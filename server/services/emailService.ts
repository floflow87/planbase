import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
  // Check for direct environment variables first (for Render/production)
  if (process.env.RESEND_API_KEY) {
    console.log('📧 Using RESEND_API_KEY from environment');
    return {
      apiKey: process.env.RESEND_API_KEY,
      fromEmail: process.env.EMAIL_FROM || 'Planbase <noreply@planbase.io>'
    };
  }

  // Fall back to Replit connector system
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=resend',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key)) {
    throw new Error('Resend not connected');
  }
  return {
    apiKey: connectionSettings.settings.api_key, 
    fromEmail: connectionSettings.settings.from_email
  };
}

async function getResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  // Allow override via environment variable for multi-project setups (Render, etc.)
  const overrideFromEmail = process.env.EMAIL_FROM || 'Planbase <noreply@planbase.io>';
  return {
    client: new Resend(apiKey),
    fromEmail: overrideFromEmail
  };
}

interface InvitationEmailParams {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  token: string;
  expiresAt: Date;
}

export async function sendInvitationEmail(params: InvitationEmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const { client, fromEmail } = await getResendClient();
    
    const roleLabel = params.role === 'admin' ? 'Administrateur' 
      : params.role === 'member' ? 'Membre' 
      : 'Invité';
    
    // Use APP_URL for production, or planbase.io as default
    const baseUrl = process.env.APP_URL || 'https://planbase.io';
    console.log('📧 EMAIL: APP_URL =', process.env.APP_URL, '→ baseUrl =', baseUrl);
    
    const inviteUrl = `${baseUrl}/accept-invitation?token=${params.token}`;
    const expirationDate = params.expiresAt.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const { data, error } = await client.emails.send({
      from: fromEmail || 'Planbase <noreply@planbase.io>',
      to: params.to,
      subject: `${params.inviterName} vous invite à rejoindre ${params.organizationName} sur Planbase`,
      html: `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f4f4f5;">
          <table role="presentation" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                  <tr>
                    <td style="padding: 40px 40px 20px; text-align: center;">
                      <div style="display: inline-block; background: linear-gradient(135deg, #7C3AED 0%, #06B6D4 100%); padding: 12px 24px; border-radius: 8px;">
                        <span style="color: #ffffff; font-size: 24px; font-weight: 700;">Planbase</span>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px;">
                      <h1 style="margin: 0 0 20px; font-size: 24px; font-weight: 600; color: #18181b; text-align: center;">
                        Vous êtes invité(e) !
                      </h1>
                      <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #52525b;">
                        <strong>${params.inviterName}</strong> vous invite à rejoindre l'organisation 
                        <strong>${params.organizationName}</strong> sur Planbase en tant que <strong>${roleLabel}</strong>.
                      </p>
                      <p style="margin: 0 0 30px; font-size: 16px; line-height: 1.6; color: #52525b;">
                        Planbase est une plateforme de gestion de projet conçue pour les freelances et créateurs de startups.
                      </p>
                      <table role="presentation" style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td align="center">
                            <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background-color: #7C3AED; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                              Accepter l'invitation
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 30px 0 0; font-size: 14px; line-height: 1.6; color: #71717a; text-align: center;">
                        Cette invitation expire le <strong>${expirationDate}</strong>.
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 20px 40px 40px;">
                      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 0 0 20px;">
                      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                        Si vous n'attendiez pas cette invitation, vous pouvez ignorer cet email.
                      </p>
                      <p style="margin: 10px 0 0; font-size: 12px; line-height: 1.5; color: #a1a1aa; text-align: center;">
                        Si le bouton ne fonctionne pas, copiez ce lien : <br>
                        <a href="${inviteUrl}" style="color: #7C3AED; word-break: break-all;">${inviteUrl}</a>
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
      console.error('Resend error:', error);
      return { success: false, error: error.message };
    }

    console.log('Invitation email sent successfully:', data);
    return { success: true };
  } catch (error: any) {
    console.error('Failed to send invitation email:', error);
    return { success: false, error: error.message };
  }
}
