import {
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
    MessageBody,
    ConnectedSocket,
} from '@nestjs/websockets';
import { Socket, Server } from 'socket.io';
import {
    Injectable,
    InternalServerErrorException,
    Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { ChatService } from './chat.service';
import { LlmService } from '../llm/llm.service';

type JwtPayload = {
    sub?: string;
    role?: string;
    username?: string;
    [k: string]: any;
};

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/chat' })
@Injectable()
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ChatGateway.name);

    constructor(
        private readonly jwtService: JwtService,
        private readonly prisma: PrismaService,
        private readonly service: ChatService,
        private readonly llm: LlmService,
    ) {}

    @WebSocketServer() server: Server;

    /**
     * Authenticate socket on connection.
     * Accepts token in one of:
     * - socket.handshake.auth.token
     * - socket.handshake.headers.authorization (Bearer ...)
     * - socket.handshake.query.token
     *
     * After decoding token we attach `socket.data.user = { id, role }`.
     * If user is a student we automatically join them to room `student:{id}`.
     */
    async handleConnection(client: Socket) {
        try {
            const token =
                // preferred: client sends in auth payload
                client.handshake.auth?.token ||
                // fallback: Authorization header
                (client.handshake.headers?.authorization
                    ? String(client.handshake.headers.authorization).split(
                          ' ',
                      )[1]
                    : undefined) ||
                // fallback: query param
                client.handshake.query?.token;

            if (!token) {
                this.logger.warn(`Socket connection rejected: missing token`);
                client.disconnect(true);
                return;
            }
            this.logger.log(token);

            // Using decode like the HTTP interceptor does (doesn't verify signature)
            const payload = (this.jwtService.decode(token) || {}) as JwtPayload;
            const userId = (payload.sub as string) || (payload.id as string);
            let role = payload.role;
            const name = payload.name;

            // If token doesn't contain role, determine it by querying the database.
            // Students are stored in `User`, admins/guidance are stored in `Guidance`.
            if (!role) {
                try {
                    const [userRecord, guidanceRecord] = await Promise.all([
                        this.prisma.user.findUnique({ where: { id: userId } }),
                        this.prisma.guidance.findUnique({
                            where: { id: userId },
                        }),
                    ]);
                    if (guidanceRecord) {
                        role = 'guidance';
                    } else if (userRecord) {
                        role = 'student';
                    }
                } catch (e) {
                    this.logger.error(
                        'Error while resolving role from DB',
                        e as any,
                    );
                }
            }
            this.logger.log({ payload });

            if (!userId || !role) {
                this.logger.warn(
                    `Socket connection rejected: invalid token payload`,
                );
                client.disconnect(true);
                return;
            }

            // Attach user info for later event handlers
            client.data.user = { id: userId, role, token, name };

            // If student, auto-join their student room
            if (role === 'student' || role === 'user') {
                const room = this.studentRoom(userId);
                client.join(room);
                this.logger.log(
                    `Student ${userId} connected and joined room ${room}`,
                );
            } else {
                // guidance/admin connections: join the shared admins room so admin clients don't need to join every student room
                const adminRoom = this.adminRoom();
                client.join(adminRoom);
                this.logger.log(
                    `Admin ${userId} connected (role=${role}) and joined admin room ${adminRoom}`,
                );
            }
        } catch (err) {
            this.logger.error(
                'Error during socket connection auth',
                err as any,
            );
            client.disconnect(true);
        }
    }

    async handleDisconnect(client: Socket) {
        const user = client.data?.user;
        if (user) {
            this.logger.log(
                `User disconnected: ${user.id} (role=${user.role})`,
            );
        } else {
            this.logger.log(`Unknown socket disconnected: ${client.id}`);
        }
    }

    /**
     * Admins call this to join a student's room so they can receive/send messages for that student.
     * payload: { studentId: string }
     */
    @SubscribeMessage('join')
    async handleJoin(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { studentId: string },
    ) {
        const user = client.data?.user;
        if (!user) {
            client.emit('error', { message: 'Not authenticated' });
            return;
        }

        if (!payload?.studentId) {
            client.emit('error', { message: 'studentId is required' });
            return;
        }

        // Only guidance/admin roles allowed to join other student's rooms
        if (user.role !== 'guidance' && user.role !== 'admin') {
            client.emit('error', { message: 'Forbidden' });
            return;
        }

        const room = this.studentRoom(payload.studentId);
        client.join(room);
        this.logger.log(`Admin ${user.id} joined room ${room}`);
        client.emit('joined', { room });
    }

    /**
     * Admins can leave a student's room
     * payload: { studentId: string }
     */
    @SubscribeMessage('leave')
    async handleLeave(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { studentId: string },
    ) {
        const user = client.data?.user;
        if (!user) return;
        if (!payload?.studentId) return;

        const room = this.studentRoom(payload.studentId);
        client.leave(room);
        this.logger.log(`User ${user.id} left room ${room}`);
        client.emit('left', { room });
    }

    /**
     * Generic message handler.
     * payload should include:
     * - studentId: string (the conversation/room owner student)
     * - content: string
     * - metadata?: any
     *
     * The sender is determined from the authenticated socket.
     *
     * Behavior:
     * - ensure a Conversation exists for the student (one conversation per student)
     * - create Message record
     * - if sender is guidance/admin, ensure a ConversationParticipant record exists for that guidance
     * - emit the saved message to the student's room so both student and any joined admins receive it
     */
    @SubscribeMessage('message')
    async handleMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: {
            studentId: string;
            content: string;
            metadata?: any;
        },
    ) {
        const user = client.data?.user;
        if (!user) {
            client.emit('error', { message: 'Not authenticated' });
            return;
        }
        this.logger.log('Sent a message: ', user, payload);

        const { studentId, content, metadata } = payload || {};
        if (!studentId || !content) {
            client.emit('error', {
                message: 'studentId and content are required',
            });
            return;
        }

        try {
            // Find existing conversation for this student (conversation that has a participant with userId == studentId)
            let conversation = await this.prisma.conversation.findFirst({
                where: { participants: { some: { userId: studentId } } },
            });

            if (!conversation) {
                // create conversation and participant for the student
                conversation = await this.prisma.conversation.create({
                    data: {
                        title: null,
                        participants: {
                            create: [
                                {
                                    userId: studentId,
                                    role: 'student',
                                    userName: user.name,
                                },
                            ],
                        },
                    },
                });
                this.logger.log(
                    `Created conversation ${conversation.id} for student ${studentId}`,
                );
            }

            // If sender is guidance/admin, ensure a participant exists for them
            if (user.role === 'guidance' || user.role === 'admin') {
                const guidanceParticipant =
                    await this.prisma.conversationParticipant.findFirst({
                        where: {
                            conversationId: conversation.id,
                            guidanceId: user.id,
                        },
                    });
                if (!guidanceParticipant) {
                    await this.prisma.conversationParticipant.create({
                        data: {
                            conversationId: conversation.id,
                            guidanceId: user.id,
                            guidanceName: user.name,
                            role: user.role,
                        },
                    });
                }
            }

            // Persist the message
            const message = await this.prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderType: user.role,
                    senderId: user.id,
                    senderName: user.name,
                    content,
                    metadata: metadata ?? undefined,
                },
            });

            const room = this.studentRoom(studentId);

            // Emit the new message to the student's room so student and admins in that room receive it
            this.server.to(room).emit('message', {
                id: message.id,
                conversationId: conversation.id,
                senderType: message.senderType,
                senderId: message.senderId,
                content: message.content,
                metadata: message.metadata,
                createdAt: message.createdAt,
            });

            this.logger.log('Sender type:', message.senderType);
            // Additionally, if the sender was a student, emit a summary to the shared admins room
            if (message.senderType === 'student') {
                this.server.to(this.adminRoom()).emit('student-message', {
                    studentId,
                    id: message.id,
                    conversationId: conversation.id,
                    content: message.content,
                    metadata: message.metadata,
                    createdAt: message.createdAt,
                });
            }

            // Acknowledge sender with saved message
            client.emit('sent', {
                id: message.id,
                conversationId: conversation.id,
            });
            console.log('Generating AI Response...');
            const reply = await this.generateAiResponse(payload);

            if (reply) {
                console.log('Sending the AI Response...');
                await this.sendAiResponse(reply, user);
                console.log('AI Response has been sent...');
            }
        } catch (err) {
            this.logger.error('Error saving message', err as any);
            client.emit('error', { message: 'Internal server error' });
        }
    }

    /**
     * Admins send messages to a student's room without joining it individually.
     * payload: { studentId: string; content: string; metadata?: any }
     */
    @SubscribeMessage('admin-message')
    async handleAdminMessage(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: {
            studentId: string;
            content: string;
            metadata?: any;
        },
    ) {
        const user = client.data?.user;
        if (!user) {
            client.emit('error', { message: 'Not authenticated' });
            return;
        }
        if (user.role !== 'guidance' && user.role !== 'admin') {
            client.emit('error', { message: 'Forbidden' });
            return;
        }
        const { studentId, content, metadata } = payload || {};
        if (!studentId || !content) {
            client.emit('error', {
                message: 'studentId and content are required',
            });
            return;
        }

        try {
            // Find existing conversation for this student (conversation that has a participant with userId == studentId)
            let conversation = await this.prisma.conversation.findFirst({
                where: { participants: { some: { userId: studentId } } },
            });

            if (!conversation) {
                // create conversation and participant for the student
                conversation = await this.prisma.conversation.create({
                    data: {
                        title: null,
                        participants: {
                            create: [
                                {
                                    userId: studentId,
                                    role: 'student',
                                },
                            ],
                        },
                    },
                });
                this.logger.log(
                    `Created conversation ${conversation.id} for student ${studentId}`,
                );
            }

            // If sender is guidance/admin, ensure a participant exists for them
            const guidanceParticipant =
                await this.prisma.conversationParticipant.findFirst({
                    where: {
                        conversationId: conversation.id,
                        guidanceId: user.id,
                    },
                });
            if (!guidanceParticipant) {
                await this.prisma.conversationParticipant.create({
                    data: {
                        conversationId: conversation.id,
                        guidanceId: user.id,
                        role: user.role,
                    },
                });
            }

            // Persist the message
            const message = await this.prisma.message.create({
                data: {
                    conversationId: conversation.id,
                    senderType: user.role,
                    senderId: user.id,
                    senderName: user.name,
                    content,
                    metadata: metadata ?? undefined,
                },
            });

            const room = this.studentRoom(studentId);

            // Emit the new message to the student's room so student and admins in that room receive it
            this.server.to(room).emit('message', {
                id: message.id,
                conversationId: conversation.id,
                senderType: message.senderType,
                senderId: message.senderId,
                content: message.content,
                metadata: message.metadata,
                createdAt: message.createdAt,
            });

            // Also emit to admins room so admin UIs can update centralized list
            client.to(this.adminRoom()).emit('admin-sent', {
                studentId,
                id: message.id,
                conversationId: conversation.id,
                content: message.content,
                metadata: message.metadata,
                createdAt: message.createdAt,
            });

            // Acknowledge sender with saved message
            client.emit('sent', {
                id: message.id,
                conversationId: conversation.id,
            });
        } catch (err) {
            this.logger.error('Error saving admin message', err as any);
            client.emit('error', { message: 'Internal server error' });
        }
    }

    private adminRoom() {
        return `admins`;
    }

    private studentRoom(studentId: string) {
        return `student:${studentId}`;
    }

    private async isAdminOnline() {
        console.log('Checking for any online admins...');
        const sockets = await this.server.in(this.adminRoom()).fetchSockets();
        const isOnline = sockets.length > 0;
        console.log('Is there an online admin?', isOnline);
        return isOnline;
    }

    private async generateAiResponse(payload) {
        const context = await this.service.getMessages(payload.studentId, 10);
        const message = payload.content;

        const reply = await this.llm.generateReply({
            message,
            context: JSON.stringify(context),
        });

        console.log('AI Reply', reply);
        return reply;
    }

    private async sendAiResponse(reply: string, user) {
        // Persist the message
        const conversation = await this.prisma.conversation.findFirst({
            where: { participants: { some: { userId: user.id } } },
        });

        if (!conversation) throw new InternalServerErrorException();
        const message = await this.prisma.message.create({
            data: {
                conversationId: conversation.id,
                senderType: 'ai',
                senderId: null,
                senderName: 'AI',
                content: reply,
                // metadata: metadata ?? undefined,
            },
        });

        const room = this.studentRoom(user.id);

        // Emit the new message to the student's room so student and admins in that room receive it
        this.server.to(room).emit('message', {
            id: message.id,
            conversationId: conversation.id,
            senderType: message.senderType,
            senderId: message.senderId,
            content: message.content,
            metadata: message.metadata,
            createdAt: message.createdAt,
        });

        // Also emit to admins room so admin UIs can update centralized list
        this.server.to(this.adminRoom()).emit('admin-sent', {
            studentId: user.id,
            id: message.id,
            conversationId: conversation.id,
            content: message.content,
            metadata: message.metadata,
            createdAt: message.createdAt,
        });

        // Acknowledge sender with saved message
        this.server.emit('sent', {
            id: message.id,
            conversationId: conversation.id,
        });
    }
}
