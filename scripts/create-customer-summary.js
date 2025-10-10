/**
 * Migration Script: Create customer_sales_summary collection
 * 
 * This script:
 * 1. Reads all fishbowl_customers
 * 2. Aggregates sales data from fishbowl_sales_orders
 * 3. Creates customer_sales_summary documents with pre-calculated metrics
 * 
 * Run with: node scripts/create-customer-summary.js
 */

const { initializeApp } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
require('dotenv').config({ path: '.env.local' });

// Initialize Firebase Admin using database secret
console.log('📝 Using Firebase database secret from .env.local');

initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID,
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
  credential: {
    getAccessToken: () => {
      return Promise.resolve({
        access_token: process.env.FIREBASE_DATABASE_SECRET,
        expires_in: 3600
      });
    }
  }
});

const db = getFirestore();

async function createCustomerSummaries() {
  console.log('🚀 Starting customer_sales_summary migration...\n');

  try {
    // Load all customers
    console.log('📦 Loading customers from fishbowl_customers...');
    const customersSnapshot = await db.collection('fishbowl_customers').get();
    console.log(`✅ Found ${customersSnapshot.size} customers\n`);

    // Load all sales orders
    console.log('📦 Loading orders from fishbowl_sales_orders...');
    const ordersSnapshot = await db.collection('fishbowl_sales_orders').get();
    console.log(`✅ Found ${ordersSnapshot.size} orders\n`);

    // Load users for sales rep mapping
    console.log('📦 Loading users for sales rep mapping...');
    const usersSnapshot = await db.collection('users').get();
    const usersMap = new Map();
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      if (data.salesPerson) {
        usersMap.set(data.salesPerson, {
          name: data.name,
          region: data.region || '',
          email: data.email || ''
        });
      }
    });
    console.log(`✅ Loaded ${usersMap.size} sales reps\n`);

    // Group orders by customer
    console.log('🔄 Aggregating sales data by customer...');
    const customerOrders = new Map();
    
    ordersSnapshot.forEach(doc => {
      const order = doc.data();
      const customerId = order.customerId || order.customerName;
      
      if (!customerOrders.has(customerId)) {
        customerOrders.set(customerId, []);
      }
      
      customerOrders.get(customerId).push({
        revenue: Number(order.revenue) || 0,
        postingDateStr: order.postingDateStr || '',
        postingDate: order.postingDate,
        orderNum: order.orderNum || ''
      });
    });
    console.log(`✅ Aggregated orders for ${customerOrders.size} customers\n`);

    // Calculate date thresholds
    const now = new Date();
    const ytdStart = new Date(now.getFullYear(), 0, 1);
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const months12Ago = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Create summaries
    console.log('📊 Creating customer summaries...');
    let batch = db.batch();
    let batchCount = 0;
    let summariesCreated = 0;

    for (const customerDoc of customersSnapshot.docs) {
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
      let firstOrderDate = null;
      let lastOrderDate = null;
      let lastOrderAmount = 0;

      orders.forEach(order => {
        const revenue = order.revenue;
        totalSales += revenue;

        // Parse order date
        let orderDate = null;
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
      const repInfo = usersMap.get(salesPerson) || { name: salesPerson, region: '', email: '' };

      // Create summary document
      const summary = {
        customerId: customerId,
        customerName: customer.name || '',
        totalSales: totalSales,
        totalSalesYTD: totalSalesYTD,
        orderCount: orders.length,
        orderCountYTD: orders.filter(o => {
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
        firstOrderDate: firstOrderDate ? firstOrderDate.toISOString().split('T')[0] : null,
        lastOrderDate: lastOrderDate ? lastOrderDate.toISOString().split('T')[0] : null,
        lastOrderAmount: lastOrderAmount,
        avgOrderValue: avgOrderValue,
        salesPerson: salesPerson,
        salesPersonName: repInfo.name,
        region: customer.region || repInfo.region || '',
        accountType: customer.accountType || '',
        shippingAddress: customer.shippingAddress || '',
        shippingCity: customer.shippingCity || '',
        shippingState: customer.shippingState || '',
        shippingZip: customer.shippingZip || '',
        lat: customer.lat || null,
        lng: customer.lng || null,
        lastUpdatedAt: Timestamp.now()
      };

      const summaryRef = db.collection('customer_sales_summary').doc(customerId);
      batch.set(summaryRef, summary);
      batchCount++;
      summariesCreated++;

      // Commit in batches of 500
      if (batchCount >= 500) {
        await batch.commit();
        console.log(`  💾 Committed batch: ${summariesCreated} summaries created`);
        batch = db.batch();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
      console.log(`  💾 Committed final batch: ${summariesCreated} summaries created`);
    }

    console.log('\n✅ Migration complete!');
    console.log(`📊 Created ${summariesCreated} customer summaries`);
    console.log(`🎯 Collection: customer_sales_summary`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

// Run the migration
createCustomerSummaries()
  .then(() => {
    console.log('\n🎉 All done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Fatal error:', error);
    process.exit(1);
  });
