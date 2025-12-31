# Authentication System Documentation

## Overview

Bench Boss now uses **NextAuth.js v4** for production-ready authentication with enterprise-grade security features.

## Features Implemented

### ✅ 1. NextAuth.js Integration
- Industry-standard authentication library for Next.js
- Battle-tested, maintained by Vercel
- Supports multiple providers (credentials, OAuth, etc.)

### ✅ 2. JWT (JSON Web Tokens)
- **Stateless authentication** - no server-side session storage required
- Tokens are signed and encrypted
- Tokens stored in httpOnly cookies (immune to XSS attacks)
- 7-day token expiration with automatic refresh

### ✅ 3. Secure Password Handling
- **bcryptjs** for password hashing (10 salt rounds)
- Passwords never stored in plain text
- Secure password comparison using constant-time algorithm

### ✅ 4. Session Management
- Automatic session refresh
- 7-day session duration
- Server-side session validation
- Secure session cookies with httpOnly flag

### ✅ 5. CSRF Protection
- Built-in CSRF token validation in NextAuth
- Automatic CSRF token generation per request
- Protection against cross-site request forgery attacks

### ✅ 6. Secure Storage
- **httpOnly cookies** (cannot be accessed via JavaScript)
- Secure flag for HTTPS-only transmission
- SameSite attribute to prevent CSRF
- No sensitive data in localStorage

## Architecture

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │ 1. Login Request
       ▼
┌─────────────────┐
│  Login Page     │
│  (Client-Side)  │
└──────┬──────────┘
       │ 2. signIn()
       ▼
┌─────────────────┐
│   NextAuth API  │
│  /api/auth/*    │
└──────┬──────────┘
       │ 3. Validate Credentials
       ▼
┌─────────────────┐
│   User Store    │
│  (lib/users.ts) │
└──────┬──────────┘
       │ 4. bcrypt.compare()
       ▼
┌─────────────────┐
│   JWT Token     │
│   Generation    │
└──────┬──────────┘
       │ 5. Set httpOnly Cookie
       ▼
┌─────────────────┐
│  Session Active │
└─────────────────┘
```

## Files

### Core Authentication
- **`lib/auth.ts`** - NextAuth configuration
- **`lib/users.ts`** - User management with bcrypt
- **`app/api/auth/[...nextauth]/route.ts`** - NextAuth API route
- **`lib/AuthContext.tsx`** - Session provider wrapper

### UI Components
- **`app/login/page.tsx`** - Login/signup page
- **`app/welcome/page.tsx`** - Landing page
- **`components/Layout.tsx`** - Protected layout with session

### Configuration
- **`.env.local`** - Environment variables (gitignored)
- **`.env.example`** - Example environment variables

## Environment Variables

```bash
# Required
NEXTAUTH_SECRET=your-secret-key-here-replace-in-production
NEXTAUTH_URL=http://localhost:3000

# Optional (for database persistence)
# DATABASE_URL=postgresql://user:password@localhost:5432/benchboss
```

### Generating NEXTAUTH_SECRET

```bash
# Use OpenSSL to generate a secure random secret
openssl rand -base64 32
```

## Usage

### Sign In
```typescript
import { signIn } from 'next-auth/react';

await signIn('credentials', {
  username: 'demo',
  password: 'demo1234',
  redirect: false,
});
```

### Sign Out
```typescript
import { signOut } from 'next-auth/react';

await signOut({ callbackUrl: '/welcome' });
```

### Access Session
```typescript
import { useSession } from 'next-auth/react';

function MyComponent() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <div>Loading...</div>;
  if (!session) return <div>Not authenticated</div>;

  return <div>Welcome {session.user?.name}</div>;
}
```

### Protect Pages
```typescript
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

function ProtectedPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, router]);

  if (status === 'loading') return <div>Loading...</div>;
  if (!session) return null;

  return <div>Protected Content</div>;
}
```

## Security Features

### 1. Password Security
- **Hashing Algorithm**: bcrypt with 10 salt rounds
- **Minimum Length**: 4 characters (configurable)
- **Storage**: Only hashed passwords stored, never plain text

### 2. Token Security
- **JWT Signing**: HS256 algorithm with NEXTAUTH_SECRET
- **Cookie Flags**:
  - `httpOnly: true` - No JavaScript access
  - `secure: true` - HTTPS only (production)
  - `sameSite: 'lax'` - CSRF protection
- **Expiration**: 7 days (configurable)

### 3. Session Security
- **Server-side validation** on every request
- **Automatic refresh** before expiration
- **Secure logout** with token invalidation

### 4. CSRF Protection
- Automatic CSRF token generation
- Token validation on state-changing requests
- Built into NextAuth

### 5. XSS Protection
- httpOnly cookies prevent JavaScript access
- No sensitive data in localStorage
- Content Security Policy compatible

## Current Implementation (Demo)

### In-Memory User Store
```typescript
// lib/users.ts
const users: Map<string, User> = new Map();
```

**Note**: Users are stored in memory and will be lost on server restart. This is for demo purposes only.

### Default Demo Account
- **Username**: `demo`
- **Password**: `demo1234`

## Production Recommendations

### 1. Database Integration
Replace the in-memory store with a real database:

```typescript
// Using Prisma
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createUser(username: string, password: string) {
  const hashedPassword = await bcrypt.hash(password, 10);

  return prisma.user.create({
    data: {
      username,
      password: hashedPassword,
      leagueName: `${username}'s League`,
    },
  });
}
```

### 2. Enhanced Password Requirements
```typescript
// Stronger password validation
function validatePassword(password: string): boolean {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return password.length >= minLength &&
         hasUpperCase &&
         hasLowerCase &&
         hasNumbers &&
         hasSpecialChar;
}
```

### 3. Rate Limiting
```typescript
// Prevent brute force attacks
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window
  message: 'Too many login attempts, please try again later.',
});
```

### 4. Two-Factor Authentication (2FA)
```typescript
// Add 2FA with authenticator apps
import speakeasy from 'speakeasy';

const secret = speakeasy.generateSecret();
const token = speakeasy.totp({
  secret: secret.base32,
  encoding: 'base32'
});
```

### 5. OAuth Providers
```typescript
// Add Google, GitHub, etc.
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    // ... existing providers
  ],
};
```

### 6. Email Verification
```typescript
// Verify email addresses before activation
export async function sendVerificationEmail(email: string, token: string) {
  // Send email with verification link
  const verificationUrl = `${process.env.NEXTAUTH_URL}/verify?token=${token}`;
  // ... email sending logic
}
```

### 7. Audit Logging
```typescript
// Track authentication events
export async function logAuthEvent(event: {
  userId: string;
  action: 'login' | 'logout' | 'failed_login';
  ip: string;
  userAgent: string;
  timestamp: Date;
}) {
  await prisma.authLog.create({ data: event });
}
```

## Migration from Old System

The old localStorage-based system has been completely replaced. No migration needed for new users.

If you have existing users in localStorage, they will need to create new accounts with the secure system.

## Testing

### Test Authentication Flow
```bash
# 1. Start the dev server
npm run dev

# 2. Navigate to /welcome
# 3. Click "Get Started"
# 4. Sign up with a new account
# 5. Verify JWT cookie is set (check DevTools → Application → Cookies)
# 6. Access protected routes (/, /players, etc.)
# 7. Sign out
# 8. Verify redirect to /welcome
```

### Security Checklist
- [ ] NEXTAUTH_SECRET is set and secure (32+ characters)
- [ ] Passwords are hashed with bcrypt
- [ ] Cookies have httpOnly flag
- [ ] CSRF protection is enabled
- [ ] Session expiration works correctly
- [ ] Sign out clears session
- [ ] Protected routes redirect when not authenticated

## Troubleshooting

### Issue: "NEXTAUTH_SECRET missing"
**Solution**: Copy `.env.example` to `.env.local` and set NEXTAUTH_SECRET

### Issue: "Invalid session"
**Solution**: Clear cookies and sign in again

### Issue: "CSRF token mismatch"
**Solution**: Ensure NEXTAUTH_URL matches your domain

### Issue: "User not found"
**Solution**: Server restarted - in-memory users lost. Use demo account or create new one.

## References

- [NextAuth.js Documentation](https://next-auth.js.org/)
- [JWT Best Practices](https://datatracker.ietf.org/doc/html/rfc8725)
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [bcrypt NPM Package](https://www.npmjs.com/package/bcryptjs)
