# Email Verification & Password Reset Setup

This document explains the email functionality that has been implemented in Bench Boss.

## Features Implemented

### 1. Email Verification for New Users
- When users sign up, they receive a verification email
- Users must click the verification link to activate their account
- Verification tokens expire after 24 hours
- Clear success/error messaging throughout the flow

### 2. Password Reset
- Users can request a password reset via "Forgot Password?" link on login page
- Reset tokens are sent via email
- Reset links expire after 1 hour for security
- Secure token-based reset flow

## Database Schema Changes

The following fields were added to the User model:

```prisma
emailVerified             DateTime? // When email was verified
emailVerificationToken    String?   @unique
emailVerificationExpires  DateTime?
resetPasswordToken        String?   @unique
resetPasswordExpires      DateTime?
```

## Required: Run Database Migration

**IMPORTANT**: You need to run the Prisma migration to update your database schema:

```bash
npx prisma migrate dev --name add_email_verification
```

This will add the new fields to your User table.

## Email Service Configuration

### Resend SDK (Implemented)

The email system uses the official Resend Node.js SDK for sending emails.

**Setup:**

1. Install the SDK (already done):
   ```bash
   npm install resend
   ```

2. Sign up at [resend.com](https://resend.com/)

3. Get your API key from the dashboard

4. Add to your `.env` file:
   ```
   RESEND_API_KEY=re_xxxxxxxxxxxx
   EMAIL_FROM=Bench Boss <noreply@yourdomain.com>
   ```

**Benefits:**
- Type-safe TypeScript SDK
- Better error handling
- Automatic retries
- Official support from Resend

### Option 2: Development Mode (No Email Service)

If you don't configure an email service:
- Emails won't actually be sent
- Email content will be logged to the console
- You can see the verification/reset links in your terminal
- Perfect for local development and testing

## Files Created/Modified

### New API Routes
- `app/api/auth/verify-email/route.ts` - Email verification endpoint
- `app/api/auth/forgot-password/route.ts` - Password reset request
- `app/api/auth/reset-password/route.ts` - Password reset confirmation

### New Pages
- `app/verify-email/page.tsx` - Email verification landing page
- `app/forgot-password/page.tsx` - Password reset request form
- `app/reset-password/page.tsx` - Password reset form

### New Utilities
- `lib/email.ts` - Email service with HTML templates

### Modified Files
- `prisma/schema.prisma` - Added email verification fields
- `lib/users.ts` - Generate and send verification emails on signup
- `app/login/page.tsx` - Added "Forgot Password?" link and verification message
- `.env.example` - Added email configuration examples

## User Flow

### Sign Up Flow
1. User fills out registration form (name, email, username, password)
2. Account is created in database
3. Verification email is sent automatically
4. User sees success message with instructions
5. User clicks verification link in email
6. Email is marked as verified
7. User can now log in

### Password Reset Flow
1. User clicks "Forgot Password?" on login page
2. User enters their email address
3. Reset email is sent (if account exists)
4. User clicks reset link in email
5. User enters new password
6. Password is updated
7. User is redirected to login

## Security Features

- Tokens are cryptographically secure (32 bytes of random data)
- Verification tokens expire after 24 hours
- Reset tokens expire after 1 hour
- Tokens are cleared after use
- Email enumeration prevention (same response whether email exists or not)
- Passwords are hashed with bcrypt
- All tokens are unique in database

## Testing in Development

Without email service configured:

1. **Sign up a new user**
   - Go to `/login` and create an account
   - Check your terminal/console for the verification email
   - Copy the verification URL and paste into browser

2. **Test password reset**
   - Click "Forgot Password?" on login page
   - Enter email address
   - Check terminal/console for reset email
   - Copy the reset URL and paste into browser

## Production Deployment

For production:

1. Set up Resend (or another email service)
2. Configure environment variables in your hosting platform
3. Set `NEXTAUTH_URL` to your production domain
4. Ensure `EMAIL_FROM` uses a verified domain in Resend

## Email Templates

The email templates are designed with:
- Mobile-responsive design
- Professional styling matching Bench Boss branding
- Clear call-to-action buttons
- Security warnings where appropriate
- Fallback text links for accessibility

## Next Steps

1. Run the database migration
2. (Optional) Set up Resend for production email delivery
3. Test the flows in development
4. Customize email templates if needed (in `lib/email.ts`)
5. Consider adding email verification enforcement (prevent unverified users from accessing features)

## Support

If users have issues:
- Check spam/junk folders for emails
- Verify email service configuration
- Check server logs for email sending errors
- Ensure database migration was successful
