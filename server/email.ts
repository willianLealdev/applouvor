import { Resend } from 'resend';

let connectionSettings: any;

async function getCredentials() {
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
  return { apiKey: connectionSettings.settings.api_key, fromEmail: connectionSettings.settings.from_email };
}

async function getUncachableResendClient() {
  const { apiKey, fromEmail } = await getCredentials();
  return {
    client: new Resend(apiKey),
    fromEmail
  };
}

export async function sendProvisionalPasswordEmail(
  toEmail: string,
  userName: string,
  provisionalPassword: string
) {
  try {
    console.log(`[EMAIL] Attempting to send provisional password to ${toEmail}`);
    const { client, fromEmail } = await getUncachableResendClient();
    console.log(`[EMAIL] Using from email: ${fromEmail}`);
    
    await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Louvor App - Sua senha provisoria',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Bem-vindo ao Louvor App!</h2>
          <p>Ola ${userName},</p>
          <p>Sua conta foi criada com sucesso. Use a senha provisoria abaixo para fazer seu primeiro login:</p>
          <div style="background-color: #f4f4f4; padding: 20px; text-align: center; margin: 20px 0; border-radius: 8px;">
            <h1 style="color: #6b46c1; letter-spacing: 4px; margin: 0;">${provisionalPassword}</h1>
          </div>
          <p><strong>Importante:</strong> Ao fazer login pela primeira vez, voce sera solicitado a criar uma nova senha.</p>
          <p>Sua nova senha deve ter no minimo 8 caracteres.</p>
          <br/>
          <p>Equipe Louvor App</p>
        </div>
      `
    });
    
    console.log(`[EMAIL] Successfully sent provisional password email to ${toEmail}`);
    return true;
  } catch (error: any) {
    console.error('[EMAIL] Error sending provisional password email:', error?.message || error);
    return false;
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  userName: string,
  resetToken: string
) {
  try {
    const { client, fromEmail } = await getUncachableResendClient();
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.REPLIT_DEPLOYMENT_DOMAIN
      ? `https://${process.env.REPLIT_DEPLOYMENT_DOMAIN}`
      : 'http://localhost:5000';
    
    const resetLink = `${baseUrl}/reset-password?token=${resetToken}`;
    
    await client.emails.send({
      from: fromEmail,
      to: toEmail,
      subject: 'Louvor App - Redefinir senha',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Redefinir sua senha</h2>
          <p>Ola ${userName},</p>
          <p>Recebemos uma solicitacao para redefinir sua senha. Clique no botao abaixo para criar uma nova senha:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #6b46c1; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">Redefinir Senha</a>
          </div>
          <p>Se voce nao solicitou a redefinicao de senha, ignore este email.</p>
          <p>Este link expira em 1 hora.</p>
          <br/>
          <p>Equipe Louvor App</p>
        </div>
      `
    });
    
    return true;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return false;
  }
}

export function generateNumericPassword(length: number = 6): string {
  let password = '';
  for (let i = 0; i < length; i++) {
    password += Math.floor(Math.random() * 10).toString();
  }
  return password;
}
