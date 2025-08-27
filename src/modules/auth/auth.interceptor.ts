import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class AuthInterceptor implements NestInterceptor {
  constructor(
    private readonly cls: ClsService,
    private readonly jwtService: JwtService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    const request = context.switchToHttp().getRequest();
    const authorization = request.headers.authorization;
    if (authorization) {
      const token = authorization.split(' ')[1];
      if (token) {
        // decrypt token here
        const result = await this.jwtService.decode(token);
        this.cls.set('auth', { id: result.sub, role: result.role, username: result.username, token });
      }
    }

    return next.handle();
  }
}
