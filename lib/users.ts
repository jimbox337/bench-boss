import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { generateToken, sendVerificationEmail } from './email';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string | null;
  password: string; // hashed
  role: string; // user or admin
  profilePicture: string | null;
  emailVerified: Date | null;
  createdAt: Date;
}

// Helper to check if we're in a build environment
const isBuildTime = () => {
  return process.env.NEXT_PHASE === 'phase-production-build';
};

export async function createPendingUser(
  username: string,
  email: string,
  firstName: string,
  lastName: string | null,
  password: string
): Promise<{ id: string; email: string; firstName: string; lastName: string | null } | null> {
  if (isBuildTime()) {
    console.log('Skipping pending user creation during build');
    return null;
  }

  try {
    // Check if user already exists (in both User and PendingUser tables)
    const existingUser = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    const existingPendingUser = await prisma.pendingUser.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (existingUser || existingPendingUser) {
      return null;
    }

    // Check if email already exists (in both tables)
    const existingEmailUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    const existingEmailPending = await prisma.pendingUser.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingEmailUser || existingEmailPending) {
      return null;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiry

    // Create pending user in database
    const pendingUser = await prisma.pendingUser.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        firstName: firstName,
        lastName: lastName,
        password: hashedPassword,
        verificationToken: verificationToken,
        verificationExpires: verificationExpires,
      },
    });

    // Send verification email (don't wait for it to complete)
    console.log('📧 Attempting to send verification email to:', pendingUser.email);
    const displayName = pendingUser.lastName
      ? `${pendingUser.firstName} ${pendingUser.lastName}`
      : pendingUser.firstName;
    sendVerificationEmail(pendingUser.email, displayName, verificationToken)
      .then((success) => {
        if (success) {
          console.log('✅ Verification email sent successfully to:', pendingUser.email);
        } else {
          console.error('❌ Verification email failed to send to:', pendingUser.email);
        }
      })
      .catch((error) => {
        console.error('❌ Failed to send verification email to:', pendingUser.email, error);
      });

    return {
      id: pendingUser.id,
      email: pendingUser.email,
      firstName: pendingUser.firstName,
      lastName: pendingUser.lastName,
    };
  } catch (error) {
    console.error('Error creating pending user:', error);
    return null;
  }
}

export async function createUser(
  username: string,
  email: string,
  firstName: string,
  lastName: string | null,
  password: string
): Promise<User | null> {
  if (isBuildTime()) {
    console.log('Skipping user creation during build');
    return null;
  }

  try {
    // Check if user already exists
    const existingUsername = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (existingUsername) {
      return null;
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingEmail) {
      return null;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database with verified email
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        firstName: firstName,
        lastName: lastName,
        password: hashedPassword,
        profilePicture: null,
        emailVerified: new Date(), // Auto-verify when created this way
      },
    });

    return user;
  } catch (error) {
    console.error('Error creating user:', error);
    return null;
  }
}

export async function findUserByUsername(username: string): Promise<User | null> {
  if (isBuildTime()) {
    console.log('Skipping user lookup during build');
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    return user;
  } catch (error) {
    console.error('Error finding user:', error);
    return null;
  }
}

export async function findUserByEmail(email: string): Promise<User | null> {
  if (isBuildTime()) {
    console.log('Skipping user lookup during build');
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    return user;
  } catch (error) {
    console.error('Error finding user by email:', error);
    return null;
  }
}

export async function validatePassword(user: User, password: string): Promise<boolean> {
  return bcrypt.compare(password, user.password);
}

export async function getUserById(id: string): Promise<User | null> {
  if (isBuildTime()) {
    console.log('Skipping user lookup during build');
    return null;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id }
    });

    return user;
  } catch (error) {
    console.error('Error finding user by ID:', error);
    return null;
  }
}
