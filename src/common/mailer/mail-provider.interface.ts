export const MAIL_PROVIDER = Symbol('MAIL_PROVIDER');

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
}

export interface MailProvider {
  send(message: EmailMessage): Promise<void>;
}
