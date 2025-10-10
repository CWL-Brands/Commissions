import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// State name to abbreviation mapping
const stateNameToAbbr: { [key: string]: string } = {
  'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
  'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
  'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
  'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
  'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
  'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
  'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
  'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
  'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
  'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
};

function normalizeState(state: string): string {
  const normalized = state.trim().toUpperCase();
  // If already 2 characters, return as-is
  if (normalized.length === 2) return normalized;
  // Look up full state name
  return stateNameToAbbr[normalized] || normalized.slice(0, 2);
}

export async function POST(request: Request) {
  try {
    console.log('🚀 Starting customer_sales_summary migration...');

    // Load all customers
    console.log('📦 Loading customers from fishbowl_customers...');
    const customersSnapshot = await adminDb.collection('fishbowl_customers').get();
    console.log(`✅ Found ${customersSnapshot.size} customers`);

    // Load all sales orders
    console.log('📦 Loading orders from fishbowl_sales_orders...');
    const ordersSnapshot = await adminDb.collection('fishbowl_sales_orders').get();
    console.log(`✅ Found ${ordersSnapshot.size} orders`);

    // Load regions for state-to-region mapping
    console.log('📦 Loading regions for state mapping...');
    const regionsSnapshot = await adminDb.collection('regions').get();
    const stateToRegionMap = new Map<string, { name: string; color: string }>();
    regionsSnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.states && Array.isArray(data.states)) {
        data.states.forEach((state: string) => {
          stateToRegionMap.set(state.toUpperCase(), {
            name: data.name,
            color: data.color || '#808080'
          });
        });
      }
    });
    console.log(`✅ Loaded ${regionsSnapshot.size} regions with ${stateToRegionMap.size} state mappings`);

    // Load users for sales rep mapping
    console.log('📦 Loading users for sales rep mapping...');
    const usersSnapshot = await adminDb.collection('users').get();
    const usersMap = new Map<string, any>();
    usersSnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.salesPerson) {
        usersMap.set(data.salesPerson, {
          id: doc.id,
          name: data.name,
          region: data.region || '',
          regionalTerritory: data.regionalTerritory || '',
          email: data.email || ''
        });
      }
    });
    console.log(`✅ Loaded ${usersMap.size} sales reps`);

    // Group orders by customer
    console.log('🔄 Aggregating sales data by customer...');
    const customerOrders = new Map<string, any[]>();
    
    ordersSnapshot.forEach((doc: any) => {
      const order = doc.data();
      const customerId = order.customerId || order.customerName;
      
      if (!customerOrders.has(customerId)) {
        customerOrders.set(customerId, []);
      }
      
      customerOrders.get(customerId)!.push({
        revenue: Number(order.revenue) || 0,
        postingDateStr: order.postingDateStr || '',
        postingDate: order.postingDate,
        orderNum: order.orderNum || ''
      });
    });
    console.log(`✅ Aggregated orders for ${customerOrders.size} customers`);

    // Calculate date thresholds
    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const months12Ago = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Create summaries
    console.log('📊 Creating customer summaries...');
    let summariesCreated = 0;
    const batchSize = 50;
    const customerDocs = customersSnapshot.docs;

    for (let i = 0; i < customerDocs.length; i += batchSize) {
      const batch = customerDocs.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (customerDoc: any) => {
        const customer = customerDoc.data();
        const customerId = customer.id || customerDoc.id;
        const orders = customerOrders.get(customerId) || [];

        // Calculate metrics
        let totalSales = 0;
        let totalSalesYTD = 0;
        let sales_30d = 0;
        let sales_90d = 0;
        let sales_12m = 0;
        let orders_30d = 0;
        let orders_90d = 0;
        let orders_12m = 0;
        let firstOrderDate: Date | null = null;
        let lastOrderDate: Date | null = null;
        let lastOrderAmount = 0;

        orders.forEach(order => {
          const revenue = order.revenue;
          totalSales += revenue;

          // Parse order date
          let orderDate: Date | null = null;
          if (order.postingDate && order.postingDate.toDate) {
            orderDate = order.postingDate.toDate();
          } else if (order.postingDateStr) {
            const parts = order.postingDateStr.split('/');
            if (parts.length === 3) {
              orderDate = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
            }
          }

          if (orderDate) {
            // YTD
            if (orderDate >= ytdStart) {
              totalSalesYTD += revenue;
            }

            // Rolling windows
            if (orderDate >= days30Ago) {
              sales_30d += revenue;
              orders_30d++;
            }
            if (orderDate >= days90Ago) {
              sales_90d += revenue;
              orders_90d++;
            }
            if (orderDate >= months12Ago) {
              sales_12m += revenue;
              orders_12m++;
            }

            // First/Last order
            if (!firstOrderDate || orderDate < firstOrderDate) {
              firstOrderDate = orderDate;
            }
            if (!lastOrderDate || orderDate > lastOrderDate) {
              lastOrderDate = orderDate;
              lastOrderAmount = revenue;
            }
          }
        });

        const avgOrderValue = orders.length > 0 ? totalSales / orders.length : 0;

        // Get sales rep info
        const salesPerson = customer.salesPerson || '';
        const repInfo = usersMap.get(salesPerson) || { id: '', name: salesPerson, region: '', regionalTerritory: '', email: '' };

        // Determine region from state (normalize full state names to abbreviations)
        const stateAbbr = normalizeState(customer.shippingState || '');
        const regionInfo = stateToRegionMap.get(stateAbbr) || { name: '', color: '#808080' };

        // Create summary document
        const summary = {
          customerId: customerId,
          customerName: customer.name || '',
          totalSales: totalSales,
          totalSalesYTD: totalSalesYTD,
          orderCount: orders.length,
          orderCountYTD: orders.filter((o: any) => {
            if (o.postingDate && o.postingDate.toDate) {
              return o.postingDate.toDate() >= ytdStart;
            }
            return false;
          }).length,
          sales_30d: sales_30d,
          sales_90d: sales_90d,
          sales_12m: sales_12m,
          orders_30d: orders_30d,
          orders_90d: orders_90d,
          orders_12m: orders_12m,
          firstOrderDate: firstOrderDate ? (firstOrderDate as Date).toISOString().split('T')[0] : null,
          lastOrderDate: lastOrderDate ? (lastOrderDate as Date).toISOString().split('T')[0] : null,
          lastOrderAmount: lastOrderAmount,
          avgOrderValue: avgOrderValue,
          salesPerson: salesPerson,
          salesPersonName: repInfo.name,
          salesPersonId: repInfo.id, // User document ID
          salesPersonRegion: repInfo.region, // User's assigned region
          salesPersonTerritory: repInfo.regionalTerritory, // User's territory
          region: regionInfo.name, // Determined from state mapping
          regionColor: regionInfo.color, // Store color for fast display
          accountType: customer.accountType || '',
          shippingAddress: customer.shippingAddress || '',
          shippingCity: customer.shippingCity || '',
          shippingState: customer.shippingState || '',
          shippingZip: customer.shippingZip || '',
          lat: customer.lat || null,
          lng: customer.lng || null,
          lastUpdatedAt: Timestamp.now()
        };

        const summaryRef = adminDb.collection('customer_sales_summary').doc(customerId);
        await summaryRef.set(summary);
        summariesCreated++;
      }));

      console.log(`  💾 Progress: ${summariesCreated}/${customerDocs.length} summaries created`);
    }

    console.log('✅ Migration complete!');
    console.log(`📊 Created ${summariesCreated} customer summaries`);

    return NextResponse.json({
      success: true,
      message: `Successfully created ${summariesCreated} customer summaries`,
      summariesCreated
    });

  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
