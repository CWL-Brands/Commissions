import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Unified Fishbowl Import from Conversight Report
 * 
 * This single import creates:
 * 1. fishbowl_customers (deduplicated by Customer id)
 * 2. fishbowl_sales_orders (deduplicated by Sales order Number)
 * 3. fishbowl_soitems (one per row - line items)
 * 
 * All properly linked together!
 */

interface ImportStats {
  processed: number;
  customersCreated: number;
  customersUpdated: number;
  ordersCreated: number;
  ordersUpdated: number;
  itemsCreated: number;
  skipped: number;
}

async function importUnifiedReport(buffer: Buffer, filename: string): Promise<ImportStats> {
  console.log('📥 Importing Unified Fishbowl Report from Conversight...');
  
  let data: Record<string, any>[];
  
  // Parse file - use XLSX for both CSV and Excel for consistent parsing
  console.log('📄 Parsing file...');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  data = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];
  
  console.log(`✅ Found ${data.length} rows to process`);
  
  const stats: ImportStats = {
    processed: 0,
    customersCreated: 0,
    customersUpdated: 0,
    ordersCreated: 0,
    ordersUpdated: 0,
    itemsCreated: 0,
    skipped: 0
  };
  
  // Track what we've already processed (to avoid duplicates within the same import)
  const processedCustomers = new Set<string>();
  const processedOrders = new Set<string>();
  
  // FIRST PASS: Aggregate order totals from line items using Decimal.js for precision
  console.log('🔄 First pass: Aggregating order totals with precise decimal math...');
  const orderTotals = new Map<string, { revenue: Decimal; orderValue: Decimal; lineCount: number }>();
  
  for (const row of data) {
    const salesOrderNum = String(row['Sales order Number'] || '');
    if (!salesOrderNum) continue;
    
    // Exclude shipping and CC processing fees from commission calculations
    const productDescription = String(row['Sales Order Item Description'] || '').toLowerCase();
    const isShipping = productDescription.includes('shipping');
    const isCCProcessing = productDescription.includes('cc processing') || 
                          productDescription.includes('credit card processing');
    
    // Skip this line item if it's shipping or CC processing
    if (isShipping || isCCProcessing) {
      console.log(`⏭️  Excluding from totals: ${row['Sales Order Item Description']} (Order ${salesOrderNum})`);
      continue;
    }
    
    const revenue = new Decimal(row['Revenue'] || 0);
    const orderValue = new Decimal(row['Order value'] || 0);
    
    if (!orderTotals.has(salesOrderNum)) {
      orderTotals.set(salesOrderNum, { revenue: new Decimal(0), orderValue: new Decimal(0), lineCount: 0 });
    }
    
    const totals = orderTotals.get(salesOrderNum)!;
    totals.revenue = totals.revenue.plus(revenue);
    totals.orderValue = totals.orderValue.plus(orderValue);
    totals.lineCount++;
  }
  
  console.log(`✅ Aggregated ${orderTotals.size} unique orders from ${data.length} line items`);
  
  let batch = adminDb.batch();
  let batchCount = 0;
  
  let rowIndex = 0;
  const totalRows = data.length;
  for (const row of data) {
    rowIndex++;
    stats.processed++;
    
    // Log progress every 1000 rows
    if (stats.processed % 1000 === 0) {
      console.log(`📊 Progress: ${stats.processed} of ${totalRows} (${((stats.processed/totalRows)*100).toFixed(1)}%)`);
      console.log(`   Customers: ${stats.customersCreated} created, ${stats.customersUpdated} updated`);
      console.log(`   Orders: ${stats.ordersCreated} created, ${stats.ordersUpdated} updated`);
      console.log(`   Items: ${stats.itemsCreated} created, Skipped: ${stats.skipped}`);
    }
    
    
    try {
      // Extract key fields
      const customerId = row['Customer id'];
      const salesOrderNum = row['Sales order Number'];
      const salesOrderId = row['Sales Order ID'];
      
      // Skip if missing critical data
      if (!customerId || !salesOrderNum || !salesOrderId) {
        stats.skipped++;
        continue;
      }
      
      // === 1. CREATE/UPDATE CUSTOMER ===
      if (!processedCustomers.has(String(customerId))) {
        // Sanitize customer ID - remove slashes and invalid Firestore path characters
        const customerDocId = String(customerId)
          .replace(/\//g, '_')  // Replace / with _
          .replace(/\\/g, '_')  // Replace \ with _
          .trim();
        
        const customerRef = adminDb.collection('fishbowl_customers').doc(customerDocId);
        
        // Check if exists first to preserve account type
        const existingCustomer = await customerRef.get();
        const existingData = existingCustomer.exists ? existingCustomer.data() : null;
        
        const customerData: any = {
          id: customerDocId,  // Fishbowl Customer ID
          name: row['Customer Name'] || row['Customer'] || '',  // Customer Name (try both formats)
          accountNumber: row['Account Number'] || '',  // Customer Account Number in Fishbowl
          // PRESERVE existing accountType if it exists, otherwise use Fishbowl value
          accountType: existingData?.accountType || row['Account Type'] || '',
          // PRESERVE manual sales rep assignment (fishbowlUsername) - don't overwrite with import
          fishbowlUsername: existingData?.fishbowlUsername || '',
          companyId: row['Company id'] || '',
          companyName: row['Company Name'] || row['Company name'] || '',
          parentCompanyId: row['Parent Company ID'] || '',
          parentCustomerName: row['Parent Customer Name'] || '',
          shippingCity: row['Shipping City'] || row['Billing City'] || '',
          shippingState: row['Shipping State'] || row['Billing State'] || '',
          shippingAddress: row['Shipping Address'] || row['Billing Address'] || '',
          shippingCountry: row['Shipping Country'] || '',
          shipToName: row['Ship to name'] || '',
          shipToZip: row['Ship to zip'] || row['Billing Zip'] || '',
          customerContact: row['Customer contact'] || '',
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
      if (!processedOrders.has(String(salesOrderNum))) {
        const orderDocId = `fb_so_${salesOrderNum}`;
        const orderRef = adminDb.collection('fishbowl_sales_orders').doc(orderDocId);
        
        // Sanitize customer ID for consistency
        const sanitizedCustomerId = String(customerId)
          .replace(/\//g, '_')
          .replace(/\\/g, '_')
          .trim();
        
        // Parse posting date for commission tracking
        const postingDateRaw = row['Posting Date'];
        let postingDate = null;
        let postingDateStr = '';
        let commissionMonth = '';
        let commissionYear = 0;
        
        if (postingDateRaw) {
          try {
            // Check if it's an Excel serial number (numeric)
            if (typeof postingDateRaw === 'number') {
              // Convert Excel serial date to JavaScript Date
              // Excel dates are days since 1/1/1900
              const excelEpoch = new Date(1899, 11, 30); // Excel epoch (Dec 30, 1899)
              postingDate = new Date(excelEpoch.getTime() + postingDateRaw * 86400000);
              
              const month = postingDate.getMonth() + 1;
              const day = postingDate.getDate();
              const year = postingDate.getFullYear();
              
              postingDateStr = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
              commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
              commissionYear = year;
            } else {
              // String format: MM-DD-YYYY or MM/DD/YYYY
              const dateStr = String(postingDateRaw);
              postingDateStr = dateStr;
              
              // Try splitting by dash first, then slash
              let dateParts = dateStr.split('-');
              if (dateParts.length !== 3) {
                dateParts = dateStr.split('/');
              }
              
              if (dateParts.length === 3) {
                const month = parseInt(dateParts[0]);
                const day = parseInt(dateParts[1]);
                const year = parseInt(dateParts[2]);
                postingDate = new Date(year, month - 1, day);
                commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
                commissionYear = year;
              }
            }
          } catch (e) {
            // Silently ignore parse errors
          }
        }
        
        // Get aggregated totals for this order (convert Decimal to number for storage)
        const aggregatedTotals = orderTotals.get(String(salesOrderNum));
        const revenue = aggregatedTotals ? aggregatedTotals.revenue.toNumber() : 0;
        const orderValue = aggregatedTotals ? aggregatedTotals.orderValue.toNumber() : 0;
        const lineCount = aggregatedTotals ? aggregatedTotals.lineCount : 0;
        
        const orderData: any = {
          id: orderDocId,  // fb_so_{Sales order Number}
          num: String(salesOrderNum),  // Sales Order Number (external customer-facing)
          fishbowlNum: String(salesOrderNum),
          salesOrderId: String(salesOrderId), // Sales Order ID (Fishbowl assigned ID)
          customerId: sanitizedCustomerId, // Customer ID (Fishbowl)
          customerName: row['Customer Name'] || row['Customer'] || '',  // Customer Name (try both formats)
          salesPerson: row['Sales person'] || '',  // Sales Person (long name)
          salesRep: row['Sales Rep'] || '',  // Sales Rep (short name)
          
          // Commission tracking fields
          postingDate: postingDate ? Timestamp.fromDate(postingDate) : null,
          postingDateStr: postingDateStr,
          commissionDate: postingDate ? Timestamp.fromDate(postingDate) : null, // COMMISSION DATE = POSTING DATE
          commissionMonth: commissionMonth, // For grouping: "2025-10"
          commissionYear: commissionYear, // For filtering: 2025
          
          // Financial totals - USE AGGREGATED TOTALS FROM ALL LINE ITEMS (precise decimal math)
          revenue: revenue,  // SUM of all line items for this order
          orderValue: orderValue,  // SUM of all line items for this order
          lineItemCount: lineCount, // Number of line items
          
          updatedAt: Timestamp.now(),
          source: 'fishbowl_unified',
        };
        
        // Check if exists
        const existingOrder = await orderRef.get();
        if (existingOrder.exists) {
          batch.update(orderRef, orderData);
          stats.ordersUpdated++;
        } else {
          batch.set(orderRef, orderData);
          stats.ordersCreated++;
        }
        
        processedOrders.add(String(salesOrderNum));
        batchCount++;
      }
      
      // === 3. CREATE SOITEM (LINE ITEM) ===
      // Each row is a unique line item
      // Sales Order Product ID is the unique line item ID from Fishbowl
      const productLineId = row['Sales Order Product ID'];
      if (!productLineId) {
        stats.skipped++;
        continue;
      }
      
      const itemDocId = `soitem_${productLineId}`;
      const itemRef = adminDb.collection('fishbowl_soitems').doc(itemDocId);
      
      // Sanitize customer ID for consistency
      const sanitizedCustomerId = String(customerId)
        .replace(/\//g, '_')
        .replace(/\\/g, '_')
        .trim();
      
      // Parse posting date for commission tracking (denormalized for fast queries)
      const postingDateRaw2 = row['Posting Date'];
      let postingDate2 = null;
      let postingDateStr2 = '';
      let commissionMonth2 = '';
      let commissionYear2 = 0;
      
      if (postingDateRaw2) {
        try {
          // Check if it's an Excel serial number (numeric)
          if (typeof postingDateRaw2 === 'number') {
            const excelEpoch = new Date(1899, 11, 30);
            postingDate2 = new Date(excelEpoch.getTime() + postingDateRaw2 * 86400000);
            
            const month = postingDate2.getMonth() + 1;
            const day = postingDate2.getDate();
            const year = postingDate2.getFullYear();
            
            postingDateStr2 = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
            commissionMonth2 = `${year}-${String(month).padStart(2, '0')}`;
            commissionYear2 = year;
          } else {
            // String format: MM-DD-YYYY or MM/DD/YYYY
            const dateStr = String(postingDateRaw2);
            postingDateStr2 = dateStr;
            
            // Try splitting by dash first, then slash
            let dateParts = dateStr.split('-');
            if (dateParts.length !== 3) {
              dateParts = dateStr.split('/');
            }
            
            if (dateParts.length === 3) {
              const month = parseInt(dateParts[0]);
              const day = parseInt(dateParts[1]);
              const year = parseInt(dateParts[2]);
              postingDate2 = new Date(year, month - 1, day);
              commissionMonth2 = `${year}-${String(month).padStart(2, '0')}`;
              commissionYear2 = year;
            }
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      const itemData: any = {
        id: itemDocId,  // soitem_{Sales Order Product ID}
        
        // Sales Order Links
        salesOrderId: String(salesOrderId), // Sales Order ID (Fishbowl assigned ID)
        salesOrderNum: String(salesOrderNum), // Sales Order Number (customer-facing)
        soId: `fb_so_${salesOrderNum}`, // Link to fishbowl_sales_orders collection
        
        // Customer Info (denormalized for fast queries)
        customerId: sanitizedCustomerId, // Customer ID (Fishbowl)
        customerName: row['Customer Name'] || row['Customer'] || '',  // Customer Name (try both formats)
        accountNumber: row['Account Number'] || '',  // Customer Account Number
        accountType: row['Account Type'] || '',
        
        // Sales Person
        salesPerson: row['Sales person'] || '',  // Sales Person (long name)
        salesRep: row['Sales Rep'] || '',  // Sales Rep (short name)
        
        // Commission Tracking (denormalized for fast queries)
        postingDate: postingDate2 ? Timestamp.fromDate(postingDate2) : null,
        postingDateStr: postingDateStr2,
        commissionDate: postingDate2 ? Timestamp.fromDate(postingDate2) : null, // COMMISSION DATE = POSTING DATE
        commissionMonth: commissionMonth2, // For grouping: "2025-10"
        commissionYear: commissionYear2, // For filtering: 2025
        
        // Line Item Identification
        lineItemId: String(productLineId), // Sales Order Product ID (unique line item ID)
        
        // Product Info
        partNumber: row['Part Number'] || '',  // Name of the SKU in Fishbowl
        partId: row['Part id'] || '',  // ID associated to the part number
        product: row['Product'] || '',
        productC1: row['Product Custom 1'] || row['Product c1'] || '',  // Product category 1
        productC2: row['Product Custom 2'] || row['Product c2'] || '',  // Product category 2
        productC3: row['Product Custom 3'] || row['Product c3'] || '',  // Product category 3
        productC4: row['Product Custom 4'] || row['Product c4'] || '',  // Product category 4
        productC5: row['Product Custom 5'] || row['Product c5'] || '',  // Product category 5
        productDesc: row['Product desc'] || row['Part Description'] || '',
        description: row['Sales Order Item Description'] || '',
        itemType: row['Sales Order Item Type'] || '',
        
        // Shipping Info (try Billing fields as fallback)
        shippingCity: row['Shipping City'] || row['Billing City'] || '',
        shippingState: row['Shipping State'] || row['Billing State'] || '',
        shippingItemId: row['Shipping Item ID'] || '',
        
        // Financial Data (LINE ITEM LEVEL)
        // Support both Coversight field names and standard names
        revenue: parseFloat(row['Total Price'] || row['Revenue'] || 0),  // Line item revenue
        unitPrice: parseFloat(row['UNIT PRICE'] || row['Unit price'] || row['Unit Price'] || 0),  // Price customer pays per unit
        invoicedCost: parseFloat(row['Total cost'] || row['Invoiced cost'] || 0),  // Cost of the product/line item
        margin: parseFloat(row['Sales Order Product Margin'] || row['Margin'] || 0),  // Dollar amount of margin from line item
        quantity: parseFloat(row['Shipped Quantity'] || 0),  // Unit quantity of line item
        
        // Import metadata
        importedAt: Timestamp.now(),
        source: 'fishbowl_unified',
      };
      
      batch.set(itemRef, itemData);
      stats.itemsCreated++;
      batchCount++;
      
      // Commit in batches of 500
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`💾 Committed batch: ${stats.customersCreated + stats.customersUpdated} customers, ${stats.ordersCreated + stats.ordersUpdated} orders, ${stats.itemsCreated} items`);
        batch = adminDb.batch();
        batchCount = 0;
      }
      
    } catch (error: any) {
      console.error(`❌ Error processing row ${stats.processed}:`, error.message);
      stats.skipped++;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    await batch.commit();
  }
  
  console.log(`\n✅ UNIFIED IMPORT COMPLETE!`);
  console.log(`   Rows processed: ${stats.processed}`);
  console.log(`   Customers: ${stats.customersCreated} created, ${stats.customersUpdated} updated`);
  console.log(`   Orders: ${stats.ordersCreated} created, ${stats.ordersUpdated} updated`);
  console.log(`   Line Items: ${stats.itemsCreated} created`);
  console.log(`   Skipped: ${stats.skipped}\n`);
  
  return stats;
}


export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    console.log(`📁 File received: ${file.name}`);
    
    const buffer = Buffer.from(await file.arrayBuffer());
    const stats = await importUnifiedReport(buffer, file.name);
    
    return NextResponse.json({
      success: true,
      stats,
      message: `Successfully imported ${stats.itemsCreated} line items, ${stats.customersCreated + stats.customersUpdated} customers, ${stats.ordersCreated + stats.ordersUpdated} orders`
    });
    
  } catch (error: any) {
    console.error('❌ Import error:', error);
    return NextResponse.json(
      { error: error.message || 'Import failed' },
      { status: 500 }
    );
  }
}
