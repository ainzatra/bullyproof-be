import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { PrismaService } from 'src/prisma.service';
import { S3Service } from '../s3.service';

@Module({
  providers: [ReportService, PrismaService, S3Service],
  controllers: [ReportController]
})
export class ReportModule {}
