import { Module } from '@nestjs/common';
import { ReportService } from './report.service';
import { ReportController } from './report.controller';
import { S3Service } from '../s3.service';
import { LlmService } from '../llm/llm.service';
import { AireportService } from '../aireport/aireport.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    providers: [ReportService, S3Service, LlmService, AireportService],
    controllers: [ReportController],
})
export class ReportModule {}
