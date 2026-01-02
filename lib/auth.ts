import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import { findUserByUsername, findUserByEmail, validatePassword, createUser } from './users';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        username: { label: 'Username', type: 'text' },
        email: { label: 'Email', type: 'email' },
        name: { label: 'Name', type: 'text' },
        password: { label: 'Password', type: 'password' },
        isSignUp: { label: 'Sign Up', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Please enter username and password');
        }

        const isSignUp = credentials.isSignUp === 'true';

        if (isSignUp) {
          // Sign up flow
          if (!credentials.email || !credentials.name) {
            throw new Error('Please enter email and name');
          }

          if (credentials.password.length < 4) {
            throw new Error('Password must be at least 4 characters');
          }

          const newUser = await createUser(
            credentials.username,
            credentials.email,
            credentials.name,
            credentials.password
          );

          if (!newUser) {
            throw new Error('Username or email already exists');
          }

          return {
            id: newUser.id,
            name: newUser.name,
            email: newUser.email,
            image: newUser.profilePicture,
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

          return {
            id: user.id,
            name: user.name,
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
    error: '/login',
  },

  // Callbacks
  callbacks: {
    async signIn({ user, account, profile }) {
      // Handle Google OAuth sign-in
      if (account?.provider === 'google' && profile?.email) {
        try {
          // Check if user exists with this email
          let existingUser = await findUserByEmail(profile.email);

          if (!existingUser) {
            // Create new user from Google account
            const username = profile.email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');

            existingUser = await prisma.user.create({
              data: {
                username: `${username}_${Date.now()}`, // Ensure unique username
                email: profile.email.toLowerCase(),
                name: profile.name || profile.email.split('@')[0],
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
