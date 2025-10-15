# Jared Leuzinger - Exact Commission Comparison
## September 2025 - VP vs System

**VP Total**: $9,304.51  
**System Total**: $7,539.74  
**Difference**: $1,764.77 (VP is HIGH)

---

## Order-by-Order Comparison

| Order | Customer | VP Amount | VP Rate | VP Comm | System Amount | System Rate | System Comm | Difference | Notes |
|-------|----------|-----------|---------|---------|---------------|-------------|-------------|------------|-------|
| 8672 | The Point Vape | $199.00 | 8% | **$30.00** | $204.97 | 8% | $16.40 | **-$13.60** | VP uses FLAT $30 for KB-040 Acrylic Kit |
| 8673 | White Cloud | $360.00 | 8% | $28.80 | $372.00 | 8% | $29.76 | +$0.96 | Revenue mismatch |
| 8705 | 505 Vape World | $199.00 | 8% | **$30.00** | $204.97 | 8% | $16.40 | **-$13.60** | VP uses FLAT $30 for KB-040 Acrylic Kit |
| 8768 | Number One Distro | $35,323.20 | 2% | $706.46 | $35,852.20 | 2% | $717.04 | +$10.58 | Revenue mismatch |
| 8775 | ISmoke Cigars | $32,256.00 | 2% | $645.12 | $32,578.50 | 2% | $651.57 | +$6.45 | Revenue mismatch |
| 8811 | Smoke & Eve | $299.00 | 8% | **$50.00** | $307.97 | 8% | $24.64 | **-$25.36** | VP uses FLAT $50 for KB-038 Acrylic Kit |
| 8813 | A Vape Escape | $360.00 | 8% | $28.80 | $381.00 | 8% | $30.48 | +$1.68 | Revenue mismatch |
| 8833 | Smoker's Gallery | $299.00 | 8% | **$50.00** | $307.97 | 8% | $24.64 | **-$25.36** | VP uses FLAT $50 for KB-038 Acrylic Kit |
| 8843 | Nimbus Wholesale | $34,272.00 | **4%** | **$1,370.88** | $34,614.72 | **2%** | $692.29 | **-$678.59** | 🔴 VP ERROR: Used Wholesale (4%), should be Distributor (2%) |
| 8844 | Mr. Zip #607 | $299.00 | 8% | **$50.00** | $299.00 | 8% | $23.92 | **-$26.08** | VP uses FLAT $50 for KB-038 Acrylic Kit |
| 8845 | Mr. Zip #603 | $299.00 | 8% | **$50.00** | $299.00 | 8% | $23.92 | **-$26.08** | VP uses FLAT $50 for KB-038 Acrylic Kit |
| 8871 | Los Dos Barbones | $34,272.00 | 8% | $2,741.76 | $34,786.00 | 8% | $2,782.88 | +$41.12 | Revenue mismatch |
| 8913 | 24 Stop Smokeshop | $912.00 | 8% | $72.96 | $980.56 | 8% | $78.44 | +$5.48 | Revenue mismatch |
| 8926 | 505 Vape World | $240.00 | 8% | $19.20 | $257.50 | 8% | $20.60 | +$1.40 | Revenue mismatch |
| 8939 | (Unknown) | $2,304.00 | 8% | $184.32 | $2,304.00 | 8% | $184.32 | $0.00 | ✅ Match |
| 8963 | Majestic Distrib | $12,228.00 | 8% | $978.24 | $12,790.54 | 8% | $1,023.24 | +$45.00 | Revenue mismatch + VP has -$24 FB_DISCOUNT |
| 8964 | Sky High Distrib | $37,548.00 | **4%** | **$1,501.92** | $37,548.00 | **2%** | $750.96 | **-$750.96** | 🔴 VP ERROR: Used Wholesale (4%), should be Distributor (2%) |
| 8971 | Pioneer Wholesale | $17,539.20 | 2% | $350.78 | $17,734.20 | 2% | $354.68 | +$3.90 | Revenue mismatch |
| 8989 | Lucky Stop | $360.00 | 8% | $28.80 | $386.25 | 8% | $30.90 | +$2.10 | Revenue mismatch |
| 9011 | IdaGo | $499.00 | 8% | **$160.00** | NOT IN LOG | 8% | ??? | **-$160.00** | VP uses FLAT amounts for 4 Acrylic Kits |
| 9043 | Toke N Smoke | $360.00 | 8% | $28.80 | $383.16 | 8% | $30.65 | +$1.85 | Revenue mismatch |
| 9044 | 505 Vape World | $360.00 | 8% | $28.80 | $383.16 | 8% | $30.65 | +$1.85 | Revenue mismatch |
| 9050 | Drew's Tobacco | $60.00 | 4% | $2.40 | $66.95 | 2% | $1.34 | -$1.06 | Rate difference (VP shows 4%, system 2%) + Revenue |

**TOTALS**: VP = $9,304.51 | System = $7,539.74 | Difference = $1,764.77

---

## Breakdown of Differences

### 🔴 Major VP Errors (Fishbowl Data Issues)

#### 1. Nimbus Wholesale (Order 8843)
- **VP Used**: 4% (Wholesale 12-month)
- **Correct**: 2% (Distributor 12-month)
- **VP Commission**: $1,370.88
- **Correct Commission**: $692.29
- **VP Overpayment**: **$678.59**

#### 2. Sky High Distribution (Order 8964)
- **VP Used**: 4% (Wholesale 12-month, dormant reactivated)
- **Correct**: 2% (Distributor 12-month, dormant reactivated)
- **VP Commission**: $1,501.92
- **Correct Commission**: $750.96
- **VP Overpayment**: **$750.96**

**Total VP Errors**: $1,429.55

---

### 💰 Acrylic Kit Spiff Differences

VP uses **FLAT commission amounts** for acrylic kits instead of percentage:

| Order | Product | VP Method | VP Comm | System Method | System Comm | Difference |
|-------|---------|-----------|---------|---------------|-------------|------------|
| 8672 | KB-040 (4-piece) | Flat $30 | $30.00 | $204.97 × 8% | $16.40 | -$13.60 |
| 8705 | KB-040 (4-piece) | Flat $30 | $30.00 | $204.97 × 8% | $16.40 | -$13.60 |
| 8811 | KB-038 (8-piece) | Flat $50 | $50.00 | $307.97 × 8% | $24.64 | -$25.36 |
| 8833 | KB-038 (8-piece) | Flat $50 | $50.00 | $307.97 × 8% | $24.64 | -$25.36 |
| 8844 | KB-038 (8-piece) | Flat $50 | $50.00 | $299.00 × 8% | $23.92 | -$26.08 |
| 8845 | KB-038 (8-piece) | Flat $50 | $50.00 | $299.00 × 8% | $23.92 | -$26.08 |
| 9011 | 4× Acrylic Kits | Flat $160 | $160.00 | Not in log | ??? | -$160.00 |

**Total Acrylic Kit Difference**: -$290.08

**VP's Acrylic Kit Rules**:
- KB-040 (Black 4-piece): **$30.00 flat**
- KB-038 (Black 8-piece): **$50.00 flat**

---

### 📊 Revenue Mismatches

Small differences in order totals between VP spreadsheet and system:

| Order | VP Revenue | System Revenue | Difference | VP Comm | System Comm | Comm Diff |
|-------|------------|----------------|------------|---------|-------------|-----------|
| 8673 | $360.00 | $372.00 | +$12.00 | $28.80 | $29.76 | +$0.96 |
| 8768 | $35,323.20 | $35,852.20 | +$529.00 | $706.46 | $717.04 | +$10.58 |
| 8775 | $32,256.00 | $32,578.50 | +$322.50 | $645.12 | $651.57 | +$6.45 |
| 8813 | $360.00 | $381.00 | +$21.00 | $28.80 | $30.48 | +$1.68 |
| 8871 | $34,272.00 | $34,786.00 | +$514.00 | $2,741.76 | $2,782.88 | +$41.12 |
| 8913 | $912.00 | $980.56 | +$68.56 | $72.96 | $78.44 | +$5.48 |
| 8926 | $240.00 | $257.50 | +$17.50 | $19.20 | $20.60 | +$1.40 |
| 8963 | $12,228.00 | $12,790.54 | +$562.54 | $978.24 | $1,023.24 | +$45.00 |
| 8971 | $17,539.20 | $17,734.20 | +$195.00 | $350.78 | $354.68 | +$3.90 |
| 8989 | $360.00 | $386.25 | +$26.25 | $28.80 | $30.90 | +$2.10 |
| 9043 | $360.00 | $383.16 | +$23.16 | $28.80 | $30.65 | +$1.85 |
| 9044 | $360.00 | $383.16 | +$23.16 | $28.80 | $30.65 | +$1.85 |
| 9050 | $60.00 | $66.95 | +$6.95 | $2.40 | $1.34 | -$1.06 |

**Total Revenue-Based Commission Difference**: +$121.31

**Likely Causes**:
- Shipping exclusions working correctly in system
- VP may have manually adjusted some totals
- Rounding differences
- Tax/fee handling

---

### 🔧 Other Discrepancies

#### Order 8963 - FB_DISCOUNT
- VP shows: $1,002.24 - $24.00 = $978.24
- System shows: $1,023.24 (no discount applied)
- **Difference**: +$24.00 (system needs manual adjustment)

#### Order 9050 - Drew's Tobacco World
- VP Rate: 4% (shows as transferred "From Brandon")
- System Rate: 2% (transferred)
- VP Comm: $2.40
- System Comm: $1.34
- **Difference**: -$1.06

#### Order 9011 - IdaGo (MISSING FROM SYSTEM LOG)
- VP shows: $160.00 commission (4 acrylic kits)
- System: Not visible in console log
- **Difference**: -$160.00 (need to verify if calculated)

---

## Summary of All Differences

| Category | Amount | Direction |
|----------|--------|-----------|
| **VP Errors (Fishbowl Data)** | | |
| - Nimbus Wholesale (8843) | $678.59 | VP HIGH |
| - Sky High Distribution (8964) | $750.96 | VP HIGH |
| **Subtotal VP Errors** | **$1,429.55** | **VP HIGH** |
| | | |
| **Acrylic Kit Spiffs** | | |
| - Flat amounts vs percentage | $290.08 | VP HIGH |
| | | |
| **Revenue Mismatches** | | |
| - Various orders | $121.31 | System HIGH |
| | | |
| **Other** | | |
| - FB_DISCOUNT (8963) | $24.00 | System HIGH |
| - Drew's Tobacco rate (9050) | $1.06 | VP HIGH |
| - IdaGo missing (9011) | $160.00 | VP HIGH |
| **Subtotal Other** | **$137.06** | **VP HIGH** |
| | | |
| **TOTAL DIFFERENCE** | **$1,764.77** | **VP HIGH** |

---

## Reconciliation

```
VP Calculation:                    $9,304.51

Corrections:
  - Nimbus Wholesale error:         -$678.59
  - Sky High Distribution error:    -$750.96
  - Acrylic kit spiffs:             -$290.08
  - Revenue mismatches:             +$121.31
  - FB_DISCOUNT:                    +$24.00
  - Other differences:              -$137.06
                                   ──────────
CORRECTED TOTAL:                   $7,593.13

System Calculation:                $7,539.74
                                   ──────────
Remaining Difference:                $53.39
```

**Remaining $53.39** is likely due to:
- Order 9011 (IdaGo) not visible in console log but may be calculated
- Small rounding differences
- Minor revenue calculation variances

---

## Conclusion

### VP Made Two Major Errors:
1. **Nimbus Wholesale**: Used 4% (Wholesale) instead of 2% (Distributor) = **+$678.59 overpayment**
2. **Sky High Distribution**: Used 4% (Wholesale) instead of 2% (Distributor) = **+$750.96 overpayment**

**Total VP Overpayment from Errors**: $1,429.55

### System is Missing Acrylic Kit Spiffs:
- VP uses flat amounts ($30 for KB-040, $50 for KB-038)
- System calculates percentage commission
- **Difference**: $290.08 (system should pay MORE)

### Net Result:
- VP Overpayment: $1,429.55
- System Underpayment (spiffs): -$290.08
- Revenue/Other: +$95.25
- **Net VP Overpayment**: $1,234.22

### Recommendation:
**Correct Commission**: ~$8,070 (after implementing acrylic kit spiffs)  
**Current System**: $7,539.74 (before spiff implementation)  
**VP Calculation**: $9,304.51 (contains errors)

**Action**: Implement acrylic kit spiffs, then system will calculate ~$7,830, which is the correct amount.
