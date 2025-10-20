# Setup Vercel Environment Variables
Write-Host "Adding environment variables to Vercel..." -ForegroundColor Green

# Firebase Configuration (Public - Client-side)
"AIzaSyBwU2sUVjnT-ZqxhBaIWp18DRJzHnTxf9Q" | vercel env add NEXT_PUBLIC_FIREBASE_API_KEY production
"kanvaportal.firebaseapp.com" | vercel env add NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN production
"kanvaportal" | vercel env add NEXT_PUBLIC_FIREBASE_PROJECT_ID production
"kanvaportal.appspot.com" | vercel env add NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET production
"829835149823" | vercel env add NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID production
"1:829835149823:web:68e50ea9f6b1eec3df67ca" | vercel env add NEXT_PUBLIC_FIREBASE_APP_ID production
"G-QDK79V6MX5" | vercel env add NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID production

# Firebase Admin SDK (Server-side)
"kanvaportal" | vercel env add FIREBASE_PROJECT_ID production
"firebase-adminsdk-fbsvc@kanvaportal.iam.gserviceaccount.com" | vercel env add FIREBASE_CLIENT_EMAIL production
"ROHwFBWH5FUWOFBG9sVM87qNeRI6uniO135Ff8BD" | vercel env add FIREBASE_DATABASE_SECRET production
"-----BEGIN PRIVATE KEY-----\IHokNT8LNWxCptiveNNDAKLFG80rgRTkJ7ig8TdH\n-----END PRIVATE KEY-----\n" | vercel env add FIREBASE_PRIVATE_KEY production

# Copper CRM
"6187c1b571e219a060285bf66fcaf8ae" | vercel env add COPPER_API_KEY production
"ben@kanvabotanicals.com" | vercel env add COPPER_USER_EMAIL production

# Admin
"ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com" | vercel env add NEXT_PUBLIC_ADMIN_EMAILS production
"https://cdn.jsdelivr.net/npm/copper-sdk@latest/dist/copper-sdk.min.js" | vercel env add NEXT_PUBLIC_COPPER_SDK_URL production

# App Configuration
"https://kanvacommissions.web.app/" | vercel env add NEXT_PUBLIC_APP_URL production
"Kanvacommissions" | vercel env add NEXT_PUBLIC_APP_NAME production
"Kanva Botanicals" | vercel env add NEXT_PUBLIC_COMPANY_NAME production

# Feature Flags
"false" | vercel env add NEXT_PUBLIC_ENABLE_JUSTCALL production
"false" | vercel env add NEXT_PUBLIC_ENABLE_AI_INSIGHTS production
"true" | vercel env add NEXT_PUBLIC_DEV_MODE production

# Team Admin
"K@nva2025!" | vercel env add TEAM_ADMIN_PASS production
"ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com" | vercel env add ADMIN_EMAILS production
"kanvabotanicals.com,cwlbrands.com" | vercel env add NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS production

# JustCall
"882854de1e42e5b3856c5d3eae7a924e052f102a" | vercel env add JUSTCALL_API_KEY production
"61e2a915e687e18921d4911b04893e72ea460a83" | vercel env add JUSTCALL_API_SECRET production
"kanvabotanicals.com,cwlbrands.com" | vercel env add ALLOWED_DOMAINS production

# ShipStation
"3030832aab044579a5c3be2eff940516" | vercel env add SHIPSTATION_API_KEY production
"71bf030eb7ba489db52828a63ddafb3c" | vercel env add SHIPSTATION_API_SECRET production
"YOUR_SHIPSTATION_WEBHOOK_SECRET" | vercel env add SHIPSTATION_WEBHOOK_SECRET production

# Google Maps
"AIzaSyBb6XLQjPCFhsxLB6kYU4NbUnuWJ8KgbXI" | vercel env add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY production

Write-Host "`nDone! Now run: vercel --prod" -ForegroundColor Green
