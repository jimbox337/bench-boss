import { randomBytes } from 'crypto';
import { Resend } from 'resend';

// Initialize Resend client
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send an email using the Resend SDK
 */
export async function sendEmail({ to, subject, html }: EmailOptions): Promise<boolean> {
  try {
    // If Resend is configured, use the SDK
    if (resend) {
      const { data, error } = await resend.emails.send({
        from: process.env.EMAIL_FROM || 'Bench Boss <noreply@benchboss.pro>',
        to,
        subject,
        html,
      });

      if (error) {
        console.error('Failed to send email:', error);
        return false;
      }

      console.log('✅ Email sent successfully:', data);
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }
          .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 4s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          .logo {
            font-size: 60px;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
            text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }
          .header-title {
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 2px;
            position: relative;
            z-index: 1;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .content {
            padding: 40px 30px;
            background: #ffffff;
          }
          .greeting {
            font-size: 24px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 20px;
          }
          .message {
            font-size: 16px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 16px;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%);
            color: #ffffff;
            padding: 18px 50px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 800;
            font-size: 18px;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 10px 30px rgba(245, 158, 11, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(245, 158, 11, 0.6);
          }
          .divider {
            margin: 30px 0;
            text-align: center;
            color: #94a3b8;
            font-size: 14px;
            font-weight: 600;
          }
          .link-box {
            background: #f1f5f9;
            border: 2px dashed #cbd5e1;
            border-radius: 12px;
            padding: 16px;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #1e293b;
            margin: 20px 0;
          }
          .footer {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            padding: 30px;
            text-align: center;
          }
          .footer-text {
            color: #cbd5e1;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 10px;
          }
          .footer-brand {
            color: #ffffff;
            font-size: 16px;
            font-weight: 700;
            margin-top: 15px;
          }
          .emoji-accent {
            font-size: 24px;
            margin: 0 5px;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="logo">🏒</div>
            <div class="header-title">Bench Boss</div>
          </div>

          <div class="content">
            <div class="greeting">Hey ${name}! <span class="emoji-accent">👋</span></div>

            <p class="message">
              Welcome to <strong>Bench Boss</strong>! You're one step away from dominating your fantasy hockey league.
            </p>

            <p class="message">
              Click the button below to verify your email and unlock your account:
            </p>

            <div class="button-container">
              <a href="${verificationUrl}" class="button">Verify Email</a>
            </div>

            <div class="divider">━━━ OR ━━━</div>

            <p class="message" style="text-align: center; font-size: 14px;">
              Copy and paste this link into your browser:
            </p>

            <div class="link-box">${verificationUrl}</div>

            <p class="message" style="font-size: 14px; color: #64748b; margin-top: 30px;">
              ⏱️ This link expires in <strong>24 hours</strong>
            </p>
          </div>

          <div class="footer">
            <p class="footer-text">
              If you didn't create an account, you can safely ignore this email.
            </p>
            <div class="footer-brand">🏒 BENCH BOSS</div>
            <p class="footer-text" style="font-size: 12px; margin-top: 10px;">
              © 2026 Bench Boss. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: '🏒 Verify your Bench Boss account!',
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
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
          }
          .email-wrapper {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          }
          .header {
            background: linear-gradient(135deg, #dc2626 0%, #f59e0b 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            left: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
            animation: pulse 4s ease-in-out infinite;
          }
          @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
          }
          .logo {
            font-size: 60px;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
            text-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
          }
          .header-title {
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: 2px;
            position: relative;
            z-index: 1;
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
          }
          .content {
            padding: 40px 30px;
            background: #ffffff;
          }
          .greeting {
            font-size: 24px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 20px;
          }
          .message {
            font-size: 16px;
            line-height: 1.6;
            color: #475569;
            margin-bottom: 16px;
          }
          .button-container {
            text-align: center;
            margin: 30px 0;
          }
          .button {
            display: inline-block;
            background: linear-gradient(135deg, #dc2626 0%, #f59e0b 100%);
            color: #ffffff;
            padding: 18px 50px;
            text-decoration: none;
            border-radius: 50px;
            font-weight: 800;
            font-size: 18px;
            text-transform: uppercase;
            letter-spacing: 1px;
            box-shadow: 0 10px 30px rgba(220, 38, 38, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .button:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 40px rgba(220, 38, 38, 0.6);
          }
          .divider {
            margin: 30px 0;
            text-align: center;
            color: #94a3b8;
            font-size: 14px;
            font-weight: 600;
          }
          .link-box {
            background: #f1f5f9;
            border: 2px dashed #cbd5e1;
            border-radius: 12px;
            padding: 16px;
            word-break: break-all;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            color: #1e293b;
            margin: 20px 0;
          }
          .warning-box {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border: 3px solid #f59e0b;
            border-radius: 12px;
            padding: 20px;
            margin: 25px 0;
          }
          .warning-title {
            font-size: 18px;
            font-weight: 800;
            color: #92400e;
            margin-bottom: 8px;
          }
          .warning-text {
            font-size: 14px;
            color: #78350f;
            line-height: 1.5;
          }
          .footer {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            padding: 30px;
            text-align: center;
          }
          .footer-text {
            color: #cbd5e1;
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 10px;
          }
          .footer-brand {
            color: #ffffff;
            font-size: 16px;
            font-weight: 700;
            margin-top: 15px;
          }
          .emoji-accent {
            font-size: 24px;
            margin: 0 5px;
          }
        </style>
      </head>
      <body>
        <div class="email-wrapper">
          <div class="header">
            <div class="logo">🔐</div>
            <div class="header-title">Password Reset</div>
          </div>

          <div class="content">
            <div class="greeting">Hey ${name}! <span class="emoji-accent">👋</span></div>

            <p class="message">
              We received a request to reset your password for your <strong>Bench Boss</strong> account.
            </p>

            <p class="message">
              No worries! Click the button below to create a new password:
            </p>

            <div class="button-container">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>

            <div class="divider">━━━ OR ━━━</div>

            <p class="message" style="text-align: center; font-size: 14px;">
              Copy and paste this link into your browser:
            </p>

            <div class="link-box">${resetUrl}</div>

            <p class="message" style="font-size: 14px; color: #64748b; margin-top: 20px;">
              ⏱️ This link expires in <strong>1 hour</strong> for security
            </p>

            <div class="warning-box">
              <div class="warning-title">⚠️ Security Notice</div>
              <div class="warning-text">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </div>
            </div>
          </div>

          <div class="footer">
            <p class="footer-text">
              For security, we never send your password in email.
            </p>
            <div class="footer-brand">🏒 BENCH BOSS</div>
            <p class="footer-text" style="font-size: 12px; margin-top: 10px;">
              © 2026 Bench Boss. All rights reserved.
            </p>
          </div>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: '🔐 Reset your Bench Boss password',
    html,
  });
}
