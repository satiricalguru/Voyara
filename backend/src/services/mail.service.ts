import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

const transport = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    })
  : null;

/** Fire-and-forget mail; logs to console when SMTP is not configured. Never throws. */
export async function sendMail(to: string, subject: string, text: string, attachments?: { filename: string; content: Buffer }[]) {
  if (!transport) {
    if (!env.isProd) console.log(`✉  [mail:dev] → ${to} · ${subject}`);
    return;
  }
  try {
    await transport.sendMail({ from: env.SMTP_FROM, to, subject, text, attachments });
  } catch (err) {
    console.warn('✉  mail failed:', (err as Error).message);
  }
}
