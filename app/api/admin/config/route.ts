import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/config
// Secured by header x-admin-pass which must match process.env.TEAM_ADMIN_PASS
export async function POST(request: NextRequest) {
  try {
    const pass = request.headers.get('x-admin-pass') || '';
    const expected = process.env.TEAM_ADMIN_PASS || '';
    
    if (!expected) {
      return NextResponse.json({ error: 'Server missing TEAM_ADMIN_PASS' }, { status: 500 });
    }
    
    if (pass !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Update commission configuration
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    await adminDb.collection('settings').doc('commission_config').set({
      ...body,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to update config' }, { status: 500 });
  }
}

// GET /api/admin/config
// Secured by header x-admin-pass
export async function GET(request: NextRequest) {
  try {
    const pass = request.headers.get('x-admin-pass') || '';
    const expected = process.env.TEAM_ADMIN_PASS || '';
    
    if (!expected) {
      return NextResponse.json({ error: 'Server missing TEAM_ADMIN_PASS' }, { status: 500 });
    }
    
    if (pass !== expected) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }

    const configDoc = await adminDb.collection('settings').doc('commission_config').get();
    
    if (!configDoc.exists) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: configDoc.data() });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed to load config' }, { status: 500 });
  }
}
