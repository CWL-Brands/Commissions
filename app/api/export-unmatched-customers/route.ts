import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const runtime = 'nodejs';
export const maxDuration = 60; // 1 minute

/**
 * Export Unmatched Fishbowl Customers
 * 
 * Exports CSV of Fishbowl customers that don't have a Copper match
 * (no copperId or accountTypeSource != "copper_sync")
 * 
 * Sales team will use this to add Account Order IDs to Copper
 */

export async function GET() {
  try {
    console.log('📥 Loading Fishbowl customers without Copper match...');
    
    const fishbowlSnap = await adminDb.collection('fishbowl_customers').get();
    
    const unmatchedCustomers: any[] = [];
    
    fishbowlSnap.forEach((doc: any) => {
      const d = doc.data() || {};
      
      // Find customers that DON'T have Copper sync data
      const hasCopperMatch = d.copperId && d.accountTypeSource === 'copper_sync';
      
      if (!hasCopperMatch) {
        unmatchedCustomers.push({
          accountNumber: d.accountNumber || '',
          name: d.name || d.customerName || '',
          billingAddress: d.billingAddress || d.shippingAddress || '',
          billingCity: d.billingCity || d.shippingCity || '',
          billingState: d.billingState || d.shippingState || '',
          billingZip: d.billingZip || d.shipToZip || d.shippingZip || '',
          currentAccountType: d.accountType || 'Retail',
          assignedSalesRep: d.salesRep || 'Unassigned',
        });
      }
    });
    
    console.log(`✅ Found ${unmatchedCustomers.length} unmatched customers`);
    
    // Sort by sales rep, then name
    unmatchedCustomers.sort((a, b) => {
      if (a.assignedSalesRep !== b.assignedSalesRep) {
        return a.assignedSalesRep.localeCompare(b.assignedSalesRep);
      }
      return a.name.localeCompare(b.name);
    });
    
    // Build CSV
    const headers = [
      'Account Number (Fishbowl)',
      'Customer Name',
      'Address',
      'City',
      'State',
      'Zip',
      'Current Account Type',
      'Assigned Sales Rep',
      'Action Needed',
    ];
    
    const rows = unmatchedCustomers.map(c => [
      c.accountNumber,
      c.name,
      c.billingAddress,
      c.billingCity,
      c.billingState,
      c.billingZip,
      c.currentAccountType,
      c.assignedSalesRep,
      'Add this Account Number to Copper "Account Order ID cf_698467" field',
    ]);
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
    
    // Return CSV file
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="unmatched-fishbowl-customers-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
    
  } catch (error: any) {
    console.error('❌ Export failed:', error);
    return NextResponse.json(
      { error: error.message || 'Export failed' },
      { status: 500 }
    );
  }
}
