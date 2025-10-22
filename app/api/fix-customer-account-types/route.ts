import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

/**
 * Fix customer account types that are incorrectly set
 * POST /api/fix-customer-account-types
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Starting customer account type fixes...');

    const fixes = [
      {
        customerName: 'CK Import and Distributing',
        currentType: 'Wholesale',
        correctType: 'Distributor',
        reason: 'Per actual commission file - should be Distributor, not Wholesale'
      }
    ];

    let fixedCount = 0;
    const batch = adminDb.batch();

    for (const fix of fixes) {
      console.log(`🔍 Looking for customer: ${fix.customerName}`);
      
      // Find customer by name
      const customerQuery = adminDb.collection('fishbowl_customers')
        .where('name', '==', fix.customerName);
      
      const customerSnapshot = await customerQuery.get();
      
      if (customerSnapshot.empty) {
        console.log(`❌ Customer not found: ${fix.customerName}`);
        continue;
      }

      customerSnapshot.forEach(doc => {
        const customer = doc.data();
        console.log(`📋 Found customer: ${customer.name} | Current type: ${customer.accountType}`);
        
        if (customer.accountType === fix.currentType) {
          console.log(`🔧 Fixing: ${customer.name} | ${fix.currentType} → ${fix.correctType}`);
          
          batch.update(doc.ref, {
            accountType: fix.correctType,
            lastUpdated: new Date(),
            updateReason: fix.reason
          });
          
          fixedCount++;
        } else {
          console.log(`✅ Already correct: ${customer.name} | Type: ${customer.accountType}`);
        }
      });
    }

    if (fixedCount > 0) {
      await batch.commit();
      console.log(`✅ Fixed ${fixedCount} customer account types`);
    } else {
      console.log(`ℹ️ No fixes needed - all account types are correct`);
    }

    return NextResponse.json({
      success: true,
      message: `Customer account type fixes completed`,
      fixesApplied: fixedCount,
      fixes: fixes
    });

  } catch (error: any) {
    console.error('Error fixing customer account types:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fix customer account types' },
      { status: 500 }
    );
  }
}
