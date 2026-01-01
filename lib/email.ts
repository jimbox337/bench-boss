import { randomBytes } from 'crypto';

// Email service configuration
// You can use Resend, SendGrid, NodeMailer, or any email service
// For this example, we'll set up the structure for Resend

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using the configured email service
 */
export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  try {
    // If RESEND_API_KEY is configured, use Resend
    if (process.env.RESEND_API_KEY) {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Bench Boss <noreply@benchboss.app>',
          to,
          subject,
          html,
        }),
      });

      if (!response.ok) {
        console.error('Failed to send email:', await response.text());
        return false;
      }

      return true;
    }

    // If no email service is configured, log to console (development mode)
    console.log('📧 Email would be sent in production:');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('HTML:', html);

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
}

/**
 * Generate a random token for email verification or password reset
 */
export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Send email verification email
 */
export async function sendVerificationEmail(email: string, name: string, token: string): Promise<boolean> {
  const verificationUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/verify-email?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f8fafc;
            border-radius: 12px;
            padding: 40px;
            border: 1px solid #e2e8f0;
          }
          .logo {
            font-size: 32px;
            margin-bottom: 20px;
          }
          h1 {
            color: #1e293b;
            font-size: 24px;
            margin-bottom: 20px;
          }
          p {
            color: #475569;
            margin-bottom: 16px;
          }
          .button {
            display: inline-block;
            background-color: #3b82f6;
            color: white;
            padding: 12px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 14px;
          }
          .code {
            background-color: #f1f5f9;
            padding: 12px;
            border-radius: 6px;
            font-family: monospace;
            color: #0f172a;
            margin: 16px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🏒 Bench Boss</div>
          <h1>Verify Your Email Address</h1>
          <p>Hi ${name},</p>
          <p>Thanks for signing up for Bench Boss! Please verify your email address to get started with managing your fantasy hockey team.</p>
          <p>Click the button below to verify your email:</p>
          <a href="${verificationUrl}" class="button">Verify Email Address</a>
          <p>Or copy and paste this link into your browser:</p>
          <div class="code">${verificationUrl}</div>
          <p>This link will expire in 24 hours.</p>
          <div class="footer">
            <p>If you didn't create an account with Bench Boss, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Verify your Bench Boss email address',
    html,
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(email: string, name: string, token: string): Promise<boolean> {
  const resetUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/reset-password?token=${token}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f8fafc;
            border-radius: 12px;
            padding: 40px;
            border: 1px solid #e2e8f0;
          }
          .logo {
            font-size: 32px;
            margin-bottom: 20px;
          }
          h1 {
            color: #1e293b;
            font-size: 24px;
            margin-bottom: 20px;
          }
          p {
            color: #475569;
            margin-bottom: 16px;
          }
          .button {
            display: inline-block;
            background-color: #3b82f6;
            color: white;
            padding: 12px 32px;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin: 20px 0;
          }
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            color: #64748b;
            font-size: 14px;
          }
          .code {
            background-color: #f1f5f9;
            padding: 12px;
            border-radius: 6px;
            font-family: monospace;
            color: #0f172a;
            margin: 16px 0;
          }
          .warning {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 12px;
            margin: 20px 0;
            border-radius: 4px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">🏒 Bench Boss</div>
          <h1>Reset Your Password</h1>
          <p>Hi ${name},</p>
          <p>We received a request to reset your password for your Bench Boss account. Click the button below to create a new password:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <div class="code">${resetUrl}</div>
          <p>This link will expire in 1 hour for security reasons.</p>
          <div class="warning">
            <strong>⚠️ Security Notice:</strong> If you didn't request a password reset, please ignore this email. Your password will remain unchanged.
          </div>
          <div class="footer">
            <p>For security, we never send your password in email.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: 'Reset your Bench Boss password',
    html,
  });
}
