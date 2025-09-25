import { Module } from '@nestjs/common';
import { AireportController } from './aireport.controller';
import { AireportService } from './aireport.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [AireportController],
    providers: [AireportService],
})
export class AireportModule {}
