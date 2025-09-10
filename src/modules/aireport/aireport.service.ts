import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma.service';

@Injectable()
export class AireportService {
    constructor(private readonly prisma: PrismaService) {}

    async createReport(reportId: string, data) {
        return this.prisma.aiReport.create({
            data: {
                report_id: reportId,
                bullying_category: data.bullyingCategory.join(', '),
                insult: data.insult,
                profanity: data.profanity,
                reason: data.summary,
                sentiment: data.sentiment,
                threat: data.threat,
                toxicity: data.toxicityScore,
                urgency: data.urgencyLevel,
            },
        });
    }
}
