import { Injectable, Inject, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ENHANCED_PRISMA } from '@zenstackhq/server/nestjs';
import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import bcrypt from 'bcrypt'
import { ClsService } from 'nestjs-cls';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
      private readonly cls: ClsService,
      private readonly prisma: PrismaService) {}

  async create(body: CreateUserDto): Promise<User> {
      if (body.password && body.confirm_password && body.password !== body.confirm_password) {
        throw new HttpException('Passwords do not match', HttpStatus.BAD_REQUEST)
      }
  
      const saltRounds = 10
      const hashedPassword = await bcrypt.hash(body.password, saltRounds)
  
      const data: any = {
        name: body.name,
        email: body.email,
        password: hashedPassword,
        birthday: body.birthday,
        gender: body.gender,
        grade: body.grade,
        section: body.section,
        guardian: {
          create: {
            name: body.guardian?.name,
            email: body.guardian?.email,
            phone: body.guardian?.phone,
            relationship: body.guardian?.relationship ?? '',
            address: body.guardian?.address,
          },
        },
      }
  
      try {
        return await this.prisma.user.create({ data })
      } catch (error: any) {
        // Handle unique constraint violation (duplicate email)
        if (error?.code === 'P2002') {
          throw new HttpException('User with that email already exists', HttpStatus.CONFLICT)
        }
        throw error
      }
    }

  async findAll(): Promise<User[]> {
    return this.prisma.user.findMany()
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });
  }

}