import {
    Body,
    Controller,
    Post,
    UseGuards,
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
    Param,
    Get,
    Query,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { ReportService } from './report.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateReportDto } from './dto/create-report.dto';
import { memoryStorage } from 'multer';

// @UseGuards(AuthGuard)
@Controller('reports')
export class ReportController {
    constructor(private readonly service: ReportService) {}

    @Get('for-review')
    async findForReview(@Query('filter') filter) {
        return this.service.findForReview();
    }

    @Post()
    @UseInterceptors(
        FilesInterceptor('evidences', 5, { storage: memoryStorage() }),
    )
    async submitReport(
        @UploadedFiles() files: any[] = [],
        @Body() body: CreateReportDto,
    ) {
        return this.service.createReport(body, files);
    }

    @Get('user/:userId')
    async getUserReports(@Param('userId') userId: string) {
        return this.service.fetchUserReports(userId);
    }

    @Get(':id')
    async getReportById(@Param('id') id: string) {
        return this.service.fetchReportById(id);
    }
}
