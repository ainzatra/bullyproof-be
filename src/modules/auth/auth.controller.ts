import { Body, Controller, Get, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('login')
  async login(@Body() data: LoginAuthDto) {
    return this.service.login(data);
  }

  @Post('signup')
  async signup(@Body() data: CreateUserDto) {
    return this.service.signup(data);
  }

  @Get('me')
  async refresh() {
    return this.service.refresh()
  }
}
