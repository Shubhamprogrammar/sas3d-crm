import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer }[];
}

export interface EmailResult {
  sent: boolean;
  providerId?: string;
  reason?: string;
}

/** Callers must treat `sent: false` as "not delivered" and never report the email as sent. */
export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailResult>;
}

class ResendProvider implements EmailProvider {
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage): Promise<EmailResult> {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        attachments: message.attachments?.map((file) => ({
          filename: file.filename,
          content: file.content.toString("base64"),
        })),
      }),
    });
    if (!response.ok) {
      logger.error({ status: response.status }, "Resend rejected an email");
      return { sent: false, reason: `Email provider responded with status ${response.status}` };
    }
    const body = (await response.json()) as { id?: string };
    return { sent: true, providerId: body.id };
  }
}

class UnconfiguredProvider implements EmailProvider {
  async send(message: EmailMessage): Promise<EmailResult> {
    // The body may hold a password reset link, which is useful locally but must not reach production logs.
    if (env.NODE_ENV === "development") {
      logger.info(
        { to: message.to, subject: message.subject, html: message.html },
        "Email not sent: no provider configured",
      );
    } else {
      logger.warn({ subject: message.subject }, "Email not sent: no provider configured");
    }
    return { sent: false, reason: "No email provider is configured" };
  }
}

let provider: EmailProvider = env.RESEND_API_KEY
  ? new ResendProvider(env.RESEND_API_KEY)
  : new UnconfiguredProvider();

export const sendEmail = (message: EmailMessage) => provider.send(message);
export const isEmailConfigured = () => Boolean(env.RESEND_API_KEY);
/** Test seam for substituting the provider. */
export const setEmailProvider = (next: EmailProvider) => {
  provider = next;
};
