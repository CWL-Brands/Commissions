import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Clean up duplicate orders in fishbowl_sales_orders collection
 * POST /api/cleanup-duplicate-orders
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting duplicate order cleanup...');

    // Get all orders
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders').get();
    console.log(`📊 Found ${ordersSnapshot.size} total orders`);

    // Group orders by unique identifier
    const orderGroups = new Map<string, any[]>();
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      // Create unique key based on order number, customer, rep, and revenue
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

    // Find duplicates
    let duplicatesFound = 0;
    let duplicatesDeleted = 0;
    const batch = adminDb.batch();
    let batchCount = 0;

    for (const [uniqueKey, orders] of orderGroups.entries()) {
      if (orders.length > 1) {
        duplicatesFound += orders.length - 1;
        console.log(`🔍 Found ${orders.length} duplicates for order: ${uniqueKey}`);
        
        // Sort by creation date (keep the most recent)
        orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        
        // Keep the first (most recent), delete the rest
        for (let i = 1; i < orders.length; i++) {
          const duplicateOrder = orders[i];
          console.log(`   ❌ Deleting duplicate: ${duplicateOrder.id}`);
          
          batch.delete(adminDb.collection('fishbowl_sales_orders').doc(duplicateOrder.id));
          duplicatesDeleted++;
          batchCount++;
          
          // Commit batch every 500 operations to avoid limits
          if (batchCount >= 500) {
            await batch.commit();
            console.log(`✅ Committed batch of ${batchCount} deletions`);
            batchCount = 0;
          }
        }
      }
    }

    // Commit remaining batch
    if (batchCount > 0) {
      await batch.commit();
      console.log(`✅ Committed final batch of ${batchCount} deletions`);
    }

    console.log(`🧹 Cleanup complete!`);
    console.log(`   📊 Total orders processed: ${ordersSnapshot.size}`);
    console.log(`   🔍 Duplicate groups found: ${Array.from(orderGroups.values()).filter(g => g.length > 1).length}`);
    console.log(`   ❌ Duplicates deleted: ${duplicatesDeleted}`);
    console.log(`   ✅ Unique orders remaining: ${ordersSnapshot.size - duplicatesDeleted}`);

    return NextResponse.json({
      success: true,
      message: 'Duplicate cleanup completed',
      stats: {
        totalOrders: ordersSnapshot.size,
        duplicatesFound: duplicatesFound,
        duplicatesDeleted: duplicatesDeleted,
        uniqueOrdersRemaining: ordersSnapshot.size - duplicatesDeleted
      }
    });

  } catch (error: any) {
    console.error('Error cleaning up duplicates:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clean up duplicates' },
      { status: 500 }
    );
  }
}
