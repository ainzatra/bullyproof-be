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
import { PrismaService } from 'src/prisma.service';

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
    private readonly prisma: PrismaService,
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
    console.log('Login successful: ', user.email)
    return {token, id: user.id, name: user.name, email: user.email, isVerified: user.isVerified} 
  }

  async loginWeb(data: LoginAuthDto) {
    const user = await this.prisma.guidance.findUnique({
      where: {
        email: data.email
      }
    })

    if (!user) throw new UnauthorizedException('Invalid email or password')
    
    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.password,
    );
    
    if (!isPasswordValid) throw new UnauthorizedException('Invalid email or password');

    const token = await this.generateJWT(user)
    console.log('Guidance login successfull:', user.email)
    return {token, id: user.id, name: user.name, email: user.email} 


  }
    
  async signup(data: CreateUserDto) {
    const user = await this.service.create(data);

    if(!user) {
      throw new UnauthorizedException('Could not create user');
    }
    console.log('Success creating user:', user.id)
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
  
  async generateJWT(user: User | Guidance): Promise<string> {
    const tokenPayload = {
      id: user.id,
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
      console.log('expired token')
      throw new UnauthorizedException('Invalid Token')
    }

    const user = await this.prisma.guidance.findUnique({
      where: {
        id: result.id
      }
    })

    if(!user) {
      throw new NotFoundException
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      token: result.token
    }
  }

  async sendOtp(email: string) {
    const code = await this.email.sendVerification(email)
    console.log('Sending otp code of ', code, ' to ', email)
    await this.service.setOtp(code, email)
    console.log('Otp email sent')
  }

  async createGuidance(data) {
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(data.password, saltRounds)
    data.password = hashedPassword
    return this.prisma.guidance.create({ data })
  }
}
