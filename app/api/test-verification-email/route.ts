import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { sendVerificationEmail, generateToken } from '@/lib/email';
import { isAdmin } from '@/lib/admin';
import { getUserById } from '@/lib/users';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const user = await getUserById(session.user.id);
    if (!user || !isAdmin(user.username)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden - Admin access only' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      );
    }

    // Generate a test token
    const testToken = generateToken();

    // Send the verification email
    console.log(`📧 Attempting to send verification email to: ${email}`);
    const success = await sendVerificationEmail(email, session.user.name || 'Test User', testToken);

    if (success) {
      console.log(`✅ Verification email sent successfully to: ${email}`);
      return NextResponse.json({
        success: true,
        message: 'Verification email sent successfully',
      });
    } else {
      console.error(`❌ Failed to send verification email to: ${email}`);
      return NextResponse.json(
        { success: false, error: 'Failed to send verification email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in test-verification-email API:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
