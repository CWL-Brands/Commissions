/**
 * Commission Calculator Service
 * Uses Fishbowl data from Goals app (fishbowl_soitems collection)
 */

import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export interface CommissionCalculationParams {
  repName: string; // Sales person name from Fishbowl (e.g., "BrandonG")
  quarterId: string;
  startDate: Date;
  endDate: Date;
}

export interface ProductMixBreakdown {
  productNum: string;
  product: string;
  category1: string;
  category2: string;
  revenue: number;
  margin: number;
  quantity: number;
  percentage: number;
}

export interface CommissionResults {
  newBusinessRevenue: number;
  maintainBusinessRevenue: number;
  productMix: ProductMixBreakdown[];
  totalRevenue: number;
  totalMargin: number;
  orderCount: number;
  customerCount: number;
  newCustomerCount: number;
  lineItemCount: number;
}

/**
 * Check if a rep is active and eligible for commissions
 */
async function getRepStatus(fishbowlUsername: string): Promise<{ isActive: boolean; isCommissioned: boolean }> {
  if (!adminDb) {
    return { isActive: true, isCommissioned: true }; // Default to true if no DB
  }

  try {
    // Query reps collection by salesPerson field (Fishbowl username)
    const repsSnapshot = await adminDb
      .collection('reps')
      .where('salesPerson', '==', fishbowlUsername)
      .limit(1)
      .get();

    if (repsSnapshot.empty) {
      // Default: if not in database, assume active and commissioned
      console.warn(`Rep with salesPerson=${fishbowlUsername} not found in reps collection - defaulting to active/commissioned`);
      return { isActive: true, isCommissioned: true };
    }

    const repData = repsSnapshot.docs[0].data();
    return {
      isActive: repData.isActive ?? true,
      isCommissioned: repData.isCommissioned ?? true, // Default to true
    };
  } catch (error) {
    console.error(`Error checking rep status for ${fishbowlUsername}:`, error);
    // On error, default to true so calculations can proceed
    return { isActive: true, isCommissioned: true };
  }
}

/**
 * Calculate commissions from Fishbowl SO Items
 * Only calculates for active, commissioned reps
 */
export async function calculateCommissions(
  params: CommissionCalculationParams
): Promise<CommissionResults> {
  if (!adminDb) {
    throw new Error('Database not initialized');
  }

  const { repName, quarterId, startDate, endDate } = params;

  // Check if rep is active and commissioned
  const repStatus = await getRepStatus(repName);
  if (!repStatus.isActive || !repStatus.isCommissioned) {
    console.warn(`Rep ${repName} is not eligible for commissions (active: ${repStatus.isActive}, commissioned: ${repStatus.isCommissioned})`);
    return {
      newBusinessRevenue: 0,
      maintainBusinessRevenue: 0,
      productMix: [],
      totalRevenue: 0,
      totalMargin: 0,
      orderCount: 0,
      customerCount: 0,
      newCustomerCount: 0,
      lineItemCount: 0,
    };
  }

  // Load commission rules
  const rulesDoc = await adminDb.collection('settings').doc('commission_rules').get();
  const commissionRules = rulesDoc.exists ? rulesDoc.data() : { excludeShipping: true, useOrderValue: true };
  console.log('Commission rules:', commissionRules);

  // Load customer account types
  const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
  const customersMap = new Map();
  customersSnapshot.forEach(doc => {
    const data = doc.data();
    if (data.customerNum || data.customerId) {
      const key = data.customerNum || data.customerId;
      customersMap.set(key, data.accountType || 'Retail');
    }
  });
  console.log(`Loaded ${customersMap.size} customers with account types`);

  // Query fishbowl_soitems for this rep and date range
  const itemsSnapshot = await adminDb
    .collection('fishbowl_soitems')
    .where('salesPerson', '==', repName)
    .where('commissionDate', '>=', Timestamp.fromDate(startDate))
    .where('commissionDate', '<=', Timestamp.fromDate(endDate))
    .get();

  let items = itemsSnapshot.docs.map(doc => doc.data());

  // Filter out shipping items if rule enabled
  if (commissionRules?.excludeShipping) {
    const originalCount = items.length;
    items = items.filter(item => item.product !== 'Shipping');
    const filtered = originalCount - items.length;
    if (filtered > 0) {
      console.log(`Filtered out ${filtered} shipping line items`);
    }
  }

  // Filter out Retail account items
  const originalCount = items.length;
  items = items.filter(item => {
    const accountType = customersMap.get(item.customerId) || customersMap.get(item.customerNum) || 'Retail';
    return accountType !== 'Retail';
  });
  const retailFiltered = originalCount - items.length;
  if (retailFiltered > 0) {
    console.log(`Filtered out ${retailFiltered} line items from Retail accounts`);
  }

  if (items.length === 0) {
    return {
      newBusinessRevenue: 0,
      maintainBusinessRevenue: 0,
      productMix: [],
      totalRevenue: 0,
      totalMargin: 0,
      orderCount: 0,
      customerCount: 0,
      newCustomerCount: 0,
      lineItemCount: 0,
    };
  }

  // Get unique customers and orders
  const customerIds = new Set(items.map(item => item.customerId).filter(Boolean));
  const orderIds = new Set(items.map(item => item.soId).filter(Boolean));

  // Identify new vs existing customers
  const newCustomers = await identifyNewCustomers(Array.from(customerIds), startDate);

  // Helper function to get revenue value based on rules
  const getRevenueValue = (item: any) => {
    if (commissionRules?.useOrderValue) {
      return item.orderValue || item.revenue || 0;
    }
    return item.revenue || 0;
  };

  // Calculate New Business (Bucket A) - Revenue from new customers
  const newBusinessRevenue = items
    .filter(item => newCustomers.has(item.customerId))
    .reduce((sum, item) => sum + getRevenueValue(item), 0);

  // Calculate Maintain Business (Bucket C) - Revenue from existing customers
  const maintainBusinessRevenue = items
    .filter(item => !newCustomers.has(item.customerId))
    .reduce((sum, item) => sum + getRevenueValue(item), 0);

  // Calculate Product Mix (Bucket B) - pass commission rules
  const productMix = calculateProductMix(items, commissionRules);

  // Calculate totals
  const totalRevenue = items.reduce((sum, item) => sum + getRevenueValue(item), 0);
  const totalMargin = items.reduce((sum, item) => sum + (item.margin || 0), 0);

  return {
    newBusinessRevenue,
    maintainBusinessRevenue,
    productMix,
    totalRevenue,
    totalMargin,
    orderCount: orderIds.size,
    customerCount: customerIds.size,
    newCustomerCount: newCustomers.size,
    lineItemCount: items.length,
  };
}

/**
 * Identify new customers (first order in this period)
 */
async function identifyNewCustomers(
  customerIds: string[],
  periodStartDate: Date
): Promise<Set<string>> {
  if (!adminDb || customerIds.length === 0) {
    return new Set();
  }

  const newCustomers = new Set<string>();

  // Batch query customers to check first order date
  for (const customerId of customerIds) {
    // Get earliest SO item for this customer
    const firstItemSnapshot = await adminDb
      .collection('fishbowl_soitems')
      .where('customerId', '==', customerId)
      .orderBy('commissionDate', 'asc')
      .limit(1)
      .get();

    if (!firstItemSnapshot.empty) {
      const firstItem = firstItemSnapshot.docs[0].data();
      const firstOrderDate = firstItem.commissionDate?.toDate();

      // If first order is within this period, it's a new customer
      if (firstOrderDate && firstOrderDate >= periodStartDate) {
        newCustomers.add(customerId);
      }
    }
  }

  return newCustomers;
}

/**
 * Calculate product mix breakdown
 */
function calculateProductMix(items: any[], commissionRules?: any): ProductMixBreakdown[] {
  // Helper function to get revenue value based on rules
  const getRevenueValue = (item: any) => {
    if (commissionRules?.useOrderValue) {
      return item.orderValue || item.revenue || 0;
    }
    return item.revenue || 0;
  };

  // Group by product number
  const productMap = new Map<string, {
    product: string;
    category1: string;
    category2: string;
    revenue: number;
    margin: number;
    quantity: number;
  }>();

  items.forEach(item => {
    const productNum = item.productNum || 'Unknown';
    const existing = productMap.get(productNum) || {
      product: item.product || 'Unknown Product',
      category1: item.productC1 || 'Uncategorized',
      category2: item.productC2 || '',
      revenue: 0,
      margin: 0,
      quantity: 0,
    };

    productMap.set(productNum, {
      product: existing.product,
      category1: existing.category1,
      category2: existing.category2,
      revenue: existing.revenue + getRevenueValue(item),
      margin: existing.margin + (item.margin || 0),
      quantity: existing.quantity + (item.quantity || 0),
    });
  });

  // Calculate total revenue for percentages
  const totalRevenue = items.reduce((sum, item) => sum + getRevenueValue(item), 0);

  // Convert to array and add percentages
  return Array.from(productMap.entries())
    .filter(([productNum, data]) => {
      // Filter out shipping and non-product items
      const product = data.product.toLowerCase();
      return !product.includes('shipping') && 
             !product.includes('freight') &&
             productNum !== 'Shipping';
    })
    .map(([productNum, data]) => ({
      productNum,
      product: data.product,
      category1: data.category1 || 'Uncategorized',
      category2: data.category2,
      revenue: data.revenue,
      margin: data.margin,
      quantity: data.quantity,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue); // Sort by revenue descending
}

/**
 * Save commission calculation results to Firestore
 */
export async function saveCommissionResults(
  userId: string,
  quarterId: string,
  results: CommissionResults
): Promise<void> {
  if (!adminDb) {
    throw new Error('Database not initialized');
  }

  const db = adminDb; // Type-safe reference
  const batch = db.batch();
  const timestamp = Timestamp.fromDate(new Date());

  // Fetch commission config from Settings to get goal values
  const configDoc = await db.collection('settings').doc('commission_config').get();
  const config = configDoc.data();
  
  // Get rep's title to determine bucket goals
  const repDoc = await db.collection('reps').doc(userId).get();
  const repData = repDoc.data();
  const repTitle = repData?.title || 'Account Executive';
  const repName = repData?.name || 'Unknown Rep';
  
  // Find the matching budget configuration
  const budgetConfig = config?.budgets?.find((b: any) => b.title === repTitle);
  const bucketAGoal = budgetConfig?.bucketA || 0;
  const bucketBGoal = budgetConfig?.bucketB || 0;
  const bucketCGoal = budgetConfig?.bucketC || 0;

  // Save Bucket A (New Business)
  const bucketAId = `${userId}_A_${quarterId}`;
  batch.set(db.collection('commission_entries').doc(bucketAId), {
    id: bucketAId,
    quarterId,
    repId: userId,
    repName: repName,
    bucketCode: 'A',
    goalValue: bucketAGoal,
    actualValue: results.newBusinessRevenue,
    notes: `${results.newCustomerCount} new customers | $${results.newBusinessRevenue.toFixed(2)} revenue | ${results.lineItemCount} line items`,
    updatedAt: timestamp,
    calculatedAt: timestamp,
  }, { merge: true });

  // Save Bucket C (Maintain Business)
  const bucketCId = `${userId}_C_${quarterId}`;
  batch.set(db.collection('commission_entries').doc(bucketCId), {
    id: bucketCId,
    quarterId,
    repId: userId,
    repName: repName,
    bucketCode: 'C',
    goalValue: bucketCGoal,
    actualValue: results.maintainBusinessRevenue,
    notes: `${results.customerCount - results.newCustomerCount} existing customers | $${results.maintainBusinessRevenue.toFixed(2)} revenue`,
    updatedAt: timestamp,
    calculatedAt: timestamp,
  }, { merge: true });

  // Save Bucket B (Product Mix) - Top 10 products
  // For Bucket B, divide the total goal equally among top products
  const topProducts = results.productMix.slice(0, 10);
  const bucketBGoalPerProduct = topProducts.length > 0 ? bucketBGoal / topProducts.length : 0;
  
  topProducts.forEach((product) => {
    const bucketBId = `${userId}_B_${product.productNum}_${quarterId}`;
    batch.set(db.collection('commission_entries').doc(bucketBId), {
      id: bucketBId,
      quarterId,
      repId: userId,
      repName: repName,
      bucketCode: 'B',
      subGoalId: product.productNum,
      subGoalLabel: `${product.product} (${product.category1})`,
      goalValue: bucketBGoalPerProduct,
      actualValue: product.revenue,
      notes: `${product.quantity} units | ${product.percentage.toFixed(1)}% of total | $${product.margin.toFixed(2)} margin`,
      updatedAt: timestamp,
      calculatedAt: timestamp,
    }, { merge: true });
  });

  await batch.commit();
}

/**
 * Get email from Fishbowl username (reverse mapping)
 */
function getEmailFromFishbowlUsername(fishbowlUsername: string): string | null {
  const usernameToEmailMap: Record<string, string> = {
    // Active Sales Reps
    'BenW': 'ben@kanvabotanicals.com',
    'BrandonG': 'brandon@kanvabotanicals.com',
    'JSimmons': 'joe@kanvabotanicals.com',
    'DerekW': 'derek@kanvabotanicals.com',
    'Jared': 'jared@funktdistro.com',
    'Corey': 'corey@cwlbrands.com',
    'John': 'john@cwlbrands.com',
    'Josie': 'josie@cwlbrands.com',
    'Cori': 'cori@cwlbrands.com',
    
    // Operations & Admin
    'admin': 'rob@cwlbrands.com',
    'tthomas': 'trina@cwlbrands.com',
    'Brian': 'operations@cwlbrands.com',
    'CrystalD': 'crystal@cwlbrands.com',
    'Zalak': 'zz@cwlbrands.com',
    
    // Other Staff
    'Sergio': 'sergio@kanvabotanicals.com',
    'Kevin': 'kevin@cwlbrands.com',
    'Ethan25': 'ethan@cwlbrands.com',
    'LydiaN': 'lydia@cwlbrands.com',
    'MarllynC': 'marllyn@cwlbrands.com',
    'Rebecca': 'rebecca@cwlbrands.com',
    'bbarker': 'bryan.barker@cwlbrands.com',
    
    // Inactive/Former
    'mcraft': 'matt@cwlbrands.com',
    'JoshC': 'josh@kanvabotanicals.com',
    'Shane-Inactive': 'shane@kanvabotanicals.com',
    'Ryan': 'ryan@cwlbrands.com',
  };

  return usernameToEmailMap[fishbowlUsername] || null;
}

/**
 * Get sales person name from user email
 * Maps email to Fishbowl salesPerson field (username column)
 */
export function getSalesPersonFromEmail(email: string): string {
  // Map email to Fishbowl username (from fishbowl_users table)
  const salesPersonMap: Record<string, string> = {
    // Active Sales Reps
    'ben@kanvabotanicals.com': 'BenW',
    'brandon@kanvabotanicals.com': 'BrandonG',
    'joe@kanvabotanicals.com': 'JSimmons',
    'derek@kanvabotanicals.com': 'DerekW',
    'jared@funktdistro.com': 'Jared',
    'corey@cwlbrands.com': 'Corey',
    'john@cwlbrands.com': 'John',
    'josie@cwlbrands.com': 'Josie',
    'cori@cwlbrands.com': 'Cori',
    
    // Operations & Admin
    'rob@cwlbrands.com': 'admin',
    'trina@cwlbrands.com': 'tthomas',
    'operations@cwlbrands.com': 'Brian',
    'crystal@cwlbrands.com': 'CrystalD',
    'zz@cwlbrands.com': 'Zalak',
    
    // Other Staff
    'sergio@kanvabotanicals.com': 'Sergio',
    'kevin@cwlbrands.com': 'Kevin',
    'ethan@cwlbrands.com': 'Ethan25',
    'lydia@cwlbrands.com': 'LydiaN',
    'marllyn@cwlbrands.com': 'MarllynC',
    'rebecca@cwlbrands.com': 'Rebecca',
    'bryan.barker@cwlbrands.com': 'bbarker',
    
    // Inactive/Former
    'matt@cwlbrands.com': 'mcraft',
    'josh@kanvabotanicals.com': 'JoshC',
    'shane@kanvabotanicals.com': 'Shane-Inactive',
    'ryan@cwlbrands.com': 'Ryan',
  };

  const username = salesPersonMap[email.toLowerCase()];
  
  if (!username) {
    console.warn(`No Fishbowl username mapping found for ${email}`);
    // Fallback: use email prefix
    return email.split('@')[0];
  }
  
  return username;
}
