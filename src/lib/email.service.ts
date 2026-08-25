import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  text?: string;
  html?: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMPT_HOST || 'smtp.example.com',
      port: parseInt(process.env.SMPT_PORT || '587'),
      auth: {
        user: process.env.SMPT_USER || 'your_email@example.com',
        pass: process.env.SMPT_PASS || 'your_password',
      },
    });

    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('SMTP server connection verified');
    } catch (error) {
      if (error instanceof Error) {
        console.warn('SMTP server connection warning:', error.message);
      }
    }
  }

  async sendMail(options: EmailOptions): Promise<boolean> {
    try {
      await this.transporter.sendMail({
        from: process.env.ADMIN_EMAIL || 'admin@peachcraft.com',
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      return false;
    }
  }
}

export const emailService = new EmailService();