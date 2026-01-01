import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

export interface User {
  id: string;
  username: string;
  password: string; // hashed
  leagueName: string;
  createdAt: Date;
}

// Helper to check if we're in a build environment
const isBuildTime = () => {
  return process.env.NEXT_PHASE === 'phase-production-build';
};

export async function createUser(username: string, password: string): Promise<User | null> {
  if (isBuildTime()) {
    console.log('Skipping user creation during build');
    return null;
  }

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { username: username.toLowerCase() }
    });

    if (existing) {
      return null;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        username: username.toLowerCase(),
        password: hashedPassword,
        leagueName: `${username}'s League`,
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
