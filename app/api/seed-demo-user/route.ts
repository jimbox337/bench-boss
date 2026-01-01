import { NextResponse } from 'next/server';
import { createUser } from '@/lib/users';

/**
 * API endpoint to create a demo user
 * Visit this URL in your browser: https://your-app.vercel.app/api/seed-demo-user
 */
export async function GET() {
  try {
    const user = await createUser('demo', 'demo1234');

    if (user) {
      return NextResponse.json({
        success: true,
        message: 'Demo user created successfully!',
        username: 'demo',
        password: 'demo1234'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'Demo user already exists or could not be created'
      });
    }
  } catch (error) {
    console.error('Error creating demo user:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
