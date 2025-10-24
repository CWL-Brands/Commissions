import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Progress Polling Endpoint
 * 
 * Returns the current progress of a Fishbowl import operation
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const importId = searchParams.get('importId');

    if (!importId) {
      return NextResponse.json(
        { error: 'importId is required' },
        { status: 400 }
      );
    }

    // Fetch progress from Firestore
    const progressDoc = await adminDb.collection('import_progress').doc(importId).get();

    if (!progressDoc.exists) {
      return NextResponse.json(
        { error: 'Import session not found' },
        { status: 404 }
      );
    }

    const progressData = progressDoc.data();

    return NextResponse.json({
      success: true,
      progress: {
        status: progressData?.status || 'unknown',
        totalRows: progressData?.totalRows || 0,
        currentRow: progressData?.currentRow || 0,
        percentage: progressData?.percentage || 0,
        currentCustomer: progressData?.currentCustomer || '',
        currentOrder: progressData?.currentOrder || '',
        stats: progressData?.stats || {},
        startedAt: progressData?.startedAt?.toDate?.().toISOString() || null,
        completedAt: progressData?.completedAt?.toDate?.().toISOString() || null,
        updatedAt: progressData?.updatedAt?.toDate?.().toISOString() || null
      }
    });

  } catch (error: any) {
    console.error('❌ Progress fetch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch progress' },
      { status: 500 }
    );
  }
}
