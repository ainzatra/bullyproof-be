import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { AuthGuard } from '../auth/guard/auth.guard';

@UseGuards(AuthGuard)
@Controller('notification')
export class NotificationController {
    constructor(private readonly service: NotificationService) {}

    @Post('register-token')
    async registerToken(@Body() body: { token; userId; deviceId; platform }) {
        return this.service.registerToken(body);
    }

    @Post('unregister-token')
    async unregisterToken(@Body('token') token: string) {
        return this.service.unregisterToken(token);
    }
}
