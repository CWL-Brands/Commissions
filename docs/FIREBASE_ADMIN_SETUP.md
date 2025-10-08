# Firebase Admin SDK Setup Guide for KanvaPortal Apps

## 🎯 The Problem
Firebase Admin SDK requires authentication to access Firestore server-side. Without proper setup, you'll get errors like:
- `Failed to initialize Google Cloud Firestore client`
- `Missing or insufficient permissions`
- `Admin DB not initialized`

## ✅ The Solution: Application Default Credentials (ADC)

All KanvaPortal apps use **Google Cloud Application Default Credentials** instead of service account keys. This is more secure and easier to manage.

---

## 📋 One-Time Setup (Per Developer Machine)

### Step 1: Install Google Cloud SDK

1. Download from: https://cloud.google.com/sdk/docs/install
2. Run the installer
3. Restart your terminal/IDE

### Step 2: Authenticate with Google Cloud

```bash
gcloud auth application-default login
```

This will:
- Open your browser
- Ask you to sign in with your Google account (use your @kanvabotanicals.com or @cwlbrands.com email)
- Save credentials to your machine

**You only need to do this ONCE per machine!**

### Step 3: Set Default Project

```bash
gcloud config set project kanvaportal
```

---

## 🚀 Setup for Each New App

### 1. Copy the Admin Config File

Create `lib/firebase/admin.ts` with this exact code:

```typescript
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
```

### 2. Create .env.local

```env
# Firebase Configuration (KanvaPortal)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBwU2sUVjnT-ZqxhBaIWp18DRJzHnTxf9Q
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kanvaportal.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kanvaportal
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kanvaportal.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=829835149823
NEXT_PUBLIC_FIREBASE_APP_ID=1:829835149823:web:68e50ea9f6b1eec3df67ca
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-QDK79V6MX5

# Firebase Admin SDK (for server-side)
FIREBASE_PROJECT_ID=kanvaportal
# No FIREBASE_PRIVATE_KEY needed - uses Application Default Credentials

# Copper CRM Configuration
COPPER_API_KEY=6187c1b571e219a060285bf66fcaf8ae
COPPER_USER_EMAIL=ben@kanvabotanicals.com

# Admin
NEXT_PUBLIC_ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@cwlbrands.com
```

### 3. Create .env.production

For production deployment (Firebase Hosting, Vercel, etc.), you'll need the actual private key.

**Get it from an existing app's `.env.production` or ask the admin.**

```env
# Firebase Configuration (KanvaPortal)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBwU2sUVjnT-ZqxhBaIWp18DRJzHnTxf9Q
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kanvaportal.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kanvaportal
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kanvaportal.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=829835149823
NEXT_PUBLIC_FIREBASE_APP_ID=1:829835149823:web:68e50ea9f6b1eec3df67ca
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-QDK79V6MX5

# Firebase Admin SDK (for server-side)
FIREBASE_PROJECT_ID=kanvaportal
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@kanvaportal.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n[COPY FROM EXISTING APP]\n-----END PRIVATE KEY-----\n"

# Copper CRM Configuration
COPPER_API_KEY=6187c1b571e219a060285bf66fcaf8ae
COPPER_USER_EMAIL=ben@kanvabotanicals.com

# Admin
NEXT_PUBLIC_ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@cwlbrands.com
NEXT_PUBLIC_DEV_MODE=false
```

### 4. Update .gitignore

```gitignore
# Local env files
.env*.local
.env
.env.production

# Service account keys
service-account-key.json
*-firebase-adminsdk-*.json
```

### 5. Install Dependencies

```bash
npm install firebase firebase-admin
```

---

## 🧪 Testing

Start your dev server:
```bash
npm run dev
```

You should see in the terminal:
```
[firebase-admin] initializeApp(applicationDefault, projectId=kanvaportal)
```

If you see this, **it's working!** ✅

---

## 🚨 Troubleshooting

### Error: "Application Default Credentials not found"

**Solution:** Run the authentication command again:
```bash
gcloud auth application-default login
```

### Error: "Permission denied" or "Insufficient permissions"

**Solution:** Make sure you're logged in with an email that has access to the KanvaPortal project:
- @kanvabotanicals.com
- @cwlbrands.com

### Error: "Failed to initialize Google Cloud Firestore client"

**Solution:** Make sure `FIREBASE_PROJECT_ID=kanvaportal` is in your `.env.local`

---

## 📦 Production Deployment

### For Firebase Hosting:

1. Copy `.env.production` values to Firebase environment config:
```bash
firebase functions:config:set firebase.project_id="kanvaportal"
firebase functions:config:set firebase.client_email="firebase-adminsdk-fbsvc@kanvaportal.iam.gserviceaccount.com"
firebase functions:config:set firebase.private_key="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

2. Deploy:
```bash
npm run build
firebase deploy
```

### For Vercel:

1. Go to Project Settings → Environment Variables
2. Add all variables from `.env.production`
3. Deploy:
```bash
vercel --prod
```

---

## 📝 Summary

### Local Development:
- ✅ Uses Application Default Credentials (ADC)
- ✅ No private key needed
- ✅ One-time `gcloud auth` setup per machine

### Production:
- ✅ Uses private key from `.env.production`
- ✅ Copy from existing app or ask admin
- ✅ Set as environment variables in hosting platform

### Key Files:
- `lib/firebase/admin.ts` - Admin SDK config (copy from Goals app)
- `.env.local` - Local dev (no private key)
- `.env.production` - Production (with private key)

---

## 🔗 Reference Apps

All these apps use the same setup:
- **Goals Tracker:** `C:\Projects\copper-goals-tracker`
- **Commission Calculator:** `C:\Projects\Commission_calculator`

**Just copy the `lib/firebase/admin.ts` file from any of these apps to your new app!**

---

## ✨ That's It!

With this setup, you'll never have to deal with service account keys or authentication issues again. Just:

1. Copy `lib/firebase/admin.ts`
2. Copy `.env.local` (without private key)
3. Run `npm run dev`

**It just works!** 🎉
