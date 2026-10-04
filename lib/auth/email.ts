import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

export interface AuthEmail {
  to: string;
  subject: string;
  text: string;
}
export interface EmailProvider {
  send(message: AuthEmail): Promise<void>;
}
export function emailConfigured(): boolean {
  return (
    (!!process.env.AUTH_EMAIL_FROM &&
      (process.env.AUTH_EMAIL_PROVIDER === "ses" || !!process.env.RESEND_API_KEY)) ||
    testEmailEnabled()
  );
}
function testEmailEnabled(): boolean {
  const url = process.env.DATABASE_URL_AUTH;
  return (
    process.env.AUTH_EMAIL_PROVIDER === "test" &&
    !!url &&
    ["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) &&
    !!process.env.AUTH_TEST_EMAIL_DIR?.startsWith("/tmp/")
  );
}
export function getEmailProvider(): EmailProvider {
  return {
    async send(message) {
      if (testEmailEnabled()) {
        const directory = process.env.AUTH_TEST_EMAIL_DIR!;
        await mkdir(directory, { recursive: true });
        await writeFile(`${directory}/${randomUUID()}.json`, JSON.stringify(message), {
          mode: 0o600,
        });
        return;
      }
      if (!emailConfigured()) throw new Error("Email delivery is not configured.");
      const from = process.env.AUTH_EMAIL_FROM!;
      if (process.env.AUTH_EMAIL_PROVIDER === "ses") {
        await new SESv2Client({ region: process.env.AWS_REGION }).send(
          new SendEmailCommand({
            FromEmailAddress: from,
            Destination: { ToAddresses: [message.to] },
            Content: {
              Simple: {
                Subject: { Data: message.subject },
                Body: { Text: { Data: message.text } },
              },
            },
          })
        );
      } else {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from,
            to: [message.to],
            subject: message.subject,
            text: message.text,
          }),
          signal: AbortSignal.timeout(10000),
        });
        if (!response.ok) throw new Error("Email delivery failed.");
      }
    },
  };
}
