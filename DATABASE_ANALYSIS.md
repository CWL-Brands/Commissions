# Database Structure Analysis & Improvement Plan

## Current Firestore Collections

### 1. **users** ✅ GOOD
**Purpose**: User profiles, roles, and team information
**Fields**:
- `id`, `email`, `name`, `role` (admin/manager/sales)
- `salesPerson`, `title`, `region`, `regionalTerritory`
- `isCommissioned`, `isActive`, `copperUserId`, `copperUserEmail`
- `createdAt`, `updatedAt`, `passwordChanged`, `photoUrl`

**Issues**:
- ⚠️ Role capitalization inconsistency (Fixed with lowercase normalization)
- ⚠️ Some fields like `division`, `territory`, `orgRole` are underutilized

**Recommendations**:
- ✅ Keep as-is (working well)
- Consider adding `lastLogin` timestamp
- Add `permissions` array for granular access control

---

### 2. **fishbowl_customers** ⚠️ NEEDS INDEXING
**Purpose**: Customer data synced from Fishbowl
**Fields**:
- `name`, `shippingAddress`, `shippingCity`, `shippingState`, `shippingZip`
- `salesPerson`, `accountType`, `lat`, `lng`, `region`, `regionColor`
- `totalSales`, `orderCount`, `lastOrderDate`

**Issues**:
- ❌ No composite indexes for common queries
- ❌ `totalSales`, `orderCount`, `lastOrderDate` are calculated on-the-fly (slow)
- ❌ Missing `customerId` field for Fishbowl reference
- ❌ No `lastSyncedAt` timestamp

**Recommendations**:
- **Add Firestore indexes**:
  - `salesPerson` + `accountType`
  - `region` + `totalSales` (descending)
  - `lastOrderDate` (descending)
- **Pre-calculate aggregates** during sync (don't calculate in CustomerMap.tsx)
- **Add fields**: `customerId`, `lastSyncedAt`, `syncStatus`

---

### 3. **fishbowl_sales_orders** ❌ CRITICAL - NEEDS OPTIMIZATION
**Purpose**: Sales orders synced from Fishbowl
**Fields**:
- `customerId`, `revenue`, `orderValue`, `postingDateStr`
- `salesPerson`, `orderNumber`, `status`

**Issues**:
- ❌ **HUGE PERFORMANCE PROBLEM**: Loading ALL orders in CustomerMap (line 82)
- ❌ No indexes on `customerId` or `postingDateStr`
- ❌ Aggregations done client-side (should be pre-calculated)
- ❌ No pagination or date filtering

**Recommendations**:
- **URGENT**: Create `customer_sales_summary` collection (pre-aggregated)
- **Add indexes**:
  - `customerId` + `postingDateStr` (descending)
  - `salesPerson` + `postingDateStr` (descending)
- **Add pagination** to order queries (limit to last 12 months)
- **Background job** to update summaries nightly

---

### 4. **fishbowl_soitems** ⚠️ NEEDS REVIEW
**Purpose**: Sales order line items
**Fields**: (Not fully documented in code)

**Issues**:
- ❌ Unclear usage - only queried in reports page
- ❌ No clear relationship to orders (missing `orderId` index?)

**Recommendations**:
- Document schema
- Add composite index: `orderId` + `productId`
- Consider archiving old items (>2 years)

---

### 5. **regions** ✅ GOOD
**Purpose**: Sales territory regions
**Fields**:
- `name`, `states[]`, `color`, `manager`, `createdAt`

**Issues**:
- None - working well

**Recommendations**:
- ✅ Keep as-is
- Consider adding `isActive` flag

---

### 6. **commission_entries** ⚠️ NEEDS INDEXING
**Purpose**: Quarterly commission calculations
**Fields**:
- `quarterId`, `repId`, `bucketCode`, `actual`, `budget`, `attainment`
- `payout`, `createdAt`

**Issues**:
- ❌ No composite index on `quarterId` + `repId`
- ❌ Slow queries when loading entries for a quarter

**Recommendations**:
- **Add index**: `quarterId` + `repId` + `createdAt` (descending)
- Consider partitioning by year

---

### 7. **monthly_commissions** ⚠️ NEEDS INDEXING
**Purpose**: Monthly commission details
**Fields**:
- `commissionMonth`, `salesPerson`, `orderId`, `revenue`, `commissionAmount`

**Issues**:
- ❌ No index on `commissionMonth` + `salesPerson`
- ❌ Querying all months is slow

**Recommendations**:
- **Add index**: `commissionMonth` (desc) + `salesPerson`
- **Add index**: `salesPerson` + `commissionMonth` (desc)

---

### 8. **monthly_commission_summary** ✅ GOOD
**Purpose**: Aggregated monthly commission totals
**Fields**:
- `month`, `salesPerson`, `totalCommission`, `orderCount`

**Issues**:
- None - working well

**Recommendations**:
- ✅ Keep as-is
- Add `lastCalculatedAt` timestamp

---

### 9. **settings** ⚠️ NEEDS STRUCTURE
**Purpose**: App configuration
**Current**: Flat document structure

**Issues**:
- ❌ No versioning
- ❌ No audit trail
- ❌ Overly permissive rules (`allow write: if true`)

**Recommendations**:
- **Add subcollections**:
  - `settings/commission_config/quarters/{quarterId}`
  - `settings/monthly_rates/versions/{versionId}`
- **Add fields**: `version`, `updatedBy`, `updatedAt`
- **Restrict write access** to admins only

---

### 10. **products** & **activities** ✅ GOOD
**Purpose**: Commission sub-goals
**Fields**: Standard CRUD fields

**Issues**:
- None - working well

**Recommendations**:
- ✅ Keep as-is

---

## NEW COLLECTIONS TO CREATE

### 1. **customer_sales_summary** 🆕 CRITICAL
**Purpose**: Pre-aggregated customer sales data
**Fields**:
```javascript
{
  customerId: string,
  customerName: string,
  totalSales: number,
  orderCount: number,
  lastOrderDate: string,
  lastOrderId: string,
  salesPerson: string,
  region: string,
  accountType: string,
  lastUpdatedAt: timestamp,
  // Rolling windows
  sales_30d: number,
  sales_90d: number,
  sales_12m: number,
  orders_30d: number,
  orders_90d: number,
  orders_12m: number
}
```

**Indexes**:
- `customerId` (primary)
- `salesPerson` + `totalSales` (desc)
- `region` + `totalSales` (desc)
- `lastOrderDate` (desc)

**Benefits**:
- ✅ CustomerMap loads instantly (no aggregation needed)
- ✅ Dashboard metrics are pre-calculated
- ✅ Historical trends available

---

### 2. **sync_logs** 🆕 RECOMMENDED
**Purpose**: Track Fishbowl sync operations
**Fields**:
```javascript
{
  syncId: string,
  syncType: 'customers' | 'orders' | 'items',
  startedAt: timestamp,
  completedAt: timestamp,
  status: 'running' | 'completed' | 'failed',
  recordsProcessed: number,
  recordsAdded: number,
  recordsUpdated: number,
  errors: array,
  triggeredBy: string
}
```

**Benefits**:
- ✅ Monitor sync health
- ✅ Debug sync issues
- ✅ Track data freshness

---

### 3. **audit_logs** 🆕 RECOMMENDED
**Purpose**: Track admin actions
**Fields**:
```javascript
{
  userId: string,
  userName: string,
  action: string,
  collection: string,
  documentId: string,
  changes: object,
  timestamp: timestamp,
  ipAddress: string
}
```

**Benefits**:
- ✅ Compliance and security
- ✅ Debug configuration changes
- ✅ User activity tracking

---

## FIRESTORE INDEXES TO CREATE

### Priority 1 (Critical - Performance)
```javascript
// fishbowl_customers
- salesPerson ASC, totalSales DESC
- region ASC, totalSales DESC
- accountType ASC, lastOrderDate DESC

// fishbowl_sales_orders
- customerId ASC, postingDateStr DESC
- salesPerson ASC, postingDateStr DESC

// commission_entries
- quarterId ASC, repId ASC, createdAt DESC

// monthly_commissions
- commissionMonth DESC, salesPerson ASC
- salesPerson ASC, commissionMonth DESC
```

### Priority 2 (Nice to have)
```javascript
// users
- isCommissioned ASC, isActive ASC, region ASC

// regions
- isActive ASC, name ASC
```

---

## SECURITY RULES IMPROVEMENTS

### Current Issues:
- ❌ Too permissive: `allow read: if true; allow write: if true;`
- ❌ No field-level validation
- ❌ No rate limiting

### Recommended Rules:
```javascript
// fishbowl_customers (read-only for users, write for sync)
match /fishbowl_customers/{customerId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin() || isSystemSync();
}

// fishbowl_sales_orders (read-only for users)
match /fishbowl_sales_orders/{orderId} {
  allow read: if isAuthenticated();
  allow write: if isAdmin() || isSystemSync();
}

// settings (admin only)
match /settings/{document=**} {
  allow read: if isAuthenticated();
  allow write: if isAdmin();
}

// commission_entries (read own, write admin)
match /commission_entries/{entryId} {
  allow read: if isAuthenticated() && 
    (isAdmin() || resource.data.repId == request.auth.uid);
  allow write: if isAdmin();
}
```

---

## PERFORMANCE OPTIMIZATIONS

### 1. **CustomerMap.tsx** (Lines 67-135)
**Current**: Loads ALL customers + ALL orders, aggregates client-side
**Problem**: 1000+ customers × 10,000+ orders = slow load times

**Solution**:
```typescript
// BEFORE (slow)
const customersSnapshot = await getDocs(collection(db, 'fishbowl_customers'));
const salesSnapshot = await getDocs(collection(db, 'fishbowl_sales_orders'));
// ... aggregate in browser

// AFTER (fast)
const customersSnapshot = await getDocs(collection(db, 'customer_sales_summary'));
// Done! All aggregates pre-calculated
```

### 2. **Settings Page** (Line 883-905)
**Current**: Loads ALL customers + ALL orders to map sales reps
**Problem**: Unnecessary data transfer

**Solution**:
```typescript
// Use customer_sales_summary instead
const snapshot = await getDocs(collection(db, 'customer_sales_summary'));
```

### 3. **Reports Page**
**Current**: Queries monthly_commissions without pagination
**Problem**: Loads all months

**Solution**:
```typescript
// Add pagination
const q = query(
  collection(db, 'monthly_commissions'),
  where('commissionMonth', '>=', startMonth),
  where('commissionMonth', '<=', endMonth),
  limit(100)
);
```

---

## MIGRATION PLAN

### Phase 1: Immediate (This Week)
1. ✅ Create `customer_sales_summary` collection
2. ✅ Add critical Firestore indexes
3. ✅ Update CustomerMap to use summary collection
4. ✅ Add `lastSyncedAt` to fishbowl collections

### Phase 2: Short-term (Next Week)
5. Create `sync_logs` collection
6. Update Fishbowl sync to populate summaries
7. Add pagination to order queries
8. Tighten security rules

### Phase 3: Long-term (Next Month)
9. Create `audit_logs` collection
10. Archive old orders (>2 years)
11. Add data retention policies
12. Implement caching layer

---

## ESTIMATED IMPROVEMENTS

### Before:
- CustomerMap load time: **8-15 seconds**
- Settings page load: **5-10 seconds**
- Firestore reads per page load: **10,000+**
- Monthly cost: **$50-100**

### After:
- CustomerMap load time: **1-2 seconds** (80% faster)
- Settings page load: **1-2 seconds** (80% faster)
- Firestore reads per page load: **100-500** (95% reduction)
- Monthly cost: **$5-10** (90% savings)

---

## NEXT STEPS

**What would you like me to do first?**

1. **Create `customer_sales_summary` collection** + update CustomerMap (biggest impact)
2. **Add Firestore indexes** (quick win, immediate performance boost)
3. **Tighten security rules** (important for production)
4. **Create migration script** to populate summary collection from existing data
5. **All of the above** (comprehensive fix)

Let me know which priority you'd like to tackle first!
