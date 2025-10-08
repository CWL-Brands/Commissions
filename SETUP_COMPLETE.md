# Commission Calculator - Setup Complete! 🎉

## ✅ What's Been Built

### 1. **Backend Admin Configuration**
- ✅ Same permissions structure as Sales Goals Tracker
- ✅ `TEAM_ADMIN_PASS` protection for admin APIs
- ✅ Admin emails: ben@, it@, rob@, kent@ @kanvabotanicals.com
- ✅ Email domain validation (kanvabotanicals.com, cwlbrands.com)

### 2. **UI Components**
- ✅ **AppShell Wrapper** - Matches Sales Goals Tracker
  - Sticky navigation with Kanva branding
  - Role-based menu (Admin sees Settings & Team)
  - User profile with role badge
  - Sign out functionality
  - Copper iframe support

- ✅ **AuthContext** - Global authentication state
  - User profile loading from Firestore
  - Role detection (admin/manager/sales)
  - Client-side only initialization

### 3. **Pages Built**

#### **Settings Page** (`/settings`)
Comprehensive configuration matching your AppScript:

**Global Settings:**
- Max Bonus Per Rep ($25,000)
- Over-Performance Cap (125%)
- Minimum Attainment (75%)

**Sales Team Roster:**
- Add/Remove reps
- Name, Title, Email, Start Date
- Active status toggle
- Notes field
- Shows Active Reps count
- Shows Total Quarterly Budget

**Commission Buckets:**
- Bucket A: New Business (50%)
- Bucket B: Product Mix (15%)
- Bucket C: Maintain Business (20%)
- Bucket D: Effort (15%)
- Weight validation (must sum to 100%)

**Product Mix Sub-Goals (Bucket B):**
- Focus+Flow, Release+Relax, Mango, Zoom, Raw + Relief
- Target % of Sales
- Sub-Weight in Bucket
- MSRP
- Active toggle
- Notes
- Validation: Target % and Sub-Weights must each sum to 100%

**Effort Sub-Goals (Bucket D):**
- Phone Calls, Emails Sent, Talk Time, SMS Messages
- Goal values
- Sub-Weights
- Data Source (Copper/JustCall)
- Active toggle
- Validation: Sub-Weights must sum to 100%

**Validation Summary:**
- Real-time validation indicators
- Green checkmarks for valid configurations
- Red alerts for invalid sums

#### **Team Page** (`/team`)
Team performance dashboard:

**Summary Cards:**
- Total Payout (all reps)
- Average Attainment
- Active Reps count
- Top Performer with payout

**Team Leaderboard Table:**
- Rank (with trophy icon for #1)
- Rep Name & Email
- Total Commission
- Attainment % with progress bar
- Bucket A/B/C/D breakdown
- Trend indicators (up/down/stable)
- Color-coded attainment bars

**Features:**
- Quarter selector
- Aggregates data from `commission_entries` collection
- Auto-calculates ranks
- Shows performance by bucket

### 4. **Database Structure**

Your database matches the AppScript structure:

**Collections:**
- `settings/commission_config` - Global settings
- `reps` - Sales team roster
- `products` - Product mix sub-goals
- `activities` - Effort sub-goals
- `commission_entries` - Master database entries
- `users` - User profiles with roles

**Entry Structure:**
```typescript
{
  quarter: "Q4 2025",
  repId: "user123",
  repName: "Ben Wallner",
  repEmail: "ben@kanvabotanicals.com",
  bucket: "A",
  subGoal: "New Business",
  goalValue: 0.20,
  actualValue: 0.05,
  attainment: 0.25,
  bucketMax: 12500,
  payout: 0,
  notes: "Exceeded"
}
```

## 🔧 Configuration Files

### Environment Variables (`.env.local`)
```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin (Server-side)
FIREBASE_ADMIN_PROJECT_ID=your_project_id
FIREBASE_ADMIN_CLIENT_EMAIL=your_service_account_email
FIREBASE_ADMIN_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Copper API
COPPER_API_KEY=your_copper_api_key
COPPER_USER_EMAIL=your_copper_user_email

# Admin Configuration
TEAM_ADMIN_PASS=K@nva2025!
ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com
NEXT_PUBLIC_ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=kanvabotanicals.com,cwlbrands.com

# Copper SDK
NEXT_PUBLIC_COPPER_SDK_URL=https://cdn.jsdelivr.net/npm/copper-sdk@latest/dist/copper-sdk.min.js
```

## 📊 Calculation Logic (Matches Your AppScript)

### Row Math
```
Attainment % = Actual ÷ Goal
Capped Attainment = MIN(Attainment, 1.25)
75% Floor: IF(Attainment < 0.75, payout = $0)
Row Max $ = Bucket Max $ × Sub-Weight (for B & D)
Payout $ = IF(Attainment < 0.75, 0, Row Max $ × Capped Attainment)
```

### Bucket Specifics
- **Bucket A (New Business):** Growth % based (e.g., 23% actual vs 20% goal = 115%)
- **Bucket B (Product Mix):** Weighted sum of product sub-goals
- **Bucket C (Maintain Business):** Revenue-based (Actual $ ÷ Goal $)
- **Bucket D (Effort):** Weighted sum of activity sub-goals

### Example Calculation
```
Prev Quarter Revenue: $1,000,000
Goal Growth: 20%
Target Revenue: $1,200,000
Actual Revenue: $1,100,000
Actual Growth: 10%
Attainment: 10% ÷ 20% = 50%
Capped: MIN(50%, 125%) = 50%
Payout: 50% × 35% × $25,000 = $4,375
```

## 🚀 Next Steps

### 1. **Initialize Firestore Data**
Run this script to populate default settings:

```javascript
// In Firebase Console > Firestore
// Create document: settings/commission_config
{
  maxBonusPerRep: 25000,
  overPerfCap: 1.25,
  minAttainment: 0.75,
  buckets: [
    { id: 'A', code: 'A', name: 'New Business', weight: 0.50, hasSubGoals: false, active: true },
    { id: 'B', code: 'B', name: 'Product Mix', weight: 0.15, hasSubGoals: true, active: true },
    { id: 'C', code: 'C', name: 'Maintain Business', weight: 0.20, hasSubGoals: false, active: true },
    { id: 'D', code: 'D', name: 'Effort', weight: 0.15, hasSubGoals: true, active: true }
  ]
}
```

### 2. **Add Products**
```javascript
// Collection: products
{ sku: 'Focus+Flow', targetPercent: 0.30, subWeight: 0.30, msrp: 9.99, active: true, notes: 'Top seller' }
{ sku: 'Release+Relax', targetPercent: 0.10, subWeight: 0.10, msrp: 9.99, active: true, notes: 'Grow this' }
{ sku: 'Mango', targetPercent: 0.10, subWeight: 0.10, msrp: 9.99, active: true, notes: 'Steady' }
{ sku: 'Zoom', targetPercent: 0.10, subWeight: 0.10, msrp: 6.99, active: true, notes: 'Grow this' }
{ sku: 'Raw + Relief', targetPercent: 0.40, subWeight: 0.40, msrp: 9.99, active: true, notes: 'Grow this' }
```

### 3. **Add Activities**
```javascript
// Collection: activities
{ activity: 'Phone Calls', goal: 1200, subWeight: 0.30, dataSource: 'JustCall', active: true }
{ activity: 'Emails Sent', goal: 600, subWeight: 0.25, dataSource: 'Copper CRM', active: true }
{ activity: 'Talk Time (hrs)', goal: 6000, subWeight: 0.25, dataSource: 'JustCall', active: true }
{ activity: 'SMS Messages', goal: 600, subWeight: 0.20, dataSource: 'JustCall', active: true }
```

### 4. **Add Sales Reps**
```javascript
// Collection: reps
{ name: 'Ben Wallner', title: 'Account Executive', email: 'ben@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06') }
{ name: 'Jared', title: 'Account Executive', email: 'jared@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06') }
{ name: 'Derek', title: 'Jr. Account Executive', email: 'derek@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06') }
{ name: 'Brandon', title: 'Jr. Account Executive', email: 'brandon@kanvabotanicals.com', active: true, startDate: new Date('2025-10-06') }
```

### 5. **Copper CRM Integration**
The Copper integration from the Sales Goals Tracker is ready to use:

**Available Functions:**
- `lib/copper/integration.ts` - Client-side SDK
- Activity logging
- Opportunity tracking
- Context retrieval

**To Enable:**
1. Set `COPPER_API_KEY` and `COPPER_USER_EMAIL` in `.env.local`
2. The app already includes Copper SDK script loading
3. Use the same integration patterns from the goals app

## 🎯 Testing Checklist

- [ ] Sign up with admin email (ben@kanvabotanicals.com)
- [ ] Verify admin access (Settings & Team links visible)
- [ ] Configure Settings:
  - [ ] Add/edit sales reps
  - [ ] Adjust bucket weights (must sum to 100%)
  - [ ] Configure products (target % and sub-weights sum to 100%)
  - [ ] Configure activities (sub-weights sum to 100%)
  - [ ] Save all sections
- [ ] View Team page
  - [ ] Select different quarters
  - [ ] Verify leaderboard displays
  - [ ] Check summary cards
- [ ] Test non-admin user
  - [ ] Sign up with non-admin email
  - [ ] Verify no Settings/Team access
  - [ ] Can access Dashboard, Database, Reports

## 📝 Notes

### Differences from AppScript
1. **Web App vs Sheets:** This is a full web application, not a Google Sheet
2. **Real-time:** Uses Firestore for real-time data sync
3. **Multi-user:** Supports concurrent users with role-based access
4. **API Integration:** Ready for Copper CRM integration
5. **Scalable:** Can handle unlimited reps and quarters

### Same as AppScript
1. **Calculation Logic:** Identical 75% floor, 125% cap
2. **Bucket Structure:** Same A/B/C/D buckets
3. **Sub-Goals:** Same product mix and effort sub-goals
4. **Validation:** Same weight validation (must sum to 100%)
5. **Data Model:** Same master database structure

## 🔐 Security

- ✅ Email domain validation
- ✅ Password requirements (8+ chars, number, special char)
- ✅ Firestore security rules
- ✅ Admin API protection (TEAM_ADMIN_PASS)
- ✅ Role-based access control
- ✅ Client-side navigation guards

## 📚 Documentation

- `README.md` - Project overview
- `ADMIN_SETUP.md` - Admin configuration guide
- `SETUP_COMPLETE.md` - This file
- Inline code comments throughout

## 🎉 Ready to Launch!

Your Commission Calculator is now fully configured and ready for local testing. The UI matches your Sales Goals Tracker, the calculation logic matches your AppScript, and all admin controls are in place.

**To start:**
```bash
npm run dev
```

Then visit `http://localhost:3000` and sign in with an admin email!

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-07  
**Built by:** Cascade AI
