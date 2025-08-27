import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { ZenstackModule } from 'src/zenstack.module';
import { PrismaService } from 'src/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { AuthGuard } from './guard/auth.guard';
import { UsersModule } from 'src/modules/users/users.module';
import { UsersService } from '../users/users.service';

@Module({
  providers: [AuthService, PrismaService, AuthGuard, UsersService],
  imports: [
    ZenstackModule,
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
    UsersModule
  ],
  controllers: [AuthController],
  exports: [AuthGuard],
})
export class AuthModule {}
