import { Controller, Get, Param } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly service: ChatService) {}

    @Get('conversations')
    fetchAllConversations() {
        return this.service.getAllConversations();
    }

    @Get(':id/messages')
    fetchMessages(@Param('id') id: string) {
        return this.service.getMessages(id);
    }
}
