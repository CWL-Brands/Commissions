import { getApps, getApp, initializeApp, applicationDefault, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK pinned to the intended project.
// This avoids verifyIdToken() failing due to ambiguous or mismatched default credentials.
let app: App;
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

// Handle escaped newlines and surrounding quotes from env files
if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, '\n').replace(/^"|"$/g, '');
}

try {
  if (getApps().length) {
    app = getApp();
  } else if (projectId && clientEmail && privateKey) {
    try { console.info(`[firebase-admin] initializeApp(cert, projectId=${projectId})`); } catch {}
    app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
  } else if (projectId) {
    try { console.info(`[firebase-admin] initializeApp(applicationDefault, projectId=${projectId})`); } catch {}
    app = initializeApp({
      credential: applicationDefault(),
      projectId,
    } as any);
  } else {
    try { console.info('[firebase-admin] initializeApp() with default credentials (no FIREBASE_PROJECT_ID)'); } catch {}
    app = initializeApp();
  }
} catch (e: any) {
  try { console.error('[firebase-admin] initializeApp error:', e?.message || e); } catch {}
  // Final fallback: attempt applicationDefault without projectId
  app = initializeApp({ credential: applicationDefault() } as any);
}

export const adminAuth = getAuth(app);
export const adminDb = getFirestore(app);
