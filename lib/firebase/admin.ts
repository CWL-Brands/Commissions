import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let adminApp: App | undefined;
let adminDb: Firestore | undefined;

// Only initialize on server-side and not during build
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';

if (typeof window === 'undefined' && !isBuild) {
  if (!getApps().length) {
    try {
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.FIREBASE_ADMIN_PROJECT_ID;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.FIREBASE_ADMIN_PRIVATE_KEY;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

      // Only initialize if we have valid service account credentials
      if (privateKey && projectId && clientEmail && privateKey.includes('BEGIN PRIVATE KEY')) {
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        adminDb = getFirestore(adminApp);
      } else {
        console.warn('Firebase Admin credentials not configured - admin features will be disabled');
      }
    } catch (error) {
      console.error('Firebase Admin initialization error:', error);
      // Don't throw - just disable admin features
    }
  } else {
    adminApp = getApps()[0];
    adminDb = getFirestore(adminApp);
  }
}

export { adminApp, adminDb };
