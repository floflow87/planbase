import { getResendClient } from "./emailService";
import { storage } from "../storage";

interface ProviderAlertParams {
  promptType: string;
  timestamp: Date;
  errorMessage?: string;
}

async function sendEmailAlert(params: ProviderAlertParams): Promise<void> {
  const alertEmail = process.env.ALERT_EMAIL;
  if (!alertEmail) return;

  try {
    const { client, fromEmail } = await getResendClient();
    const timestampStr = params.timestamp.toISOString();

    const { error } = await client.emails.send({
      from: fromEmail,
      to: alertEmail,
      subject: `[Planbase Alert] Ollama unavailable — fallback to OpenAI (${params.promptType})`,
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"></head>
        <body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f4f4f5;">
          <table role="presentation" style="width:100%;border-collapse:collapse;">
            <tr>
              <td align="center" style="padding:40px 20px;">
                <table role="presentation" style="width:100%;max-width:600px;border-collapse:collapse;background:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);">
                  <tr>
                    <td style="padding:40px 40px 20px;">
                      <h1 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#18181b;">AI Provider Alert</h1>
                      <p style="margin:0 0 12px;font-size:15px;color:#52525b;">
                        The primary AI provider <strong>Ollama</strong> became unavailable and the system automatically fell back to <strong>OpenAI</strong>.
                      </p>
                      <table role="presentation" style="width:100%;border-collapse:collapse;margin:20px 0;background:#f9fafb;border-radius:8px;">
                        <tr>
                          <td style="padding:16px 20px;">
                            <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Prompt Type</p>
                            <p style="margin:0;font-size:15px;font-weight:600;color:#18181b;">${params.promptType}</p>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding:0 20px 16px;">
                            <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Timestamp (UTC)</p>
                            <p style="margin:0;font-size:15px;font-weight:600;color:#18181b;">${timestampStr}</p>
                          </td>
                        </tr>
                        ${params.errorMessage ? `
                        <tr>
                          <td style="padding:0 20px 16px;">
                            <p style="margin:0 0 8px;font-size:13px;color:#71717a;text-transform:uppercase;letter-spacing:0.05em;">Error</p>
                            <p style="margin:0;font-size:14px;color:#ef4444;font-family:monospace;">${params.errorMessage}</p>
                          </td>
                        </tr>` : ''}
                      </table>
                      <p style="margin:0;font-size:14px;color:#71717a;">
                        Please check the Ollama service and restore it as soon as possible. OpenAI usage may incur additional costs.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 40px 40px;">
                      <hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 20px;">
                      <p style="margin:0;font-size:12px;color:#a1a1aa;text-align:center;">
                        This is an automated alert from Planbase. Do not reply to this email.
                      </p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
    });

    if (error) {
      console.error('[Alert] Failed to send email alert:', error.message);
    } else {
      console.log(`[Alert] Email alert sent to ${alertEmail}`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Alert] Exception while sending email alert:', msg);
  }
}

function maskUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.hostname}`;
  } catch {
    return '[invalid url]';
  }
}

async function sendWebhookAlert(params: ProviderAlertParams): Promise<void> {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const payload = {
    event: 'ai_provider_fallback',
    provider_down: 'ollama',
    fallback_provider: 'openai',
    prompt_type: params.promptType,
    timestamp: params.timestamp.toISOString(),
    ...(params.errorMessage ? { error: params.errorMessage } : {}),
  };

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[Alert] Webhook returned non-OK status: ${res.status} (${maskUrl(webhookUrl)})`);
    } else {
      console.log(`[Alert] Webhook alert sent (${maskUrl(webhookUrl)})`);
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Alert] Exception while sending webhook alert (${maskUrl(webhookUrl)}):`, msg);
  }
}

export async function alertOllamaFallback(params: ProviderAlertParams & { fallbackSucceeded?: boolean }): Promise<void> {
  // Always persist the event regardless of alert channel configuration
  storage.logAiFallbackEvent({
    promptType: params.promptType,
    errorMessage: params.errorMessage ?? null,
    fallbackSucceeded: params.fallbackSucceeded !== false,
  }).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Alert] Failed to persist AI fallback event:', msg);
  });

  const hasEmail = !!process.env.ALERT_EMAIL;
  const hasWebhook = !!process.env.ALERT_WEBHOOK_URL;

  if (!hasEmail && !hasWebhook) {
    console.warn(
      '[Alert] Ollama fallback occurred but no alert channel is configured. ' +
      'Set ALERT_EMAIL or ALERT_WEBHOOK_URL to enable alerts.'
    );
    return;
  }

  await Promise.allSettled([
    sendEmailAlert(params),
    sendWebhookAlert(params),
  ]);
}
