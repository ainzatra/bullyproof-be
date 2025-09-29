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
    Put,
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { ReportService } from './report.service';
import {
    FileFieldsInterceptor,
    FilesInterceptor,
} from '@nestjs/platform-express';
import { CreateReportDto } from './dto/create-report.dto';
import { memoryStorage } from 'multer';
import { ReportDocumentDto } from './dto/report-document.dto';

@UseGuards(AuthGuard)
@Controller('reports')
export class ReportController {
    constructor(private readonly service: ReportService) {}

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

    @Get('dashboard')
    async fetchDashboardNumbers() {
        return this.service.fetchDashboardNumbers();
    }

    @Post('update/:id')
    @UseInterceptors(
        FileFieldsInterceptor(
            [
                { name: 'brngy', maxCount: 5 },
                { name: 'dswd', maxCount: 5 },
                { name: 'committee', maxCount: 5 },
                { name: 'council', maxCount: 1 },
            ],
            { storage: memoryStorage() },
        ),
    )
    async updateReport(
        @UploadedFiles()
        files,
        @Param('id') id: string,
        @Body()
        body: {
            notes: string;
        },
    ) {
        console.log('updare report', files);
        return this.service.updateReport(id, body.notes, files);
    }

    @Put('update-status/:id')
    async updateReportStatus(@Param('id') id: string) {
        return this.service.updateReportStatus(id);
    }

    @Get('for-review')
    async findForReview(@Query('filter') filter) {
        return this.service.findForReview();
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
