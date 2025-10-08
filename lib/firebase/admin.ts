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
      const databaseSecret = process.env.FIREBASE_DATABASE_SECRET;

      // Method 1: Use service account credentials (preferred)
      if (privateKey && projectId && clientEmail && privateKey.includes('BEGIN PRIVATE KEY')) {
        console.log('[firebase-admin] Initializing with service account credentials');
        adminApp = initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        adminDb = getFirestore(adminApp);
      } 
      // Method 2: Use database secret (fallback for local dev)
      else if (databaseSecret && projectId) {
        console.log('[firebase-admin] Initializing with database secret');
        adminApp = initializeApp({
          credential: {
            getAccessToken: async () => ({
              access_token: databaseSecret,
              expires_in: 3600,
            }),
          } as any,
          databaseURL: `https://${projectId}.firebaseio.com`,
        });
        adminDb = getFirestore(adminApp);
      } else {
        console.warn('[firebase-admin] No valid credentials found - admin features will be disabled');
      }
    } catch (error) {
      console.error('[firebase-admin] Initialization error:', error);
      // Don't throw - just disable admin features
    }
  } else {
    adminApp = getApps()[0];
    adminDb = getFirestore(adminApp);
  }
}

export { adminApp, adminDb };
