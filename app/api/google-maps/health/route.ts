import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Check if Google Maps API key is configured
    const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!googleMapsApiKey) {
      return NextResponse.json(
        { status: 'offline', message: 'Google Maps API not configured' },
        { status: 503 }
      );
    }

    // Make a lightweight API call to verify the key works
    // Using the Geocoding API with a simple request
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=1600+Amphitheatre+Parkway,+Mountain+View,+CA&key=${googleMapsApiKey}`
      );

      const data = await response.json();

      if (response.ok && data.status === 'OK') {
        return NextResponse.json({
          status: 'online',
          message: 'Google Maps API connected',
          timestamp: new Date().toISOString()
        });
      } else if (data.status === 'REQUEST_DENIED') {
        return NextResponse.json(
          { status: 'offline', message: `Google Maps API error: ${data.error_message || 'Invalid API key'}` },
          { status: 503 }
        );
      } else {
        return NextResponse.json(
          { status: 'offline', message: `Google Maps API error: ${data.status}` },
          { status: 503 }
        );
      }
    } catch (apiError) {
      return NextResponse.json(
        { status: 'offline', message: 'Google Maps API unreachable' },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error('Google Maps health check error:', error);
    return NextResponse.json(
      { status: 'error', message: 'Health check failed' },
      { status: 500 }
    );
  }
}
