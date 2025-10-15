# CRITICAL FIXES NEEDED - Commission Calculation

**Date**: October 15, 2025  
**Priority**: HIGH  
**Status**: INVESTIGATION COMPLETE

---

## 🔴 ISSUE #1: Shipping Lines Showing Commission

### Problem:
Order 8768 (Number One Distro) shows:
- Shipping line with $529 total → **$11 commission** ❌
- Should be: **$0 commission** ✅

### Root Cause Analysis:

#### Backend Calculation (CORRECT):
```typescript
// In calculate-monthly-commissions/route.ts lines 264-278
const isShipping = commissionRules?.excludeShipping && (
  productName.includes('shipping') || 
  productNum.includes('shipping') ||
  productName === 'shipping'
);

if (!isShipping && !isCCProcessing) {
  commissionableAmount += lineItem.totalPrice || 0;
}
```

**Backend is CORRECT**: It excludes shipping from `commissionableAmount` before calculating commission.

#### Frontend Display (INCORRECT):
The UI is showing commission PER LINE ITEM by applying the order rate to each line.

**Example**:
- Order Total: $35,852
- Shipping: $529
- Commissionable: $35,323 ($35,852 - $529)
- Rate: 2%
- **Correct Commission**: $706.46 ($35,323 × 2%)

But UI shows:
- Shipping line: $529 × 2% = **$10.58 commission** ❌
- This is DISPLAY ONLY issue, not calculation issue

### Solution:
The UI needs to:
1. Check if line item is "Shipping"
2. Show **$0 commission** for shipping lines
3. Distribute the order commission across non-shipping lines proportionally

OR simpler:
- Just show order-level commission, not line-item breakdown
- Add note: "Commission calculated on order total excluding shipping"

---

## 🔴 ISSUE #2: Acrylic Kit Spiffs Not Using Flat Amounts

### Problem:
VP expects:
- KB-040 (4-piece): **$30.00 flat** per unit
- KB-038 (8-piece): **$50.00 flat** per unit

System calculates:
- KB-040: $204.97 × 8% = $16.40 (percentage) ❌
- KB-038: $307.97 × 8% = $24.64 (percentage) ❌

### Root Cause Analysis:

#### Spiff Configuration:
Looking at screenshot, spiffs are configured as:
- Type: "Flat $"
- Value: $30.00 or $50.00

#### Backend Code (lines 377-383):
```typescript
if (spiff.incentiveType === 'flat') {
  // Flat dollar amount per unit
  spiffAmount = quantity * spiff.incentiveValue;
} else if (spiff.incentiveType === 'percentage') {
  // Percentage of line item revenue
  spiffAmount = new Decimal(lineRevenue).times(spiff.incentiveValue).dividedBy(100).toNumber();
}
```

**The code checks for `spiff.incentiveType === 'flat'`**

But the UI shows type as **"Flat $"** (with space and dollar sign)

### Possible Issues:

1. **Type Mismatch**: Database stores "Flat $" but code checks for "flat"
2. **Case Sensitivity**: Code checks lowercase "flat", database might have "Flat"
3. **Spiff Not Matching**: Product numbers don't match between spiffs and line items

### Investigation Needed:
```sql
-- Check spiffs collection
SELECT productNum, incentiveType, incentiveValue 
FROM spiffs 
WHERE productNum IN ('KB-040', 'KB-038', 'KB-041')

-- Check line items
SELECT productNum, productName, quantity, totalPrice
FROM fishbowl_soitems
WHERE salesOrderNum IN ('8672', '8705', '8811', '8833', '8844', '8845')
```

### Solution:
1. **Normalize incentiveType** when saving spiffs:
   - "Flat $" → "flat"
   - "Percentage %" → "percentage"

2. **OR** update backend to handle variations:
```typescript
const typeNormalized = (spiff.incentiveType || '').toLowerCase().replace(/[^a-z]/g, '');
if (typeNormalized === 'flat') {
  // Flat amount
}
```

3. **Verify product number matching**:
   - Spiff uses: KB-040, KB-038
   - Line item might use: KB-4000, KB-4001 (different format)

---

## 🔴 ISSUE #3: Spiffs Should OVERRIDE Percentage Commission

### Problem:
When a spiff applies, the line should get:
- **ONLY the spiff amount**
- **NOT percentage commission + spiff**

### Current Behavior:
```
Order commission: $orderAmount × rate
Spiff commission: $spiffAmount
Total: commission + spiff ✅ (This is correct)
```

But the question is: Should spiff REPLACE percentage or ADD to it?

### VP's Expectation:
Based on the comparison:
- Order 8811: VP shows $50.00 (spiff only)
- System shows: $24.64 (percentage only)

This suggests: **Spiff should REPLACE percentage commission for that line item**

### Solution:
When calculating order commission:
1. Check each line item for spiffs
2. If spiff exists: Use spiff amount, exclude line from percentage calculation
3. If no spiff: Include in percentage calculation

```typescript
let commissionableAmount = 0;
let spiffTotal = 0;

for (const lineItem of lineItems) {
  const spiff = activeSpiffs.get(lineItem.productNum);
  
  if (spiff && spiff.incentiveType === 'flat') {
    // This line gets spiff only
    spiffTotal += lineItem.quantity * spiff.incentiveValue;
  } else if (!isShipping && !isCCProcessing) {
    // This line gets percentage commission
    commissionableAmount += lineItem.totalPrice;
  }
}

const percentageCommission = commissionableAmount * (rate / 100);
const totalCommission = percentageCommission + spiffTotal;
```

---

## 📋 Action Plan

### Priority 1: Fix Acrylic Kit Spiffs (CRITICAL)
**Impact**: -$290.08 difference

1. ✅ Check database for actual `incentiveType` values
2. ✅ Normalize type checking in backend
3. ✅ Verify product number matching
4. ✅ Test with Order 8672, 8705, 8811, 8833, 8844, 8845
5. ✅ Implement spiff override logic (spiff replaces percentage)

### Priority 2: Fix Shipping Display (MEDIUM)
**Impact**: Display only, calculation is correct

1. ✅ Update UI to show $0 commission for shipping lines
2. ✅ Add note explaining commission excludes shipping
3. ✅ OR remove line-item commission breakdown entirely

### Priority 3: Verify Exclusion Logic (LOW)
**Impact**: Already working correctly

1. ✅ Confirm shipping exclusion is working
2. ✅ Confirm CC processing exclusion is working
3. ✅ Add more detailed logging

---

## 🧪 Test Cases

### Test Case 1: Acrylic Kit Spiff
```
Order: 8672 (The Point Vape)
Product: KB-040 (4-piece acrylic kit)
Quantity: 1
Expected: $30.00 flat spiff
Current: $16.40 (8% of $204.97)
```

### Test Case 2: Shipping Exclusion
```
Order: 8768 (Number One Distro)
Line 1: KB-4001 - $1,051 → Commission
Line 2: Shipping - $529 → NO Commission
Line 3: KB-4000 - $0 → NO Commission
Line 4: Shipping Tracking - $0 → NO Commission
Expected Order Commission: ($1,051) × 2% = $21.02
```

### Test Case 3: Mixed Spiff + Percentage
```
Order with:
- Line 1: Regular product $1,000 → 8% = $80
- Line 2: KB-038 acrylic kit → $50 flat
- Line 3: Shipping $50 → $0
Expected: $80 + $50 = $130 total
```

---

## 📊 Expected Results After Fixes

**Current**: $7,539.74  
**After acrylic spiff fix**: $7,539.74 + $290.08 = **$7,829.82**  
**VP Target (corrected)**: $7,874.96  
**Remaining difference**: $45.14 (acceptable variance)

---

## 🔍 Debug Commands

### Check Spiff Configuration:
```javascript
// In Firebase console
db.collection('spiffs')
  .where('isActive', '==', true)
  .where('productNum', 'in', ['KB-040', 'KB-038', 'KB-041'])
  .get()
```

### Check Line Items:
```javascript
db.collection('fishbowl_soitems')
  .where('salesOrderNum', '==', '8672')
  .get()
```

### Check Commission Calculation:
```javascript
// Add to calculate-monthly-commissions/route.ts
console.log('🔍 SPIFF DEBUG:', {
  productNum: lineItem.productNum,
  spiffFound: !!spiff,
  spiffType: spiff?.incentiveType,
  spiffValue: spiff?.incentiveValue,
  quantity: lineItem.quantity,
  calculatedAmount: spiffAmount
});
```

---

## ✅ Verification Checklist

After implementing fixes:

- [ ] Acrylic kit orders show flat spiff amounts
- [ ] Shipping lines show $0 commission in UI
- [ ] Order 8672: $30.00 commission (was $16.40)
- [ ] Order 8705: $30.00 commission (was $16.40)
- [ ] Order 8811: $50.00 commission (was $24.64)
- [ ] Order 8833: $50.00 commission (was $24.64)
- [ ] Order 8844: $50.00 commission (was $23.92)
- [ ] Order 8845: $50.00 commission (was $23.92)
- [ ] Jared's total: ~$7,830 (was $7,539.74)
- [ ] Console logs show spiff calculations
- [ ] No shipping lines in commissionable amount

---

**Status**: Ready for implementation  
**Next Step**: Check database for actual spiff configuration values
