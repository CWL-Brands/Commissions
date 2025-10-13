import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import Decimal from 'decimal.js';

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
      const customerData = { id: doc.id, ...data };
      
      // Map by multiple keys for flexibility
      if (data.accountNumber) customersMap.set(data.accountNumber, customerData);
      if (data.customerNum) customersMap.set(data.customerNum, customerData);
      if (data.customerId) customersMap.set(data.customerId, customerData);
      if (doc.id) customersMap.set(doc.id, customerData);
    });
    console.log(`Loaded ${customersSnapshot.size} customers (${customersMap.size} keys) with account types`);

    // Get all users (sales reps) - map by salesPerson field
    // Use isCommissioned instead of role='sales' because some reps have role='admin'
    const usersSnapshot = await adminDb.collection('users')
      .where('isCommissioned', '==', true)
      .where('isActive', '==', true)
      .get();
    
    const repsMap = new Map();
    console.log(`\n🔍 Loading sales reps from users collection...`);
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const repData = { id: doc.id, ...data, active: data.isActive }; // Normalize active field
      
      console.log(`  Rep: ${data.name} | salesPerson: "${data.salesPerson}" | isActive: ${data.isActive}`);
      
      // Map by salesPerson (e.g., "JaredM", "BenW", "DerekS", "BrandonG")
      if (data.salesPerson) {
        repsMap.set(data.salesPerson, repData);
        console.log(`    ✅ Mapped by salesPerson: "${data.salesPerson}"`);
      }
      
      // Also map by name (first name only) to catch cases like "Jared" -> "Jared Leuzinger"
      if (data.name) {
        const firstName = data.name.split(' ')[0];
        if (!repsMap.has(firstName)) {
          repsMap.set(firstName, repData);
          console.log(`    ✅ Mapped by first name: "${firstName}"`);
        }
      }
    });
    
    console.log(`\n📊 Total reps mapped: ${repsMap.size}`);
    console.log(`📋 Rep keys in map:`, Array.from(repsMap.keys()).join(', '));

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
    const skippedReps = new Set();
    let skippedCounts = {
      admin: 0,
      shopify: 0,
      retail: 0,
      inactiveRep: 0
    };

    // Process each order
    for (const orderDoc of ordersSnapshot.docs) {
      const order = orderDoc.data();
      processed++;

      // Skip admin/house account orders (no commission)
      if (order.salesPerson === 'admin' || order.salesPerson === 'Admin') {
        skippedCounts.admin++;
        continue;
      }

      // Skip Commerce/Shopify orders (no commission on direct e-commerce)
      if (order.salesPerson === 'Commerce' || order.salesPerson === 'commerce' || 
          order.num?.startsWith('Sh') || order.orderNum?.startsWith('Sh')) {
        skippedCounts.shopify++;
        continue;
      }

      // Get rep details
      const rep = repsMap.get(order.salesPerson);
      if (!rep || !rep.active) {
        skippedReps.add(order.salesPerson);
        skippedCounts.inactiveRep++;
        continue;
      }

      // Get customer account type - try multiple keys
      const customer = customersMap.get(order.customerId) || 
                      customersMap.get(order.customerNum) ||
                      customersMap.get(order.accountNumber) ||
                      customersMap.get(order.customerName);
      const accountType = customer?.accountType || 'Retail';
      const manualTransferStatus = customer?.transferStatus; // Manual override from UI
      
      // Skip Retail accounts (no commission)
      if (accountType === 'Retail') {
        skippedCounts.retail++;
        continue;
      }

      // Get customer segment from Copper
      const customerSegment = await getCustomerSegment(order.customerId);
      
      // Determine customer status (check manual override first)
      let customerStatus: string;
      if (manualTransferStatus) {
        // Manual override from UI takes precedence
        customerStatus = manualTransferStatus; // 'own' or 'transferred'
        console.log(`📌 Manual override for ${order.customerName}: ${manualTransferStatus}`);
      } else {
        // Auto-calculate based on order history AND customer assignment
        customerStatus = await getCustomerStatus(
          order.customerId,
          order.salesPerson,
          order.postingDate,
          commissionRules,
          customer // Pass customer object to check originalOwner
        );
      }

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

      // Calculate commission using Decimal.js for precision
      let commissionAmount = 0;
      if (customerStatus === 'rep_transfer') {
        const specialRule = repCommissionRates?.specialRules?.repTransfer;
        if (specialRule?.enabled) {
          const flatFee = specialRule.flatFee || 0;
          const percentCommission = new Decimal(orderAmount).times(specialRule.percentFallback || 0).dividedBy(100).toNumber();
          commissionAmount = specialRule.useGreater 
            ? Math.max(flatFee, percentCommission)
            : flatFee;
        }
      } else {
        // Precise decimal calculation: orderAmount × (rate / 100)
        commissionAmount = new Decimal(orderAmount).times(rate).dividedBy(100).toNumber();
      }

      totalCommission += commissionAmount;
      commissionsCalculated++;

      // Log successful commission calculation
      console.log(`✅ COMMISSION CALCULATED: Order ${order.num} | ${rep.name} | ${customerSegment} | ${customerStatus} | $${orderAmount.toFixed(2)} × ${rate}% = $${commissionAmount.toFixed(2)}`);

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

    // Print summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 COMMISSION CALCULATION SUMMARY');
    console.log('='.repeat(80));
    console.log(`✅ Commissions Calculated: ${commissionsCalculated}`);
    console.log(`💰 Total Commission: $${totalCommission.toFixed(2)}`);
    console.log(`\n📋 Orders Processed: ${processed}`);
    console.log(`   ⚪ Admin/House: ${skippedCounts.admin}`);
    console.log(`   ⚪ Shopify: ${skippedCounts.shopify}`);
    console.log(`   ⚪ Retail: ${skippedCounts.retail}`);
    console.log(`   ⚪ Inactive/Unknown Reps: ${skippedCounts.inactiveRep}`);
    
    if (skippedReps.size > 0) {
      console.log(`\n⚠️  INACTIVE/UNKNOWN REPS WITH ORDERS:`);
      skippedReps.forEach(rep => console.log(`   - ${rep}`));
    }
    
    if (commissionsCalculated > 0) {
      console.log(`\n💵 COMMISSIONS BY REP:`);
      for (const [salesPerson, summary] of commissionsByRep.entries()) {
        console.log(`   ${summary.repName} (${salesPerson}): ${summary.orders} orders = $${summary.commission.toFixed(2)}`);
      }
    }
    console.log('='.repeat(80) + '\n');

    // Format rep breakdown for UI
    const repBreakdown: { [key: string]: any } = {};
    for (const [salesPerson, summary] of commissionsByRep.entries()) {
      repBreakdown[summary.repName] = {
        salesPerson: salesPerson,
        orders: summary.orders,
        revenue: summary.revenue,
        commission: summary.commission
      };
    }

    return NextResponse.json({
      success: true,
      processed: processed,
      commissionsCalculated: commissionsCalculated,
      totalCommission: totalCommission,
      repBreakdown: repBreakdown,
      skippedCounts: skippedCounts,
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
  orderDate: any,
  commissionRules?: any,
  customer?: any
): Promise<string> {
  try {
    // Get reorg settings from commission rules
    const applyReorgRule = commissionRules?.applyReorgRule ?? true;
    const reorgDateStr = commissionRules?.reorgDate ?? '2025-07-01';
    const REORG_DATE = new Date(reorgDateStr);
    const currentOrderDate = orderDate.toDate ? orderDate.toDate() : new Date(orderDate);
    
    // Get recent orders for rep change detection
    const previousOrders = await adminDb.collection('fishbowl_sales_orders')
      .where('customerId', '==', customerId)
      .where('postingDate', '<', orderDate)
      .orderBy('postingDate', 'desc')
      .limit(10) // Get recent orders to check for rep changes
      .get();

    if (previousOrders.empty) {
      return 'new'; // First order ever
    }

    const lastOrder = previousOrders.docs[0].data();
    const lastOrderDate = lastOrder.postingDate.toDate();
    
    // Get the ACTUAL FIRST order (oldest ever) to determine customer age
    const firstOrderQuery = await adminDb.collection('fishbowl_sales_orders')
      .where('customerId', '==', customerId)
      .orderBy('postingDate', 'asc')
      .limit(1)
      .get();
    
    const firstOrder = firstOrderQuery.docs[0].data();
    const firstOrderDate = firstOrder.postingDate.toDate();
    
    // Calculate months since LAST order (for dormancy check)
    const monthsSinceLastOrder = Math.floor((currentOrderDate - lastOrderDate) / (1000 * 60 * 60 * 24 * 30));
    
    // Calculate months since FIRST order (for customer age)
    const customerAgeMonths = Math.floor((currentOrderDate - firstOrderDate) / (1000 * 60 * 60 * 24 * 30));

    // Check if customer hasn't ordered in 12+ months (dormant/reactivated)
    if (monthsSinceLastOrder >= 12) {
      console.log(`💤 DORMANT ACCOUNT REACTIVATED: ${customer?.customerName || customerId} - Last order: ${lastOrderDate.toISOString().split('T')[0]} (${monthsSinceLastOrder} months ago) → NEW BUSINESS (8%)`);
      return 'new'; // Reverted to new business
    }

    // PRIORITY 1: Check customer age FIRST - New business (0-6 months) ALWAYS gets 8%
    console.log(`📅 Customer ${customerId}: First order ${firstOrderDate.toISOString().split('T')[0]}, Age: ${customerAgeMonths} months`);
    
    if (customerAgeMonths <= 6) {
      console.log(`   ✅ NEW (0-6 months old) → 8% (overrides any transfer status)`);
      return 'new'; // Customer is 0-6 months old → New Business (8%)
    }

    // PRIORITY 2: REORG RULE - Check if customer was transferred during the July 2025 reorg
    if (applyReorgRule && currentOrderDate >= REORG_DATE) {
      // Check if customer had ANY orders before the reorg date
      let hadOrdersBeforeReorg = false;
      let hadDifferentRepBeforeReorg = false;
      
      for (const orderDoc of previousOrders.docs) {
        const order = orderDoc.data();
        const orderDateCheck = order.postingDate.toDate();
        
        if (orderDateCheck < REORG_DATE) {
          hadOrdersBeforeReorg = true;
          // Check if this old order had a different rep
          if (order.salesPerson !== currentSalesPerson) {
            hadDifferentRepBeforeReorg = true;
            break;
          }
        }
      }
      
      // NEW: Also check if originalOwner (Fishbowl owner) differs from assigned rep
      // This catches transfers that happened but may not show in order history
      if (customer?.originalOwner && customer.originalOwner !== currentSalesPerson) {
        // Customer exists and has a different original owner
        // If they had orders before reorg, this is a transferred customer
        if (hadOrdersBeforeReorg) {
          console.log(`🔄 Transfer detected: ${customer.customerName || customerId} - Original: ${customer.originalOwner} → Current: ${currentSalesPerson}`);
          return 'transferred';
        }
      }
      
      // If customer existed before reorg AND had a different rep in order history → "transferred" (2%)
      if (hadOrdersBeforeReorg && hadDifferentRepBeforeReorg) {
        return 'transferred';
      }
    }

    // PRIORITY 3: Check for rep transfer (non-reorg scenario)
    if (lastOrder.salesPerson !== currentSalesPerson) {
      return 'rep_transfer';
    }

    // PRIORITY 4: Same rep, check customer activity tier
    if (customerAgeMonths <= 12) {
      console.log(`   ⏱️ 6MONTH (6-12 months old) → 4%`);
      return '6month'; // Customer is 6-12 months old → 6 Month Active (4%)
    } else {
      console.log(`   ⏱️ 12MONTH (12+ months old) → 4%`);
      return '12month'; // Customer is 12+ months old → 12 Month Active (4%)
    }
  } catch (error) {
    console.error(`Error getting customer status for ${customerId}:`, error);
    return 'new'; // Default to new on error
  }
}

/**
 * Get commission rate for given parameters from saved commission rates
 */
function getCommissionRate(
  commissionRates: any,
  title: string,
  segment: string,
  status: string
): number {
  // Map status values to match what we save in the UI
  const statusMap: { [key: string]: string } = {
    'new': 'new_business',
    'rep_transfer': 'new_business', // Old rep transfers use new business rate (8%)
    'transferred': 'transferred', // July 2025 reorg transferred customers (2%)
    'own': 'new_business', // Manual override: rep acquired customer themselves (8%)
    '6month': '6_month_active',
    '12month': '12_month_active'
  };
  
  const mappedStatus = statusMap[status] || status;
  
  // Map segment to segmentId
  const segmentLower = segment.toLowerCase();
  let segmentId = 'distributor'; // default
  if (segmentLower.includes('wholesale')) {
    segmentId = 'wholesale';
  }
  
  // Look up rate in the rates array
  if (commissionRates?.rates && Array.isArray(commissionRates.rates)) {
    const rate = commissionRates.rates.find((r: any) => 
      r.title === title && 
      r.segmentId === segmentId && 
      r.status === mappedStatus &&
      r.active !== false // Only use active rates
    );
    
    if (rate && typeof rate.percentage === 'number') {
      console.log(`✅ Found rate: ${title} | ${segmentId} | ${mappedStatus} = ${rate.percentage}%`);
      return rate.percentage;
    }
  }
  
  // Fallback to hardcoded defaults if no rate found
  console.log(`⚠️ No rate found for ${title} | ${segmentId} | ${mappedStatus}, using defaults`);
  
  // Transferred customers always get 2% (July 2025 reorg rule)
  if (mappedStatus === 'transferred') return 2.0;
  
  if (segmentId === 'distributor') {
    if (mappedStatus === 'new_business') return 8.0;
    if (mappedStatus === '6_month_active') return 5.0;
    if (mappedStatus === '12_month_active') return 3.0;
  } else if (segmentId === 'wholesale') {
    if (mappedStatus === 'new_business') return 10.0;
    if (mappedStatus === '6_month_active') return 7.0;
    if (mappedStatus === '12_month_active') return 5.0;
  }
  
  return 5.0; // Final fallback
}
