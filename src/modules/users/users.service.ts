import {
    Injectable,
    Inject,
    HttpException,
    HttpStatus,
    UnauthorizedException,
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { ENHANCED_PRISMA } from '@zenstackhq/server/nestjs';
import { Prisma, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';
import bcrypt from 'bcrypt';
import { ClsService } from 'nestjs-cls';
import { CreateUserDto } from './dto/create-user.dto';
import { UserGuardianDto } from './dto/user-guardian.dto';
import { UpdateGuidanceDto } from './dto/update-guidance.dto';
import { UpdatePasswordDto } from './dto/update-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { randomUUID } from 'crypto';
import { S3Service } from '../s3.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly cls: ClsService,
        private readonly prisma: PrismaService,
        private readonly s3: S3Service,
    ) {}

    async create(body: CreateUserDto): Promise<User> {
        if (
            body.password &&
            body.confirm_password &&
            body.password !== body.confirm_password
        ) {
            throw new HttpException(
                'Passwords do not match',
                HttpStatus.BAD_REQUEST,
            );
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(body.password, saltRounds);

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
        };

        try {
            return await this.prisma.user.create({ data });
        } catch (error: any) {
            // Handle unique constraint violation (duplicate email)
            if (error?.code === 'P2002') {
                throw new HttpException(
                    'User with that email already exists',
                    HttpStatus.CONFLICT,
                );
            }
            throw error;
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
                otp: true,
            },
        });
        return data;
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
            omit: {
                password: true,
            },
        });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }
        return user;
    }

    async setOtp(code: string, email: string) {
        return await this.prisma.user.update({
            where: { email },
            data: {
                otp: code,
            },
        });
    }

    async verifyUser(id: string) {
        return await this.prisma.user.update({
            where: { id },
            data: {
                isVerified: true,
            },
        });
    }

    async updateGuidance(id: string, data: UpdateGuidanceDto) {
        const guidance = await this.prisma.guidance.findUnique({
            where: {
                id,
            },
        });

        if (!guidance) throw new NotFoundException();

        return this.prisma.guidance.update({
            where: { id },
            data,
        });
    }

    async updateGuidancePassword(id: string, data: UpdatePasswordDto) {
        const guidance = await this.prisma.guidance.findUnique({
            where: {
                id,
            },
        });

        if (!guidance) throw new NotFoundException();

        if (data.new !== data.confirm)
            throw new BadRequestException('Password do not match');

        const isPasswordValid = await bcrypt.compare(
            data.old,
            guidance.password,
        );

        if (!isPasswordValid) throw new BadRequestException('Invalid password');

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.new, saltRounds);

        return this.prisma.guidance.update({
            where: { id },
            data: {
                password: hashedPassword,
            },
            select: {
                id: true,
                name: true,
                email: true,
            },
        });
    }

    async updateUserInfo(id: string, data: UpdateUserDto) {
        const user = await this.prisma.user.findUnique({ where: { id } });

        if (!user) throw new NotFoundException();

        return this.prisma.user.update({
            where: {
                id,
            },
            data: {
                name: data.name,
                birthday: data.birthday,
                gender: data.gender,
                grade: data.grade,
                section: data.section,
                guardian: {
                    update: {
                        name: data.guardian.name,
                        email: data.guardian.email,
                        phone: data.guardian.phone,
                        relationship: data.guardian.relationship,
                        address: data.guardian.address,
                    },
                },
            },
        });
    }

    async updatePassword(id: string, data: UpdatePasswordDto) {
        const user = await this.prisma.user.findUnique({ where: { id } });

        if (!user) throw new NotFoundException();

        const isPasswordValid = await bcrypt.compare(data.old, user.password);

        if (!isPasswordValid)
            throw new UnauthorizedException('Incorrect password');

        if (data.new !== data.confirm)
            throw new BadRequestException('Password do not match');

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.new, saltRounds);

        await this.prisma.user.update({
            where: { id },
            data: {
                password: hashedPassword,
            },
        });

        return 'Password updated successfully';
    }

    async updateUserAvatar(id: string, file: any) {
        if (!file) throw new NotFoundException('File not found');

        const user = await this.prisma.user.findUnique({ where: { id } });

        if (!user) throw new NotFoundException();

        const key = `avatars/${Date.now()}-${randomUUID()}-${(file.originalname || 'upload').replace(/\s+/g, '_')}`;
        const url = await this.s3.upload(file, key);

        if (!url) throw new BadRequestException('Image failed to upload to S3');

        await this.prisma.user.update({
            where: { id },
            data: {
                avatar: url,
            },
        });

        return { message: 'Avatar updated successfully', url };
    }
}
