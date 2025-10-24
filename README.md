# Kanva Botanicals Commission Calculator

Multi-rep commission calculator with Copper CRM integration for the Kanva Sales Portal.

---

## 🚨 CRITICAL: BEFORE MAKING DEPLOYMENT CHANGES

**⚠️ READ THIS FIRST:** Before modifying `firebase.json`, `next.config.js`, or `app/layout.tsx`:

**📖 See:** [`DEPLOYMENT_RULES.md`](./DEPLOYMENT_RULES.md) - Critical deployment configuration rules

**Key Rules:**
- ❌ **NEVER** add `force-dynamic` to root layout
- ❌ **NEVER** change `firebase.json` from object to array format
- ❌ **NEVER** add complex webpack configs
- ✅ **ALWAYS** test with `npm run build` before deploying
- ✅ **ALWAYS** keep configs simple

**Reference:** Last working config is in commit `50ada75e` (Oct 14-15, 2025)

**Live App:** https://kanvacommissions.web.app

---

## Features

- **Multi-Bucket Commission System**: New Business (A), Product Mix (B), Maintain Business (C), and Effort (D)
- **75% Minimum Attainment**: No payout below 75% goal achievement
- **125% Maximum Cap**: Over-performance capped at 125%
- **Sub-Goals Support**: Product Mix and Effort buckets support weighted sub-goals
- **Copper CRM Integration**: Automatic metrics sync from Copper opportunities and activities
- **Real-Time Calculations**: ArrayFormula-style automatic payout calculations
- **Admin Settings**: Centralized configuration for buckets, weights, goals, products, and activities
- **Rep Dashboards**: Individual and team performance views
- **Quarterly Tracking**: Track commissions by quarter with historical data

## Business Rules

### Global Settings
- **Max Bonus Per Rep**: Configurable (default $25,000)
- **Over-Performance Cap**: 1.25 (125%)
- **Attainment**: Actual / Goal
- **Pay Threshold**: 75% minimum
- **Payout Formula**: `IF(Attainment < 0.75, 0, MIN(Attainment, 1.25) × MaxBonus × Weight)`

### Commission Buckets

#### A – New Business (default 50%)
- Growth goal % vs actual growth %
- Single metric bucket

#### B – Product Mix (default 15%)
- Multiple product rows with Target % and Sub-Weight
- Sub-weights must sum to 100%
- Each row: `IF(Att<0.75, 0, MIN(Att, 1.25) × SubWeight)`
- Bucket payout: `SUM(Row Scores) × MaxBonus × WeightB`

#### C – Maintain Business (default 20%)
- Revenue goal $ vs actual revenue $
- Single metric bucket

#### D – Effort (default 15%)
- Multiple activities with Goal, Sub-Weight, and Actual counts
- Sub-weights must sum to 100%
- Each row: `IF(Att<0.75, 0, MIN(Att, 1.25) × SubWeight)`
- Bucket payout: `SUM(Row Scores) × MaxBonus × WeightD`

## Environment Variables

Create `.env.local` for development:

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
FIREBASE_ADMIN_PRIVATE_KEY=your_private_key

# Copper API
COPPER_API_KEY=your_copper_api_key
COPPER_USER_EMAIL=your_copper_user_email

# Admin Users (comma-separated emails)
NEXT_PUBLIC_ADMIN_EMAILS=admin@kanvabotanicals.com,admin@cwlbrands.com

# Copper SDK
NEXT_PUBLIC_COPPER_SDK_URL=https://cdn.jsdelivr.net/npm/copper-sdk@latest/dist/copper-sdk.min.js
```

## Getting Started

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

### Build

```bash
npm run build
```

### Deploy to Firebase

```bash
npm run deploy
```

## Project Structure

```
├── app/
│   ├── api/              # API routes
│   │   ├── commission/   # Commission calculation endpoints
│   │   ├── copper/       # Copper integration
│   │   └── settings/     # Settings management
│   ├── dashboard/        # Main dashboard
│   ├── settings/         # Admin settings page
│   ├── database/         # Commission data entry
│   ├── reports/          # Reports and exports
│   └── login/            # Authentication
├── components/           # React components
│   ├── commission/       # Commission-specific components
│   ├── dashboard/        # Dashboard components
│   └── settings/         # Settings components
├── lib/
│   ├── firebase/         # Firebase configuration
│   ├── copper/           # Copper SDK integration
│   └── commission/       # Commission calculation engine
└── types/                # TypeScript types
```

## Data Model

### Firestore Collections

- **settings**: Global and per-user settings
  - `commission_config`: Buckets, weights, max bonus, cap
  - `quarters`: Quarter definitions
  - `products`: Product mix sub-goals
  - `activities`: Effort sub-goals
  - `reps`: Sales team roster

- **commission_entries**: Per-rep quarterly data
  - Quarter, Rep, Bucket, Sub-Goal, Goal, Actual, Attainment, Payout

- **commission_payouts**: Calculated payouts
  - Computed attainment and payout per entry

## Authentication

Users must authenticate with their organization email:
- `@kanvabotanicals.com`
- `@cwlbrands.com`

## License

Proprietary - Kanva Botanicals / CWL Brands
