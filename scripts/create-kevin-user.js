/**
 * Script to create Kevin's user document in Firestore
 * Run with: node scripts/create-kevin-user.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createKevinUser() {
  try {
    const uid = 'hmokBKLndYeCljwskn3KWZjwELX2';
    const email = 'kevin@kanvabotanicals.com';
    
    const userDoc = {
      id: uid,
      email: email,
      name: 'Kevin Goree',
      role: 'sales', // You can change to 'admin' in Firebase Console
      isActive: true,
      salesPerson: 'Kevin', // Fishbowl username
      title: 'Operations', // Or whatever his title is
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await db.collection('users').doc(uid).set(userDoc);
    console.log('✅ Kevin\'s user document created successfully!');
    console.log(userDoc);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating user document:', error);
    process.exit(1);
  }
}

createKevinUser();
