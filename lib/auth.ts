import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { findUserByUsername, findUserByEmail, validatePassword, createPendingUser } from './users';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    // Only add Google provider if credentials are configured
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        email: { label: 'Email', type: 'email' },
        firstName: { label: 'First Name', type: 'text' },
        lastName: { label: 'Last Name', type: 'text' },
        password: { label: 'Password', type: 'password' },
        isSignUp: { label: 'Sign Up', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Please enter username and password');
        }

        const isSignUp = credentials.isSignUp === 'true';

        if (isSignUp) {
          // Sign up flow - create pending user
          if (!credentials.email || !credentials.firstName) {
            throw new Error('Please enter email and first name');
          }

          if (credentials.password.length < 4) {
            throw new Error('Password must be at least 4 characters');
          }

          const pendingUser = await createPendingUser(
            credentials.username,
            credentials.email,
            credentials.firstName,
            credentials.lastName || null,
            credentials.password
          );

          if (!pendingUser) {
            throw new Error('Username or email already exists');
          }

          // Return pending user info (won't actually log them in)
          const displayName = pendingUser.lastName
            ? `${pendingUser.firstName} ${pendingUser.lastName}`
            : pendingUser.firstName;

          return {
            id: pendingUser.id,
            name: displayName,
            email: pendingUser.email,
            image: null,
          };
        } else {
          // Sign in flow
          const user = await findUserByUsername(credentials.username);

          if (!user) {
            throw new Error('Invalid username or password');
          }

          const isValid = await validatePassword(user, credentials.password);

          if (!isValid) {
            throw new Error('Invalid username or password');
          }

          // Check if email is verified
          if (!user.emailVerified) {
            throw new Error('Please verify your email before logging in. Check your inbox for the verification link.');
          }

          const displayName = user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.firstName;

          return {
            id: user.id,
            name: displayName,
            email: user.email,
            image: user.profilePicture,
          };
        }
      },
    }),
  ],

  // Use JWT for session management (stateless)
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  // JWT configuration
  jwt: {
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },

  // Custom pages
  pages: {
    signIn: '/login',
  },

  // Callbacks
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Handle OAuth errors by redirecting to login
      if (url.includes('error=OAuthSignin') || url.includes('error=Configuration')) {
        return `${baseUrl}/login`;
      }
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
    async signIn({ user, account, profile }) {
      // Handle Google OAuth sign-in
      if (account?.provider === 'google' && profile?.email) {
        try {
          // Check if user exists with this email
          let existingUser = await findUserByEmail(profile.email);

          if (!existingUser) {
            // Create new user from Google account
            const username = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

            const fullName = profile.name || profile.email.split('@')[0];
            const nameParts = fullName.split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

            existingUser = await prisma.user.create({
              data: {
                username: `${username}_${Date.now()}`, // Ensure unique username
                email: profile.email.toLowerCase(),
                firstName: firstName,
                lastName: lastName,
                password: '', // No password for OAuth users
                profilePicture: (profile as any).picture || null,
                emailVerified: new Date(), // Auto-verify Google emails
              },
            });
          } else if (!existingUser.emailVerified) {
            // Auto-verify email for existing users signing in with Google
            await prisma.user.update({
              where: { id: existingUser.id },
              data: { emailVerified: new Date() },
            });
          }

          // Update user object with database ID
          user.id = existingUser.id;
        } catch (error) {
          console.error('Error handling Google sign-in:', error);
          return false;
        }
      }

      return true;
    },
    async jwt({ token, user }) {
      // Add custom fields to JWT
      if (user) {
        token.id = user.id;
        token.picture = user.image;
      }
      return token;
    },
    async session({ session, token }) {
      // Add custom fields to session
      if (session.user) {
        (session.user as any).id = token.id;
        session.user.image = token.picture as string | null | undefined;
      }
      return session;
    },
  },

  // Security options
  secret: process.env.NEXTAUTH_SECRET,

  // Enable debug in development
  debug: process.env.NODE_ENV === 'development',
};
