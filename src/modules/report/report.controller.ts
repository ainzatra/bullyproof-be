import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Param,
  Get
} from '@nestjs/common';
import { AuthGuard } from '../auth/guard/auth.guard';
import { ReportService } from './report.service';
import { FilesInterceptor } from '@nestjs/platform-express';
import { CreateReportDto } from './dto/create-report.dto';
import { memoryStorage } from 'multer';
 
@UseGuards(AuthGuard)
@Controller('reports')
export class ReportController {
  constructor(private readonly service: ReportService) {}
  
  @Post()
  @UseInterceptors(FilesInterceptor('evidences', 5, { storage: memoryStorage() }))
  async submitReport(@UploadedFiles() files: any[] = [], @Body() body: CreateReportDto) {
    return this.service.createReport(body, files);
  }
  @Get(':userId')
  async getUserReports(@Param('userId') userId: string) {
    return this.service.fetchUserReports(userId)
  }
}
