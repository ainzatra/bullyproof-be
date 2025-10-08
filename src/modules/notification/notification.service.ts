import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import Expo from 'expo-server-sdk';
import { ReportStatus } from '@prisma/client';
import { EmailService } from '../../email.service';

interface NotificationContent {
    title: string;
    body: string;
    data: {
        type: 'report_status_update';
        reportId: string;
        status: ReportStatus;
    };
    sound: 'default';
    channelId: string;
    groupId: string;
    summaryText: string;
    threadId: string;
}

@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);
    private expo: Expo;

    constructor(
        private readonly prisma: PrismaService,
        private readonly emailService: EmailService,
    ) {
        this.expo = new Expo();
    }

    async registerToken(data) {
        if (!Expo.isExpoPushToken(data.token))
            throw new BadRequestException('Invalid push token');

        await this.prisma.pushToken.upsert({
            where: {
                device_id: data.deviceId,
            },
            update: {
                token: data.token,
                is_active: true,
            },
            create: {
                token: data.token,
                device_id: data.deviceId,
                platform: data.platform,
                userId: data.userId,
                is_active: true,
            },
        });

        return { success: true };
    }

    async unregisterToken(token: string) {
        await this.prisma.pushToken.update({
            where: {
                token,
            },
            data: {
                is_active: false,
            },
        });
    }

    async sendReportStatusUpdate(
        reportId: string,
        userId: string,
        status: ReportStatus,
    ) {
        this.logger.log(
            `Attempting to send notification for report ${reportId}, user ${userId}, status ${status}`,
        );

        try {
            // Get all active tokens for the user
            const tokens = await this.prisma.pushToken.findMany({
                where: {
                    userId,
                    is_active: true,
                },
                select: {
                    token: true,
                },
            });

            this.logger.log(
                `Found ${tokens.length} active tokens for user ${userId}`,
            );

            if (!tokens.length) {
                this.logger.log(`No active tokens found for user ${userId}`);
                return { success: false, message: 'No active tokens found' };
            }

            const notification = this.createNotificationContent(
                reportId,
                status,
            );
            const tokenList = tokens.map((t) => t.token);

            this.logger.log(
                `Sending notification to ${tokenList.length} tokens`,
            );

            await this.sendPushNotifications(tokenList, notification);

            this.logger.log(
                `Successfully sent status update notification for report ${reportId} to user ${userId}`,
            );
            return { success: true, message: 'Notification sent' };
        } catch (error) {
            this.logger.error(
                `Failed to send status update notification: ${error.message}`,
            );
            throw error;
        }
    }

    private createNotificationContent(
        reportId: string,
        status: ReportStatus,
    ): NotificationContent {
        let title: string;
        let body: string;

        switch (status) {
            case 'Pending':
                title = 'Report Received';
                body = 'Your report has been received and is being reviewed.';
                break;
            case 'InProgress':
                title = 'Report Update';
                body = 'Your report is now being investigated by our team.';
                break;
            case 'Resolved':
                title = 'Report Resolved';
                body =
                    'Your report has been resolved. Thank you for your patience.';
                break;
            default:
                title = 'Report Update';
                body = 'There is an update on your report.';
        }

        return {
            title,
            body,
            data: {
                type: 'report_status_update',
                reportId,
                status,
            },
            sound: 'default',
            channelId: 'report-updates',
            groupId: 'report-group',
            summaryText: 'Report updates',
            threadId: 'report-updates-thread',
        };
    }

    private async sendPushNotifications(
        tokens: string[],
        notification: NotificationContent,
    ) {
        if (!tokens.length) return;

        // Create messages array
        const messages = tokens.map((token) => ({
            to: token,
            ...notification,
        }));

        // Chunk the messages into batches of 100 (Expo's limit)
        const chunks = this.expo.chunkPushNotifications(messages);

        // Send each chunk
        const tickets: any[] = [];
        for (const chunk of chunks) {
            try {
                const ticketChunk =
                    await this.expo.sendPushNotificationsAsync(chunk);
                tickets.push(...ticketChunk);
            } catch (error) {
                this.logger.error(
                    `Error sending push notification chunk: ${error.message}`,
                );
            }
        }

        // Handle failed notifications
        if (tickets.length) {
            await this.handleFailedNotifications(tickets);
        }
    }

    private async handleFailedNotifications(tickets: any[]) {
        const receiptIds: string[] = [];

        // Collect receipt IDs for tickets that need checking
        for (const ticket of tickets) {
            if (ticket.status === 'error') {
                this.logger.error(
                    `Push notification error: ${(ticket as any).message}`,
                );

                // If the token is no longer valid, deactivate it
                if (
                    (ticket as any).details?.error === 'DeviceNotRegistered' ||
                    (ticket as any).details?.error === 'InvalidCredentials'
                ) {
                    await this.deactivateToken(
                        (ticket as any).details?.expoPushToken,
                    );
                }
            } else {
                receiptIds.push(ticket.id);
            }
        }

        // Check receipts for any additional failures
        if (receiptIds.length) {
            try {
                const receipts =
                    await this.expo.getPushNotificationReceiptsAsync(
                        receiptIds,
                    );

                for (const receiptId in receipts) {
                    const receipt = receipts[receiptId];

                    if (receipt.status === 'error') {
                        this.logger.error(
                            `Push notification receipt error: ${(receipt as any).message}`,
                        );

                        // If the token is no longer valid, deactivate it
                        if (
                            (receipt as any).details?.error ===
                                'DeviceNotRegistered' ||
                            (receipt as any).details?.error ===
                                'InvalidCredentials'
                        ) {
                            await this.deactivateToken(
                                (receipt as any).details?.expoPushToken,
                            );
                        }
                    }
                }
            } catch (error) {
                this.logger.error(
                    `Error checking push notification receipts: ${error.message}`,
                );
            }
        }
    }

    private async deactivateToken(token: string | undefined) {
        if (!token) return;

        try {
            await this.prisma.pushToken.updateMany({
                where: { token },
                data: { is_active: false },
            });
            this.logger.log(`Deactivated invalid token: ${token}`);
        } catch (error) {
            this.logger.error(`Error deactivating token: ${error.message}`);
        }
    }

    async getUserTokens(userId: string) {
        const tokens = await this.prisma.pushToken.findMany({
            where: {
                userId,
                is_active: true,
            },
            select: {
                id: true,
                token: true,
                device_id: true,
                platform: true,
                createdAt: true,
            },
        });

        return {
            success: true,
            data: tokens,
        };
    }

    async cleanupInactiveTokens() {
        // Remove tokens that are inactive and older than 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const result = await this.prisma.pushToken.deleteMany({
            where: {
                is_active: false,
                updatedAt: {
                    lt: thirtyDaysAgo,
                },
            },
        });

        this.logger.log(
            `Cleaned up ${result.count} inactive tokens older than 30 days`,
        );

        return {
            success: true,
            message: `Cleaned up ${result.count} inactive tokens`,
        };
    }

    async sendReportStatusUpdateToGuardian(
        reportId: string,
        guardianId: string,
        status: ReportStatus,
    ) {
        this.logger.log(
            `Attempting to send guardian notification for report ${reportId}, guardian ${guardianId}, status ${status}`,
        );

        try {
            // Get guardian details
            const guardian = await this.prisma.guardian.findUnique({
                where: { id: guardianId },
            });

            if (!guardian) {
                this.logger.error(`Guardian not found: ${guardianId}`);
                return { success: false, message: 'Guardian not found' };
            }

            // Get report details with student info
            const report = await this.prisma.report.findUnique({
                where: { id: reportId },
                include: {
                    student: {
                        select: {
                            name: true,
                            grade: true,
                            section: true,
                        },
                    },
                },
            });

            if (!report) {
                this.logger.error(`Report not found: ${reportId}`);
                return { success: false, message: 'Report not found' };
            }

            // Send email notification to guardian
            try {
                await this.sendGuardianEmailNotification(
                    guardian,
                    report,
                    status,
                );
                this.logger.log(
                    `Successfully sent email notification to guardian ${guardianId}`,
                );
            } catch (emailError) {
                this.logger.error(
                    `Failed to send email notification to guardian: ${emailError.message}`,
                );
                // Continue with push notification even if email fails
            }

            // Check if guardian has registered push tokens
            const tokens = await this.prisma.pushToken.findMany({
                where: {
                    userId: guardianId,
                    is_active: true,
                },
                select: {
                    token: true,
                },
            });

            if (tokens.length > 0) {
                try {
                    const notification = this.createGuardianNotificationContent(
                        reportId,
                        status,
                        report.student.name,
                    );
                    const tokenList = tokens.map((t) => t.token);

                    await this.sendPushNotifications(tokenList, notification);
                    this.logger.log(
                        `Successfully sent push notification to guardian ${guardianId}`,
                    );
                } catch (pushError) {
                    this.logger.error(
                        `Failed to send push notification to guardian: ${pushError.message}`,
                    );
                }
            }

            return { success: true, message: 'Guardian notification sent' };
        } catch (error) {
            this.logger.error(
                `Failed to send guardian notification: ${error.message}`,
            );
            throw error;
        }
    }

    private async sendGuardianEmailNotification(
        guardian: any,
        report: any,
        status: ReportStatus,
    ) {
        const { subject, text, html } = this.buildGuardianEmailTemplate(
            guardian,
            report,
            status,
        );

        await this.emailService.sendMail({
            to: guardian.email,
            subject,
            text,
            html,
        });
    }

    private buildGuardianEmailTemplate(
        guardian: any,
        report: any,
        status: ReportStatus,
    ) {
        const studentName = report.student.name;
        const reportId = report.id; // Shortened ID for readability

        let subject: string;
        let statusText: string;
        let message: string;

        switch (status) {
            case 'Pending':
                subject = `New Report Filed - ${studentName}`;
                statusText = 'Received';
                message = `A new report has been filed by ${studentName} and is currently being reviewed by our team.`;
                break;
            case 'InProgress':
                subject = `Report Update - ${studentName}`;
                statusText = 'Under Investigation';
                message = `The report filed by ${studentName} is now being actively investigated by our team.`;
                break;
            case 'Resolved':
                subject = `Report Resolved - ${studentName}`;
                statusText = 'Resolved';
                message = `The report filed by ${studentName} has been resolved. Thank you for your patience and support.`;
                break;
            default:
                subject = `Report Update - ${studentName}`;
                statusText = 'Updated';
                message = `There has been an update to the report filed by ${studentName}.`;
        }

        const html = `
            <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
                <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                    <h2 style="color: #007bff; margin: 0 0 10px 0;">BullyProof</h2>
                    <h3 style="margin: 0; color: #495057;">Report Status: ${statusText}</h3>
                </div>
                
                <div style="padding: 20px; background-color: #ffffff; border: 1px solid #dee2e6; border-radius: 8px;">
                    <p>Dear ${guardian.name},</p>
                    
                    <p>${message}</p>
                    
                    <div style="background-color: #e9ecef; padding: 15px; border-radius: 5px; margin: 20px 0;">
                        <h4 style="margin: 0 0 10px 0;">Report Details:</h4>
                        <ul style="margin: 0; padding-left: 20px;">
                            <li><strong>Student:</strong> ${studentName}</li>
                            <li><strong>Grade & Section:</strong> ${report.student.grade} - ${report.student.section}</li>
                            <li><strong>Report ID:</strong> #${reportId}</li>
                            <li><strong>Status:</strong> ${statusText}</li>
                            <li><strong>Date Filed:</strong> ${report.createdAt.toLocaleDateString()}</li>
                        </ul>
                    </div>
                    
                    <p>Please feel free to contact us if you have any questions or concerns.</p>
                    
                    <p>Best regards,<br>
                    The BullyProof Team</p>
                </div>
                
                <div style="text-align: center; margin-top: 20px; color: #6c757d; font-size: 12px;">
                    <p>This is an automated message. Please do not reply to this email.</p>
                </div>
            </div>
        `;

        const text = `
            Dear ${guardian.name},
            
            ${message}
            
            Report Details:
            - Student: ${studentName}
            - Grade & Section: ${report.student.grade} - ${report.student.section}
            - Report ID: #${reportId}
            - Status: ${statusText}
            - Date Filed: ${report.createdAt.toLocaleDateString()}
            
            Please feel free to contact us if you have any questions or concerns.
            
            Best regards,
            The BullyProof Team
        `;

        return { subject, text, html };
    }

    private createGuardianNotificationContent(
        reportId: string,
        status: ReportStatus,
        studentName: string,
    ): NotificationContent {
        let title: string;
        let body: string;

        switch (status) {
            case 'Pending':
                title = 'New Report Filed';
                body = `${studentName} has filed a new report. It's being reviewed.`;
                break;
            case 'InProgress':
                title = 'Report Update';
                body = `${studentName}'s report is now under investigation.`;
                break;
            case 'Resolved':
                title = 'Report Resolved';
                body = `${studentName}'s report has been resolved.`;
                break;
            default:
                title = 'Report Update';
                body = `There is an update on ${studentName}'s report.`;
        }

        return {
            title,
            body,
            data: {
                type: 'report_status_update',
                reportId,
                status,
            },
            sound: 'default',
            channelId: 'report-updates',
            groupId: 'report-group',
            summaryText: 'Report updates',
            threadId: 'report-updates-thread',
        };
    }
}
