import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from '../../email.service';

@Module({
    imports: [PrismaModule],
    providers: [NotificationService, EmailService],
    controllers: [NotificationController],
    exports: [NotificationService],
})
export class NotificationModule {}
