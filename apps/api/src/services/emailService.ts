import nodemailer from 'nodemailer';

import { env } from '../config/env.js';

const isEmailConfigured =
  Boolean(env.EMAIL_HOST && env.EMAIL_USER && env.EMAIL_PASSWORD && env.EMAIL_FROM) ?? false;

const transporter = isEmailConfigured
  ? nodemailer.createTransport({
      host: env.EMAIL_HOST,
      port: env.EMAIL_PORT ?? 465,
      secure: env.EMAIL_SECURE ?? true,
      auth: {
        user: env.EMAIL_USER,
        pass: env.EMAIL_PASSWORD,
      },
    })
  : null;

type SendEmailPayload = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
};

export const sendEmail = async ({ to, subject, text, html }: SendEmailPayload) => {
  if (!transporter) {
    console.warn('Email transport not configured. Skipping email send.');
    return;
  }

  await transporter.sendMail({
    from: env.EMAIL_FROM,
    to,
    subject,
    text,
    html,
  });
};

