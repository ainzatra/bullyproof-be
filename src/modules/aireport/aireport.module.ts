import { Module } from '@nestjs/common';
import { AireportController } from './aireport.controller';
import { AireportService } from './aireport.service';
import { PrismaService } from 'src/prisma.service';

@Module({
    controllers: [AireportController],
    providers: [AireportService, PrismaService],
})
export class AireportModule {}
