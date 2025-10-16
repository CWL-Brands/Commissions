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

    // Define commission month early for spiff filtering
    const commissionMonth = `${year}-${month.padStart(2, '0')}`;

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
    const commissionRules = rulesDoc.exists ? rulesDoc.data() : { 
      excludeShipping: true, 
      excludeCCProcessing: true,
      useOrderValue: true 
    };
    console.log('Commission rules:', commissionRules);

    // Load active spiffs for the period
    const spiffsSnapshot = await adminDb.collection('spiffs')
      .where('isActive', '==', true)
      .get();
    
    const activeSpiffs = new Map();
    spiffsSnapshot.forEach(doc => {
      const spiff = doc.data();
      const startDate = new Date(spiff.startDate);
      const endDate = spiff.endDate ? new Date(spiff.endDate) : null;
      const periodStart = new Date(`${year}-${month.padStart(2, '0')}-01`);
      const periodEnd = new Date(year, parseInt(month), 0); // Last day of month
      
      // Check if spiff is active during this period
      if (startDate <= periodEnd && (!endDate || endDate >= periodStart)) {
        activeSpiffs.set(spiff.productNum, { id: doc.id, ...spiff });
        console.log(`  📌 Spiff: ${spiff.productNum} | Type: "${spiff.incentiveType}" | Value: $${spiff.incentiveValue}`);
      }
    });
    console.log(`Loaded ${activeSpiffs.size} active spiffs for ${commissionMonth}`);

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
    console.log(`\n🔍 Querying orders for commissionMonth: "${commissionMonth}"`);
    
    let ordersQuery = adminDb.collection('fishbowl_sales_orders')
      .where('commissionMonth', '==', commissionMonth);
    
    if (salesPerson) {
      console.log(`   Filtering by salesPerson: "${salesPerson}"`);
      ordersQuery = ordersQuery.where('salesPerson', '==', salesPerson);
    }

    const ordersSnapshot = await ordersQuery.get();
    
    if (ordersSnapshot.empty) {
      console.log(`\n❌ NO ORDERS FOUND for commissionMonth="${commissionMonth}"`);
      console.log(`\n🔍 Checking what commission months exist in database...`);
      
      // Debug: Check what commission months actually exist
      const allOrdersSnapshot = await adminDb.collection('fishbowl_sales_orders').limit(10).get();
      console.log(`   Total orders in collection: ${allOrdersSnapshot.size}`);
      allOrdersSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   Sample order: ${data.num} | commissionMonth: "${data.commissionMonth}" | postingDate: ${data.postingDateStr}`);
      });
      
      return NextResponse.json({
        success: true,
        message: `No orders found for commissionMonth="${commissionMonth}". Check console for debug info.`,
        processed: 0,
        commissionsCalculated: 0,
        totalCommission: 0
      });
    }

    console.log(`✅ Found ${ordersSnapshot.size} orders to process`);

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
    
    // Track spiff details for summary
    const spiffDetails: any[] = [];

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

      // Calculate commission base by excluding shipping and CC processing if configured
      let orderAmount = commissionRules?.useOrderValue ? (order.orderValue || order.revenue) : order.revenue;
      
      // If exclusions are enabled, calculate from line items
      if (commissionRules?.excludeShipping || commissionRules?.excludeCCProcessing) {
        const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
          .where('salesOrderId', '==', order.salesOrderId)
          .get();
        
        // Only recalculate if we found line items
        if (!lineItemsSnapshot.empty) {
          let commissionableAmount = 0;
          for (const lineItemDoc of lineItemsSnapshot.docs) {
            const lineItem = lineItemDoc.data();
            const productName = (lineItem.productName || '').toLowerCase();
            const productNum = (lineItem.productNum || '').toLowerCase();
            
            // Check if this line item should be excluded
            const isShipping = commissionRules?.excludeShipping && (
              productName.includes('shipping') || 
              productNum.includes('shipping') ||
              productName === 'shipping'
            );
            
            const isCCProcessing = commissionRules?.excludeCCProcessing && (
              productName.includes('cc processing') ||
              productName.includes('credit card processing') ||
              productNum.includes('cc processing') ||
              productNum === 'cc processing'
            );
            
            // Debug logging for exclusions
            if (isShipping) {
              console.log(`  🚫 EXCLUDED (Shipping): ${lineItem.productNum} | ${lineItem.productName} | $${lineItem.totalPrice || 0}`);
            } else if (isCCProcessing) {
              console.log(`  🚫 EXCLUDED (CC Processing): ${lineItem.productNum} | ${lineItem.productName} | $${lineItem.totalPrice || 0}`);
            }
            
            // Only include if not excluded
            if (!isShipping && !isCCProcessing) {
              commissionableAmount += lineItem.totalPrice || 0;
            }
          }
          
          // Only use the calculated amount if we found commissionable items
          // Otherwise fall back to the original order amount
          orderAmount = commissionableAmount > 0 ? commissionableAmount : orderAmount;
        }
      }

      // Calculate commission using Decimal.js for precision
      let commissionAmount = 0;
      if (customerStatus === 'rep_transfer') {
        const specialRule = repCommissionRates?.specialRules?.repTransfer;
        if (specialRule?.enabled) {
          // Determine which rate to use based on customer segment
          let transferRate = specialRule.percentFallback || 2.0; // Default fallback
          
          if (specialRule.segmentRates) {
            const segmentLower = customerSegment.toLowerCase();
            if (segmentLower.includes('wholesale') && specialRule.segmentRates.wholesale) {
              transferRate = specialRule.segmentRates.wholesale;
              console.log(`  Using Wholesale transfer rate: ${transferRate}%`);
            } else if (segmentLower.includes('distributor') && specialRule.segmentRates.distributor) {
              transferRate = specialRule.segmentRates.distributor;
              console.log(`  Using Distributor transfer rate: ${transferRate}%`);
            } else {
              console.log(`  Using default transfer rate: ${transferRate}% (segment: ${customerSegment})`);
            }
          }
          
          const flatFee = specialRule.flatFee || 0;
          const percentCommission = new Decimal(orderAmount).times(transferRate).dividedBy(100).toNumber();
          commissionAmount = specialRule.useGreater 
            ? Math.max(flatFee, percentCommission)
            : (flatFee > 0 ? flatFee : percentCommission);
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
      const commissionRef = adminDb.collection('monthly_commissions').doc(commissionId);
      
      // Check if this commission already exists and has a manual override
      const existingCommission = await commissionRef.get();
      const hasManualOverride = existingCommission.exists && existingCommission.data()?.isOverride === true;
      
      if (hasManualOverride) {
        // Preserve manual override - only update non-override fields
        console.log(`⚠️  PRESERVING MANUAL OVERRIDE for Order ${order.num} - keeping adjusted commission`);
        await commissionRef.update({
          // Update metadata fields only, preserve commission amount and override data
          repName: rep.name,
          repTitle: rep.title,
          customerName: order.customerName,
          accountType: accountType,
          customerSegment: customerSegment,
          customerStatus: customerStatus,
          orderRevenue: commissionRules?.useOrderValue ? orderAmount : order.revenue,
          orderValue: order.orderValue || order.revenue,
          commissionRate: rate,
          // DO NOT update: commissionAmount, isOverride, overrideReason, manualAdjustment, etc.
          calculatedAt: new Date(),
          notes: `${accountType} - ${customerStatus} - ${customerSegment} [OVERRIDE PRESERVED]`
        });
      } else {
        // No override - normal save/update
        await commissionRef.set({
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
      }

      // Calculate spiffs from line items
      let orderSpiffTotal = 0;
      if (activeSpiffs.size > 0) {
        // Get line items for this order
        const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems')
          .where('salesOrderId', '==', order.salesOrderId)
          .get();
        
        for (const lineItemDoc of lineItemsSnapshot.docs) {
          const lineItem = lineItemDoc.data();
          // Use partNumber instead of productNum (Fishbowl field name)
          const productNumber = lineItem.partNumber || lineItem.productNum || lineItem.product;
          const spiff = activeSpiffs.get(productNumber);
          
          // Debug: Log all line items to see product numbers and available fields
          console.log(`  🔍 Line Item Fields:`, {
            productNum: lineItem.productNum,
            partNumber: lineItem.partNumber,
            partNum: lineItem.partNum,
            productId: lineItem.productId,
            product: lineItem.product,
            productName: lineItem.productName,
            productDescription: lineItem.productDescription,
            description: lineItem.description,
            quantity: lineItem.quantity
          });
          console.log(`  🔍 Checking spiff for: ${productNumber || 'NO_PRODUCT_NUM'} | Spiff: ${spiff ? 'YES' : 'NO'}`);
          
          if (spiff) {
            let spiffAmount = 0;
            const quantity = lineItem.quantity || 0;
            const lineRevenue = lineItem.totalPrice || 0;
            
            console.log(`  🎯 SPIFF MATCH! Product: ${productNumber} | Type: "${spiff.incentiveType}" | Value: $${spiff.incentiveValue} | Qty: ${quantity}`);
            
            // Normalize incentiveType to handle variations like "Flat $" or "flat"
            const typeNormalized = (spiff.incentiveType || '').toLowerCase().replace(/[^a-z]/g, '');
            
            if (typeNormalized === 'flat') {
              // Flat dollar amount per unit
              spiffAmount = quantity * spiff.incentiveValue;
              console.log(`  💰 FLAT SPIFF: ${quantity} × $${spiff.incentiveValue} = $${spiffAmount.toFixed(2)}`);
            } else if (typeNormalized === 'percentage') {
              // Percentage of line item revenue
              spiffAmount = new Decimal(lineRevenue).times(spiff.incentiveValue).dividedBy(100).toNumber();
              console.log(`  💰 PERCENTAGE SPIFF: $${lineRevenue} × ${spiff.incentiveValue}% = $${spiffAmount.toFixed(2)}`);
            } else {
              console.log(`  ⚠️ UNKNOWN SPIFF TYPE: "${spiff.incentiveType}" (normalized: "${typeNormalized}")`);
            }
            
            if (spiffAmount > 0) {
              orderSpiffTotal += spiffAmount;
              
              // Track spiff for summary
              spiffDetails.push({
                repName: rep.name,
                salesPerson: order.salesPerson,
                orderNum: order.num,
                customerName: order.customerName,
                productNum: productNumber,
                productDescription: lineItem.description || lineItem.productDescription || '',
                quantity: quantity,
                spiffType: typeNormalized,
                spiffValue: spiff.incentiveValue,
                spiffAmount: spiffAmount
              });
              
              // Save spiff earning record
              const spiffEarningId = `${order.salesPerson}_${commissionMonth}_spiff_${lineItemDoc.id}`;
              await adminDb.collection('spiff_earnings').doc(spiffEarningId).set({
                id: spiffEarningId,
                repId: rep.id,
                salesPerson: order.salesPerson,
                repName: rep.name,
                
                spiffId: spiff.id,
                spiffName: spiff.name,
                productNum: productNumber, // Use productNumber instead of lineItem.productNum (which is undefined)
                productDescription: lineItem.description || lineItem.productDescription || '',
                
                orderId: order.salesOrderId,
                orderNum: order.num,
                customerId: order.customerId,
                customerName: order.customerName,
                
                quantity: quantity,
                lineRevenue: lineRevenue,
                incentiveType: spiff.incentiveType,
                incentiveValue: spiff.incentiveValue,
                spiffAmount: spiffAmount,
                
                orderDate: order.postingDate,
                commissionMonth: commissionMonth,
                commissionYear: year,
                
                calculatedAt: new Date(),
                paidStatus: 'pending',
              });
              
              console.log(`💰 SPIFF EARNED: ${rep.name} | ${lineItem.productNum} | Qty: ${quantity} | ${spiff.incentiveType === 'flat' ? `$${spiff.incentiveValue}/unit` : `${spiff.incentiveValue}%`} = $${spiffAmount.toFixed(2)}`);
            }
          }
        }
      }

      // Track by rep
      if (!commissionsByRep.has(order.salesPerson)) {
        commissionsByRep.set(order.salesPerson, {
          repName: rep.name,
          orders: 0,
          revenue: 0,
          commission: 0,
          spiffs: 0
        });
      }
      const repSummary = commissionsByRep.get(order.salesPerson);
      repSummary.orders++;
      repSummary.revenue += order.revenue;
      repSummary.commission += commissionAmount;
      repSummary.spiffs += orderSpiffTotal;
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
        totalSpiffs: summary.spiffs,
        totalEarnings: summary.commission + summary.spiffs,
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
        const spiffTotal = summary.spiffs || 0;
        const totalEarnings = summary.commission + spiffTotal;
        console.log(`   ${summary.repName} (${salesPerson}): ${summary.orders} orders | Commission: $${summary.commission.toFixed(2)} | Spiffs: $${spiffTotal.toFixed(2)} | Total: $${totalEarnings.toFixed(2)}`);
      }
    }
    
    // Print spiff summary if any spiffs were earned
    if (spiffDetails.length > 0) {
      console.log(`\n🎁 SPIFFS EARNED (${spiffDetails.length} total):`);
      const spiffsByRep = new Map();
      spiffDetails.forEach(spiff => {
        if (!spiffsByRep.has(spiff.repName)) {
          spiffsByRep.set(spiff.repName, []);
        }
        spiffsByRep.get(spiff.repName).push(spiff);
      });
      
      for (const [repName, spiffs] of spiffsByRep.entries()) {
        const repTotal = spiffs.reduce((sum: number, s: any) => sum + s.spiffAmount, 0);
        console.log(`\n   ${repName}: ${spiffs.length} spiffs = $${repTotal.toFixed(2)}`);
        spiffs.forEach((s: any) => {
          console.log(`      Order ${s.orderNum} | ${s.productNum} | Qty: ${s.quantity} | ${s.spiffType === 'flat' ? `$${s.spiffValue}/unit` : `${s.spiffValue}%`} = $${s.spiffAmount.toFixed(2)}`);
        });
      }
    }
    
    console.log('\n' + '='.repeat(80) + '\n');

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

    // Group spiffs by rep for response
    const spiffsByRep = new Map();
    spiffDetails.forEach(spiff => {
      if (!spiffsByRep.has(spiff.repName)) {
        spiffsByRep.set(spiff.repName, []);
      }
      spiffsByRep.get(spiff.repName).push(spiff);
    });

    return NextResponse.json({
      success: true,
      processed: processed,
      commissionsCalculated: commissionsCalculated,
      totalCommission: totalCommission,
      repBreakdown: repBreakdown,
      skippedCounts: skippedCounts,
      summary: Object.fromEntries(commissionsByRep),
      spiffDetails: spiffDetails,
      spiffsByRep: Object.fromEntries(spiffsByRep),
      totalSpiffs: spiffDetails.reduce((sum, s) => sum + s.spiffAmount, 0)
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
    // Use customer age (time since FIRST order) to determine rate, not treat as new
    if (monthsSinceLastOrder >= 12) {
      console.log(`💤 DORMANT ACCOUNT REACTIVATED: ${customer?.customerName || customerId} - Last order: ${lastOrderDate.toISOString().split('T')[0]} (${monthsSinceLastOrder} months ago)`);
      console.log(`   📅 Customer age: ${customerAgeMonths} months (from first order ${firstOrderDate.toISOString().split('T')[0]})`);
      
      // Determine rate based on customer age, not as new business
      if (customerAgeMonths <= 6) {
        console.log(`   → NEW BUSINESS (8%) - Still in first 6 months`);
        return 'new';
      } else if (customerAgeMonths <= 12) {
        console.log(`   → 6-MONTH ACTIVE (4%) - Customer is 6-12 months old`);
        return '6month';
      } else {
        console.log(`   → 12-MONTH ACTIVE (4% Wholesale / 2% Distributor) - Customer is 12+ months old`);
        return '12month';
      }
    }

    // REORG RULE: Check if this customer was transferred during the July 2025 reorg
    // BUT: Only apply transfer rate if customer is NOT in their first 6 months (new business period)
    if (applyReorgRule && currentOrderDate >= REORG_DATE && customerAgeMonths > 6) {
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

    // Check for rep transfer (non-reorg scenario)
    if (lastOrder.salesPerson !== currentSalesPerson) {
      return 'rep_transfer';
    }

    // Same rep, check customer age (time since FIRST order)
    console.log(`📅 Customer ${customerId}: First order ${firstOrderDate.toISOString().split('T')[0]}, Age: ${customerAgeMonths} months`);
    
    if (customerAgeMonths <= 6) {
      console.log(`   ✅ NEW (0-6 months old) → 8%`);
      return 'new'; // Customer is 0-6 months old → New Business (8%)
    } else if (customerAgeMonths <= 12) {
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
