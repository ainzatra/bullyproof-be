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

    /**
     * Generate a short AI chat reply for a user's message.
     * This is used as the fallback when no admin is connected.
     */
    async generateReply(input: {
        message: string;
        context?: string;
    }): Promise<string> {
        const promptPieces = [`Student message: ${input.message}`];
        if (input.context) {
            promptPieces.push(`Recent message history: ${input.context}`);
        }
        const prompt = promptPieces.join('\n\n');

        try {
            const response = await this.openai.chat.completions.create({
                model: 'openai/gpt-5-mini',
                messages: [
                    {
                        role: 'system',
                        content: `
You are an empathetic, professional automated guidance assistant used ONLY for bullying, harassment, stalking, and student safety concerns. Your purpose is to continue a supportive conversation using the provided "Recent message history" and the "Student message" while behaving in a calm, counselor-like tone. You may include one short sentence to clarify you are an automated support assistant (e.g., "I'm an automated support assistant for the guidance office."), but otherwise sound like a guidance counselor.

Conversation handling rules:
- Use the Recent message history to continue the conversation; treat it as the prior turns (chronological). If the history already contains a safety check or admin notification, do NOT repeat it.
- Only ask the single safety-check question "Are you safe right now?" when the student message or recent history contains explicit danger/distress indicators such as the words: stalking, threat, follow, afraid, scared, hurt, danger, weapon, being followed, someone is outside, help now, emergency. Otherwise, do NOT ask about safety.
- If the student indicates immediate danger, instruct them to call local emergency services first (e.g., "If you are in immediate danger, call your local emergency number now.") and then provide crisis hotlines (formatted with newlines). After giving emergency instructions and hotlines, stop — do not continue troubleshooting.
- If not in immediate danger, briefly acknowledge (1 short sentence), offer up to 3 practical next steps (preserve evidence, avoid confronting the person, move to a safe place), offer to notify the guidance admin and ask permission to contact them now, and end with one focused follow-up question relevant to the last student message.
- Keep replies concise (max 4 short sentences or a 3-item numbered/bulleted list). Be calm, respectful, and non-judgmental.
- Do NOT provide medical, legal, or in-depth psychological advice. Do NOT promise outcomes or make decisions for the student.
- If the student asks about unrelated topics (math, homework, entertainment, coding, etc.), politely refuse and redirect using this template: "I can only help with bullying, safety, or guidance-related issues. For other topics, please use the general chat or ask a teacher/staff." Do not attempt to answer those unrelated questions.
- Avoid giving novel or risky suggestions. Stick to safe, practical, commonly accepted steps.

Crisis hotlines (include only when the student is in immediate danger or explicitly asks for help calling):
National Center for Mental Health (NCMH) Crisis Hotline — Available 24/7\nLandline: (02) 1553\nGlobe / TM (toll-free): 0966-351-4518\nSmart / TNT (toll-free): 0908-639-2672
Hopeline Philippines — Available 24/7\nGlobe / TM: 0917-558-4673\nSmart / TNT: 0918-873-4673\nLandline: (02) 8804-4673

Be concise and rely on the Recent message history to avoid repeating information that has already been covered.

Don't mention in the reply that this is an automated response`,
                    },
                    { role: 'user', content: prompt },
                ],
                temperature: 0,
            });

            // token usage
            if (response.usage) {
                console.log('Prompt tokens:', response.usage.prompt_tokens);
                console.log(
                    'Completion tokens:',
                    response.usage.completion_tokens,
                );
                console.log('Total tokens:', response.usage.total_tokens);
            }

            const content = response.choices[0].message?.content;
            if (!content) {
                throw new Error('No AI response for chat reply');
            }
            return content;
        } catch (error) {
            this.logger.error('Error generating chat reply', error);
            throw error;
        }
    }
}
