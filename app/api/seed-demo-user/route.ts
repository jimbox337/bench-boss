import { NextResponse } from 'next/server';
import { createUser, findUserByUsername } from '@/lib/users';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

/**
 * API endpoint to create/reset demo user
 * Visit: /api/seed-demo-user to create demo user
 * Visit: /api/seed-demo-user?reset=true to delete and recreate
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const shouldReset = searchParams.get('reset') === 'true';

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

    // If reset requested, delete existing user
    if (shouldReset && existingUser) {
      await prisma.user.delete({
        where: { id: existingUser.id }
      });
      diagnostics.deleted = true;
    } else if (existingUser) {
      // User exists and no reset requested
      return NextResponse.json({
        success: true,
        message: 'Demo user already exists! Add ?reset=true to recreate it.',
        username: 'demo',
        password: 'demo1234',
        diagnostics
      });
    }

    // Create new demo user
    const hashedPassword = await bcrypt.hash('demo1234', 10);
    const user = await prisma.user.create({
      data: {
        username: 'demo',
        password: hashedPassword,
        leagueName: "Demo's League",
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Demo user created successfully!',
      username: 'demo',
      password: 'demo1234',
      userId: user.id,
      diagnostics
    });
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
