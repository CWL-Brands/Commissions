# Settings Page - Goal Values Implementation Plan

## Current State
Settings page has:
- ✅ Commission Buckets (A, B, C, D with weights)
- ✅ Product Mix Sub-Goals (Bucket B)
- ✅ Effort Sub-Goals (Bucket D)
- ✅ Sales Team Roster
- ❌ **Missing: Actual goal values per bucket per title**

## What We Need to Add

### New Section: "Quarterly Goals by Title"

This section will appear AFTER the Sales Team Roster and define goal values for each title.

```
┌─────────────────────────────────────────────────────────────┐
│ Quarterly Goals by Title                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Title: [Account Executive ▼]                                │
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Bucket A - New Business                                  ││
│ │ Goal: $ [200,000]                                        ││
│ │ Description: Revenue from NEW customers in quarter       ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Bucket B - Product Mix                                   ││
│ │ Goals defined in Product Mix Sub-Goals section above     ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Bucket C - Maintain Business                             ││
│ │ Goal: $ [500,000]                                        ││
│ │ Description: Revenue from EXISTING customers in quarter  ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌──────────────────────────────────────────────────────────┐│
│ │ Bucket D - Effort                                        ││
│ │ Goals defined in Effort Sub-Goals section above          ││
│ └──────────────────────────────────────────────────────────┘│
│                                                              │
│                                    [Save Goals]              │
└─────────────────────────────────────────────────────────────┘
```

## Firestore Structure Update

### Current: `settings/commission_config`
```javascript
{
  buckets: [...],
  budgets: [
    {
      title: "Account Executive",
      bucketA: 25000,  // Max payout
      bucketB: 125000, // Max payout
      bucketC: 75000,  // Max payout
    }
  ]
}
```

### New: `settings/commission_config`
```javascript
{
  buckets: [...],
  budgets: [...], // Keep existing (these are MAX PAYOUTS)
  
  // NEW: Actual performance goals
  goals: [
    {
      title: "Account Executive",
      bucketA: {
        goalValue: 200000,
        metric: "newCustomerRevenue",
        description: "Revenue from NEW customers"
      },
      bucketB: {
        // Goals come from products collection
        useSubGoals: true
      },
      bucketC: {
        goalValue: 500000,
        metric: "existingCustomerRevenue",
        description: "Revenue from EXISTING customers"
      },
      bucketD: {
        // Goals come from activities collection
        useSubGoals: true
      }
    },
    {
      title: "Jr. Account Executive",
      bucketA: {
        goalValue: 100000,
        metric: "newCustomerRevenue",
        description: "Revenue from NEW customers"
      },
      bucketC: {
        goalValue: 300000,
        metric: "existingCustomerRevenue",
        description: "Revenue from EXISTING customers"
      }
    }
  ]
}
```

## How It Connects

### 1. Settings Page (Admin Setup)
```
Admin sets:
- Account Executive Bucket A Goal: $200,000
- Account Executive Bucket C Goal: $500,000
- Jr. AE Bucket A Goal: $100,000
- Jr. AE Bucket C Goal: $300,000
```

### 2. Calculate Commissions (Auto-Population)
```javascript
// When Calculate Commissions runs:
1. Get user's title from reps collection
2. Fetch goals from settings/commission_config based on title
3. Create commission_entries with:
   - goalValue: from settings (e.g., $200,000 for AE Bucket A)
   - actualValue: from Fishbowl data (e.g., $35,087 actual)
   - attainment: actualValue / goalValue (e.g., 17.5%)
   - payout: calculated based on attainment
```

### 3. Database Page (View/Edit)
```
Shows pre-filled entries:
- Goal Value: $200,000 (from Settings, admin can adjust)
- Actual Value: $35,087 (from Fishbowl, read-only)
- Attainment: 17.5% (calculated, read-only)
- Payout: $4,375 (calculated, read-only)
```

### 4. Reports Page (Analytics)
```
Aggregates commission_entries:
- Shows attainment vs goals
- Compares across reps
- All data comes from commission_entries
- Goals originally from Settings
```

## Implementation Steps

1. ✅ Add `goals` array to commission_config Firestore structure
2. ✅ Add "Quarterly Goals by Title" section to Settings page UI
3. ✅ Update `saveCommissionResults()` to fetch goals from Settings
4. ✅ Update Database page to show goal values
5. ✅ Update Reports page to use goal values

## Benefits

- ✅ Single source of truth (Settings page)
- ✅ No manual data entry on Database page
- ✅ Goals automatically applied when Calculate runs
- ✅ Easy to adjust goals per title
- ✅ Everything connected and automated

## Next Steps

Would you like me to:
1. Implement the UI for "Quarterly Goals by Title" section?
2. Update the commission calculator to use these goals?
3. Both?

Let me know and I'll build it out!
