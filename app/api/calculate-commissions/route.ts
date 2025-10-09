import { NextRequest, NextResponse } from 'next/server';
import { calculateCommissions, saveCommissionResults } from '@/lib/services/commission-calculator';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CalculateRequest {
  userId: string; // This is the rep document ID from reps collection
  quarterId: string;
  startDate: string;
  endDate: string;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, quarterId, startDate, endDate }: CalculateRequest = await request.json();

    if (!userId || !quarterId || !startDate || !endDate) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, quarterId, startDate, endDate' },
        { status: 400 }
      );
    }

    // Get rep data from reps collection
    const repDoc = await adminDb.collection('reps').doc(userId).get();
    
    if (!repDoc.exists) {
      return NextResponse.json({ error: 'Rep not found' }, { status: 404 });
    }

    const repData = repDoc.data();
    const salesPerson = repData?.salesPerson || repData?.fishbowlUsername || repData?.name || 'Unknown';
    const repName = repData?.name || 'Unknown Rep';

    console.log(`Calculating bonuses for ${repName} (Fishbowl: ${salesPerson}) - ${quarterId}`);

    // Calculate commissions from Fishbowl SO Items
    const results = await calculateCommissions({
      repName: salesPerson,
      quarterId,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
    });

    // Save results to commission_entries
    await saveCommissionResults(userId, quarterId, results);

    return NextResponse.json({
      success: true,
      userId,
      quarterId,
      salesPerson,
      results: {
        totalRevenue: results.totalRevenue,
        totalMargin: results.totalMargin,
        newBusinessRevenue: results.newBusinessRevenue,
        maintainBusinessRevenue: results.maintainBusinessRevenue,
        orderCount: results.orderCount,
        customerCount: results.customerCount,
        newCustomerCount: results.newCustomerCount,
        lineItemCount: results.lineItemCount,
        productMixCategories: results.productMix.length,
        topProducts: results.productMix.slice(0, 5).map(p => ({
          productNum: p.productNum,
          product: p.product,
          category: p.category1,
          revenue: p.revenue,
          margin: p.margin,
          quantity: p.quantity,
          percentage: p.percentage.toFixed(1) + '%',
        })),
      },
    });
  } catch (error: any) {
    console.error('Commission calculation error:', error);
    return NextResponse.json(
      { error: error.message || 'Calculation failed' },
      { status: 500 }
    );
  }
}
