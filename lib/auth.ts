import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { findUserByUsername, validatePassword, createUser } from './users';

export const authOptions: NextAuthOptions = {
  providers: [
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
