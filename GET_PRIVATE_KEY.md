# How to Get the Private Key from Goals App

Since the Goals app is working, it HAS the private key in its `.env.local` file.

## Step 1: Find the Goals App's .env.local

The file is at: `C:\Projects\copper-goals-tracker\.env.local`

## Step 2: Copy the FIREBASE_PRIVATE_KEY

Open that file and look for the line that starts with:
```
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
```

It will be a VERY LONG line with the entire private key.

## Step 3: Copy it to Commission Calculator's .env.local

Add that exact same line to:
`C:\Projects\Commission_calculator\.env.local`

## Example:

Your `.env.local` should have:
```env
FIREBASE_PROJECT_ID=kanvaportal
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@kanvaportal.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC...(VERY LONG)...END PRIVATE KEY-----\n"
```

## Step 4: Restart

```bash
npm run dev
```

You should see:
```
[firebase-admin] initializeApp(cert, projectId=kanvaportal)
```

**That's it! The Goals app already has the key - just copy it!**
