# VP/Admin Permissions Setup for Kevin

## Overview
Kevin (CFO) can now view all team member commissions and data across the application. This is controlled by role-based permissions.

## How It Works

The system grants full data access to users who meet ANY of these criteria:

1. **Admin Role** - Users with `role: "admin"` in Firestore
2. **VP Title** - Users with "VP" in their job title (e.g., "VP Finance", "VP Sales")
3. **Explicit Permission** - Users with `canViewAllCommissions: true` flag

## Setting Up Kevin's Account

### Option 1: Set VP Title (Recommended)

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select project: `kanvaportal`
3. Navigate to Firestore Database
4. Find Kevin's user document in the `users` collection
5. Add or update the `title` field to: `"VP Finance"`
6. Save the document

Kevin will automatically have access to all data.

### Option 2: Set Explicit Permission

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Find Kevin's user document in the `users` collection
4. Add field: `canViewAllCommissions` = `true`
5. Save the document

### Option 3: Set Admin Role

1. Go to Firebase Console
2. Navigate to Firestore Database
3. Find Kevin's user document in the `users` collection
4. Update `role` field to: `"admin"`
5. Save the document

## Kevin's User Document Structure

Kevin's document in the `users` collection should look like this:

```
{
  "email": "kevin@cwlbrands.com",
  "name": "Kevin",
  "role": "admin",  // OR keep as "manager"/"sales" if using title method
  "title": "VP Finance",  // This grants full access
  "canViewAllCommissions": true,  // Optional explicit flag
  "salesPerson": "",  // Optional Fishbowl sales person ID
  "createdAt": <timestamp>,
  "updatedAt": <timestamp>
}
```

## What Kevin Can See

Once configured, Kevin will have access to:

### Dashboard
- **Aggregate Team Stats**: Shows combined totals for all sales reps
  - Monthly Commissions: Sum of all reps' commissions
  - Spiffs: Total spiffs across team
  - Orders: Total orders from all reps
  - YTD Total: Combined year-to-date commissions
  - Quarterly Bonus: Team total payout and average attainment
  - Budget: Calculated as $25k per active rep
- All navigation cards (Settings, Monthly Reports, Team View)
- Shows "Admin/VP" badge instead of "Sales Rep"

### Reports Page
- **Quarterly Bonuses**: All team members' performance data
- **Monthly Commissions**: All sales reps' commission details
- **Team Performance**: Rankings and payouts for all reps
- **Export**: Can export all team data to Excel

### Team Page
- View all team members
- See everyone's performance metrics
- Access all commission data

### Monthly Reports Page
- View commission summaries for all reps
- See detailed order-level commissions for entire team
- Filter by specific rep or view all

## Testing

After setting up Kevin's permissions:

1. Have Kevin sign out and sign back in
2. Navigate to Dashboard - should see "Admin/VP" badge
3. Check that Settings, Monthly Reports, and Team View cards are visible
4. Go to Reports page - should see all team members' data
5. Go to Monthly Reports - should see dropdown to select any rep

## Adding More VPs/Admins

To grant full access to other executives:

1. Add "VP" to their title field, OR
2. Set `canViewAllCommissions: true`, OR
3. Set `role: "admin"`

Examples of titles that grant access:
- "VP Finance"
- "VP Sales"
- "VP Operations"
- "Chief Financial Officer" (does NOT auto-grant - use explicit flag)

## Security Notes

- Regular sales reps can only see their own data
- VPs/Admins can see all data but cannot modify other users' records
- Admin role also grants access to Settings page for configuration
- Permissions are checked on every page load
- Users must sign out and back in for permission changes to take effect

## Troubleshooting

### Kevin still can't see all data

1. Verify Kevin's email in Firestore matches exactly: `kevin@cwlbrands.com`
2. Check that one of the permission fields is set correctly
3. Have Kevin sign out completely and sign back in
4. Clear browser cache (Ctrl+Shift+Delete)
5. Check browser console for any errors

### Permission changes not taking effect

- Users must sign out and sign back in for changes to apply
- Browser cache may need to be cleared
- Verify the Firestore document was saved correctly

## Support

If issues persist:
1. Check Firestore rules allow read access to users collection
2. Verify Firebase Admin SDK is properly configured
3. Check browser console for authentication errors
4. Ensure Kevin's account is not disabled in Firebase Authentication
