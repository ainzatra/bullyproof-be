import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { AuthGuard } from './guard/auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly service: AuthService) {}

  @Post('login')
  async login(@Body() data: LoginAuthDto, @Query('type') type?: string) {
    if(type && type === 'web') {
      return this.service.loginWeb(data)
    }
    return this.service.login(data);
  }

  @Post('signup')
  async signup(@Body() data: CreateUserDto) {
    return this.service.signup(data);
  }

  @UseGuards(AuthGuard)
  @Get('me')
  async refresh() {
    return this.service.refresh()
  }

  @Post('verify-otp')
  async verifyOtp(@Body() body) {
    return this.service.verifyOtp(body.email, body.code)
  }

  @Post('resend-otp')
  async resendOtp(@Body() body) {
    return this.service.sendOtp(body.email)
  }

  @Post('create-guidance')
  async createGuidance(@Body() body) {
    return this.service.createGuidance(body)
  }
}
