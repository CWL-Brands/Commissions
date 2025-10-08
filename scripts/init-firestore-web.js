/**
 * Initialize Firestore with default data using Web SDK
 * Run with: node scripts/init-firestore-web.js
 * 
 * This uses your existing Firebase client credentials (no admin SDK needed)
 */

require('dotenv').config({ path: '.env.local' });

const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc 
} = require('firebase/firestore');

// Initialize Firebase with your existing credentials
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function initializeFirestore() {
  console.log('🔥 Initializing Firestore with default data...\n');

  try {
    // Create commission config
    console.log('Creating commission config...');
    await setDoc(doc(db, 'settings', 'commission_config'), {
      maxBonusPerRep: 25000,
      overPerfCap: 1.25,
      minAttainment: 0.75,
      buckets: [
        { id: 'A', code: 'A', name: 'New Business', weight: 0.50, hasSubGoals: false, active: true },
        { id: 'B', code: 'B', name: 'Product Mix', weight: 0.15, hasSubGoals: true, active: true },
        { id: 'C', code: 'C', name: 'Maintain Business', weight: 0.20, hasSubGoals: false, active: true },
        { id: 'D', code: 'D', name: 'Effort', weight: 0.15, hasSubGoals: true, active: true }
      ]
    });
    console.log('✓ Commission config created\n');

    // Create products
    console.log('Creating products...');
    const products = [
      { sku: 'Focus+Flow', targetPercent: 0.30, subWeight: 0.30, msrp: 9.99, active: true, notes: 'Top seller' },
      { sku: 'Release+Relax', targetPercent: 0.10, subWeight: 0.10, msrp: 9.99, active: true, notes: 'Grow this' },
      { sku: 'Mango', targetPercent: 0.10, subWeight: 0.10, msrp: 9.99, active: true, notes: 'Steady' },
      { sku: 'Zoom', targetPercent: 0.10, subWeight: 0.10, msrp: 6.99, active: true, notes: 'Grow this' },
      { sku: 'Raw + Relief', targetPercent: 0.40, subWeight: 0.40, msrp: 9.99, active: true, notes: 'Grow this' }
    ];

    for (const product of products) {
      await addDoc(collection(db, 'products'), product);
    }
    console.log('✓ Products created\n');

    // Create activities
    console.log('Creating activities...');
    const activities = [
      { activity: 'Phone Calls', goal: 1200, subWeight: 0.30, dataSource: 'JustCall', active: true, notes: 'Outbound' },
      { activity: 'Emails Sent', goal: 600, subWeight: 0.25, dataSource: 'Copper CRM', active: true, notes: 'Customer emails' },
      { activity: 'Talk Time (hrs)', goal: 6000, subWeight: 0.25, dataSource: 'JustCall', active: true, notes: 'Duration' },
      { activity: 'SMS Messages', goal: 600, subWeight: 0.20, dataSource: 'JustCall', active: true, notes: 'Text outreach' }
    ];

    for (const activity of activities) {
      await addDoc(collection(db, 'activities'), activity);
    }
    console.log('✓ Activities created\n');

    // Create quarters
    console.log('Creating quarters...');
    const quarters = [
      { code: 'Q1 2025', startDate: new Date('2025-01-01'), endDate: new Date('2025-03-31') },
      { code: 'Q2 2025', startDate: new Date('2025-04-01'), endDate: new Date('2025-06-30') },
      { code: 'Q3 2025', startDate: new Date('2025-07-01'), endDate: new Date('2025-09-30') },
      { code: 'Q4 2025', startDate: new Date('2025-10-01'), endDate: new Date('2025-12-31') },
      { code: 'Q1 2026', startDate: new Date('2026-01-01'), endDate: new Date('2026-03-31') }
    ];

    for (const quarter of quarters) {
      await setDoc(doc(db, 'quarters', quarter.code), quarter);
    }
    console.log('✓ Quarters created\n');

    // Create sales reps
    console.log('Creating sales reps...');
    const reps = [
      { name: 'Ben Wallner', title: 'Account Executive', email: 'ben@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06'), notes: '' },
      { name: 'Jared', title: 'Account Executive', email: 'jared@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06'), notes: '' },
      { name: 'Derek', title: 'Jr. Account Executive', email: 'derek@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06'), notes: '' },
      { name: 'Brandon', title: 'Jr. Account Executive', email: 'brandon@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06'), notes: '' },
      { name: 'Vacant', title: 'Account Manager', email: '', active: false, startDate: new Date('2025-10-06'), notes: 'TBD' }
    ];

    for (const rep of reps) {
      await addDoc(collection(db, 'reps'), rep);
    }
    console.log('✓ Sales reps created\n');

    console.log('✅ Firestore initialization complete!\n');
    console.log('Next steps:');
    console.log('1. Sign up through the app with your admin email');
    console.log('2. Start using the commission calculator!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error initializing Firestore:', error);
    process.exit(1);
  }
}

initializeFirestore();
