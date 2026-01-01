import { NextResponse } from 'next/server';
import { createUser, findUserByUsername } from '@/lib/users';
import { prisma } from '@/lib/prisma';

/**
 * API endpoint to create a demo user with detailed diagnostics
 * Visit this URL in your browser: https://your-app.vercel.app/api/seed-demo-user
 */
export async function GET() {
  const diagnostics: any = {
    env: {
      NEXT_PHASE: process.env.NEXT_PHASE,
      VERCEL_ENV: process.env.VERCEL_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'Set (starts with: ' + process.env.DATABASE_URL.substring(0, 10) + '...)' : 'Not set',
      NODE_ENV: process.env.NODE_ENV
    }
  };

  try {
    // Check if user already exists
    const existingUser = await findUserByUsername('demo');
    diagnostics.existingUser = existingUser ? {
      id: existingUser.id,
      username: existingUser.username,
      createdAt: existingUser.createdAt
    } : null;

    if (existingUser) {
      return NextResponse.json({
        success: true,
        message: 'Demo user already exists!',
        username: 'demo',
        password: 'demo1234',
        diagnostics
      });
    }

    // Try to create user
    const user = await createUser('demo', 'demo1234');
    diagnostics.creationAttempt = user ? 'Success' : 'Returned null';

    if (user) {
      return NextResponse.json({
        success: true,
        message: 'Demo user created successfully!',
        username: 'demo',
        password: 'demo1234',
        userId: user.id,
        diagnostics
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'User creation returned null (likely blocked by build-time check)',
        diagnostics
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error creating demo user:', error);
    diagnostics.error = error instanceof Error ? error.message : 'Unknown error';
    diagnostics.errorStack = error instanceof Error ? error.stack : undefined;

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      diagnostics
    }, { status: 500 });
  }
}
