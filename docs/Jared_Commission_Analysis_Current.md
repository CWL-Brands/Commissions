# Jared Leuzinger Commission Analysis - Current Results

**Date**: October 15, 2025  
**Month**: September 2025  
**Current System Total**: $7,539.74  
**VP Target**: $9,304.51  
**Difference**: -$1,764.77 (System is LOW)

---

## Key Changes Applied

### ✅ 1. Dormant Account Reactivation Fixed
- Changed from treating dormant accounts as NEW (8%)
- Now uses customer age from first order
- 12+ month old customers get appropriate rate (4% Wholesale / 2% Distributor)

### ✅ 2. Nimbus Wholesale Corrected
- Changed from Wholesale (4%) to Distributor (2%)
- Order 8843: Now calculates at 2% instead of 4%
- **Impact**: -$678.59

---

## Current Calculation Results (from Terminal)

### Orders Visible in Terminal:
1. **Order 8768** - Number One Distro: $35,852.20 × 2% = $717.04
2. **Order 8775** - ISmoke Cigars: $32,578.50 × 2% = $651.57
3. **Order 8843** - Nimbus Wholesale: $34,614.72 × 2% = $692.29 ✅ (Fixed!)
4. **Order 8844** - Mr. Zip #607: $299 × 8% = $23.92
5. **Order 8845** - Mr. Zip #603: $299 × 8% = $23.92
6. **Order 8871** - Los Dos Barbones: $34,786 × 8% = $2,782.88
7. **Order 8811** - Smoke & Eve: $307.97 × 8% = $24.64
8. **Order 8813** - A Vape Escape: $381 × 8% = $30.48
9. **Order 8833** - Smoker's Gallery: $307.97 × 8% = $24.64
10. **Order 8672** - The Point Vape: (Acrylic Kit - amount not shown)
11. **Order 8673** - White Cloud: (amount not shown)
12. **Order 8705** - 505 Vape World: (Acrylic Kit - amount not shown)
13. **Order 8926** - 505 Vape World: (amount not shown)
14. **Order 9043** - Toke N Smoke: (amount not shown)
15. **Order 9044** - 505 Vape World: (amount not shown)
16. **Order 9050** - Drew's Tobacco World: $66.95 × 2% = $1.34
17. **Order 8939** - (customer not shown)
18. **Order 8963** - Majestic Distribution: $12,790.54 × 8% = $1,023.24
19. **Order 8971** - Pioneer Wholesale: $17,734.20 × 2% = $354.68
20. **Order 8989** - Lucky Stop: (amount not shown)
21. **Order 8913** - 24 Stop Smokeshop: $980.56 × 8% = $78.44

### 🔴 MISSING ORDER:
**Order 8964 - Sky High Distribution**: **NOT IN OUTPUT**
- VP Shows: $37,548 × 4% = $1,501.92
- System Shows: **NOTHING** (order not processed)
- **This is the $1,501.92 difference!**

---

## Why is Order 8964 Missing?

### Possible Reasons:

1. **Wrong Sales Rep Assignment**
   - Order might be assigned to different rep in Fishbowl
   - Check: `salesPerson` field in `fishbowl_sales_orders`

2. **Wrong Month**
   - Order might be in different commission month
   - Check: `commissionMonth` field

3. **Customer Segment Issue**
   - Customer might be marked as Retail (skipped)
   - Check: Customer #417 (Sky High Distribution) account type

4. **Order Status**
   - Order might be cancelled or voided
   - Check: Order status in Fishbowl

5. **Dormant Logic Issue**
   - Our fix might be excluding it somehow
   - Check: Customer #417 first order date and last order date

---

## Comparison: VP vs System

### VP's Calculation ($9,304.51):
```
Order 8768: $706.46
Order 8775: $645.12
Order 8843: $1,370.88 (4% Wholesale - but we corrected to 2% Distributor)
Order 8844: $50.00 (Acrylic Kit flat)
Order 8845: $50.00 (Acrylic Kit flat)
Order 8871: $2,741.76
Order 8811: $50.00 (Acrylic Kit flat)
Order 8813: $28.80
Order 8833: $50.00 (Acrylic Kit flat)
Order 8672: $30.00 (Acrylic Kit flat)
Order 8673: $28.80
Order 8705: $30.00 (Acrylic Kit flat)
Order 8926: $19.20
Order 9043: $28.80
Order 9044: $28.80
Order 9050: $2.40
Order 8939: $184.32
Order 8963: $978.24 ($1,002.24 - $24 FB_DISCOUNT)
Order 8964: $1,501.92 ⚠️ MISSING FROM SYSTEM
Order 8971: $350.78
Order 8989: $28.80
Order 8913: $72.96
Order 9011 (IdaGo): $160.00 (Acrylic Kits)
```

### System's Calculation ($7,539.74):
- Missing Order 8964: -$1,501.92
- Nimbus corrected (8843): -$678.59 (from $1,370.88 to $692.29)
- Acrylic kits using percentage instead of flat: -$200 (estimated)
- Revenue mismatches: ~$100
- FB_DISCOUNT not applied (8963): +$24

**Math Check**:
```
VP Target: $9,304.51
- Order 8964 missing: -$1,501.92
- Nimbus correction: -$678.59
- Acrylic spiffs: -$200
- Other differences: ~$100
= ~$6,924 (but we got $7,539.74)
```

**Discrepancy**: We're getting $7,539.74 instead of expected ~$6,924

This suggests:
1. Order 8964 might actually be included but at wrong rate
2. OR other orders are calculating higher than expected
3. OR revenue amounts are different

---

## Next Steps to Debug

### 1. Check Order 8964 in Database
```sql
SELECT * FROM fishbowl_sales_orders 
WHERE orderNum = '8964' OR num = '8964'
```

Check:
- `salesPerson` field (should be "Jared" or "JaredM")
- `commissionMonth` (should be "2025-09")
- `customerId` (should be 417)
- `revenue` or `orderValue`

### 2. Check Customer 417 (Sky High Distribution)
```sql
SELECT * FROM customers WHERE id = '417'
```

Check:
- `accountType` (should be "Wholesale" or "Distributor")
- `transferStatus`
- `salesRep`

### 3. Check First/Last Order Dates
```sql
SELECT MIN(postingDate), MAX(postingDate) 
FROM fishbowl_sales_orders 
WHERE customerId = '417'
```

Expected:
- First order: ~2024-02-27 (19 months ago)
- Last order before 8964: 2024-02-27
- Order 8964 date: 2025-09-23

### 4. Add Debug Logging
Add console.log for Order 8964 specifically to see if it's being processed and why it might be skipped.

---

## Summary

**Current Status**: System is $1,764.77 LOW

**Main Issue**: Order 8964 (Sky High Distribution, $1,501.92) is not appearing in the calculation output.

**Secondary Issues**:
1. Acrylic kit spiffs not using flat amounts (~$200)
2. Revenue mismatches (~$100)
3. FB_DISCOUNT not applied to Order 8963 ($24)

**Priority**: Find and fix Order 8964 - this is 85% of the remaining difference!
