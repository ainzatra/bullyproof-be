import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';

@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);
    private readonly openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY,
            maxRetries: 3,
        });
    }

    async analyzeReport(input: {
        details: string;
        feelings: string;
        files: string[]; // array of public S3 URLs
    }): Promise<any> {
        const { details, feelings, files } = input;

        // Filter images only
        const supportedFiles = files.filter((url) =>
            url.toLowerCase().match(/\.(png|jpe?g)$/),
        );

        // Build the analysis prompt
        const prompt = `
You are an AI assistant specialized in analyzing student bullying reports.
Analyze the provided details and attached evidence. Output ONLY valid JSON
with this structure:

{
  "toxicityScore": number,
  "insult": boolean,
  "threat": boolean,
  "profanity": boolean,
  "bullyingCategory": string[],
  "sentiment": string,
  "urgencyLevel": string,
  "summary": string
}

Formatting rules:
- "toxicityScore": Give a score from 0 to 100 as a whole number (no decimals).
- "sentiment": Capitalize each word (e.g., "Very Negative").
- "urgencyLevel": Only use "Low", "Medium", or "High".
- "bullyingCategory": Convert to capitalized words with spaces instead of underscores (e.g., "Verbal Abuse", "Cyberbullying").
- "summary": Keep as a descriptive sentence or paragraph.

Report details:
- Student feelings: ${feelings}
- Report text: ${details}
    `;
        const userContent: any[] = [
            {
                type: 'text',
                text: prompt,
            },
        ];

        for (const file of supportedFiles) {
            userContent.push({
                type: 'image_url',
                image_url: file,
            });
        }
        try {
            const response = await this.openai.chat.completions.create({
                model: 'openai/gpt-5-mini',
                messages: [
                    {
                        role: 'system',
                        content:
                            'You are a JSON-only bullying analysis assistant.',
                    },
                    { role: 'user', content: userContent },
                ],
                temperature: 0, // deterministic output
            });

            const content = response.choices[0].message?.content;
            // token usage
            if (response.usage) {
                console.log('Prompt tokens:', response.usage.prompt_tokens);
                console.log(
                    'Completion tokens:',
                    response.usage.completion_tokens,
                );
                console.log('Total tokens:', response.usage.total_tokens);
            }

            if (!content) throw new Error('No AI response');
            const result = JSON.parse(content);
            console.log('ai content response:', result);
            return result;
        } catch (error) {
            this.logger.error('Error analyzing report with AI', error);
            throw error;
        }
    }
}
