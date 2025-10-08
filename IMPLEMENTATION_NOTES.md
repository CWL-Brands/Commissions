# Commission Calculator - Implementation Notes

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Firebase (Firestore, Authentication, Hosting)
- **Integration**: Copper CRM API
- **Charts**: Recharts (ready to add)
- **Export**: XLSX (SheetJS)

### Key Design Decisions

1. **Next.js Static Export**: Using `output: 'export'` for Firebase Hosting compatibility
2. **Client-Side Calculations**: Commission calculations happen in browser for real-time updates
3. **Firestore as Single Source of Truth**: All configuration and data stored in Firestore
4. **Automatic Recalculation**: Payout formulas auto-execute on data entry

## Commission Calculation Logic

### Core Formula

```typescript
Attainment = Actual / Goal
CappedAttainment = IF(Attainment < 0.75, 0, MIN(Attainment, 1.25))
BucketMax = MaxBonus × BucketWeight × SubWeight (if applicable)
Payout = CappedAttainment × BucketMax
```

### Bucket Types

#### A - New Business (Single Metric)
- Input: Growth % goal vs actual growth %
- Weight: 50% (default)
- No sub-goals

#### B - Product Mix (Sub-Goals)
- Multiple product rows with Target % and Sub-Weight
- Sub-weights must sum to 100%
- Target percentages must sum to 100%
- Each row calculated independently, then summed

#### C - Maintain Business (Single Metric)
- Input: Revenue $ goal vs actual revenue $
- Weight: 20% (default)
- No sub-goals

#### D - Effort (Sub-Goals)
- Multiple activity rows with Goal count and Sub-Weight
- Sub-weights must sum to 100%
- Each row calculated independently, then summed
- Can sync from Copper activities

## Data Model

### Firestore Collections

```
settings/
  commission_config          # Global config (max bonus, caps, buckets)
  copper_metadata           # Copper API metadata cache
  {userId}                  # Per-user settings

users/
  {userId}                  # User profile and role

commission_entries/
  {entryId}                 # Individual commission records
    - quarterId
    - repId
    - bucketCode (A/B/C/D)
    - subGoalId (for B/D)
    - goalValue
    - actualValue
    - attainment (calculated)
    - bucketMax (calculated)
    - payout (calculated)

products/
  {productId}               # Product mix sub-goals (Bucket B)
    - sku
    - targetPercent
    - subWeight
    - active

activities/
  {activityId}              # Effort sub-goals (Bucket D)
    - activity
    - goal
    - subWeight
    - dataSource
    - active

quarters/
  {quarterId}               # Quarter definitions
    - code (e.g., "Q1-2025")
    - startDate
    - endDate

reps/
  {repId}                   # Sales team roster
    - name
    - email
    - active
```

## API Endpoints

### `/api/copper/sync` (POST)
Syncs metrics from Copper CRM:
- Opportunities → Bucket C (Maintain Business)
- Activities → Bucket D (Effort sub-goals)

**Request:**
```json
{
  "userId": "firebase_user_id",
  "quarterId": "Q1-2025",
  "startDate": "2025-01-01",
  "endDate": "2025-03-31"
}
```

**Response:**
```json
{
  "success": true,
  "userId": "...",
  "quarterId": "Q1-2025",
  "results": {
    "opportunities": 42,
    "revenue": 150000,
    "activities": 128
  }
}
```

## Validation Rules

### Settings Page
1. **Bucket Weights**: Must sum to 100% (tolerance: 0.01%)
2. **Product Target %**: Must sum to 100% (tolerance: 0.01%)
3. **Product Sub-Weights**: Must sum to 100% (tolerance: 0.01%)
4. **Activity Sub-Weights**: Must sum to 100% (tolerance: 0.01%)

### Database Page
1. **Goal Value**: Must be > 0 for valid calculations
2. **Actual Value**: Can be any number (including 0)
3. **Bucket Code**: Must be A, B, C, or D
4. **Sub-Goal**: Required for B and D buckets

## Copper Integration

### SDK Initialization
- Auto-detects iframe context
- Requires `parentOrigin` and `instanceId` URL params
- Gracefully degrades if not in Copper

### API Authentication
- Uses `X-PW-AccessToken` header
- Uses `X-PW-UserEmail` header
- Implements retry logic for rate limits (429)

### Metrics Mapping
- **Opportunities** → Revenue for Bucket C
- **Activities** → Counts for Bucket D sub-goals
- **Users** → Rep mapping via email

## Security

### Firestore Rules
- Reps can read their own data
- Admins can read/write all data
- Settings are read-only for non-admins
- Email domain validation (@kanvabotanicals.com, @cwlbrands.com)

### Authentication
- Firebase Email/Password
- Password requirements: 8+ chars, 1 number, 1 special char
- Admin role determined by email in `NEXT_PUBLIC_ADMIN_EMAILS`

### API Security
- Copper API key stored server-side only
- Firebase Admin credentials never exposed to client
- CORS headers configured for Copper iframe

## Performance Optimizations

1. **Firestore Indexes**: Created for common queries
2. **Client-Side Calculations**: Reduces API calls
3. **Lazy Loading**: Components load on demand
4. **Memoization**: React hooks prevent unnecessary re-renders

## Known Limitations

1. **Static Export**: No server-side API routes (use Firebase Functions if needed)
2. **Real-Time Updates**: Not implemented (refresh required)
3. **File Uploads**: Not supported in current version
4. **Multi-Currency**: Not supported (USD only)
5. **Proration**: Start date proration not implemented

## Future Enhancements

### Phase 2 Features
1. **Real-Time Dashboards**: WebSocket updates
2. **Advanced Charts**: Recharts integration with trend analysis
3. **Automated Sync**: Scheduled Copper sync via Cloud Functions
4. **Email Notifications**: Commission reports via email
5. **Mobile App**: React Native version
6. **Multi-Currency**: Support for CAD, EUR, etc.
7. **Role Hierarchy**: Manager role with team view
8. **Audit Trail**: Track all changes to commission data
9. **Approval Workflow**: Manager approval before payout
10. **JustCall Integration**: Direct call metrics sync

### Technical Debt
1. Add comprehensive unit tests
2. Implement E2E tests with Playwright
3. Add error boundary components
4. Improve loading states and skeletons
5. Add offline support with service workers
6. Implement proper logging and monitoring

## Testing Strategy

### Manual Testing Checklist
- [ ] Sign up with valid email
- [ ] Sign in with existing account
- [ ] Admin can access Settings page
- [ ] Non-admin cannot access Settings page
- [ ] Create commission entry
- [ ] Edit commission entry (auto-calculates)
- [ ] Bucket weights validation
- [ ] Product sub-weights validation
- [ ] Activity sub-weights validation
- [ ] Export to Excel
- [ ] Copper sync (if configured)
- [ ] Reports generation
- [ ] Mobile responsive design

### Test Data
Use the following test scenarios:

**Scenario 1: Below Threshold (No Payout)**
- Goal: 100
- Actual: 50
- Attainment: 50%
- Expected Payout: $0

**Scenario 2: At Threshold (Minimum Payout)**
- Goal: 100
- Actual: 75
- Attainment: 75%
- Expected Payout: 75% of BucketMax

**Scenario 3: Above 100% (Normal Payout)**
- Goal: 100
- Actual: 110
- Attainment: 110%
- Expected Payout: 110% of BucketMax

**Scenario 4: Above Cap (Capped Payout)**
- Goal: 100
- Actual: 150
- Attainment: 150% → Capped to 125%
- Expected Payout: 125% of BucketMax

## Deployment Checklist

- [ ] Environment variables configured
- [ ] Firebase project created
- [ ] Firestore rules deployed
- [ ] Firestore indexes deployed
- [ ] Initial settings document created
- [ ] Admin users configured
- [ ] Copper API credentials added
- [ ] Build successful (`npm run build`)
- [ ] Hosting deployed (`firebase deploy`)
- [ ] Authentication enabled
- [ ] Test admin login
- [ ] Test rep login
- [ ] Verify calculations
- [ ] Test Copper integration (if applicable)

## Maintenance

### Regular Tasks
- Monitor Firestore usage (reads/writes)
- Review error logs in Firebase Console
- Update dependencies monthly
- Backup Firestore data weekly
- Review and update Copper API mappings

### Quarterly Tasks
- Review commission structure with stakeholders
- Update bucket weights if needed
- Add/remove products and activities
- Archive old quarter data
- Generate annual reports

## Support Resources

- **Firebase Docs**: https://firebase.google.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **Copper API Docs**: https://developer.copper.com
- **Tailwind CSS**: https://tailwindcss.com/docs
- **TypeScript**: https://www.typescriptlang.org/docs

## Contact

For technical issues or questions, contact the development team.

---

**Last Updated**: 2025-01-07
**Version**: 1.0.0
