import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Commission Calculation Progress Polling Endpoint
 * 
 * Returns the current progress of a commission calculation operation
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const calcId = searchParams.get('calcId');

    if (!calcId) {
      return NextResponse.json(
        { error: 'calcId is required' },
        { status: 400 }
      );
    }

    // Fetch progress from Firestore
    const progressDoc = await adminDb.collection('commission_calc_progress').doc(calcId).get();

    if (!progressDoc.exists) {
      return NextResponse.json(
        { error: 'Calculation session not found' },
        { status: 404 }
      );
    }

    const progressData = progressDoc.data();

    return NextResponse.json({
      success: true,
      progress: {
        status: progressData?.status || 'unknown',
        totalOrders: progressData?.totalOrders || 0,
        currentOrder: progressData?.currentOrder || 0,
        percentage: progressData?.percentage || 0,
        currentRep: progressData?.currentRep || '',
        currentCustomer: progressData?.currentCustomer || '',
        currentOrderNum: progressData?.currentOrderNum || '',
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
