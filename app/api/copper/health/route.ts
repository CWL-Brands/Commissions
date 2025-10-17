import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if Copper API credentials are configured
    const copperApiKey = process.env.COPPER_API_KEY;
    const copperEmail = process.env.COPPER_USER_EMAIL || process.env.COPPER_EMAIL;

    if (!copperApiKey || !copperEmail) {
      return NextResponse.json(
        { status: 'offline', message: 'Copper API not configured' },
        { status: 503 }
      );
    }

    // Make a lightweight API call to verify credentials work
    try {
      const response = await fetch('https://api.copper.com/developer_api/v1/account', {
        method: 'GET',
        headers: {
          'X-PW-AccessToken': copperApiKey,
          'X-PW-Application': 'developer_api',
          'X-PW-UserEmail': copperEmail,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        return NextResponse.json({
          status: 'online',
          message: 'Copper API connected',
          timestamp: new Date().toISOString()
        });
      } else {
        return NextResponse.json(
          { status: 'offline', message: `Copper API error: ${response.status}` },
          { status: 503 }
        );
      }
    } catch (apiError) {
      return NextResponse.json(
        { status: 'offline', message: 'Copper API unreachable' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Copper health check error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
}
