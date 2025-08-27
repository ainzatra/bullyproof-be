import {
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
  ) {}

  async login(data: LoginAuthDto) {
    const user = await this.service.findByEmail(
      data.email,
    );

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const isPasswordValid = await bcrypt.compare(
      data.password,
      user.password,
    );
    
    if (!isPasswordValid)
      throw new UnauthorizedException('Invalid email or password');
    
    const payload = await this.generateJWT(user);
    return payload;
  }
  
  async signup(data: CreateUserDto) {
    console.log('signup data', data);
    const user = await this.service.create(data);

    if(!user) {
      throw new UnauthorizedException('Could not create user');
    }
    const payload = await this.generateJWT(user);
    console.log('signup payload', payload);
    return payload;
  }
  
  async generateJWT(user: User): Promise<TokenPayload> {
    const tokenPayload = {
      sub: user.id,
      email: user.email,
      name: user.name,
    };

    const token = await this.jwtService.signAsync(tokenPayload);

    return { token, id: user.id, name: user.name, email: user.email };
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
}
