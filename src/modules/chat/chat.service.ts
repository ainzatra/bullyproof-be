import { Injectable, NotFoundException } from '@nestjs/common';
import { Guidance, User } from '@prisma/client';
import { PrismaService } from 'src/modules/prisma/prisma.service';

@Injectable()
export class ChatService {
    constructor(private readonly prisma: PrismaService) {}

    async getMessages(id: string, limit = 100) {
        const user = await this.prisma.user.findUnique({ where: { id } });

        if (!user) throw new NotFoundException('User not found');

        const conversation = await this.prisma.conversation.findFirst({
            where: { participants: { some: { userId: id } } },
        });

        if (!conversation)
            throw new NotFoundException('Conversation not found');

        const messages = await this.prisma.message.findMany({
            where: {
                conversationId: conversation.id,
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: limit,
        });

        // console.log(`User ${user.name} messages:`, messages);
        return messages;
    }

    async getAllConversations() {
        return this.prisma.conversation.findMany({
            include: {
                participants: {
                    where: {
                        role: 'student',
                    },
                    include: {
                        student: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatar: true,
                            },
                        },
                    },
                },
                messages: {
                    orderBy: {
                        createdAt: 'desc',
                    },
                    take: 1,
                },
            },
            orderBy: {
                updatedAt: 'desc',
            },
        });
    }
}
