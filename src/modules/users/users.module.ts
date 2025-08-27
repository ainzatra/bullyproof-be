import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { ZenstackModule } from 'src/zenstack.module';
import { ZenStackModule } from '@zenstackhq/server/nestjs';
import { PrismaService } from 'src/prisma.service';

@Module({
  providers: [UsersService, PrismaService],
  controllers: [UsersController]
})
export class UsersModule {}
