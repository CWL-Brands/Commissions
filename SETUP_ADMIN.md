# Firebase Admin Setup for Commission Calculator

## Problem
The `/api/calculate-commissions` endpoint needs Firebase Admin SDK to access Firestore server-side.

## Solution

### Step 1: Get Service Account Key

1. Go to: https://console.firebase.google.com/project/kanvaportal/settings/serviceaccounts/adminsdk
2. Click **"Generate new private key"**
3. Download the JSON file (e.g., `kanvaportal-firebase-adminsdk.json`)

### Step 2: Create .env.local

Create `c:\Projects\Commission_calculator\.env.local` with:

```env
# Copy from Goals app .env.local or .env.production
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBwU2sUVjnT-ZqxhBaIWp18DRJzHnTxf9Q
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=kanvaportal.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=kanvaportal
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=kanvaportal.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=829835149823
NEXT_PUBLIC_FIREBASE_APP_ID=1:829835149823:web:68e50ea9f6b1eec3df67ca
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-QDK79V6MX5

# Firebase Admin SDK (from downloaded JSON file)
FIREBASE_PROJECT_ID=kanvaportal
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@kanvaportal.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
PASTE_FULL_PRIVATE_KEY_HERE_FROM_JSON_FILE
-----END PRIVATE KEY-----"

# Copper CRM
COPPER_API_KEY=6187c1b571e219a060285bf66fcaf8ae
COPPER_USER_EMAIL=ben@kanvabotanicals.com

# Admin
NEXT_PUBLIC_ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@cwlbrands.com
```

### Step 3: Copy Private Key Correctly

**IMPORTANT:** The private key must be the FULL key from the JSON file, including all newlines.

From the downloaded JSON:
```json
{
  "project_id": "kanvaportal",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...(VERY LONG)...END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-fbsvc@kanvaportal.iam.gserviceaccount.com"
}
```

Copy the ENTIRE `private_key` value (with the `\n` characters) into `.env.local`.

### Step 4: Restart Server

```bash
npm run dev
```

## Alternative: Copy from Goals App

If the Goals app already has this working, you can copy the `.env.local` file from:

```
C:\Projects\copper-goals-tracker\.env.local
```

To:

```
C:\Projects\Commission_calculator\.env.local
```

Then restart the server!
