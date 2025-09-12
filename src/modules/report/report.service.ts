import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';
import { randomUUID } from 'crypto';
import { S3Service } from '../s3.service';
import { buffer } from 'stream/consumers';
import { AiReport, ReportStatus } from '@prisma/client';
import { LlmService } from '../llm/llm.service';
import { AireportService } from '../aireport/aireport.service';
import { ReportDocumentDto } from './dto/report-document.dto';

@Injectable()
export class ReportService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly s3: S3Service,
        private readonly llm: LlmService,
        private readonly ai: AireportService,
    ) {}

    async findForReview() {
        return this.prisma.report.findMany({
            include: {
                ai_flag: {
                    select: {
                        urgency: true,
                    },
                },
                student: {
                    select: {
                        name: true,
                        email: true,
                        grade: true,
                        section: true,
                    },
                },
            },
        });
    }

    async fetchUserReports(userId: string) {
        console.log('Fetching report of user:', userId);
        const user = await this.prisma.user.findUnique({
            where: {
                id: userId,
            },
        });

        if (!user) {
            console.log('User not found');
            throw new NotFoundException();
        }

        const reports = await this.prisma.report.findMany({
            where: {
                studentId: userId,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        return reports;
    }

    async fetchReportById(id: string) {
        return this.prisma.report.findUnique({
            where: { id },
            include: {
                ai_flag: true,
                evidences: true,
                documents: true,
                student: {
                    select: {
                        name: true,
                        email: true,
                        grade: true,
                        section: true,
                        guardian: true,
                    },
                },
            },
        });
    }

    async updateReportStatus(id: string) {
        const report = await this.prisma.report.findUnique({
            where: { id },
        });

        if (!report) throw new NotFoundException();

        let newStatus: ReportStatus = 'Pending';

        if (report.status === 'Pending') newStatus = 'InProgress';

        if (report.status === 'InProgress') newStatus = 'Resolved';

        return this.prisma.report.update({
            where: { id },
            data: {
                status: newStatus,
            },
        });
    }

    async createReport(data: CreateReportDto, files: any) {
        // Create report first to get id
        console.log('Creating report...');
        const report = await this.prisma.report.create({
            data: {
                studentId: data.studentId,
                feelings: data.feelings,
                details: data.details,
                status: 'Pending',
            },
        });

        if (!report) throw new BadRequestException('Failed to submit report');

        const uploadedUrls: string[] = [];
        const prefix = `reports/${report.id}/`;

        if (files && files.length) {
            try {
                for (const file of files) {
                    console.log('Uploading to S3', { file });
                    const key = `${prefix}${Date.now()}-${(file.originalname || 'upload').replace(/\s+/g, '_')}`;
                    const url = await this.s3.upload(file, key);
                    uploadedUrls.push(url);
                }
            } catch (error) {
                // Attempt cleanup: delete uploaded S3 objects under the report folder and remove the report record
                try {
                    await this.s3.deleteFolder(prefix);
                } catch (s3Err) {
                    console.error(
                        'Failed to delete S3 folder during cleanup:',
                        s3Err,
                    );
                }

                try {
                    await this.prisma.report.delete({
                        where: { id: report.id },
                    });
                } catch (dbErr) {
                    console.error(
                        'Failed to delete report during cleanup:',
                        dbErr,
                    );
                }

                throw new BadRequestException(
                    'Failed to upload evidence files',
                );
            }
        }
        console.log('Uploaded URLs', uploadedUrls);
        console.log('Saving urls to report evidence records...');
        // If uploads succeeded, create evidence records
        if (uploadedUrls.length) {
            try {
                for (const url of uploadedUrls) {
                    await this.prisma.reportEvidence.create({
                        data: {
                            reportId: report.id,
                            url,
                        },
                    });
                }
            } catch (error) {
                // If saving evidences failed, cleanup S3 and report
                try {
                    await this.s3.deleteFolder(prefix);
                } catch (s3Err) {
                    console.error(
                        'Failed to delete S3 folder during evidence-save cleanup:',
                        s3Err,
                    );
                }

                try {
                    await this.prisma.report.delete({
                        where: { id: report.id },
                    });
                } catch (dbErr) {
                    console.error(
                        'Failed to delete report during evidence-save cleanup:',
                        dbErr,
                    );
                }

                throw new BadRequestException(
                    'Failed to save evidence records',
                );
            }
        }

        console.log('Finished creating report');
        console.log('Send reort to AI');
        const aiReport = await this.llm.analyzeReport({
            details: data.details,
            feelings: data.feelings,
            files: uploadedUrls,
        });

        // Save AI Report
        await this.ai.createReport(report.id, aiReport);

        // Return the report including evidences
        return this.prisma.report.findUnique({
            where: { id: report.id },
        });
    }

    async updateReport(id, notes, files: ReportDocumentDto) {
        const report = await this.prisma.report.findUnique({
            where: { id },
        });

        if (!report) throw new NotFoundException();

        // Update report notes
        if (notes) {
            await this.prisma.report.update({
                where: { id },
                data: {
                    notes,
                },
            });
        }

        // Upload report documents (supports multiple document types)
        if (files) {
            const prefixBase = `reports/${report.id}/documents/`;
            const uploadedUrls: string[] = [];

            try {
                // list of allowed document types matching Prisma enum names
                const docTypes = ['brngy', 'dswd', 'committee', 'council'];

                for (const type of docTypes) {
                    const fileList: Express.Multer.File[] = files[type];
                    if (!fileList || !fileList.length) continue;

                    for (const file of fileList) {
                        const key = `${prefixBase}${type}/${Date.now()}-${(file.originalname || 'upload').replace(/\s+/g, '_')}`;
                        const url = await this.s3.upload(file, key);
                        uploadedUrls.push(url);

                        // create ReportDocument record with the document type
                        await this.prisma.reportDocument.create({
                            data: {
                                report_id: report.id,
                                url,
                                type: type as any,
                            },
                        });
                    }
                }
            } catch (error) {
                console.error('Failed to upload/save report documents:', error);

                // Attempt cleanup of uploaded files for this report's documents folder
                try {
                    await this.s3.deleteFolder(
                        `reports/${report.id}/documents/`,
                    );
                } catch (s3Err) {
                    console.error(
                        'Failed to delete S3 folder during document-upload cleanup:',
                        s3Err,
                    );
                }

                throw new BadRequestException(
                    'Failed to upload report documents',
                );
            }
        }

        // return the updated report (including documents)
        return this.prisma.report.findUnique({
            where: { id },
            include: {
                documents: true,
            },
        });
    }

    async fetchDashboardNumbers() {
        const total = await this.prisma.report.count();

        const status = await this.prisma.report.groupBy({
            by: ['status'],
            _count: true,
        });

        const urgency = await this.prisma.aiReport.groupBy({
            by: ['urgency'],
            _count: true,
        });

        const recent = await this.prisma.report.findMany({
            orderBy: {
                createdAt: 'desc',
            },
            take: 3,
            select: {
                id: true,
                status: true,
                details: true,
                ai_flag: {
                    select: {
                        urgency: true,
                    },
                },
                student: {
                    select: {
                        name: true,
                    },
                },
            },
        });

        // Compute last 12 months (including current month) using local time to match user expectations,
        // and fetch reports within that local range
        const now = new Date();
        // start from the first day of the month 11 months ago (local)
        const startOfWindow = new Date(
            now.getFullYear(),
            now.getMonth() - 11,
            1,
            0,
            0,
            0,
            0,
        );
        const endOfWindow = now; // include up to current moment

        const reportDates = await this.prisma.report.findMany({
            where: {
                createdAt: {
                    gte: startOfWindow,
                    lte: endOfWindow,
                },
            },
            select: {
                createdAt: true,
            },
            orderBy: {
                createdAt: 'desc',
            },
        });

        // Build the list of month keys (YYYY-MM) for the last 12 months (newest first) using local time
        const months: string[] = [];
        for (let i = 0; i < 12; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            months.push(monthStr);
        }

        // Initialize map with zero counts for each month in the window
        const perMonthMap = new Map<string, number>();
        for (const monthKey of months) {
            perMonthMap.set(monthKey, 0);
        }

        // Count reports into the map using local month/year from the createdAt timestamp
        for (const r of reportDates) {
            const created = r.createdAt;
            if (!created) continue;
            const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
            if (!perMonthMap.has(monthKey)) {
                // report falls outside the 12-month window (defensive), skip
                continue;
            }
            perMonthMap.set(monthKey, (perMonthMap.get(monthKey) || 0) + 1);
        }

        // Preserve newest-first order from months array
        const monthly = months.map((month) => ({
            month,
            count: perMonthMap.get(month) || 0,
        }));

        return { total, status, urgency, recent, monthly };
    }
}
