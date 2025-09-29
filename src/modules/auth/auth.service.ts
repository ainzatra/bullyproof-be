import {
    BadRequestException,
    HttpException,
    HttpStatus,
    Injectable,
    NotFoundException,
    UnauthorizedException,
} from '@nestjs/common';
import { LoginAuthDto } from './dto/login-auth.dto';
import * as bcrypt from 'bcrypt';
import { Guidance, User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { ClsService } from 'nestjs-cls';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { EmailService } from 'src/email.service';
import { PrismaService } from 'src/modules/prisma/prisma.service';

type TokenPayload = {
    id: string;
    name: string;
    email: string;
};

@Injectable()
export class AuthService {
    constructor(
        private readonly cls: ClsService,
        private readonly service: UsersService,
        private readonly jwtService: JwtService,
        private readonly email: EmailService,
        private readonly prisma: PrismaService,
    ) {}

    async login(data: LoginAuthDto) {
        const user = await this.service.findByEmail(data.email);

        if (!user) throw new UnauthorizedException('Invalid email or password');

        const isPasswordValid = await bcrypt.compare(
            data.password,
            user.password,
        );

        if (!isPasswordValid)
            throw new UnauthorizedException('Invalid email or password');

        if (!user.isVerified) {
            await this.sendOtp(user.email);

            throw new UnauthorizedException('Not verified yet');
        }

        // Check if user is blocked
        const blockedUser = await this.prisma.blockedUser.findUnique({
            where: { userId: user.id },
        });

        const token = await this.generateJWT(user);
        const userInfo = await this.service.findOne(user.id);
        console.log('Login successful: ', user.email);
        return {
            token,
            id: user.id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified,
            avatar: user.avatar,
            blocked: !!blockedUser,
        };
    }

    async loginWeb(data: LoginAuthDto) {
        const user = await this.prisma.guidance.findUnique({
            where: {
                email: data.email,
            },
        });

        if (!user) throw new UnauthorizedException('Invalid email or password');

        const isPasswordValid = await bcrypt.compare(
            data.password,
            user.password,
        );

        if (!isPasswordValid)
            throw new UnauthorizedException('Invalid email or password');

        const token = await this.generateJWT(user);
        console.log('Guidance login successfull:', user.email);
        return { token, id: user.id, name: user.name, email: user.email };
    }

    async signup(data: CreateUserDto) {
        const user = await this.service.create(data);

        if (!user) {
            throw new UnauthorizedException('Could not create user');
        }
        console.log('Success creating user:', user.id);
        const token = await this.generateJWT(user);
        const userInfo = await this.service.findOne(user.id);

        await this.sendOtp(user.email);

        return {
            token,
            id: user.id,
            name: user.name,
            email: user.email,
            isVerified: user.isVerified,
            avatar: user.avatar,
        };
    }

    async verifyOtp(email: string, code: string) {
        const user = await this.service.findByEmail(email);

        if (!user) throw new UnauthorizedException('User not found');

        if (user.otp !== code) throw new BadRequestException('Invalid code');

        await this.service.verifyUser(user.id);

        const token = await this.generateJWT(user);

        return {
            token,
            id: user.id,
            name: user.name,
            email: user.email,
            isVerified: true,
            avatar: user.avatar,
        };
    }

    async generateJWT(user: {
        id: string;
        email: string;
        name: string;
    }): Promise<string> {
        const tokenPayload = {
            id: user.id,
            email: user.email,
            name: user.name,
        };

        const token = await this.jwtService.signAsync(tokenPayload);

        return token;
    }

    async verifyJwtToken(token: string): Promise<TokenPayload | null> {
        const result = (await this.jwtService.decode(
            token,
        )) as TokenPayload | null;
        return result;
    }

    async refresh(): Promise<TokenPayload & { token: string }> {
        const auth = this.cls.get('auth');
        if (!auth || !auth.token) {
            throw new UnauthorizedException('Invalid Token');
        }

        const result = await this.verifyJwtToken(auth.token);

        if (!result) {
            console.log('expired token');
            throw new UnauthorizedException('Invalid Token');
        }

        const user = await this.prisma.guidance.findUnique({
            where: {
                id: result.id,
            },
        });

        if (!user) {
            throw new NotFoundException();
        }

        return {
            id: user.id,
            name: user.name,
            email: user.email,
            token: auth.token,
        };
    }

    async sendOtp(email: string) {
        const code = await this.email.sendVerification(email);
        console.log('Sending otp code of ', code, ' to ', email);
        await this.service.setOtp(code, email);
        console.log('Otp email sent');
    }

    async createGuidance(data) {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);
        data.password = hashedPassword;
        return this.prisma.guidance.create({ data });
    }

    async sendResetOtp(email: string) {
        const user = await this.service.findByEmail(email);
        if (!user) throw new NotFoundException('User not found');
        const code = await this.email.sendVerification(email);
        await this.service.setOtp(code, email);
        return { message: 'Reset OTP sent' };
    }

    async verifyResetOtp(email: string, code: string) {
        const user = await this.service.findByEmail(email);
        if (!user) throw new NotFoundException('User not found');

        if (user.otp !== code) throw new BadRequestException('Invalid code');

        // Keep the OTP so it can still be used by the reset-password endpoint
        return { message: 'OTP verified' };
    }

    async resetPassword(
        email: string,
        code: string,
        newPassword: string,
        confirm: string,
    ) {
        const user = await this.service.findByEmail(email);
        if (!user) throw new NotFoundException('User not found');

        if (user.otp !== code) throw new BadRequestException('Invalid code');

        if (newPassword !== confirm)
            throw new BadRequestException('Password do not match');

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        await this.prisma.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                otp: null,
            },
        });

        return { message: 'Password updated successfully' };
    }

    // Guidance-specific reset endpoints (use guidance model)
    async sendGuidanceResetOtp(email: string) {
        const guidance = await this.prisma.guidance.findUnique({
            where: { email },
        });
        if (!guidance) throw new NotFoundException('Guidance not found');
        const code = await this.email.sendVerification(email);
        await this.prisma.guidance.update({
            where: { email },
            data: { otp: code },
        });
        return { message: 'Reset OTP sent' };
    }

    async verifyGuidanceResetOtp(email: string, code: string) {
        const guidance = await this.prisma.guidance.findUnique({
            where: { email },
        });
        if (!guidance) throw new NotFoundException('Guidance not found');

        if (guidance.otp !== code)
            throw new BadRequestException('Invalid code');

        // Keep the OTP so it can still be used by the reset-password endpoint
        return { message: 'OTP verified' };
    }

    async resetGuidancePassword(
        email: string,
        code: string,
        newPassword: string,
        confirm: string,
    ) {
        const guidance = await this.prisma.guidance.findUnique({
            where: { email },
        });
        if (!guidance) throw new NotFoundException('Guidance not found');

        if (guidance.otp !== code)
            throw new BadRequestException('Invalid code');

        if (newPassword !== confirm)
            throw new BadRequestException('Password do not match');

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

        await this.prisma.guidance.update({
            where: { email },
            data: {
                password: hashedPassword,
                otp: null,
            },
        });

        return { message: 'Password updated successfully' };
    }

    private generateCode(): string {
        // Generate a 6-digit numeric code (100000 - 999999)
        return Math.floor(100000 + Math.random() * 900000).toString();
    }
}
