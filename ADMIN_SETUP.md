# Admin Setup Guide - Commission Calculator

## Backend Admin Configuration

The Commission Calculator now uses the same admin permissions structure as the Sales Goals Tracker.

### Environment Variables

Add these to your `.env.local` file:

```env
# Admin Configuration
TEAM_ADMIN_PASS=K@nva2025!
ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com
NEXT_PUBLIC_ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com
NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=kanvabotanicals.com,cwlbrands.com
```

### Admin Users

The following users have admin access:
- ben@kanvabotanicals.com
- it@cwlbrands.com
- rob@kanvabotanicals.com
- kent@kanvabotanicals.com

### Allowed Email Domains

Users can only sign up with emails from:
- @kanvabotanicals.com
- @cwlbrands.com

## UI Components

### AppShell Wrapper

The app now uses the same AppShell wrapper as the Sales Goals Tracker:

**Features:**
- ✅ Sticky top navigation bar
- ✅ Kanva branding with Calculator icon
- ✅ Role-based navigation (admin sees Settings & Team)
- ✅ User profile display with role badge
- ✅ Sign out button
- ✅ Active page highlighting
- ✅ Copper iframe query param preservation
- ✅ Responsive footer with version number

### AuthContext

Provides global authentication state:

```typescript
const { user, userProfile, loading, isAdmin, isManager } = useAuth();
```

**User Roles:**
- `admin` - Full access to all features
- `manager` - Team view access (future feature)
- `sales` - Standard rep access

## Admin API Endpoints

### POST /api/admin/config

Update commission configuration (protected by TEAM_ADMIN_PASS).

**Headers:**
```
x-admin-pass: K@nva2025!
Content-Type: application/json
```

**Body:**
```json
{
  "maxBonusPerRep": 25000,
  "overPerfCap": 1.25,
  "minAttainment": 0.75,
  "buckets": [...]
}
```

### GET /api/admin/config

Retrieve commission configuration (protected by TEAM_ADMIN_PASS).

**Headers:**
```
x-admin-pass: K@nva2025!
```

## Local Development Setup

1. **Copy environment file:**
   ```bash
   copy .env.local.example .env.local
   ```

2. **Add your Firebase credentials** to `.env.local`

3. **The admin config is already set:**
   ```env
   TEAM_ADMIN_PASS=K@nva2025!
   ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com
   NEXT_PUBLIC_ADMIN_EMAILS=ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com
   NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS=kanvabotanicals.com,cwlbrands.com
   ```

4. **Run the app:**
   ```bash
   npm run dev
   ```

5. **Sign up with an admin email** (e.g., ben@kanvabotanicals.com)

6. **Firestore will auto-create user document** with role based on email

## User Role Assignment

### Automatic Role Assignment

When a user signs up, their role is automatically determined:

- **Admin emails** (from ADMIN_EMAILS) → `role: "admin"`
- **Other allowed domains** → `role: "sales"`

### Manual Role Override

To manually change a user's role in Firestore:

1. Go to Firebase Console > Firestore
2. Navigate to `users` collection
3. Find the user document
4. Edit the `role` field:
   - `admin` - Full access
   - `manager` - Team view (future)
   - `sales` - Standard access

## Navigation Access Control

### All Users
- Dashboard
- Database (own data)
- Reports (own data)

### Admin Only
- Settings (configure buckets, weights, products, activities)
- Team (view all reps performance)

### Manager (Future)
- Team view for their assigned reps

## Security Features

### Email Domain Validation
- Only @kanvabotanicals.com and @cwlbrands.com can sign up
- Validated on both client and server side

### Password Requirements
- Minimum 8 characters
- At least one number
- At least one special character

### API Protection
- Admin endpoints protected by TEAM_ADMIN_PASS header
- Firestore rules enforce role-based access
- Client-side navigation guards

### Firestore Security Rules

```javascript
// Users can read their own data, admins can read all
match /users/{userId} {
  allow read: if request.auth.uid == userId || 
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
  allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// Settings are read-only for non-admins
match /settings/{document=**} {
  allow read: if request.auth != null;
  allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}

// Commission entries - reps can read their own, admins can read/write all
match /commission_entries/{entryId} {
  allow read: if request.auth != null && 
              (get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin' ||
               resource.data.repId == request.auth.uid);
  allow write: if get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin';
}
```

## Testing Admin Access

1. **Sign up as admin:**
   - Use one of the admin emails
   - Create account
   - You'll automatically have admin role

2. **Verify admin access:**
   - Check navigation bar shows "Settings" and "Team" links
   - User badge shows "Admin"
   - Can access `/settings` page
   - Can access `/team` page

3. **Test non-admin:**
   - Sign up with a non-admin email (e.g., test@kanvabotanicals.com)
   - Should only see Dashboard, Database, Reports
   - User badge shows "Sales Rep"
   - Cannot access `/settings` or `/team`

## Troubleshooting

### "Unauthorized" error on admin API
- Check TEAM_ADMIN_PASS is set in environment
- Verify x-admin-pass header matches exactly

### User doesn't have admin access
- Verify email is in ADMIN_EMAILS list
- Check Firestore user document has `role: "admin"`
- Clear browser cache and re-login

### Email domain rejected
- Verify NEXT_PUBLIC_ALLOWED_EMAIL_DOMAINS includes the domain
- Check for typos in email address
- Ensure no extra spaces in environment variable

## Production Deployment

1. **Set environment variables in Firebase:**
   ```bash
   firebase functions:config:set admin.pass="K@nva2025!"
   firebase functions:config:set admin.emails="ben@kanvabotanicals.com,it@cwlbrands.com,rob@kanvabotanicals.com,kent@kanvabotanicals.com"
   ```

2. **Deploy:**
   ```bash
   npm run build
   firebase deploy
   ```

3. **Verify admin access in production**

## Support

For issues with admin access or configuration:
1. Check environment variables are set correctly
2. Verify Firestore rules are deployed
3. Check user role in Firestore Console
4. Review browser console for errors

---

**Version:** 1.0.0  
**Last Updated:** 2025-01-07
