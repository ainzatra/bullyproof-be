import { Module } from '@nestjs/common';
import { ClsModule, ClsService } from 'nestjs-cls';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AuthInterceptor } from './modules/auth/auth.interceptor';
import { PrismaService } from './prisma.service';
import { UsersModule } from './modules/users/users.module';
import { ZenstackModule } from './zenstack.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
      },
    }),
    UsersModule,
    ZenstackModule,
    AuthModule,
  ],
  controllers: [],
  providers: [
    PrismaService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuthInterceptor,
    },],
})
export class AppModule {}
