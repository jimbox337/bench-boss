import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find pending user with this verification token
    const pendingUser = await prisma.pendingUser.findUnique({
      where: { verificationToken: token },
    });

    if (!pendingUser) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification token' },
        { status: 400 }
      );
    }

    // Check if token has expired
    if (pendingUser.verificationExpires < new Date()) {
      // Delete expired pending user
      await prisma.pendingUser.delete({
        where: { id: pendingUser.id },
      });

      return NextResponse.json(
        { success: false, error: 'Verification token has expired. Please sign up again.' },
        { status: 400 }
      );
    }

    // Create actual user from pending user
    const user = await prisma.user.create({
      data: {
        username: pendingUser.username,
        email: pendingUser.email,
        name: pendingUser.name,
        password: pendingUser.password, // Already hashed
        emailVerified: new Date(), // Mark as verified immediately
        profilePicture: null,
      },
    });

    // Delete the pending user
    await prisma.pendingUser.delete({
      where: { id: pendingUser.id },
    });

    console.log('✅ User created and verified:', user.email);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! You can now log in.',
    });
  } catch (error) {
    console.error('Error verifying email:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify email' },
      { status: 500 }
    );
  }
}
