import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from 'src/prisma.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';

@Module({
    providers: [ChatGateway, PrismaService, ChatService],
    controllers: [ChatController],
})
export class ChatModule {}
