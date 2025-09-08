import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { randomUUID } from 'crypto';
import { S3Service } from '../s3.service';
import { buffer } from 'stream/consumers';
import { ReportStatus } from '@prisma/client';
 
@Injectable()
export class ReportService {
    constructor (
        private readonly prisma: PrismaService,
        private readonly s3: S3Service,
    ) {}

    async findForReview() {
        return this.prisma.report.findMany({
            where: {
                NOT: {
                    status: ReportStatus.Resolved
                }
            },
            include: {
                ai_flag: true,
                evidences: true,
                student: true
            }
        })
    }
    async fetchUserReports(userId: string) {
        console.log('Fetching report of user:', userId)
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId
            }
        })

        if (!user) {
            console.log('User not found')
            throw new NotFoundException()
        }

        const reports = await this.prisma.report.findMany({
            where: {
                studentId: userId
            }
        })

        return reports
    }
 
    async createReport(data: CreateReportDto, files: any) {
        // Create report first to get id
        console.log('Creating report...')
        const report = await this.prisma.report.create({ data: {
            studentId: data.studentId,
            feelings: data.feelings,
            details: data.details,
            status: 'Pending'
        } });
 
        if (!report) throw new BadRequestException('Failed to submit report');
 
        const uploadedUrls: string[] = [];
        const prefix = `reports/${report.id}/`;
 
        if (files && files.length) {
            try {
                for (const file of files) {
                    console.log('Uploading to S3',{file})
                    const key = `${prefix}${Date.now()}-${(file.originalname || 'upload').replace(/\s+/g, '_')}`;
                    const url = await this.s3.upload(file, key);
                    uploadedUrls.push(url);
                }
            } catch (error) {
                // Attempt cleanup: delete uploaded S3 objects under the report folder and remove the report record
                try {
                    await this.s3.deleteFolder(prefix);
                } catch (s3Err) {
                    console.error('Failed to delete S3 folder during cleanup:', s3Err);
                }
 
                try {
                    await this.prisma.report.delete({ where: { id: report.id }});
                } catch (dbErr) {
                    console.error('Failed to delete report during cleanup:', dbErr);
                }
 
                throw new BadRequestException('Failed to upload evidence files');
            }
        }
        console.log('Uploaded URLs', uploadedUrls)
        console.log('Saving urls to report evidence records...')
        // If uploads succeeded, create evidence records
        if (uploadedUrls.length) {
            try {
                for (const url of uploadedUrls) {
                    await this.prisma.reportEvidence.create({
                        data: {
                            reportId: report.id,
                            url
                        }
                    })
                }
            } catch (error) {
                // If saving evidences failed, cleanup S3 and report
                try {
                    await this.s3.deleteFolder(prefix);
                } catch (s3Err) {
                    console.error('Failed to delete S3 folder during evidence-save cleanup:', s3Err);
                }
 
                try {
                    await this.prisma.report.delete({ where: { id: report.id }});
                } catch (dbErr) {
                    console.error('Failed to delete report during evidence-save cleanup:', dbErr);
                }
 
                throw new BadRequestException('Failed to save evidence records');
            }
        }
 
        console.log('Finished creating report')
        // Return the report including evidences
        return this.prisma.report.findUnique({
            where: { id: report.id }
        });
    }
}
