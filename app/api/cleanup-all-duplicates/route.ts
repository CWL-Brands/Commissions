import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Clean up ALL duplicate data in Fishbowl collections
 * POST /api/cleanup-all-duplicates
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting comprehensive duplicate cleanup...');
    
    const results = {
      orders: { total: 0, duplicatesDeleted: 0 },
      lineItems: { total: 0, duplicatesDeleted: 0 },
      customers: { total: 0, duplicatesDeleted: 0 }
    };

    // 1. Clean up duplicate orders
    console.log('📦 Cleaning duplicate orders...');
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders').get();
    results.orders.total = ordersSnapshot.size;
    
    const orderGroups = new Map<string, any[]>();
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const uniqueKey = `${order.num}_${order.customerId}_${order.salesPerson}_${order.revenue}`;
      
      if (!orderGroups.has(uniqueKey)) {
        orderGroups.set(uniqueKey, []);
      }
      orderGroups.get(uniqueKey)!.push({
        id: doc.id,
        data: order,
        createdAt: order.createdAt || order.importedAt || new Date(0)
      });
    });

    let batch = adminDb.batch();
    let batchCount = 0;

    for (const [uniqueKey, orders] of orderGroups.entries()) {
      if (orders.length > 1) {
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        for (let i = 1; i < orders.length; i++) {
          batch.delete(adminDb.collection('fishbowl_sales_orders').doc(orders[i].id));
          results.orders.duplicatesDeleted++;
          batchCount++;
          
          if (batchCount >= 500) {
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }

    // 2. Clean up duplicate line items
    console.log('📋 Cleaning duplicate line items...');
    const lineItemsSnapshot = await adminDb.collection('fishbowl_soitems').get();
    results.lineItems.total = lineItemsSnapshot.size;
    
    const lineItemGroups = new Map<string, any[]>();
    lineItemsSnapshot.forEach(doc => {
      const item = doc.data();
      const uniqueKey = `${item.salesOrderId}_${item.partNumber}_${item.quantity}_${item.unitPrice}`;
      
      if (!lineItemGroups.has(uniqueKey)) {
        lineItemGroups.set(uniqueKey, []);
      }
      lineItemGroups.get(uniqueKey)!.push({
        id: doc.id,
        data: item,
        createdAt: item.createdAt || item.importedAt || new Date(0)
      });
    });

    for (const [uniqueKey, items] of lineItemGroups.entries()) {
      if (items.length > 1) {
        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        for (let i = 1; i < items.length; i++) {
          batch.delete(adminDb.collection('fishbowl_soitems').doc(items[i].id));
          results.lineItems.duplicatesDeleted++;
          batchCount++;
          
          if (batchCount >= 500) {
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
      batch = adminDb.batch();
      batchCount = 0;
    }

    // 3. Clean up duplicate customers
    console.log('👥 Cleaning duplicate customers...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    results.customers.total = customersSnapshot.size;
    
    const customerGroups = new Map<string, any[]>();
    customersSnapshot.forEach(doc => {
      const customer = doc.data();
      const uniqueKey = `${customer.customerNum}_${customer.name}`;
      
      if (!customerGroups.has(uniqueKey)) {
        customerGroups.set(uniqueKey, []);
      }
      customerGroups.get(uniqueKey)!.push({
        id: doc.id,
        data: customer,
        createdAt: customer.createdAt || customer.importedAt || new Date(0)
      });
    });

    for (const [uniqueKey, customers] of customerGroups.entries()) {
      if (customers.length > 1) {
        customers.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        for (let i = 1; i < customers.length; i++) {
          batch.delete(adminDb.collection('fishbowl_customers').doc(customers[i].id));
          results.customers.duplicatesDeleted++;
          batchCount++;
          
          if (batchCount >= 500) {
            await batch.commit();
            batch = adminDb.batch();
            batchCount = 0;
          }
        }
      }
    }

    if (batchCount > 0) {
      await batch.commit();
    }

    console.log('🎉 Comprehensive cleanup complete!');
    console.log('📊 Results:', results);

    return NextResponse.json({
      success: true,
      message: 'Comprehensive duplicate cleanup completed',
      results: results
    });

  } catch (error: any) {
    console.error('Error in comprehensive cleanup:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clean up duplicates' },
      { status: 500 }
    );
  }
}
