import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ZenstackModule } from 'src/zenstack.module';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './guard/auth.guard';
import { UsersModule } from 'src/modules/users/users.module';
import { UsersService } from '../users/users.service';
import { EmailService } from 'src/email.service';
import { S3Service } from '../s3.service';
import { PrismaModule } from '../prisma/prisma.module';
import { BlockedUserMiddleware } from './blocked-user.middleware';

@Module({
    providers: [
        AuthService,
        AuthGuard,
        UsersService,
        EmailService,
        S3Service,
        BlockedUserMiddleware,
    ],
    imports: [
        ZenstackModule,
        JwtModule.register({
            global: true,
            secret: process.env.JWT_SECRET,
            signOptions: { expiresIn: '30d' },
        }),
        UsersModule,
        PrismaModule,
    ],
    controllers: [AuthController],
    exports: [AuthGuard],
})
export class AuthModule implements NestModule {
    configure(consumer: MiddlewareConsumer) {
        consumer.apply(BlockedUserMiddleware).forRoutes('*'); // Apply to all routes, or specify specific routes
    }
}
