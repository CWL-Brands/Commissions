# Commission Calculator - Deployment Guide

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Firebase CLI** installed globally: `npm install -g firebase-tools`
3. **Firebase Project** created at [console.firebase.google.com](https://console.firebase.google.com)
4. **Copper CRM API** credentials

## Initial Setup

### 1. Install Dependencies

```bash
cd c:\Projects\Commission_calculator
npm install
```

### 2. Configure Firebase

```bash
firebase login
firebase init
```

Select:
- Hosting: Configure files for Firebase Hosting
- Firestore: Deploy rules and create indexes
- Use existing project (select your Firebase project)

### 3. Environment Variables

Create `.env.local` file:

```env
# Firebase Configuration (from Firebase Console > Project Settings)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (from Firebase Console > Project Settings > Service Accounts)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY\n-----END PRIVATE KEY-----\n"

# Copper API (from Copper Settings > Integrations > API Keys)
COPPER_API_KEY=your_copper_api_key
COPPER_USER_EMAIL=your_copper_user_email

# Admin Users (comma-separated)
NEXT_PUBLIC_ADMIN_EMAILS=admin@kanvabotanicals.com,admin@cwlbrands.com

# Copper SDK
NEXT_PUBLIC_COPPER_SDK_URL=https://cdn.jsdelivr.net/npm/copper-sdk@latest/dist/copper-sdk.min.js
```

### 4. Firestore Setup

Deploy Firestore rules and indexes:

```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
```

### 5. Initialize Data

Create initial settings document in Firestore:

```javascript
// Run in Firebase Console > Firestore > Add Document
// Collection: settings
// Document ID: commission_config

{
  "maxBonusPerRep": 25000,
  "overPerfCap": 1.25,
  "minAttainment": 0.75,
  "buckets": [
    {
      "id": "A",
      "code": "A",
      "name": "New Business",
      "weight": 0.50,
      "hasSubGoals": false,
      "active": true
    },
    {
      "id": "B",
      "code": "B",
      "name": "Product Mix",
      "weight": 0.15,
      "hasSubGoals": true,
      "active": true
    },
    {
      "id": "C",
      "code": "C",
      "name": "Maintain Business",
      "weight": 0.20,
      "hasSubGoals": false,
      "active": true
    },
    {
      "id": "D",
      "code": "D",
      "name": "Effort",
      "weight": 0.15,
      "hasSubGoals": true,
      "active": true
    }
  ]
}
```

## Development

Run locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Production Build

### 1. Build the Application

```bash
npm run build
```

This creates an optimized production build in the `out` directory.

### 2. Test Production Build Locally

```bash
npx serve out
```

### 3. Deploy to Firebase

```bash
firebase deploy --only hosting
```

Or use the npm script:

```bash
npm run deploy
```

## Post-Deployment

### 1. Configure Firebase Authentication

In Firebase Console:
1. Go to Authentication > Sign-in method
2. Enable Email/Password authentication
3. Add authorized domains if needed

### 2. Set Up Copper Integration

1. In Copper CRM, go to Settings > Integrations
2. Create a new App Card
3. Set the iframe URL to your Firebase hosting URL
4. Configure permissions for opportunities and activities

### 3. Create Admin Users

1. Sign up through the app with admin email addresses
2. Verify in Firestore that user documents are created
3. Manually add `role: "admin"` field to admin user documents

### 4. Configure Initial Settings

1. Sign in as admin
2. Go to Settings page
3. Configure:
   - Global settings (max bonus, caps)
   - Bucket weights (must sum to 100%)
   - Product mix sub-goals (Bucket B)
   - Effort sub-goals (Bucket D)

### 5. Set Up Copper Sync (Optional)

For automated metrics sync, create a Cloud Function or Cloud Scheduler job:

```bash
# Example: Daily sync at 6 AM
gcloud scheduler jobs create http copper-sync \
  --schedule="0 6 * * *" \
  --uri="https://your-app.web.app/api/copper/sync" \
  --http-method=POST \
  --headers="Content-Type=application/json" \
  --message-body='{"userId":"USER_ID","quarterId":"Q1-2025","startDate":"2025-01-01","endDate":"2025-03-31"}'
```

## Monitoring

### Firebase Console

- **Hosting**: View deployment history and usage
- **Firestore**: Monitor database reads/writes
- **Authentication**: Track user sign-ups and activity

### Application Logs

Check browser console for client-side errors and Firebase logs for server-side issues.

## Troubleshooting

### Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run build
```

### Firestore Permission Errors

- Verify Firestore rules are deployed
- Check user authentication status
- Ensure admin emails are configured correctly

### Copper Integration Issues

- Verify Copper API credentials in environment variables
- Check Copper user email matches Firebase user email
- Test API endpoints manually with Postman

## Updating

### Code Updates

```bash
git pull
npm install
npm run build
firebase deploy --only hosting
```

### Firestore Rules Updates

```bash
firebase deploy --only firestore:rules
```

### Environment Variables

Update `.env.local` and redeploy:

```bash
npm run build
firebase deploy --only hosting
```

## Security Checklist

- [ ] Firestore rules deployed and tested
- [ ] Admin emails configured correctly
- [ ] Firebase Admin private key secured (never commit to git)
- [ ] Copper API key secured (server-side only)
- [ ] HTTPS enforced (automatic with Firebase Hosting)
- [ ] CSP headers configured for Copper iframe embedding

## Support

For issues or questions:
- Check Firebase Console logs
- Review Firestore security rules
- Verify Copper API connectivity
- Contact development team

## License

Proprietary - Kanva Botanicals / CWL Brands
