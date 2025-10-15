# Jared Leuzinger September 2025 Commission Comparison

**VP Target**: $9,304.51  
**System Calculated**: $9,792.62  
**Difference**: +$488.11 (System is HIGH)

---

## Order-by-Order Comparison

### ✅ MATCHING ORDERS

#### Order 8913 - 24 Stop Smokeshop (NEW 8%)
- VP: $72.96 ($912 × 8%)
- System: $78.44 ($980.56 × 8%)
- **Issue**: Revenue mismatch - need to check if shipping included

#### Order 8705 - 505 Vape World (NEW 8%) - Acrylic Kit
- VP: **$30.00** (Flat amount for KB-040)
- System: $16.40 ($204.97 × 8%)
- **Issue**: VP uses FLAT $30 for acrylic kits, system uses percentage

#### Order 8926 - 505 Vape World (NEW 8%)
- VP: $19.20 ($240 × 8%)
- System: $20.60 ($257.50 × 8%)
- **Issue**: Revenue mismatch

#### Order 9044 - 505 Vape World (NEW 8%)
- VP: $28.80 ($360 × 8%)
- System: $30.65 ($383.16 × 8%)
- **Issue**: Revenue mismatch

#### Order 8813 - A Vape Escape (NEW 8%)
- VP: $28.80 ($360 × 8%)
- System: $30.48 ($381 × 8%)
- **Issue**: Revenue mismatch

#### Order 9050 - Drew's Tobacco World (TRANSFERRED 2%)
- VP: $2.40 ($60 × 4%) - NOTE: VP shows 4% in CSV
- System: $1.34 ($66.95 × 2%)
- **Issue**: Rate and revenue mismatch

#### Order 8843 - Nimbus Wholesale (WHOLESALE 4%)
- VP: **$1,370.88** ($34,272 × 4%)
- System: $692.29 ($34,614.72 × 2%)
- **Issue**: System treating as DISTRIBUTOR 12-month (2%), VP treats as WHOLESALE (4%)

#### Order 8768 - Number One Distro (DISTRIBUTOR 12-month 2%)
- VP: $706.46 ($35,323.20 × 2%)
- System: $717.04 ($35,852.20 × 2%)
- **Issue**: Revenue mismatch

#### Order 8775 - ISmoke Cigars (TRANSFERRED 2%)
- VP: $645.12 ($32,256 × 2%)
- System: $651.57 ($32,578.50 × 2%)
- **Issue**: Revenue mismatch

#### Order 8871 - Los Dos Barbones (NEW 8%)
- VP: **$2,741.76** ($34,272 × 8%)
- System: $2,782.88 ($34,786 × 8%)
- **Issue**: Revenue mismatch ($514 difference)

#### Order 8989 - Lucky Stop (NEW 8%)
- VP: $28.80 ($360 × 8%)
- System: $30.90 ($386.25 × 8%)
- **Issue**: Revenue mismatch

#### Order 8965 - Luv Wholesale (TRANSFERRED 2%)
- VP: $350.78 ($17,539.20 × 2%)
- System: NOT IN CONSOLE LOG
- **Issue**: Missing from system?

#### Order 8963 - Majestic Distribution (NEW 8%)
- VP: $1,002.24 ($12,528 × 8%) - $24.00 (FB_DISCOUNT) = **$978.24**
- System: $1,023.24 ($12,790.54 × 8%)
- **Issue**: 
  1. Revenue mismatch
  2. Missing FB_DISCOUNT deduction (-$24)

#### Order 8844 - Mr. Zip #607 (NEW 8%) - Acrylic Kit
- VP: **$50.00** (Flat amount for KB-038)
- System: $23.92 ($299 × 8%)
- **Issue**: VP uses FLAT $50 for acrylic kits

#### Order 8845 - Mr. Zip #603 (NEW 8%) - Acrylic Kit
- VP: **$50.00** (Flat amount for KB-038)
- System: $23.92 ($299 × 8%)
- **Issue**: VP uses FLAT $50 for acrylic kits

#### Order 8971 - Pioneer Wholesale (TRANSFERRED 2%)
- VP: $350.78 ($17,539.20 × 2%)
- System: $354.68 ($17,734.20 × 2%)
- **Issue**: Revenue mismatch

#### Order 8964 - Sky High Distribution (DORMANT REACTIVATED)
- VP: **$1,501.92** ($37,548 × 4%) - NOTE: VP uses 4% for reactivated dormant
- System: $3,003.84 ($37,548 × 8%)
- **MAJOR ISSUE**: System uses 8% (NEW), VP uses 4% (reactivated dormant accounts get 4%, not 8%)

#### Order 8811 - Smoke & Eve (NEW 8%) - Acrylic Kit
- VP: **$50.00** (Flat amount for KB-038)
- System: $24.64 ($307.97 × 8%)
- **Issue**: VP uses FLAT $50 for acrylic kits

#### Order 8833 - Smoker's Gallery (NEW 8%) - Acrylic Kit
- VP: **$50.00** (Flat amount for KB-038)
- System: $24.64 ($307.97 × 8%)
- **Issue**: VP uses FLAT $50 for acrylic kits

#### Order 8672 - The Point Vape (NEW 8%) - Acrylic Kit
- VP: **$30.00** (Flat amount for KB-040)
- System: $16.40 ($204.97 × 8%)
- **Issue**: VP uses FLAT $30 for acrylic kits

#### Order 9043 - Toke N Smoke (NEW 8%)
- VP: $28.80 ($360 × 8%)
- System: $30.65 ($383.16 × 8%)
- **Issue**: Revenue mismatch

#### Order 8673 - White Cloud (NEW 8%)
- VP: $28.80 ($360 × 8%)
- System: $29.76 ($372 × 8%)
- **Issue**: Revenue mismatch

---

## ROOT CAUSES

### 1. 🔴 ACRYLIC KIT SPIFFS NOT WORKING
**Impact**: ~$200+ difference

VP uses FLAT DOLLAR AMOUNTS for acrylic kits:
- KB-040 (4 FF/acrylic): **$30.00 flat**
- KB-038 (Full kit): **$50.00 flat**

System is calculating percentage commission instead of using spiff amounts.

**Orders Affected**:
- 8705, 8672: KB-040 → Should be $30 flat
- 8844, 8845, 8811, 8833: KB-038 → Should be $50 flat
- 9011 (IdaGo): Multiple kits → Should be $30 + $50 + $30 + $50 = $160

### 2. 🔴 DORMANT ACCOUNT REACTIVATION RATE WRONG
**Impact**: $1,501.92 difference (BIGGEST ISSUE)

**Order 8964 - Sky High Distribution**:
- Last order: 2/27/2024 (19 months dormant)
- VP Rate: **4%** (reactivated dormant)
- System Rate: **8%** (treating as NEW)
- VP Commission: $1,501.92
- System Commission: $3,003.84
- **Difference: $1,501.92**

**Rule**: Dormant accounts (12+ months) reactivated get 4%, NOT 8%

### 3. 🟡 REVENUE MISMATCHES
**Impact**: ~$100+ difference

Many orders show slightly different revenue amounts. This could be:
- Shipping lines being included when they shouldn't
- Two shipping lines per order (cost + tracking)
- Rounding differences

### 4. 🟡 NIMBUS WHOLESALE SEGMENT ISSUE
**Impact**: $678.59 difference

**Order 8843**:
- VP: Treats as WHOLESALE (4% rate)
- System: Treats as DISTRIBUTOR 12-month (2% rate)
- This customer should be at 4% rate

### 5. 🔴 FB_DISCOUNT NOT APPLIED
**Impact**: $24.00 difference

**Order 8963 - Majestic Distribution**:
- VP: -$24.00 deduction for FB_DISCOUNT
- System: No deduction applied
- Need to use manual adjustment feature

---

## SUMMARY OF FIXES NEEDED

### Priority 1: Dormant Account Rate (BIGGEST)
- [ ] Change dormant reactivation rate from 8% to 4%
- [ ] Affects Order 8964: -$1,501.92

### Priority 2: Acrylic Kit Spiffs
- [ ] Ensure spiffs override percentage commission
- [ ] KB-040: $30 flat
- [ ] KB-038: $50 flat
- [ ] Affects ~8 orders: +$200

### Priority 3: Shipping Line Exclusion
- [ ] Verify BOTH shipping lines excluded (cost + tracking)
- [ ] Check if "Shipping Tracking: https://..." lines are being excluded
- [ ] Affects multiple orders: ~$100

### Priority 4: Nimbus Wholesale Rate
- [ ] Verify customer segment for Order 8843
- [ ] Should be 4% (Wholesale), not 2% (Distributor)
- [ ] Affects 1 order: -$678.59

### Priority 5: Manual Adjustments
- [ ] Apply FB_DISCOUNT to Order 8963: -$24.00

---

## EXPECTED RESULT AFTER FIXES

Current System: $9,792.62  
- Dormant rate fix (8964): -$1,501.92  
- Acrylic spiffs: +$200 (estimated)  
- Shipping exclusions: -$100 (estimated)  
- Nimbus rate: -$678.59  
- FB_DISCOUNT: -$24.00  

**Expected**: ~$9,688 (still need to verify exact amounts)  
**Target**: $9,304.51

Remaining difference will likely be resolved by shipping line exclusions and revenue reconciliation.
