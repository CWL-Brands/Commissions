import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Calculate monthly commissions from Fishbowl sales orders
 * POST /api/calculate-monthly-commissions
 * 
 * Body: {
 *   month: "05",
 *   year: 2024,
 *   salesPerson?: "BenW" // Optional, if not provided calculates for all reps
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { month, year, salesPerson } = body;

    if (!month || !year) {
      return NextResponse.json(
        { error: 'Month and year are required' },
        { status: 400 }
      );
    }

    console.log(`Calculating monthly commissions for ${year}-${month}${salesPerson ? ` (${salesPerson})` : ' (all reps)'}`);

    // Get commission rates from settings (load all title-specific rate documents)
    const settingsSnapshot = await adminDb.collection('settings').get();
    const commissionRatesByTitle = new Map();
    
    settingsSnapshot.forEach(doc => {
      if (doc.id.startsWith('commission_rates_')) {
        // Extract title from document ID (e.g., "commission_rates_Account_Executive" -> "Account Executive")
        const titleKey = doc.id.replace('commission_rates_', '').replace(/_/g, ' ');
        commissionRatesByTitle.set(titleKey, doc.data());
      }
    });
    
    console.log(`Loaded commission rates for ${commissionRatesByTitle.size} titles`);
    
    if (commissionRatesByTitle.size === 0) {
      return NextResponse.json(
        { error: 'Commission rates not configured for any titles' },
        { status: 400 }
      );
    }

    // Get commission rules from settings
    const rulesDoc = await adminDb.collection('settings').doc('commission_rules').get();
    const commissionRules = rulesDoc.exists ? rulesDoc.data() : { excludeShipping: true, useOrderValue: true };
    console.log('Commission rules:', commissionRules);

    // Load all customers with account types
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    const customersMap = new Map();
    customersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.customerNum || data.customerId) {
        const key = data.customerNum || data.customerId;
        customersMap.set(key, { id: doc.id, ...data });
      }
    });
    console.log(`Loaded ${customersMap.size} customers with account types`);

    // Get all reps - map by BOTH salesPerson (long name from Fishbowl) AND fishbowlUsername
    const repsSnapshot = await adminDb.collection('reps').get();
    const repsMap = new Map();
    repsSnapshot.forEach(doc => {
      const data = doc.data();
      const repData = { id: doc.id, ...data };
      
      // Map by salesPerson if it exists (long name like "Jared", "BenW", "DerekW")
      if (data.salesPerson) {
        repsMap.set(data.salesPerson, repData);
      }
      
      // Also map by fishbowlUsername for backwards compatibility
      if (data.fishbowlUsername) {
        repsMap.set(data.fishbowlUsername, repData);
      }
      
      // Also map by name (first name only) to catch cases like "Jared" -> "Jared"
      if (data.name) {
        const firstName = data.name.split(' ')[0];
        if (!repsMap.has(firstName)) {
          repsMap.set(firstName, repData);
        }
      }
    });

    // Query Fishbowl sales orders for the specified month
    const commissionMonth = `${year}-${month.padStart(2, '0')}`;
    let ordersQuery = adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', commissionMonth);
    
    if (salesPerson) {
      ordersQuery = ordersQuery.where('salesPerson', '==', salesPerson);
    }

    const ordersSnapshot = await ordersQuery.get();
    
    if (ordersSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: 'No orders found for the specified period',
        processed: 0,
        commissionsCalculated: 0,
        totalCommission: 0
      });
    }

    console.log(`Found ${ordersSnapshot.size} orders to process`);

    let processed = 0;
    let commissionsCalculated = 0;
    let totalCommission = 0;
    const commissionsByRep = new Map();

    // Process each order
    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data();
      processed++;

      // Get rep details
      const rep = repsMap.get(order.salesPerson);
      if (!rep || !rep.active) {
        console.log(`Skipping order ${order.num} - rep ${order.salesPerson} not found or inactive`);
        continue;
      }

      // Get customer account type
      const customer = customersMap.get(order.customerId) || customersMap.get(order.customerNum);
      const accountType = customer?.accountType || 'Retail';
      
      // Skip Retail accounts (no commission)
      if (accountType === 'Retail') {
        console.log(`Skipping order ${order.num} - customer ${order.customerName} is Retail (no commission)`);
        continue;
      }

      // Get customer segment from Copper
      const customerSegment = await getCustomerSegment(order.customerId);
      
      // Determine customer status
      const customerStatus = await getCustomerStatus(
        order.customerId,
        order.salesPerson,
        order.postingDate
      );

      // Get commission rates for this rep's title
      const repCommissionRates = commissionRatesByTitle.get(rep.title);
      if (!repCommissionRates) {
        console.log(`No commission rates configured for title: ${rep.title}`);
        continue;
      }

      // Get commission rate
      const rate = getCommissionRate(
        repCommissionRates,
        rep.title,
        customerSegment,
        customerStatus
      );

      if (!rate) {
        console.log(`No rate found for ${rep.title}, ${customerSegment}, ${customerStatus}`);
        continue;
      }

      // Use orderValue or revenue based on rules
      const orderAmount = commissionRules?.useOrderValue ? (order.orderValue || order.revenue) : order.revenue;

      // Calculate commission
      let commissionAmount = 0;
      if (customerStatus === 'rep_transfer') {
        const specialRule = repCommissionRates?.specialRules?.repTransfer;
        if (specialRule?.enabled) {
          const flatFee = specialRule.flatFee || 0;
          const percentCommission = orderAmount * ((specialRule.percentFallback || 0) / 100);
          commissionAmount = specialRule.useGreater 
            ? Math.max(flatFee, percentCommission)
            : flatFee;
        }
      } else {
        commissionAmount = orderAmount * (rate / 100);
      }

      totalCommission += commissionAmount;
      commissionsCalculated++;

      // Save commission record
      const commissionId = `${order.salesPerson}_${commissionMonth}_order_${order.salesOrderId}`;
      await adminDb.collection('monthly_commissions').doc(commissionId).set({
        id: commissionId,
        repId: rep.id,
        salesPerson: order.salesPerson,
        repName: rep.name,
        repTitle: rep.title,
        
        orderId: order.salesOrderId,
        orderNum: order.num,
        customerId: order.customerId,
        customerName: order.customerName,
        accountType: accountType,
        
        customerSegment: customerSegment,
        customerStatus: customerStatus,
        
        orderRevenue: commissionRules?.useOrderValue ? orderAmount : order.revenue,
        orderValue: order.orderValue || order.revenue,
        commissionRate: rate,
        commissionAmount: commissionAmount,
        
        orderDate: order.postingDate,
        postingDate: order.postingDate,
        commissionMonth: commissionMonth,
        commissionYear: year,
        
        calculatedAt: new Date(),
        paidStatus: 'pending',
        notes: `${accountType} - ${customerStatus} - ${customerSegment}`
      });

      // Track by rep
      if (!commissionsByRep.has(order.salesPerson)) {
        commissionsByRep.set(order.salesPerson, {
          repName: rep.name,
          orders: 0,
          revenue: 0,
          commission: 0
        });
      }
      const repSummary = commissionsByRep.get(order.salesPerson);
      repSummary.orders++;
      repSummary.revenue += order.revenue;
      repSummary.commission += commissionAmount;
    }

    // Create monthly summaries
    for (const [salesPerson, summary] of commissionsByRep.entries()) {
      const summaryId = `${salesPerson}_${commissionMonth}`;
      await adminDb.collection('monthly_commission_summary').doc(summaryId).set({
        id: summaryId,
        salesPerson: salesPerson,
        repName: summary.repName,
        month: commissionMonth,
        year: year,
        totalOrders: summary.orders,
        totalRevenue: summary.revenue,
        totalCommission: summary.commission,
        paidStatus: 'pending',
        calculatedAt: new Date()
      });
    }

    return NextResponse.json({
      success: true,
      processed: processed,
      commissionsCalculated: commissionsCalculated,
      totalCommission: totalCommission,
      summary: Object.fromEntries(commissionsByRep)
    });

  } catch (error: any) {
    console.error('Error calculating monthly commissions:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to calculate commissions' },
      { status: 500 }
    );
  }
}

/**
 * Get customer segment from Copper
 */
async function getCustomerSegment(customerId: string): Promise<string> {
  try {
    const customerDoc = await adminDb.collection('copper_companies').doc(customerId).get();
    if (customerDoc.exists) {
      const data = customerDoc.data();
      return data?.['Account Type cf_675914'] || 'Distributor';
    }
    return 'Distributor'; // Default
  } catch (error) {
    console.error(`Error getting customer segment for ${customerId}:`, error);
    return 'Distributor';
  }
}

/**
 * Determine customer status based on order history
 */
async function getCustomerStatus(
  customerId: string,
  currentSalesPerson: string,
  orderDate: any
): Promise<string> {
  try {
    // Get all previous orders for this customer
    const previousOrders = await adminDb.collection('fishbowl_sales_orders')
      .where('customerId', '==', customerId)
      .where('postingDate', '<', orderDate)
      .orderBy('postingDate', 'desc')
      .limit(1)
      .get();

    if (previousOrders.empty) {
      return 'new'; // First order ever
    }

    const lastOrder = previousOrders.docs[0].data();
    
    // Check for rep transfer
    if (lastOrder.salesPerson !== currentSalesPerson) {
      return 'rep_transfer';
    }

    // Calculate months since last order
    const lastOrderDate = lastOrder.postingDate.toDate();
    const currentOrderDate = orderDate.toDate();
    const monthsDiff = Math.floor((currentOrderDate - lastOrderDate) / (1000 * 60 * 60 * 24 * 30));

    if (monthsDiff >= 12) {
      return 'new'; // Reverted to new
    } else if (monthsDiff <= 6) {
      return '6month';
    } else {
      return '12month';
    }
  } catch (error) {
    console.error(`Error getting customer status for ${customerId}:`, error);
    return 'new'; // Default to new on error
  }
}

/**
 * Get commission rate for given parameters
 */
function getCommissionRate(
  commissionRates: any,
  title: string,
  segment: string,
  status: string
): number {
  // For now, return default rates based on segment and status
  // In Phase 4, we'll implement per-title rates from the UI
  
  const segmentLower = segment.toLowerCase();
  
  if (segmentLower.includes('distributor')) {
    if (status === 'new' || status === 'rep_transfer') return 8.0;
    if (status === '6month') return 5.0;
    if (status === '12month') return 3.0;
  } else if (segmentLower.includes('wholesale')) {
    if (status === 'new' || status === 'rep_transfer') return 10.0;
    if (status === '6month') return 7.0;
    if (status === '12month') return 5.0;
  }
  
  return 5.0; // Default fallback
}
