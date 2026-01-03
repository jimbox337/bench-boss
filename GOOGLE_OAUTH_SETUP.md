# Google OAuth Setup Guide

Follow these steps to enable "Sign in with Google" for BenchBoss.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" at the top
3. Click "New Project"
4. Name it "BenchBoss" (or any name you prefer)
5. Click "Create"

## Step 2: Enable Google+ API

1. In the left sidebar, go to **APIs & Services** > **Library**
2. Search for "Google+ API"
3. Click on it and press "Enable"

## Step 3: Configure OAuth Consent Screen

1. In the left sidebar, go to **APIs & Services** > **OAuth consent screen**
2. Select **External** user type
3. Click "Create"
4. Fill out the required fields:
   - **App name**: BenchBoss
   - **User support email**: Your email
   - **Developer contact email**: Your email
5. Click "Save and Continue"
6. On the "Scopes" page, click "Save and Continue" (default scopes are fine)
7. On "Test users", click "Save and Continue"
8. Review and click "Back to Dashboard"

## Step 4: Create OAuth Credentials

1. In the left sidebar, go to **APIs & Services** > **Credentials**
2. Click "Create Credentials" > "OAuth client ID"
3. Select **Web application**
4. Name it "BenchBoss Web"
5. Under "Authorized JavaScript origins", add:
   - `http://localhost:3000` (for local development)
   - `https://www.benchboss.pro` (for production)
6. Under "Authorized redirect URIs", add:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://www.benchboss.pro/api/auth/callback/google`
7. Click "Create"
8. **IMPORTANT**: Copy the **Client ID** and **Client Secret** that appear

## Step 5: Update Environment Variables

### Local Development (.env.local)
Update your `.env.local` file with the credentials:
```bash
GOOGLE_CLIENT_ID=your-client-id-from-step-4
GOOGLE_CLIENT_SECRET=your-client-secret-from-step-4
NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true
```

### Production (Vercel)
1. Go to your Vercel project dashboard
2. Go to **Settings** > **Environment Variables**
3. Add these three variables:
   - `GOOGLE_CLIENT_ID` = your-client-id
   - `GOOGLE_CLIENT_SECRET` = your-client-secret
   - `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED` = `true`
4. Click "Save"
5. Redeploy your application

## Step 6: Test It Out

1. Restart your local dev server: `npm run dev`
2. Go to `http://localhost:3000/login`
3. You should see a "Continue with Google" button
4. Click it and test the sign-in flow

## Troubleshooting

**Button doesn't appear?**
- Make sure `NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED=true` is set
- Restart your dev server
- Check browser console for errors

**Redirect URI mismatch error?**
- Double-check the redirect URIs in Google Cloud Console match exactly:
  - `http://localhost:3000/api/auth/callback/google`
  - `https://www.benchboss.pro/api/auth/callback/google`

**OAuth error on production?**
- Make sure all three environment variables are set in Vercel
- Redeploy after adding the variables
- Check that the authorized origins include `https://www.benchboss.pro`

## Security Notes

- Keep your `GOOGLE_CLIENT_SECRET` private
- Never commit it to git
- Rotate it if it's ever exposed
- The `.env.local` file is already in `.gitignore`
