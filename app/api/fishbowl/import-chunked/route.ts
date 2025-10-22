import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import * as XLSX from 'xlsx';
import Decimal from 'decimal.js';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Chunked Fishbowl Import Endpoint
 * 
 * Accepts file chunks and reassembles them for processing.
 * This bypasses Vercel's 4.5 MB body size limit.
 */

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

// In-memory storage for chunks (will be cleared after processing)
const chunkStorage = new Map<string, { chunks: Buffer[], totalChunks: number, receivedChunks: number }>();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const chunk = formData.get('chunk') as File | null;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string);
    const totalChunks = parseInt(formData.get('totalChunks') as string);
    const fileId = formData.get('fileId') as string;
    const filename = formData.get('filename') as string;

    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !fileId) {
      return NextResponse.json(
        { error: 'Invalid chunk data' },
        { status: 400 }
      );
    }

    console.log(`📦 Received chunk ${chunkIndex + 1}/${totalChunks} for file ${fileId}`);

    // Initialize storage for this file if needed
    if (!chunkStorage.has(fileId)) {
      chunkStorage.set(fileId, {
        chunks: new Array(totalChunks),
        totalChunks,
        receivedChunks: 0
      });
    }

    const storage = chunkStorage.get(fileId)!;
    
    // Store this chunk
    const chunkBuffer = Buffer.from(await chunk.arrayBuffer());
    storage.chunks[chunkIndex] = chunkBuffer;
    storage.receivedChunks++;

    console.log(`✅ Stored chunk ${chunkIndex + 1}/${totalChunks} (${storage.receivedChunks}/${totalChunks} received)`);

    // If all chunks received, process the file
    if (storage.receivedChunks === totalChunks) {
      console.log('🎉 All chunks received! Reassembling and processing...');
      
      // Reassemble the file
      const completeBuffer = Buffer.concat(storage.chunks);
      
      // Clear from memory
      chunkStorage.delete(fileId);
      
      console.log(`📄 Reassembled file: ${completeBuffer.length} bytes`);
      
      // Generate import ID
      const importId = `import_${Date.now()}`;
      
      // Start processing in the background (don't await)
      importUnifiedReport(completeBuffer, filename, importId).catch(error => {
        console.error('❌ Background import failed:', error);
      });
      
      // Return immediately so frontend can start polling
      return NextResponse.json({
        success: true,
        complete: true,
        importId: importId,
        message: 'Import started - check progress',
        processing: true
      });
    }

    // Return progress
    return NextResponse.json({
      success: true,
      complete: false,
      progress: (storage.receivedChunks / totalChunks) * 100,
      received: storage.receivedChunks,
      total: totalChunks
    });

  } catch (error: any) {
    console.error('❌ Chunk upload error:', error);
    return NextResponse.json(
      { error: error.message || 'Chunk upload failed' },
      { status: 500 }
    );
  }
}

async function importUnifiedReport(buffer: Buffer, filename: string, importId: string): Promise<{ stats: ImportStats; importId: string }> {
  console.log('📥 Importing Unified Fishbowl Report from Conversight...');
  console.log(`📋 Import ID: ${importId}`);
  
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
    itemsUpdated: 0,
    skipped: 0
  };
  
  // Initialize progress tracking in Firestore
  const progressRef = adminDb.collection('import_progress').doc(importId);
  await progressRef.set({
    status: 'parsing',
    totalRows: data.length,
    currentRow: 0,
    percentage: 0,
    currentCustomer: '',
    currentOrder: '',
    stats: stats,
    startedAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
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
    
    // Revenue is "Total Price" in Coversight export (line item revenue)
    const revenue = new Decimal(row['Total Price'] || row['Revenue'] || row['Fulfilled revenue'] || 0);
    // Order value - use same as revenue for line items (will be aggregated at order level)
    const orderValue = new Decimal(row['Total Price'] || row['Order value'] || row['Fulfilled revenue'] || 0);
    
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
  const MAX_BATCH_SIZE = 400; // Firestore hard limit is 500, use 400 for safety
  
  let rowIndex = 0;
  const totalRows = data.length;
  let lastProgressUpdate = 0;
  
  for (const row of data) {
    rowIndex++;
    stats.processed++;
    
    // Update progress every 50 rows (for UI responsiveness) and every 1000 rows (for console)
    const shouldUpdateUI = stats.processed % 50 === 0;
    const shouldLogConsole = stats.processed % 1000 === 0;
    
    if (shouldLogConsole) {
      console.log(`📊 Progress: ${stats.processed} of ${totalRows} (${((stats.processed/totalRows)*100).toFixed(1)}%)`);
      console.log(`   Customers: ${stats.customersCreated} created, ${stats.customersUpdated} updated`);
      console.log(`   Orders: ${stats.ordersCreated} created, ${stats.ordersUpdated} updated`);
      console.log(`   Items: ${stats.itemsCreated} created/updated, Skipped: ${stats.skipped}`);
    }
    
    if (shouldUpdateUI) {
      const customerName = row['Customer Name'] || row['Customer'] || '';
      const salesOrderNum = row['Sales order Number'] || '';
      const percentage = ((stats.processed / totalRows) * 100);
      
      // Update Firestore progress (await to ensure it completes)
      try {
        await progressRef.update({
          status: 'processing',
          currentRow: stats.processed,
          percentage: Math.round(percentage * 10) / 10, // Round to 1 decimal
          currentCustomer: customerName,
          currentOrder: salesOrderNum,
          stats: stats,
          updatedAt: Timestamp.now()
        });
        console.log(`📊 Progress updated: ${stats.processed}/${totalRows} (${percentage.toFixed(1)}%)`);
      } catch (err) {
        console.error('❌ Progress update error:', err);
      }
    }
    
    
    try {
      // Extract key fields - EXACT field names from Conversight CSV
      const customerId = row['Account ID'] || row['Company id'] || row['Customer Id'] || row['Customer id'];
      const salesOrderNum = row['Sales order Number'];
      const salesOrderId = row['Sales Order ID'] || row['Sales order Id'];
      
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
          accountNumber: row['Account ID'] || '',  // Account ID from Conversight
          // PRESERVE existing accountType if it exists, otherwise use Fishbowl value
          accountType: existingData?.accountType || row['Account type'] || '',
          // PRESERVE manual sales rep assignment (fishbowlUsername) - don't overwrite with import
          fishbowlUsername: existingData?.fishbowlUsername || '',
          companyId: row['Company id'] || '',
          companyName: row['Company name'] || '',
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
        const postingDateRaw = row['Date fulfillment'] || row['Date fulfilled'] || row['Date last fulfillment'] || row['Issued date'] || row['Date created'];
        let postingDate = null;
        let postingDateStr = '';
        let commissionMonth = '';
        let commissionYear = 0;
        
        if (postingDateRaw) {
          try {
            // Check if it's an Excel serial number (numeric)
            if (typeof postingDateRaw === 'number') {
              const excelEpoch = new Date(1899, 11, 30);
              postingDate = new Date(excelEpoch.getTime() + postingDateRaw * 86400000);
              
              const month = postingDate.getMonth() + 1;
              const day = postingDate.getDate();
              const year = postingDate.getFullYear();
              
              postingDateStr = `${String(month).padStart(2, '0')}/${String(day).padStart(2, '0')}/${year}`;
              commissionMonth = `${year}-${String(month).padStart(2, '0')}`;
              commissionYear = year;
            } else {
              const dateStr = String(postingDateRaw);
              postingDateStr = dateStr;
              
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
        
        // Get aggregated totals for this order
        const aggregatedTotals = orderTotals.get(String(salesOrderNum));
        const revenue = aggregatedTotals ? aggregatedTotals.revenue.toNumber() : 0;
        const orderValue = aggregatedTotals ? aggregatedTotals.orderValue.toNumber() : 0;
        const lineCount = aggregatedTotals ? aggregatedTotals.lineCount : 0;
        
        const orderData: any = {
          id: orderDocId,
          num: String(salesOrderNum),
          fishbowlNum: String(salesOrderNum),
          salesOrderId: String(salesOrderId),
          customerId: sanitizedCustomerId,
          customerName: row['Customer Name'] || row['Customer'] || '',
          salesPerson: row['Sales person'] || '',
          salesRep: row['Sales Rep'] || '',
          
          // Commission tracking fields
          postingDate: postingDate ? Timestamp.fromDate(postingDate) : null,
          postingDateStr: postingDateStr,
          commissionDate: postingDate ? Timestamp.fromDate(postingDate) : null,
          commissionMonth: commissionMonth,
          commissionYear: commissionYear,
          
          // Financial totals
          revenue: revenue,
          orderValue: orderValue,
          lineItemCount: lineCount,
          
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
        
        processedOrders.add(String(salesOrderNum));
        batchCount++;
      }
      
      // === 3. CREATE SOITEM (LINE ITEM) ===
      const lineItemId = row['SO Item ID'] || row['So item id'];
      if (!lineItemId) {
        stats.skipped++;
        continue;
      }
      
      const itemDocId = `soitem_${lineItemId}`;
      const itemRef = adminDb.collection('fishbowl_soitems').doc(itemDocId);
      
      const sanitizedCustomerId = String(customerId)
        .replace(/\//g, '_')
        .replace(/\\/g, '_')
        .trim();
      
      // Parse posting date for line items
      const postingDateRaw2 = row['Date fulfillment'] || row['Date fulfilled'] || row['Date last fulfillment'] || row['Issued date'] || row['Date created'];
      let postingDate2 = null;
      let postingDateStr2 = '';
      let commissionMonth2 = '';
      let commissionYear2 = 0;
      
      if (postingDateRaw2) {
        try {
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
            const dateStr = String(postingDateRaw2);
            postingDateStr2 = dateStr;
            
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
        id: itemDocId,
        
        // Sales Order Links
        salesOrderId: String(salesOrderId),
        salesOrderNum: String(salesOrderNum),
        soId: `fb_so_${salesOrderNum}`,
        
        // Customer Info
        customerId: sanitizedCustomerId,
        customerName: row['Customer Name'] || row['Customer'] || '',
        accountNumber: row['Account ID'] || '',
        accountType: row['Account type'] || '',
        
        // Sales Person
        salesPerson: row['Sales person'] || '',
        salesRep: row['Sales Rep'] || '',
        
        // Commission Tracking
        postingDate: postingDate2 ? Timestamp.fromDate(postingDate2) : null,
        postingDateStr: postingDateStr2,
        commissionDate: postingDate2 ? Timestamp.fromDate(postingDate2) : null,
        commissionMonth: commissionMonth2,
        commissionYear: commissionYear2,
        
        // Line Item Identification
        lineItemId: String(lineItemId),
        
        // Product Info
        partNumber: row['SO Item Product Number'] || row['Part Number'] || '',
        partId: row['Part id'] || '',
        product: row['Product'] || '',
        productC1: row['Product Custom Field 1'] || row['Product Custom 1'] || row['Product c1'] || '',
        productC2: row['Product Custom Field 2'] || row['Product Custom 2'] || row['Product c2'] || '',
        productC3: row['Product Custom Field 3'] || row['Product Custom 3'] || row['Product c3'] || '',
        productC4: row['Product Custom Field 4'] || row['Product Custom 4'] || row['Product c4'] || '',
        productC5: row['Product c5'] || row['Product Custom 5'] || row['Product Custom Field 5'] || '',
        productDesc: row['Product description'] || row['Product desc'] || row['Part Description'] || '',
        description: row['Sales Order Item Description'] || '',
        itemType: row['Sales Order Item Type'] || '',
        
        // Shipping Info
        shippingCity: row['Shipping City'] || row['Billing City'] || '',
        shippingState: row['Shipping State'] || row['Billing State'] || '',
        shippingItemId: row['Shipping Item ID'] || '',
        
        // Financial Data
        revenue: parseFloat(row['Total Price'] || row['Revenue'] || 0),
        unitPrice: parseFloat(row['Unit price'] || 0),
        invoicedCost: parseFloat(row['Total cost'] || row['Invoiced cost'] || 0),
        margin: parseFloat(row['Sales Order Product Margin'] || row['Margin'] || 0),
        quantity: parseFloat(row['Qty fulfilled'] || row['Shipped Quantity'] || 0),
        
        // Import metadata
        importedAt: Timestamp.now(),
        source: 'fishbowl_unified',
      };
      
      batch.set(itemRef, itemData);
      stats.itemsCreated++;
      batchCount++;
      
      // Check batch size
      if (batchCount >= MAX_BATCH_SIZE) {
        try {
          await batch.commit();
          console.log(`💾 Committed batch: ${stats.customersCreated + stats.customersUpdated} customers, ${stats.ordersCreated + stats.ordersUpdated} orders, ${stats.itemsCreated} items`);
          batch = adminDb.batch();
          batchCount = 0;
        } catch (error: any) {
          console.error(`❌ Batch commit failed:`, error.message);
          batch = adminDb.batch();
          batchCount = 0;
        }
      }
      
    } catch (error: any) {
      console.error(`❌ Error processing row ${stats.processed}:`, error.message);
      stats.skipped++;
    }
  }
  
  // Commit remaining
  if (batchCount > 0) {
    try {
      console.log(`💾 Committing final batch of ${batchCount} operations...`);
      await batch.commit();
      console.log(`✅ Final batch committed successfully`);
    } catch (error: any) {
      console.error(`❌ Final batch commit failed:`, error.message);
      throw error;
    }
  }
  
  console.log(`\n✅ UNIFIED IMPORT COMPLETE!`);
  console.log(`   Rows processed: ${stats.processed}`);
  console.log(`   Customers: ${stats.customersCreated} created, ${stats.customersUpdated} updated`);
  console.log(`   Orders: ${stats.ordersCreated} created, ${stats.ordersUpdated} updated`);
  console.log(`   Line Items: ${stats.itemsCreated} created/updated`);
  console.log(`   Skipped: ${stats.skipped}\n`);
  
  // Mark import as complete in Firestore
  await progressRef.update({
    status: 'complete',
    currentRow: stats.processed,
    percentage: 100,
    stats: stats,
    completedAt: Timestamp.now(),
    updatedAt: Timestamp.now()
  });
  
  return { stats, importId };
}
