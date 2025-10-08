import { NextRequest, NextResponse } from 'next/server';
import { calculateCommissions, saveCommissionResults, getSalesPersonFromEmail } from '@/lib/services/commission-calculator';
import { getUserData } from '@/lib/copper/shared-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface CalculateRequest {
  userId: string;
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

    // Get user email
    const userData = await getUserData(userId);
    if (!userData?.email) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Map email to Fishbowl sales person name
    const salesPerson = getSalesPersonFromEmail(userData.email);

    console.log(`Calculating commissions for ${userData.email} (${salesPerson}) - ${quarterId}`);

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
