# Firebase Service Account Key Setup

## Overview
This guide explains how to generate and configure Firebase Admin SDK service account keys for any Firebase project.

## Prerequisites
- Firebase project access with Owner or Editor role
- Access to Vercel project settings (for deployment)
- Organization admin access to modify IAM policies (if key creation is restricted)

---

## IMPORTANT: Organization Policy Restriction

If you see this error when trying to generate a key:
```
Key creation is not allowed on this service account. 
Please check if service account key creation is restricted by organization policies.
```

You must first disable the organization policy restriction:

### Disable Key Creation Restriction (Organization Admin Required)

1. Sign in as organization admin for cwlbrands domain
2. Navigate to: https://console.cloud.google.com/iam-admin/orgpolicies
3. Select your organization: cwlbrands
4. Find policy: "Disable service account key creation"
5. Click "Edit Policy"
6. Select "Replace" or "Override parent's policy"
7. Set enforcement to: "Off" or "Not enforced"
8. Click "Set Policy" to save

Alternatively, you can allow key creation for specific service accounts:
1. Go to: https://console.cloud.google.com/iam-admin/serviceaccounts?project=kanvaportal
2. Find the Firebase Admin SDK service account
3. Click the three dots menu
4. Select "Manage keys"
5. If blocked, contact organization admin to modify the org policy

---

## Step 1: Access Firebase Console

1. Navigate to: https://console.firebase.google.com/
2. Sign in with: ben@kanvabotanicals.com
3. Select your Firebase project from the list

---

## Step 2: Navigate to Service Accounts

1. Click the gear icon (Settings) in the left sidebar
2. Select "Project Settings"
3. Click the "Service Accounts" tab at the top

---

## Step 3: Generate New Private Key

1. Scroll down to the "Firebase Admin SDK" section
2. Click the button: "Generate New Private Key"
3. A confirmation dialog will appear
4. Click "Generate Key" to confirm
5. A JSON file will automatically download to your computer

**Important:** Keep this file secure. It contains credentials that grant full access to your Firebase project.

---

## Step 4: Locate the Downloaded JSON File

The file will be named something like:
```
kanvaportal-firebase-adminsdk-xxxxx-xxxxxxxxxx.json
```

Open this file in a text editor (Notepad, VS Code, etc.)

---

## Step 5: Extract Required Values

The JSON file contains several fields. You need these specific values:

### Required Fields:
- `project_id`
- `private_key`
- `client_email`

Example structure:
```json
{
  "type": "service_account",
  "project_id": "kanvaportal",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n",
  "client_email": "firebase-adminsdk-xxxxx@kanvaportal.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

---

## Step 6: Configure Environment Variables in Vercel

### 6.1 Access Vercel Dashboard
1. Navigate to: https://vercel.com/dashboard
2. Sign in to your account
3. Select your project from the list

### 6.2 Navigate to Environment Variables
1. Click "Settings" in the top navigation
2. Click "Environment Variables" in the left sidebar

### 6.3 Add/Update Variables

Add or update these three environment variables:

**Variable 1: FIREBASE_PROJECT_ID**
- Key: `FIREBASE_PROJECT_ID`
- Value: Copy the `project_id` from your JSON file
- Environment: Select all (Production, Preview, Development)

**Variable 2: FIREBASE_CLIENT_EMAIL**
- Key: `FIREBASE_CLIENT_EMAIL`
- Value: Copy the `client_email` from your JSON file
- Environment: Select all (Production, Preview, Development)

**Variable 3: FIREBASE_PRIVATE_KEY**
- Key: `FIREBASE_PRIVATE_KEY`
- Value: Copy the entire `private_key` value from your JSON file
- **Important:** Include the quotes and all `\n` characters exactly as they appear
- Example: `"-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"`
- Environment: Select all (Production, Preview, Development)

### 6.4 Save Changes
1. Click "Save" for each variable
2. Vercel will automatically redeploy your application with the new variables

---

## Step 7: Configure Local Development (Optional)

If you want to run the application locally:

### 7.1 Create .env.local file
In your project root directory, create a file named `.env.local`

### 7.2 Add the same variables:
```
FIREBASE_PROJECT_ID=kanvaportal
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@kanvaportal.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg...\n-----END PRIVATE KEY-----\n"
```

**Important:** Never commit `.env.local` to Git. It should be in your `.gitignore` file.

---

## Step 8: Verify Configuration

### 8.1 Wait for Deployment
After saving environment variables in Vercel, wait 2-3 minutes for automatic redeployment.

### 8.2 Test the Application
1. Navigate to your application URL
2. Try accessing features that require Firebase (e.g., commission calculations)
3. Check browser console for errors

### 8.3 Check Vercel Logs
If issues persist:
1. Go to Vercel Dashboard
2. Select your project
3. Click "Deployments"
4. Click on the latest deployment
5. Click "Functions" tab
6. Check logs for Firebase initialization errors

---

## Troubleshooting

### Error: "Failed to parse private key"
**Cause:** The private key format is incorrect.

**Solution:**
1. Ensure you copied the entire `private_key` value including quotes
2. Verify all `\n` characters are present (they should be literal backslash-n, not newlines)
3. The key should start with `"-----BEGIN PRIVATE KEY-----\n` and end with `\n-----END PRIVATE KEY-----\n"`

### Error: "Permission denied"
**Cause:** The service account doesn't have sufficient permissions.

**Solution:**
1. Go to Firebase Console
2. Navigate to Project Settings > Service Accounts
3. Click "Manage service account permissions"
4. Ensure the service account has "Firebase Admin SDK Administrator Service Agent" role

### Error: "Project not found"
**Cause:** The project ID is incorrect.

**Solution:**
1. Verify `FIREBASE_PROJECT_ID` matches your Firebase project ID exactly
2. Check for typos or extra spaces

---

## Security Best Practices

1. Never commit service account JSON files to Git
2. Never share private keys in public channels
3. Rotate keys periodically (every 90 days recommended)
4. Use separate service accounts for development and production
5. Limit service account permissions to only what's needed
6. Store keys in secure environment variable systems (Vercel, AWS Secrets Manager, etc.)
7. Add `.env.local` and `*.json` (for service account files) to `.gitignore`

---

## Repeating This Process for Other Projects

To set up Firebase Admin SDK for any new project:

1. Follow Steps 1-3 to generate a new service account key
2. Each Firebase project will have its own unique service account
3. Each project needs its own set of environment variables in Vercel
4. Never reuse service account keys across different projects

---

## Additional Resources

- Firebase Admin SDK Documentation: https://firebase.google.com/docs/admin/setup
- Vercel Environment Variables: https://vercel.com/docs/concepts/projects/environment-variables
- Firebase Service Accounts: https://cloud.google.com/iam/docs/service-accounts

---

## Support

If you encounter issues:
1. Check Vercel deployment logs
2. Check Firebase Console for service account status
3. Verify all environment variables are set correctly
4. Contact Firebase Support: https://firebase.google.com/support
