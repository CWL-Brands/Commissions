# Commission Calculator - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### 1. Install Dependencies

```bash
cd c:\Projects\Commission_calculator
npm install
```

### 2. Set Up Environment Variables

Copy `.env.local.example` to `.env.local` and fill in your Firebase credentials:

```bash
copy .env.local.example .env.local
```

Edit `.env.local` with your Firebase project details from [Firebase Console](https://console.firebase.google.com).

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Sign Up

1. Click "Sign In to Get Started"
2. Click "Don't have an account? Sign up"
3. Use your `@kanvabotanicals.com` or `@cwlbrands.com` email
4. Create a password (min 8 chars, 1 number, 1 special char)

### 5. Make Yourself Admin

In Firebase Console:
1. Go to Firestore Database
2. Find your user document in the `users` collection
3. Add a field: `role` = `"admin"`

Now refresh the app - you'll have admin access!

## 📊 Using the App

### For Admins

1. **Settings** - Configure commission structure:
   - Set max bonus per rep ($25,000 default)
   - Adjust bucket weights (must sum to 100%)
   - Add products for Bucket B (Product Mix)
   - Add activities for Bucket D (Effort)

2. **Database** - Enter commission data:
   - Create new entries for each bucket
   - Enter goal and actual values
   - Payouts calculate automatically
   - 75% minimum, 125% cap enforced

3. **Reports** - View performance:
   - Quarter summaries
   - Team rankings
   - Export to Excel

### For Sales Reps

1. **Dashboard** - View your stats:
   - Total payout
   - Average attainment
   - Budget utilization

2. **Database** - View your entries:
   - See your commission data
   - Track progress by bucket

3. **Reports** - Generate your reports:
   - Bucket performance
   - Detailed entries
   - Export your data

## 🔧 Commission Structure

### Buckets

- **A - New Business (50%)**: Growth % goal vs actual
- **B - Product Mix (15%)**: Multiple products with sub-goals
- **C - Maintain Business (20%)**: Revenue $ goal vs actual
- **D - Effort (15%)**: Activities with sub-goals (calls, emails, etc.)

### Rules

- **Minimum**: 75% attainment required to earn commission
- **Maximum**: 125% cap on over-performance
- **Formula**: `Payout = MIN(Attainment, 1.25) × MaxBonus × Weight`

### Example

If Max Bonus = $25,000 and Bucket A = 50%:
- Goal: 20% growth
- Actual: 22% growth
- Attainment: 110%
- Bucket Max: $12,500 (50% of $25,000)
- Payout: $13,750 (110% × $12,500)

## 🔌 Copper Integration (Optional)

### Setup

1. Get Copper API credentials from Copper Settings > Integrations
2. Add to `.env.local`:
   ```
   COPPER_API_KEY=your_key
   COPPER_USER_EMAIL=your_email
   ```

### Sync Metrics

POST to `/api/copper/sync`:
```json
{
  "userId": "firebase_user_id",
  "quarterId": "Q1-2025",
  "startDate": "2025-01-01",
  "endDate": "2025-03-31"
}
```

This syncs:
- Opportunities → Bucket C (revenue)
- Activities → Bucket D (calls, emails, etc.)

## 📱 Embed in Copper

1. In Copper, go to Settings > Integrations
2. Create new App Card
3. Set iframe URL to your deployed app URL
4. App will auto-detect Copper context

## 🚢 Deploy to Production

```bash
npm run build
firebase deploy
```

See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for detailed instructions.

## 🆘 Troubleshooting

### "Permission denied" errors
- Check Firestore rules are deployed: `firebase deploy --only firestore:rules`
- Verify you're signed in with authorized email domain

### Calculations not working
- Ensure bucket weights sum to 100%
- Check product/activity sub-weights sum to 100%
- Verify goal values are greater than 0

### Can't access Settings page
- Confirm your email is in `NEXT_PUBLIC_ADMIN_EMAILS`
- Add `role: "admin"` to your user document in Firestore

### Copper sync failing
- Verify `COPPER_API_KEY` and `COPPER_USER_EMAIL` are set
- Check Copper user email matches Firebase user email
- Ensure Copper API has proper permissions

## 📚 Documentation

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Full deployment instructions
- [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) - Technical details
- [README.md](README.md) - Project overview

## 💡 Tips

1. **Start with Settings**: Configure everything before entering data
2. **Validate Weights**: Always check that weights sum to 100%
3. **Use Sub-Goals**: Leverage Bucket B and D for detailed tracking
4. **Export Regularly**: Download Excel reports for backup
5. **Sync from Copper**: Automate data entry with Copper integration

## 🎯 Next Steps

1. Configure your commission structure in Settings
2. Add your sales team to the `reps` collection
3. Create commission entries for the current quarter
4. Set up Copper sync for automated data entry
5. Generate and share reports with your team

---

**Need Help?** Check the documentation or contact your development team.

**Version**: 1.0.0 | **Last Updated**: 2025-01-07
