import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

/**
 * Get commission calculation logs for a specific month
 * GET /api/commission-calculation-logs?month=2025-10&rep=all
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const rep = searchParams.get('rep') || 'all';

    if (!month) {
      return NextResponse.json(
        { error: 'Month parameter is required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    console.log(`Fetching calculation logs for month: ${month}, rep: ${rep}`);

    // Build query
    let query = adminDb.collection('commission_calculation_logs')
      .where('commissionMonth', '==', month);

    if (rep !== 'all') {
      query = query.where('repName', '==', rep);
    }

    const snapshot = await query.get();
    
    const logs: any[] = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      logs.push({
        id: doc.id,
        ...data,
        calculatedAt: data.calculatedAt?.toDate?.() || data.calculatedAt,
        orderDate: data.orderDate?.toDate?.() || data.orderDate
      });
    });

    // Sort by calculated date (newest first)
    logs.sort((a, b) => new Date(b.calculatedAt).getTime() - new Date(a.calculatedAt).getTime());

    console.log(`Found ${logs.length} calculation logs`);

    return NextResponse.json({
      success: true,
      logs: logs,
      count: logs.length
    });

  } catch (error: any) {
    console.error('Error fetching calculation logs:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch calculation logs' },
      { status: 500 }
    );
  }
}
