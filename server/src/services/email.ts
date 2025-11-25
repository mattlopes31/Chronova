import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendPasswordResetEmail = async (
  email: string,
  token: string,
  firstName: string
) => {
  const resetUrl = `${process.env.APP_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const mailOptions = {
    from: `"TimeTrack Pro" <${process.env.SMTP_USER || 'noreply@timetrack.com'}>`,
    to: email,
    subject: 'Réinitialisation de votre mot de passe - TimeTrack Pro',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Réinitialisation du mot de passe</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #f4f7fa;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #0066FF 0%, #00D4AA 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">⏱️ TimeTrack Pro</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 24px; font-weight: 600;">Bonjour ${firstName},</h2>
                    <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                      Vous avez demandé la réinitialisation de votre mot de passe. Cliquez sur le bouton ci-dessous pour créer un nouveau mot de passe :
                    </p>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${resetUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #0066FF 0%, #00D4AA 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 102, 255, 0.3);">
                            Réinitialiser mon mot de passe
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 20px 0 0; color: #718096; font-size: 14px; line-height: 1.6;">
                      Ce lien expirera dans <strong>1 heure</strong>. Si vous n'avez pas demandé cette réinitialisation, vous pouvez ignorer cet email.
                    </p>
                    
                    <hr style="margin: 30px 0; border: none; border-top: 1px solid #e2e8f0;">
                    
                    <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                      Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
                      <a href="${resetUrl}" style="color: #0066FF; word-break: break-all;">${resetUrl}</a>
                    </p>
                  </td>
                </tr>
                
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                      © ${new Date().getFullYear()} TimeTrack Pro. Tous droits réservés.
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
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Password reset email sent to:', email);
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw - we don't want to expose email sending failures
  }
};

export const sendWelcomeEmail = async (
  email: string,
  firstName: string,
  tempPassword: string
) => {
  const loginUrl = `${process.env.APP_URL || 'http://localhost:3000'}/login`;

  const mailOptions = {
    from: `"TimeTrack Pro" <${process.env.SMTP_USER || 'noreply@timetrack.com'}>`,
    to: email,
    subject: 'Bienvenue sur TimeTrack Pro - Vos identifiants',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="min-width: 100%; background-color: #f4f7fa;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #0066FF 0%, #00D4AA 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">⏱️ TimeTrack Pro</h1>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 40px;">
                    <h2 style="margin: 0 0 20px; color: #1a1a2e; font-size: 24px; font-weight: 600;">Bienvenue ${firstName} !</h2>
                    <p style="margin: 0 0 20px; color: #4a5568; font-size: 16px; line-height: 1.6;">
                      Votre compte TimeTrack Pro a été créé. Voici vos identifiants de connexion :
                    </p>
                    
                    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0;">
                      <p style="margin: 0 0 10px; color: #4a5568;"><strong>Email :</strong> ${email}</p>
                      <p style="margin: 0; color: #4a5568;"><strong>Mot de passe temporaire :</strong> ${tempPassword}</p>
                    </div>
                    
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td align="center" style="padding: 20px 0;">
                          <a href="${loginUrl}" style="display: inline-block; padding: 16px 32px; background: linear-gradient(135deg, #0066FF 0%, #00D4AA 100%); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; border-radius: 8px;">
                            Se connecter
                          </a>
                        </td>
                      </tr>
                    </table>
                    
                    <p style="margin: 20px 0 0; color: #e53e3e; font-size: 14px; font-weight: 600;">
                      ⚠️ Pour des raisons de sécurité, veuillez changer votre mot de passe après votre première connexion.
                    </p>
                  </td>
                </tr>
                
                <tr>
                  <td style="padding: 20px 40px; background-color: #f8fafc; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; color: #a0aec0; font-size: 12px;">
                      © ${new Date().getFullYear()} TimeTrack Pro. Tous droits réservés.
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
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('Welcome email sent to:', email);
  } catch (error) {
    console.error('Error sending welcome email:', error);
  }
};
