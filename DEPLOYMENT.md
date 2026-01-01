# 🚀 Deploying to Vercel

## Prerequisites
- GitHub account with bench-boss repository
- Vercel account (sign up at [vercel.com](https://vercel.com))

## Step-by-Step Deployment

### 1. Create Vercel Project

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click "Add New..." → "Project"
3. Import your `bench-boss` repository
4. Click "Import"

### 2. Set Up Vercel Postgres Database

1. In your Vercel project, go to the **Storage** tab
2. Click "Create Database"
3. Select **Postgres**
4. Choose a database name (e.g., `bench-boss-db`)
5. Select your preferred region (choose closest to your users)
6. Click "Create"

Vercel will automatically add these environment variables to your project:
- `POSTGRES_URL`
- `POSTGRES_URL_NON_POOLING`
- `POSTGRES_PRISMA_URL`
- And others...

### 3. Configure Environment Variables

Go to **Settings** → **Environment Variables** and add:

#### Required Variables:

1. **NEXTAUTH_SECRET**
   ```bash
   # Generate a secure secret:
   openssl rand -base64 32
   ```
   - Value: (paste the generated secret)
   - Environment: Production, Preview, Development

2. **NEXTAUTH_URL** *(Optional - auto-detected on Vercel)*
   - **You can skip this!** NextAuth automatically detects your Vercel URL
   - Only set manually if you have a custom domain
   - Value: `https://your-custom-domain.com`
   - Environment: Production

3. **GROQ_API_KEY**
   - Value: Your Groq API key from [console.groq.com](https://console.groq.com)
   - Get a FREE key by signing up at Groq
   - Environment: Production, Preview, Development

4. **DATABASE_URL** (if not auto-added by Vercel Postgres)
   - Value: Use `POSTGRES_PRISMA_URL` from your Vercel Postgres dashboard
   - Environment: Production, Preview, Development

5. **DIRECT_URL** (if not auto-added)
   - Value: Use `POSTGRES_URL_NON_POOLING` from your Vercel Postgres dashboard
   - Environment: Production, Preview, Development

### 4. Set Up Prisma Migration

After environment variables are set, you need to run migrations:

#### Option A: Via Vercel CLI (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Link your project
vercel link

# Pull environment variables
vercel env pull .env.production

# Run migration
npx prisma migrate deploy
```

#### Option B: Add to Build Command

In Vercel project settings:
- **Build Command**: `prisma generate && prisma migrate deploy && next build`
- **Install Command**: `npm install`

### 5. Deploy

1. Click "Deploy" in Vercel dashboard
2. Wait for build to complete (~2-3 minutes)
3. Visit your deployed URL!

## Post-Deployment

### Test the Deployment

1. Visit your Vercel URL (e.g., `https://bench-boss.vercel.app`)
2. Click "Get Started"
3. Create a new account to test registration
4. Sign in and verify:
   - Dashboard loads
   - Players load from NHL API
   - AI player analysis works (click any player on My Team)
   - All navigation works

### Create Demo User (Optional)

Connect to your Vercel Postgres database and run:

```sql
-- Generate a bcrypt hash for "demo1234" (or use bcryptjs in Node)
INSERT INTO "User" (id, username, password, "leagueName", "createdAt", "updatedAt")
VALUES (
  'demo-user-id',
  'demo',
  '$2a$10$YourHashedPasswordHere',
  'Demo League',
  NOW(),
  NOW()
);
```

Or use the Vercel SQL editor in the dashboard.

## Troubleshooting

### Build Fails with "Prisma Client Not Generated"

**Solution**: Ensure `prisma generate` runs before build:
- Build Command: `prisma generate && next build`

### Database Connection Errors

**Solution**: Check that `DATABASE_URL` and `DIRECT_URL` are set correctly:
1. Go to Storage → Your Postgres DB → .env.local tab
2. Copy the `POSTGRES_PRISMA_URL` value
3. Set as `DATABASE_URL` in environment variables
4. Copy `POSTGRES_URL_NON_POOLING` as `DIRECT_URL`

### NextAuth Errors

**Solution**: Verify `NEXTAUTH_SECRET` and `NEXTAUTH_URL` are set:
- `NEXTAUTH_URL` must match your deployment URL exactly
- Include `https://` in the URL

### AI Analysis Not Working

**Solution**: Check `GROQ_API_KEY` is set and valid:
1. Verify the key in Vercel environment variables
2. Test the key at [console.groq.com](https://console.groq.com)

### Users Not Persisting

**Solution**: Ensure database migrations have run:
```bash
vercel env pull
npx prisma migrate deploy
```

## Custom Domain (Optional)

1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update `NEXTAUTH_URL` to your custom domain

## Continuous Deployment

Every `git push` to `main` branch will automatically:
1. Trigger a new Vercel deployment
2. Build your app
3. Deploy to production

To disable auto-deployments:
- Go to **Settings** → **Git**
- Configure deployment branches

## Monitoring

### View Logs

1. Go to your project in Vercel dashboard
2. Click on a deployment
3. Click "Functions" or "Logs" tab

### Analytics

Enable Vercel Analytics:
1. Go to **Analytics** tab
2. Click "Enable Analytics"
3. Free for hobby projects!

## Security Checklist

- [ ] `NEXTAUTH_SECRET` is a strong, random value
- [ ] `NEXTAUTH_URL` matches your production URL
- [ ] Database credentials are secure (never commit them)
- [ ] GROQ_API_KEY is kept private
- [ ] Enable HTTPS (automatic with Vercel)
- [ ] Consider adding rate limiting for API routes

## Cost Estimate

**Vercel Hobby Plan (FREE):**
- ✅ Unlimited deployments
- ✅ 100GB bandwidth/month
- ✅ Serverless Functions
- ✅ Automatic HTTPS

**Vercel Postgres:**
- ✅ FREE tier: 256 MB storage, 60 hours compute/month
- Sufficient for demo/personal use
- Upgrade to Pro if you exceed limits

**Groq API:**
- ✅ Completely FREE
- 30 requests/minute rate limit

**Total:** $0/month for personal use! 🎉

---

**Need help?** Check the [Vercel Documentation](https://vercel.com/docs) or [Prisma Vercel Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-vercel).
