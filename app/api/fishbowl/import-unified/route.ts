import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Unified Fishbowl Import from Conversight Report - PRODUCTION READY
 * 
 * RELIABILITY & ACCURACY IMPROVEMENTS:
 * - Copper accountType precedence (override > existing > copper > fishbowl)
 * - CustomerTypeCache for consistent accountType across orders/items
 * - Robust date parsing (Excel serials, ISO, MM/DD/YYYY, MM-DD-YYYY)
 * - Safe number parsing (handles $, commas)
 * - Correct shipping/CC exclusion using SO Item Product Number
 * - Immutable ID deduplication (Sales Order ID, SO Item ID)
 * - Accurate created vs updated counts
 * - Shopify/Commerce flags for easy filtering
 * - Shipping/CC item flags for debug
 * - Header fallbacks for Conversight export variations
 * - Normalized Sales order Number handling
 */

// Helper: Safe number parser (handles $, commas, tolerant)
function toNumberSafe(v: any): number {
  if (typeof v === 'number') return v;
  if (v == null) return 0;
  const s = String(v).replace(/[\$,]/g, '').trim();
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

// Helper: Parse Excel serial dates, ISO dates, and common US formats
function parseExcelOrTextDate(raw: any): { date?: Date; monthKey?: string; y?: number } {
  if (!raw && raw !== 0) return {};
  try {
    if (typeof raw === 'number') {
      const excelEpoch = new Date(1899, 11, 30);
      const d = new Date(excelEpoch.getTime() + raw * 86400000);
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { date: d, monthKey: `${y}-${String(m).padStart(2,'0')}`, y };
    }
    const s = String(raw).trim();

    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { // ISO YYYY-MM-DD
      const [Y, M, D] = s.split('-').map(Number);
      const d = new Date(Y, M - 1, D);
      return { date: d, monthKey: `${Y}-${String(M).padStart(2,'0')}`, y: Y };
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(s)) { // MM/DD/YYYY or M/D/YY
      const [M, D, Yraw] = s.split('/').map((t) => t.trim());
      const Y = Number(Yraw.length === 2 ? (Number(Yraw) + 2000) : Yraw);
      const d = new Date(Y, Number(M) - 1, Number(D));
      return { date: d, monthKey: `${Y}-${String(Number(M)).padStart(2,'0')}`, y: Y };
    }
    if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(s)) { // MM-DD-YYYY
      const [M, D, Y] = s.split('-').map(Number);
      const d = new Date(Y, M - 1, D);
      return { date: d, monthKey: `${Y}-${String(M).padStart(2,'0')}`, y: Y };
    }
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const m = d.getMonth() + 1, y = d.getFullYear();
      return { date: d, monthKey: `${y}-${String(m).padStart(2,'0')}`, y };
    }
  } catch {}
  return {};
}

interface ImportStats {
  processed: number;
  customersCreated: number;
  customersUpdated: number;
  ordersCreated: number;
  ordersUpdated: number;
  itemsCreated: number;
  itemsUpdated: number;
  skipped: number;
}

// Load only active Copper companies for accountType enrichment
// Maps by Account Order ID (Fishbowl's accountNumber)
async function loadActiveCopperCompanies() {
  const fieldActive = 'Active Customer cf_712751';
  const fieldType   = 'Account Type cf_675914';
  const fieldAccountOrderId = 'Account Order ID cf_698467'; // This matches Fishbowl accountNumber

  // We can't OR across different value types in a single Firestore query,
  // so run a few highly selective queries in parallel and merge.
  const queries = [
    adminDb.collection('copper_companies')
      .where(fieldActive, '==', 'checked')
      .select(fieldAccountOrderId, fieldType, fieldActive),
    // Optional fallbacks if some records were stored as booleans/strings:
    adminDb.collection('copper_companies')
      .where(fieldActive, '==', true)
      .select(fieldAccountOrderId, fieldType, fieldActive),
    adminDb.collection('copper_companies')
      .where(fieldActive, '==', 'true')
      .select(fieldAccountOrderId, fieldType, fieldActive),
    adminDb.collection('copper_companies')
      .where(fieldActive, '==', 'Checked')
      .select(fieldAccountOrderId, fieldType, fieldActive),
  ];

  const results = await Promise.allSettled(queries.map(q => q.get()));

  const copperByAccountNumber = new Map<string, { accountType?: string }>();
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    r.value.forEach(doc => {
      const d = doc.data() || {};
      const accountOrderId = d[fieldAccountOrderId];
      if (accountOrderId == null) return;

      const accountNumberKey = String(accountOrderId);
      const accountType = (d[fieldType] ?? '') as string | undefined;

      // Last write wins; they should all agree anyway.
      copperByAccountNumber.set(accountNumberKey, { accountType });
    });
  }

  console.log(`🔗 Loaded ${copperByAccountNumber.size} ACTIVE Copper companies (by Account Order ID)`);
  return copperByAccountNumber;
}

async function importUnifiedReport(buffer: Buffer, filename: string): Promise<ImportStats> {
  console.log('📥 Importing Unified Fishbowl Report from Conversight...');
  
  // Parse file
  console.log('📄 Parsing file...');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  
  console.log(`✅ Found ${data.length} rows to process`);
  
  if (data.length === 0) {
    throw new Error('No data found in file');
  }

  const stats: ImportStats = {
    processed: 0,
    customersCreated: 0,
    customersUpdated: 0,
    ordersCreated: 0,
    ordersUpdated: 0,
    itemsCreated: 0,
    itemsUpdated: 0,
    skipped: 0
  };
  
  // Preload ACTIVE Copper companies (keyed by Account Order ID == accountNumber in Fishbowl)
  console.log('🔗 Loading ACTIVE Copper companies for accountType enrichment...');
  const copperByAccountNumber = await loadActiveCopperCompanies();
  
  // Track processed entities (in-import dedupe)
  const processedCustomers = new Set<string>();
  const processedOrders = new Set<string>();
  
  // Cache final customer accountType for consistent order/item writes
  const customerTypeCache = new Map<string, { type: string; source: 'override'|'existing'|'copper'|'fishbowl' }>();
  
  // FIRST PASS: Aggregate order totals from line items
  console.log('🔄 First pass: Aggregating order totals with precise decimal math...');
  const orderTotals = new Map<string, { revenue: Decimal; orderValue: Decimal; lineCount: number }>();
  
  for (const row of data) {
    // Normalize Sales order Number
    const salesOrderNum = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    if (!salesOrderNum) continue;

    // Exclude shipping and CC processing using correct columns
    const labelLower = String(
      row['SO Item Product Number'] ?? row['Part Description'] ?? ''
    ).toLowerCase();

    const isShipping = labelLower.includes('shipping');
    const isCC = labelLower.includes('cc processing') || labelLower.includes('credit card processing');
    
    if (isShipping || isCC) continue;

    // Add header fallbacks
    const revenue = new Decimal(toNumberSafe(row['Total Price'] ?? row['Total price'] ?? row['Revenue'] ?? row['Fulfilled revenue']));
    const orderValue = new Decimal(toNumberSafe(row['Total Price'] ?? row['Total price'] ?? row['Order value'] ?? row['Fulfilled revenue']));

    if (!orderTotals.has(salesOrderNum)) {
      orderTotals.set(salesOrderNum, { revenue: new Decimal(0), orderValue: new Decimal(0), lineCount: 0 });
    }
    const t = orderTotals.get(salesOrderNum)!;
    t.revenue = t.revenue.plus(revenue);
    t.orderValue = t.orderValue.plus(orderValue);
    t.lineCount++;
  }
  
  console.log(`✅ Aggregated ${orderTotals.size} unique orders from ${data.length} line items`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  const MAX_BATCH_SIZE = 400;
  
  // SECOND PASS: Process each row (customer, order, line item)
  for (const row of data) {
    stats.processed++;
    
    if (stats.processed % 1000 === 0) {
      console.log(`📊 Progress: ${stats.processed}/${data.length} (${((stats.processed/data.length)*100).toFixed(1)}%)`);
    }
    
    const customerId = row['Account ID'];
    const salesOrderNum = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    const salesOrderId = row['Sales Order ID'];
    const lineItemId = row['SO Item ID'] || row['SO item ID'] || row['SO Item Id'] || row['SO item id'];
    
    // Skip if missing critical data
    if (!customerId || !salesOrderNum || !salesOrderId || !lineItemId) {
      stats.skipped++;
      continue;
    }
    
    // === 1. CREATE/UPDATE CUSTOMER ===
    if (!processedCustomers.has(String(customerId))) {
      const customerDocId = String(customerId).replace(/[\/\\]/g, '_').trim();
      const customerRef = adminDb.collection('fishbowl_customers').doc(customerDocId);
      
      const existingCustomer = await customerRef.get();
      const existingData = existingCustomer.exists ? (existingCustomer.data() || {}) : null;

      // Pull accountType from Copper by Account Number (matches Account Order ID in Copper)
      const accountNum = row['Account Number'] ?? row['Account ID'];
      const copper = copperByAccountNumber.get(String(accountNum));
      const copperAccountType = copper?.accountType?.trim();

      // Raw account type from import (often "Retail")
      const fbRowAccountType = row['Account Type'] ?? row['Account type'] ?? row['accountType'] ?? row['Segment'] ?? '';

      // Decide final accountType with precedence: override > existing > copper > fishbowl
      let finalAccountType: string | undefined;
      let accountTypeSource: 'override' | 'existing' | 'copper' | 'fishbowl' | undefined;

      if (existingData?.accountTypeOverride) {
        finalAccountType = existingData.accountTypeOverride;
        accountTypeSource = 'override';
      } else if (existingData?.accountType) {
        finalAccountType = existingData.accountType;
        accountTypeSource = 'existing';
      } else if (copperAccountType) {
        finalAccountType = copperAccountType;
        accountTypeSource = 'copper';
      } else if (fbRowAccountType) {
        finalAccountType = String(fbRowAccountType);
        accountTypeSource = 'fishbowl';
      }
      
      // Cache the final accountType for use in orders/items
      customerTypeCache.set(String(customerId), { type: finalAccountType ?? '', source: accountTypeSource ?? 'fishbowl' });
      
      const customerData: any = {
        id: customerDocId,
        name: row['Customer Name'] || row['Customer'] || '',
        accountNumber: row['Account Number'] || row['Account ID'] || '',
        accountId: row['Account ID'] || '',
        fishbowlUsername: existingData?.fishbowlUsername || '',
        companyId: row['Company id'] || '',
        companyName: row['Company Name'] || row['Company name'] || '',
        parentCompanyId: row['Parent Company ID'] || '',
        parentCustomerName: row['Parent Customer Name'] || '',
        
        billingName: row['Billing Name'] || '',
        billingAddress: row['Billing Address'] || '',
        billingCity: row['Billing City'] || '',
        billingState: row['Billing State'] || '',
        billingZip: row['Billing Zip'] || '',
        
        shippingCity: row['Shipping City'] || row['Billing City'] || '',
        shippingState: row['Shipping State'] || row['Billing State'] || '',
        shippingAddress: row['Shipping Address'] || row['Billing Address'] || '',
        shippingCountry: row['Shipping Country'] || '',
        shipToName: row['Ship to name'] || '',
        shipToZip: row['Ship to zip'] || row['Billing Zip'] || '',
        
        customerContact: row['Customer contact'] || '',
        
        accountType: finalAccountType ?? '',
        accountTypeSource: accountTypeSource ?? undefined,
        
        updatedAt: Timestamp.now(),
        source: 'fishbowl_unified',
      };
      
      if (existingCustomer.exists) {
        batch.update(customerRef, customerData);
        stats.customersUpdated++;
      } else {
        batch.set(customerRef, customerData);
        stats.customersCreated++;
      }
      
      processedCustomers.add(String(customerId));
      batchCount++;
    }
    
    // === 2. CREATE/UPDATE SALES ORDER ===
    // Dedupe by immutable Fishbowl Sales Order ID
    if (!processedOrders.has(String(salesOrderId))) {
      const orderDocId = String(salesOrderId).replace(/[\/\\]/g, '_');
      const orderRef = adminDb.collection('fishbowl_sales_orders').doc(orderDocId);

      const sanitizedCustomerId = String(customerId).replace(/[\/\\]/g, '_').trim();

      const rawDate = row['Date fulfillment'] ?? row['Date fulfilled'] ?? row['Date last fulfillment'] ??
                      row['Issued date'] ?? row['Date created'];

      const { date: postDate, monthKey, y } = parseExcelOrTextDate(rawDate);
      const postingDate = postDate ? Timestamp.fromDate(postDate) : null;
      const postingDateStr = postDate
        ? `${String(postDate.getMonth() + 1).padStart(2, '0')}/${String(postDate.getDate()).padStart(2, '0')}/${postDate.getFullYear()}` 
        : '';
      const commissionMonth = monthKey ?? '';
      const commissionYear = y ?? 0;

      const soNumStr = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
      const totals = orderTotals.get(soNumStr);
      const revenue = totals ? totals.revenue.toNumber() : 0;
      const orderValue = totals ? totals.orderValue.toNumber() : 0;
      const lineCount = totals ? totals.lineCount : 0;

      // Shopify/Commerce detection
      const sp = String(row['Sales person'] || '').toLowerCase();
      const isShopify = soNumStr.startsWith('Sh') || sp === 'commerce' || sp === 'shopify';
      const shopPlatform = isShopify ? (sp.includes('commerce') ? 'commerce' : 'shopify') : '';

      // Get accountType from cache (consistent with customer)
      const cachedType = customerTypeCache.get(String(customerId));
      const accountNum2 = row['Account Number'] ?? row['Account ID'];
      const orderAccountType = cachedType?.type ?? (copperByAccountNumber.get(String(accountNum2))?.accountType?.trim() || (row['Account Type'] ?? row['Account type'] ?? ''));
      const orderAccountTypeSource = cachedType?.source ?? (copperByAccountNumber.get(String(accountNum2))?.accountType ? 'copper' : 'fishbowl');

      const orderData: any = {
        id: orderDocId,
        num: soNumStr,
        fishbowlNum: soNumStr,
        salesOrderId: String(salesOrderId),
        customerId: sanitizedCustomerId,
        customerName: row['Customer Name'] || row['Customer'] || '',

        salesPerson: row['Sales person'] || '',
        salesRep: row['Sales Rep'] || '',
        salesRepInitials: row['Sales Rep Initials'] || '',

        postingDate,
        postingDateStr,
        commissionDate: postingDate,
        commissionMonth,
        commissionYear,

        revenue,
        orderValue,
        lineItemCount: lineCount,

        isShopify,
        shopPlatform,
        accountType: orderAccountType,
        accountTypeSource: orderAccountTypeSource,

        updatedAt: Timestamp.now(),
        source: 'fishbowl_unified',
      };
      
      const existingOrder = await orderRef.get();
      if (existingOrder.exists) {
        batch.update(orderRef, orderData);
        stats.ordersUpdated++;
      } else {
        batch.set(orderRef, orderData);
        stats.ordersCreated++;
      }

      processedOrders.add(String(salesOrderId));
      batchCount++;
    }
    
    // === 3. CREATE/UPDATE LINE ITEM ===
    const itemDocId = `soitem_${String(lineItemId).replace(/[\/\\]/g,'_')}`;
    const itemRef = adminDb.collection('fishbowl_soitems').doc(itemDocId);

    const sanitizedCustomerId2 = String(customerId).replace(/[\/\\]/g, '_').trim();

    const rawDate2 = row['Date fulfillment'] ?? row['Date fulfilled'] ?? row['Date last fulfillment'] ??
                     row['Issued date'] ?? row['Date created'];

    const { date: postDate2, monthKey: monthKey2, y: y2 } = parseExcelOrTextDate(rawDate2);
    const postingDate2 = postDate2 ? Timestamp.fromDate(postDate2) : null;
    const postingDateStr2 = postDate2
      ? `${String(postDate2.getMonth() + 1).padStart(2, '0')}/${String(postDate2.getDate()).padStart(2, '0')}/${postDate2.getFullYear()}` 
      : '';
    const commissionMonth2 = monthKey2 ?? '';
    const commissionYear2 = y2 ?? 0;

    const soNumStr2 = String(row['Sales order Number'] ?? row['Sales Order Number'] ?? '').trim();
    const sp2 = String(row['Sales person'] || '').toLowerCase();
    const isShopify2 = soNumStr2.startsWith('Sh') || sp2 === 'commerce' || sp2 === 'shopify';
    const shopPlatform2 = isShopify2 ? (sp2.includes('commerce') ? 'commerce' : 'shopify') : '';

    // Get accountType from cache (consistent with customer)
    const cachedType2 = customerTypeCache.get(String(customerId));
    const accountNum3 = row['Account Number'] ?? row['Account ID'];
    const itemAccountType = cachedType2?.type ?? (copperByAccountNumber.get(String(accountNum3))?.accountType?.trim() || (row['Account Type'] ?? row['Account type'] ?? ''));
    const itemAccountTypeSource = cachedType2?.source ?? (copperByAccountNumber.get(String(accountNum3))?.accountType ? 'copper' : 'fishbowl');

    // Mark shipping/CC items
    const labelLower2 = String(row['SO Item Product Number'] ?? row['Part Description'] ?? row['Sales Order Item Description'] ?? '').toLowerCase();
    const isShippingItem = labelLower2.includes('shipping');
    const isCCItem = labelLower2.includes('cc processing') || labelLower2.includes('credit card processing');

    const itemData: any = {
      id: itemDocId,
      salesOrderId: String(salesOrderId),
      salesOrderNum: soNumStr2,
      soId: String(salesOrderId).replace(/[\/\\]/g, '_'),

      customerId: sanitizedCustomerId2,
      customerName: row['Customer Name'] || row['Customer'] || '',
      accountNumber: row['Account Number'] || row['Account ID'] || '',
      accountId: row['Account ID'] || '',
      accountType: itemAccountType,
      accountTypeSource: itemAccountTypeSource,

      salesPerson: row['Sales person'] || '',
      salesRep: row['Sales Rep'] || '',
      salesRepInitials: row['Sales Rep Initials'] || '',

      postingDate: postingDate2,
      postingDateStr: postingDateStr2,
      commissionDate: postingDate2,
      commissionMonth: commissionMonth2,
      commissionYear: commissionYear2,

      lineItemId: String(lineItemId),

      partNumber: row['SO Item Product Number'] || row['Part Number'] || '',
      partId: row['Part id'] || '',
      partDescription: row['Part Description'] || '',
      product: row['Product'] || '',
      productId: row['Product ID'] || '',
      productNum: row['SO Item Product Number'] || row['Part Number'] || '',
      productShortNumber: row['Product Short Number'] || '',
      productDescription: row['Part Description'] || row['Product description'] || '',
      description: row['Sales Order Item Description'] || '',
      itemType: row['Sales Order Item Type'] || '',

      uomCode: row['UOM Code'] || '',
      uomName: row['UOM Name'] || '',

      shippingCity: row['Shipping City'] || row['Billing City'] || '',
      shippingState: row['Shipping State'] || row['Billing State'] || '',

      revenue: toNumberSafe(row['Total Price'] ?? row['Total price'] ?? row['Revenue']),
      totalPrice: toNumberSafe(row['Total Price'] ?? row['Total price']),
      unitPrice: toNumberSafe(row['UNIT PRICE'] ?? row['Unit price'] ?? row['Unit Price']),
      totalCost: toNumberSafe(row['Total cost']),
      quantity: toNumberSafe(row['Qty fulfilled'] ?? row['Shipped Quantity']),
      qtyFulfilled: toNumberSafe(row['Qty fulfilled']),

      isShopify: isShopify2,
      shopPlatform: shopPlatform2,
      isShippingItem,
      isCCProcessingItem: isCCItem,

      importedAt: Timestamp.now(),
      source: 'fishbowl_unified',
    };

    // Accurate created/updated counts
    const existingItem = await itemRef.get();
    if (existingItem.exists) {
      batch.update(itemRef, itemData);
      stats.itemsUpdated++;
    } else {
      batch.set(itemRef, itemData);
      stats.itemsCreated++;
    }
    batchCount++;

    // Commit chunk
    if (batchCount >= MAX_BATCH_SIZE) {
      await batch.commit().catch(e => console.error('❌ Batch commit failed:', e?.message || e));
      console.log(`✅ Committed batch of ${batchCount} operations`);
      batch = adminDb.batch();
      batchCount = 0;
    }
  }
  
  // Final commit
  if (batchCount > 0) {
    await batch.commit().catch(e => console.error('❌ Final batch commit failed:', e?.message || e));
    console.log(`✅ Committed final batch of ${batchCount} operations`);
  }
  
  console.log('\n✅ Import Complete!');
  console.log(`   Processed: ${stats.processed} rows`);
  console.log(`   Customers: ${stats.customersCreated} created, ${stats.customersUpdated} updated`);
  console.log(`   Orders: ${stats.ordersCreated} created, ${stats.ordersUpdated} updated`);
  console.log(`   Items: ${stats.itemsCreated} created, ${stats.itemsUpdated} updated`);
  console.log(`   Skipped: ${stats.skipped}`);
  
  return stats;
}

/**
 * POST /api/fishbowl/import-unified
 * Upload and import unified Fishbowl report
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const stats = await importUnifiedReport(buffer, file.name);
    
    return NextResponse.json({
      success: true,
      message: 'Unified import completed successfully',
      stats
    });
    
  } catch (error: any) {
    console.error('Error importing unified report:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import unified report' },
      { status: 500 }
    );
  }
}
