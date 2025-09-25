import { Module, Global } from '@nestjs/common';
import { enhance } from '@zenstackhq/runtime';
import { ZenStackModule, ENHANCED_PRISMA } from '@zenstackhq/server/nestjs';
import { ClsService } from 'nestjs-cls';
import { PrismaService } from './modules/prisma/prisma.service';

@Global() // optional: makes ENHANCED_PRISMA available globally
@Module({
    imports: [
        ZenStackModule.registerAsync({
            useFactory: (prisma: PrismaService, cls: ClsService) => ({
                getEnhancedPrisma: () =>
                    enhance(prisma, { user: cls.get('auth') }),
            }),
            inject: [PrismaService, ClsService],
            extraProviders: [PrismaService],
        }),
    ],
    exports: [ZenStackModule],
})
export class ZenstackModule {}
