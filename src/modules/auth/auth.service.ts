import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginAuthDto } from './dto/login-auth.dto';
import * as bcrypt from 'bcrypt';
import { User } from '@prisma/client';
import { UsersService } from '../users/users.service';
import { ClsService } from 'nestjs-cls';
import { JwtService } from '@nestjs/jwt';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { EmailService } from 'src/email.service';

type TokenPayload = {
  token: string;
  id: string;
  name: string;
  email: string
};

@Injectable()
export class AuthService {
  constructor(
    private readonly cls: ClsService,
    private readonly service: UsersService,
    private readonly jwtService: JwtService,
    private readonly email: EmailService,
  ) {}

  async login(data: LoginAuthDto) {
    const user = await this.service.findByEmail(
      data.email,
    );

    if (!user) throw new UnauthorizedException('Invalid email or password');

    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.password,
    );
    
    if (!isPasswordValid) throw new UnauthorizedException('Invalid email or password');
    
    if (!user.isVerified) {
      await this.sendOtp(user.email)

      throw new UnauthorizedException('Not verified yet')
    }

    const token = await this.generateJWT(user);
    const userInfo = await this.service.findOne(user.id);

    return {token, id: user.id, name: user.name, email: user.email, isVerified: user.isVerified} 
  }
    
  async signup(data: CreateUserDto) {
    const user = await this.service.create(data);

    if(!user) {
      throw new UnauthorizedException('Could not create user');
    }

    const token = await this.generateJWT(user);
    const userInfo = await this.service.findOne(user.id);

    await this.sendOtp(user.email)

    return {token, id: user.id, name: user.name, email: user.email, isVerified: user.isVerified} 
  }

  async verifyOtp(email: string, code: string) {
    const user = await this.service.findByEmail(email)

    if (!user) throw new UnauthorizedException('User not found')

    if (user.otp !== code) throw new BadRequestException('Invalid code')

    await this.service.verifyUser(user.id) 

    const token = await this.generateJWT(user)
    
    return {token, id: user.id, name: user.name, email: user.email, isVerified: true} 
  }
  
  async generateJWT(user: User): Promise<string> {
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const token = await this.jwtService.signAsync(tokenPayload);

    return token;
  }

  async verifyJwtToken(token: string): Promise<TokenPayload> {
    const result = await this.jwtService.decode(token);
    return result;
  }

  async refresh(): Promise<TokenPayload> {
    const auth = this.cls.get('auth')
    const result = await this.verifyJwtToken(auth.token)

    if (!result) {
      throw new UnauthorizedException('Invalid Token')
    }

    return result 
  }

  async sendOtp(email: string) {
    const code = await this.email.sendVerification(email)
    await this.service.setOtp(code, email)
  }
}
