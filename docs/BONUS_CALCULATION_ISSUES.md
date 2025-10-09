# Bonus Calculation Issues & Fixes Needed

## Current Status
✅ API successfully queries reps collection
✅ Loops through all active reps
✅ Creates entries for Bucket A and C
❌ Actual values show $0 (not querying Fishbowl data correctly)
❌ Bucket B (Product Mix) entries not showing
❌ Bucket D (Effort) entries not created

---

## Issue 1: Fishbowl Username Mismatch

### Problem:
The `reps` collection needs a `fishbowlUsername` field that matches the `salesPerson` field in Fishbowl data.

### Current Behavior:
- API gets: `repData?.fishbowlUsername || repData?.name`
- Falls back to rep name like "Jared", "Ben Wallner"
- Fishbowl has salesPerson values like: "BenW", "JaredM", "BrandonG", "DerekS", "Commerce", "admin"

### Fix Needed:
Add `fishbowlUsername` field to each rep in `reps` collection:

```javascript
// Example rep document
{
  id: "abc123",
  name: "Ben Wallner",
  email: "ben@kanvabotanicals.com",
  title: "Account Executive",
  active: true,
  fishbowlUsername: "BenW",  // ← ADD THIS FIELD
  startDate: timestamp
}
```

### Mapping (based on your screenshot):
- Jared → "JaredM" or check Fishbowl
- Ben Wallner → "BenW"
- Brandon → "BrandonG"
- Derek → "DerekS"

---

## Issue 2: Bucket B (Product Mix) Not Showing

### Problem:
Bucket B entries ARE being created, but they're sub-goals (one entry per product).

### Current Behavior:
- `saveCommissionResults` creates up to 10 Bucket B entries (one per top product)
- Each has a `subGoalId` and `subGoalLabel`
- They might not be displaying in the table

### Fix Needed:
Check if the Database page table is filtering out sub-goal entries or not displaying them properly.

---

## Issue 3: Bucket D (Effort) Not Created

### Problem:
`saveCommissionResults` function doesn't create Bucket D entries at all.

### Current Code:
```typescript
// Saves A, C, and B
// But NO Bucket D!
```

### Fix Needed:
Add Bucket D calculation and save logic:

```typescript
// After Bucket B, add:

// Save Bucket D (Effort/Activities)
// Query activities collection for this rep and quarter
const activitiesSnapshot = await db
  .collection('activities')
  .where('repId', '==', userId)
  .where('quarterId', '==', quarterId)
  .get();

const activities = activitiesSnapshot.docs.map(doc => doc.data());

// Group by activity type and calculate totals
const activityTypes = new Set(activities.map(a => a.activityType));

activityTypes.forEach((activityType) => {
  const typeActivities = activities.filter(a => a.activityType === activityType);
  const totalCount = typeActivities.reduce((sum, a) => sum + (a.count || 1), 0);
  
  // Get goal from config
  const activityGoal = config?.activityGoals?.find((g: any) => g.type === activityType);
  const goalValue = activityGoal?.target || 0;
  
  const bucketDId = `${userId}_D_${activityType}_${quarterId}`;
  batch.set(db.collection('commission_entries').doc(bucketDId), {
    id: bucketDId,
    quarterId,
    repId: userId,
    bucketCode: 'D',
    subGoalId: activityType,
    subGoalLabel: activityGoal?.name || activityType,
    goalValue: goalValue,
    actualValue: totalCount,
    notes: `${totalCount} ${activityType} activities completed`,
    updatedAt: timestamp,
    calculatedAt: timestamp,
  }, { merge: true });
});
```

---

## Issue 4: Goal Values Showing $0

### Problem:
The `budgets` configuration in `settings/commission_config` might not exist or be structured incorrectly.

### Current Code:
```typescript
const budgetConfig = config?.budgets?.find((b: any) => b.title === repTitle);
const bucketAGoal = budgetConfig?.bucketA || 0;
```

### Fix Needed:
Check `settings/commission_config` document structure. Should have:

```javascript
{
  buckets: [...],
  maxBonusPerRep: 25000,
  budgets: [
    {
      title: "Sr. Account Executive",
      bucketA: 500000,  // New Business goal
      bucketB: 100000,  // Product Mix goal
      bucketC: 300000,  // Maintain Business goal
      bucketD: 50       // Activities goal (count)
    },
    {
      title: "Account Executive",
      bucketA: 400000,
      bucketB: 80000,
      bucketC: 250000,
      bucketD: 40
    },
    // ... more titles
  ]
}
```

---

## Recommended Fix Order:

1. **Add `fishbowlUsername` to all reps** (5 min)
   - Go to Firestore console
   - Update each rep document
   - Add field matching their Fishbowl salesPerson value

2. **Verify Settings/commission_config has budgets** (2 min)
   - Check if `budgets` array exists
   - Verify structure matches above

3. **Add Bucket D save logic** (10 min)
   - Update `saveCommissionResults` function
   - Add activities query and save

4. **Test Calculate Bonuses** (5 min)
   - Should now populate all 4 buckets
   - Should show actual values from Fishbowl

---

## Quick Test Query:

To verify Fishbowl data is accessible:

```javascript
// In Firestore console, run query:
fishbowl_soitems
  .where('salesPerson', '==', 'BenW')
  .where('commissionDate', '>=', '2025-10-01')
  .where('commissionDate', '<=', '2025-12-31')
```

Should return line items for Ben's Q4 2025 sales.

---

## Next Steps:

**PRIORITY 1**: Add `fishbowlUsername` field to reps
**PRIORITY 2**: Test one rep to verify data flows
**PRIORITY 3**: Add Bucket D logic
**PRIORITY 4**: Verify all buckets populate correctly
