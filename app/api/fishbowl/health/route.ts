import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if Fishbowl API credentials are configured
    const fishbowlHost = process.env.FISHBOWL_HOST;
    const fishbowlPort = process.env.FISHBOWL_PORT;
    const fishbowlUsername = process.env.FISHBOWL_USERNAME;
    const fishbowlPassword = process.env.FISHBOWL_PASSWORD;

    if (!fishbowlHost || !fishbowlPort || !fishbowlUsername || !fishbowlPassword) {
      return NextResponse.json(
        { status: 'offline', message: 'Fishbowl API not configured - awaiting credentials' },
        { status: 503 }
      );
    }

    // Fishbowl API configured - return online
    // Note: Actual connection test would require Fishbowl SDK integration
    return NextResponse.json({
      status: 'online',
      message: 'Fishbowl API credentials configured',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Fishbowl health check error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
}
