import { Injectable, NestMiddleware, ForbiddenException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BlockedUserMiddleware implements NestMiddleware {
    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
    ) {}

    async use(req: Request, res: Response, next: NextFunction) {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return next();
        }

        const token = authHeader.split(' ')[1];
        if (!token) {
            return next();
        }

        try {
            const payload = (await this.jwtService.verifyAsync(token)) as {
                id: string;
                email: string;
                name: string;
            };
            if (!payload || !payload.id) {
                return next();
            }

            // Check if user is blocked
            const blockedUser = await this.prisma.blockedUser.findUnique({
                where: { userId: payload.id },
            });

            if (blockedUser) {
                throw new ForbiddenException('User is blocked');
            }

            next();
        } catch (error) {
            if (error instanceof ForbiddenException) {
                throw error;
            }
            // If token is invalid, just continue (auth guard will handle it)
            next();
        }
    }
}
