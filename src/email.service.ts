import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
 
@Injectable()
export class EmailService {
  constructor(private mailerService: MailerService) {}
 
  private generateCode(): string {
    // Generate a 6-digit numeric code (100000 - 999999)
    return Math.floor(100000 + Math.random() * 900000).toString();
  }
 
  private buildTemplates(code: string) {
    const subject = 'Your verification code';
    const text = `Your verification code is ${code}. It will expire in 10 minutes.`;
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333;">
        <h2 style="margin-bottom: 0.5rem;">Verification Code</h2>
        <p style="font-size: 18px; font-weight: 600; letter-spacing: 2px;">${code}</p>
        <p style="color: #666; margin-top: 0.5rem;">If you did not request this, please ignore this email.</p>
      </div>
    `;
    return { subject, text, html };
  }
  
  async sendVerification(to: string): Promise<string> {
    const code = this.generateCode();
    const { subject, text, html } = this.buildTemplates(code);
 
    await this.mailerService.sendMail({
      to,
      subject,
      text,
      html,
    });
 
    return code;
  }
}
