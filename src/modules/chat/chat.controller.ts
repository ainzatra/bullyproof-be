import { Controller, Get, Param } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
    constructor(private readonly service: ChatService) {}

    @Get(':id/messages')
    fetchMessages(@Param('id') id: string) {
        return this.service.getMessages(id);
    }
}
