import { Module } from '@nestjs/common';
import { ChatGateway } from './chat.gateway';
import { PrismaService } from 'src/prisma.service';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { LlmService } from '../llm/llm.service';

@Module({
    providers: [ChatGateway, PrismaService, ChatService, LlmService],
    controllers: [ChatController],
})
export class ChatModule {}
