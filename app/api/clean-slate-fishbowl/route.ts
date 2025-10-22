import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Complete clean slate - delete ALL Fishbowl data and commission calculations
 * POST /api/clean-slate-fishbowl
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🧹 Starting COMPLETE FISHBOWL CLEAN SLATE...');
    
    const collectionsToClean = [
      'fishbowl_sales_orders',
      'fishbowl_soitems', 
      'fishbowl_customers',
      'monthly_commissions',
      'monthly_commission_summary',
      'commission_calculation_logs',
      'spiff_earnings'
    ];

    let totalDeleted = 0;
    const results: any = {};

    for (const collectionName of collectionsToClean) {
      console.log(`🗑️ Cleaning collection: ${collectionName}`);
      
      const snapshot = await adminDb.collection(collectionName).get();
      const count = snapshot.size;
      results[collectionName] = count;
      
      if (count > 0) {
        const batch = adminDb.batch();
        let batchCount = 0;
        
        snapshot.forEach(doc => {
          batch.delete(doc.ref);
          batchCount++;
          totalDeleted++;
          
          // Commit every 500 to avoid limits
          if (batchCount >= 500) {
            batch.commit();
            batchCount = 0;
          }
        });
        
        // Commit remaining
        if (batchCount > 0) {
          await batch.commit();
        }
        
        console.log(`   ✅ Deleted ${count} documents from ${collectionName}`);
      } else {
        console.log(`   ℹ️ Collection ${collectionName} was already empty`);
      }
    }

    console.log(`🎉 CLEAN SLATE COMPLETE! Deleted ${totalDeleted} total documents`);

    return NextResponse.json({
      success: true,
      message: 'Complete Fishbowl clean slate completed',
      totalDeleted: totalDeleted,
      collectionsCleared: results
    });

  } catch (error: any) {
    console.error('Error in clean slate operation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to perform clean slate' },
      { status: 500 }
    );
  }
}
