# Quarterly Bonus System - Fix & Validation Plan

## 🔴 **CRITICAL ISSUES IDENTIFIED**

### 1. **Database Only Shows 2 Entries**
**Problem**: Commission entries aren't being saved properly to Firestore
**Root Cause**: Missing save functionality for commission entries from Database page

### 2. **Team Dashboard Empty**
**Problem**: No data loading on `/team` page
**Root Cause**: Query not finding commission entries or payouts

### 3. **Terminology Confusion**
**Problem**: Using "Commission" for quarterly bonuses
**Fix**: Rename to "Bonus" throughout quarterly system

### 4. **Missing Save for Role-Based Bonus Scales**
**Problem**: Role-based bonus scales in Settings aren't being saved to Firestore
**Root Cause**: No save handler for `roleCommissionScales` state

---

## 📋 **FIX PLAN**

### **Phase 1: Fix Role-Based Bonus Scales Save** ✅
**File**: `app/settings/page.tsx`

**Changes Needed**:
1. Add save handler for `roleCommissionScales`
2. Save to Firestore collection: `settings/bonus_scales`
3. Load bonus scales on page load
4. Update terminology: "Commission" → "Bonus"

**Firestore Structure**:
```javascript
// Collection: settings/bonus_scales
{
  scales: [
    {
      role: "Sr. Account Executive",
      percentageOfMax: 100,
      maxBonus: 25000
    },
    {
      role: "Account Executive",
      percentageOfMax: 85,
      maxBonus: 21250
    },
    {
      role: "Jr. Account Executive",
      percentageOfMax: 70,
      maxBonus: 17500
    },
    {
      role: "Account Manager",
      percentageOfMax: 60,
      maxBonus: 15000
    }
  ],
  updatedAt: timestamp,
  updatedBy: userId
}
```

---

### **Phase 2: Fix Commission Entry Save** ✅
**File**: `app/database/page.tsx`

**Changes Needed**:
1. Ensure "Add Quarter" button saves entries properly
2. Validate all required fields before save
3. Add proper error handling
4. Show success/error toasts

**Required Fields**:
- `quarterId` (e.g., "Q4-2025")
- `repId` (user ID)
- `repName` (from user profile)
- `bucketCode` ("A", "B", "C", "D")
- `subGoalLabel` (optional)
- `goalValue` (number)
- `actualValue` (number)
- `attainment` (calculated: actualValue / goalValue)
- `bucketMax` (from config)
- `payout` (calculated based on attainment)
- `notes` (optional)
- `createdAt` (timestamp)
- `updatedAt` (timestamp)

---

### **Phase 3: Fix Team Dashboard** ✅
**File**: `app/team/page.tsx`

**Changes Needed**:
1. Query `commission_entries` collection properly
2. Query `commission_payouts` collection for summaries
3. Calculate team stats from entries
4. Display leaderboard

**Queries Needed**:
```javascript
// Get all entries for quarter
const entriesQuery = query(
  collection(db, 'commission_entries'),
  where('quarterId', '==', selectedQuarter)
);

// Get all payouts for quarter
const payoutsQuery = query(
  collection(db, 'commission_payouts'),
  where('quarterId', '==', selectedQuarter)
);
```

---

### **Phase 4: Update Terminology** ✅
**Files to Update**:
- `app/settings/page.tsx` - "Quarterly Bonus" tab
- `app/database/page.tsx` - "Bonus Database"
- `app/reports/page.tsx` - "Quarterly Bonuses" tab
- `app/team/page.tsx` - "Team Bonus Performance"

**Changes**:
- "Commission Buckets" → "Bonus Buckets"
- "Role-Based Commission Scales" → "Role-Based Bonus Scales"
- "Commission Entries" → "Bonus Entries"
- "Commission Payouts" → "Bonus Payouts"
- "Total Commission" → "Total Bonus"

---

## 🗂️ **FIRESTORE COLLECTIONS STRUCTURE**

### **Quarterly Bonus System**:

#### 1. `settings/commission_config`
```javascript
{
  buckets: [
    { code: "A", name: "New Business", weight: 50, hasSubGoals: true },
    { code: "B", name: "Product Mix", weight: 15, hasSubGoals: true },
    { code: "C", name: "Maintain Business", weight: 20, hasSubGoals: false },
    { code: "D", name: "Effort", weight: 15, hasSubGoals: true }
  ],
  maxBonusPerRep: 25000,
  overPerformanceCap: 125,
  minimumAttainment: 75,
  productSubGoals: [...],
  activitySubGoals: [...]
}
```

#### 2. `settings/bonus_scales` (NEW - NEEDS TO BE CREATED)
```javascript
{
  scales: [
    { role: "Sr. Account Executive", percentageOfMax: 100, maxBonus: 25000 },
    { role: "Account Executive", percentageOfMax: 85, maxBonus: 21250 },
    { role: "Jr. Account Executive", percentageOfMax: 70, maxBonus: 17500 },
    { role: "Account Manager", percentageOfMax: 60, maxBonus: 15000 }
  ]
}
```

#### 3. `commission_entries`
```javascript
{
  id: "auto-generated",
  quarterId: "Q4-2025",
  repId: "user123",
  repName: "John Doe",
  bucketCode: "A",
  subGoalLabel: "New Accounts",
  goalValue: 100000,
  actualValue: 85000,
  attainment: 0.85,
  bucketMax: 12500,
  payout: 10625,
  notes: "Great quarter",
  createdAt: timestamp,
  updatedAt: timestamp
}
```

#### 4. `commission_payouts`
```javascript
{
  id: "auto-generated",
  quarterId: "Q4-2025",
  repId: "user123",
  repName: "John Doe",
  totalPayout: 18500,
  bucketPayouts: {
    A: 10625,
    B: 3200,
    C: 2500,
    D: 2175
  },
  avgAttainment: 0.87,
  status: "pending",
  createdAt: timestamp,
  paidAt: null
}
```

---

### **Monthly Commission System**:

#### 5. `settings/commission_rates`
```javascript
{
  rates: [
    {
      id: "ae_dist_new",
      title: "Account Executive",
      segment: "distributor",
      customerStatus: "new",
      commissionPercent: 8.0
    },
    // ... more rates
  ],
  specialRules: {
    repTransfer: {
      flatFee: 500,
      percentFallback: 5.0
    }
  },
  titles: ["Account Executive", "Jr. Account Executive", ...],
  segments: [
    { id: "distributor", name: "Distributor" },
    { id: "wholesale", name: "Wholesale" }
  ]
}
```

#### 6. `monthly_commissions`
```javascript
{
  id: "auto-generated",
  repId: "user123",
  repName: "John Doe",
  salesPerson: "JDoe",
  orderNum: "SO-12345",
  customerId: "CUST-001",
  customerName: "ABC Company",
  customerSegment: "distributor",
  customerStatus: "new",
  orderRevenue: 5000,
  commissionRate: 8.0,
  commissionAmount: 400,
  commissionMonth: "2024-05",
  orderDate: timestamp,
  notes: "New customer",
  createdAt: timestamp
}
```

#### 7. `monthly_commission_summary`
```javascript
{
  id: "auto-generated",
  repId: "user123",
  repName: "John Doe",
  salesPerson: "JDoe",
  month: "2024-05",
  year: 2024,
  totalOrders: 25,
  totalRevenue: 125000,
  totalCommission: 8500,
  paidStatus: "pending",
  calculatedAt: timestamp
}
```

---

## ✅ **VALIDATION CHECKLIST**

### **Settings Page - Quarterly Bonus Tab**:
- [ ] Global settings save properly
- [ ] Role-based bonus scales save to Firestore
- [ ] Bonus buckets save properly
- [ ] Product sub-goals save properly
- [ ] Activity sub-goals save properly
- [ ] All terminology uses "Bonus" not "Commission"

### **Database Page**:
- [ ] Can add new bonus entries
- [ ] Entries save to `commission_entries` collection
- [ ] All required fields are validated
- [ ] Attainment calculates correctly
- [ ] Payout calculates correctly
- [ ] Entries display in table

### **Reports Page - Quarterly Bonuses Tab**:
- [ ] Loads bonus entries for selected quarter
- [ ] Shows bucket performance
- [ ] Shows team rankings (admin)
- [ ] Shows detailed entries
- [ ] Export to Excel works

### **Team Dashboard**:
- [ ] Loads team data for selected quarter
- [ ] Shows total payout
- [ ] Shows avg attainment
- [ ] Shows active reps
- [ ] Shows leaderboard
- [ ] Displays bucket breakdowns

### **Settings Page - Monthly Commissions Tab**:
- [ ] Commission rates save properly
- [ ] Titles can be added/removed
- [ ] Segments configured
- [ ] Special rules save

### **Monthly Reports**:
- [ ] Shows monthly commission summaries
- [ ] Shows detailed orders
- [ ] Filters by month and rep
- [ ] Export to CSV works

---

## 🚀 **IMPLEMENTATION ORDER**

1. **Fix Role-Based Bonus Scales Save** (30 min)
   - Add save handler in Settings page
   - Create Firestore document structure
   - Load on page mount

2. **Fix Commission Entry Save** (20 min)
   - Validate Database page save function
   - Add error handling
   - Test with multiple entries

3. **Fix Team Dashboard** (30 min)
   - Update queries
   - Calculate stats from entries
   - Display leaderboard

4. **Update Terminology** (20 min)
   - Find/replace "Commission" → "Bonus" in quarterly context
   - Update UI labels
   - Update documentation

5. **Full System Test** (30 min)
   - Create test quarter
   - Add bonus entries for multiple reps
   - Verify calculations
   - Check all dashboards

**Total Estimated Time**: 2.5 hours

---

## 📝 **NEXT STEPS**

1. Start with Phase 1 - Fix the role-based bonus scales save
2. Then Phase 2 - Ensure commission entries save properly
3. Then Phase 3 - Fix team dashboard queries
4. Finally Phase 4 - Update all terminology

**Let's start with Phase 1!** 🎯
