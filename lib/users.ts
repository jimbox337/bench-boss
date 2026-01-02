import bcrypt from 'bcryptjs';
import { prisma } from './prisma';
import { generateToken, sendVerificationEmail } from './email';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
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

export async function createUser(
  username: string,
  email: string,
  name: string,
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

    // Generate email verification token
    const verificationToken = generateToken();
    const verificationExpires = new Date();
    verificationExpires.setHours(verificationExpires.getHours() + 24); // 24 hour expiry

    // Create user in database
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        name: name,
        password: hashedPassword,
        profilePicture: null,
        emailVerificationToken: verificationToken,
        emailVerificationExpires: verificationExpires,
      },
    });

    // Send verification email (don't wait for it to complete)
    sendVerificationEmail(user.email, user.name, verificationToken).catch((error) => {
      console.error('Failed to send verification email:', error);
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
