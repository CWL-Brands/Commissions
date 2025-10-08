/**
 * Initialize Firestore with default data
 * Run with: node scripts/init-firestore.js
 * 
 * SETUP:
 * 1. Download service account key from Firebase Console
 * 2. Save as service-account-key.json in project root
 * OR use environment variables (see below)
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Try to load service account key
let credential;
const serviceAccountPath = path.join(__dirname, '..', 'service-account-key.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  credential = admin.credential.cert(serviceAccount);
  console.log('✓ Using service-account-key.json');
} else if (process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
  // Use environment variables
  credential = admin.credential.cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
  });
  console.log('✓ Using environment variables');
} else {
  console.error('❌ ERROR: No Firebase credentials found!');
  console.error('\nOption 1: Download service-account-key.json from Firebase Console');
  console.error('  1. Go to Firebase Console > Project Settings > Service Accounts');
  console.error('  2. Click "Generate New Private Key"');
  console.error('  3. Save as service-account-key.json in project root\n');
  console.error('Option 2: Set environment variables in .env.local:');
  console.error('  FIREBASE_ADMIN_PROJECT_ID=your_project_id');
  console.error('  FIREBASE_ADMIN_CLIENT_EMAIL=your_client_email');
  console.error('  FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"');
  process.exit(1);
}

admin.initializeApp({
  credential: credential
});

const db = admin.firestore();

async function initializeFirestore() {
  console.log('Initializing Firestore with default data...');

  try {
    // Create commission config
    await db.collection('settings').doc('commission_config').set({
      maxBonusPerRep: 25000,
      overPerfCap: 1.25,
      minAttainment: 0.75,
      buckets: [
        {
          id: 'A',
          code: 'A',
          name: 'New Business',
          weight: 0.50,
          hasSubGoals: false,
          active: true
        },
        {
          id: 'B',
          code: 'B',
          name: 'Product Mix',
          weight: 0.15,
          hasSubGoals: true,
          active: true
        },
        {
          id: 'C',
          code: 'C',
          name: 'Maintain Business',
          weight: 0.20,
          hasSubGoals: false,
          active: true
        },
        {
          id: 'D',
          code: 'D',
          name: 'Effort',
          weight: 0.15,
          hasSubGoals: true,
          active: true
        }
      ]
    });
    console.log('✓ Commission config created');

    // Create sample products (matching your database)
    const products = [
      { sku: 'Focus+Flow', targetPercent: 0.30, subWeight: 0.30, msrp: 9.99, active: true, notes: 'Top seller' },
      { sku: 'Release+Relax', targetPercent: 0.10, subWeight: 0.10, msrp: 9.99, active: true, notes: 'Grow this' },
      { sku: 'Mango', targetPercent: 0.10, subWeight: 0.10, msrp: 9.99, active: true, notes: 'Steady' },
      { sku: 'Zoom', targetPercent: 0.10, subWeight: 0.10, msrp: 6.99, active: true, notes: 'Grow this' },
      { sku: 'Raw + Relief', targetPercent: 0.40, subWeight: 0.40, msrp: 9.99, active: true, notes: 'Grow this' }
    ];

    for (const product of products) {
      await db.collection('products').add(product);
    }
    console.log('✓ Sample products created');

    // Create sample activities (matching your database)
    const activities = [
      { activity: 'Phone Calls', goal: 1200, subWeight: 0.30, dataSource: 'JustCall', active: true, notes: 'Outbound' },
      { activity: 'Emails Sent', goal: 600, subWeight: 0.25, dataSource: 'Copper CRM', active: true, notes: 'Customer emails' },
      { activity: 'Talk Time (hrs)', goal: 6000, subWeight: 0.25, dataSource: 'JustCall', active: true, notes: 'Duration' },
      { activity: 'SMS Messages', goal: 600, subWeight: 0.20, dataSource: 'JustCall', active: true, notes: 'Text outreach' }
    ];

    for (const activity of activities) {
      await db.collection('activities').add(activity);
    }
    console.log('✓ Sample activities created');

    // Create quarters
    const quarters = [
      { code: 'Q1 2025', startDate: new Date('2025-01-01'), endDate: new Date('2025-03-31') },
      { code: 'Q2 2025', startDate: new Date('2025-04-01'), endDate: new Date('2025-06-30') },
      { code: 'Q3 2025', startDate: new Date('2025-07-01'), endDate: new Date('2025-09-30') },
      { code: 'Q4 2025', startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31') },
      { code: 'Q1 2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') }
    ];

    for (const quarter of quarters) {
      await db.collection('quarters').doc(quarter.code).set(quarter);
    }
    console.log('✓ Quarters created');

    // Create sales reps (matching your database)
    const reps = [
      { name: 'Ben Wallner', title: 'Account Executive', email: 'ben@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06'), notes: '' },
      { name: 'Jared', title: 'Account Executive', email: 'jared@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06'), notes: '' },
      { name: 'Derek', title: 'Jr. Account Executive', email: 'derek@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06'), notes: '' },
      { name: 'Brandon', title: 'Jr. Account Executive', email: 'brandon@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06'), notes: '' },
      { name: 'Vacant', title: 'Account Manager', email: '', active: false, startDate: new Date('2025-10-06'), notes: 'TBD' }
    ];

    for (const rep of reps) {
      await db.collection('reps').add(rep);
    }
    console.log('✓ Sales reps created');

    console.log('\n✅ Firestore initialization complete!');
    console.log('\nNext steps:');
    console.log('1. Sign up through the app with your admin email');
    console.log('2. Manually add role: "admin" to your user document in Firestore');
    console.log('3. Configure Copper API credentials in environment variables');
    console.log('4. Start using the commission calculator!');

  } catch (error) {
    console.error('Error initializing Firestore:', error);
  } finally {
    process.exit();
  }
}

initializeFirestore();
