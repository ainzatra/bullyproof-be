import { Injectable, Inject, HttpException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ENHANCED_PRISMA } from '@zenstackhq/server/nestjs';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import bcrypt from 'bcrypt'
import { ClsService } from 'nestjs-cls';
import { CreateUserDto } from './dto/create-user.dto';
import { UserGuardianDto } from './dto/user-guardian.dto';

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

  async findAll() {
    const data = await this.prisma.user.findMany({
      orderBy: { name: 'asc' },
      include: {
        guardian: true,
      },
      omit: {
        password: true,
        otp: true
      }
    });
    return data
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        email: email,
      },
    });
  }

  async findOne(id: string): Promise<UserGuardianDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { guardian: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    return user;
  }

  async setOtp(code: string, email: string){
    return await this.prisma.user.update({
      where: { email },
      data: {
        otp: code
      }
    })
  }

  async verifyUser(id: string) {
    return await this.prisma.user.update({
      where: { id },
      data: {
        isVerified: true
      }
    })
  }

}