# Conversight Field Mapping Audit

## Source of Truth: CONVERTSIGHT_IMPORT FIELDS

Comparing actual import code vs documented Conversight export fields.

## ✅ CORRECT Mappings

| Code Field | Source of Truth | Column | Status |
|------------|----------------|--------|--------|
| `row['Account ID']` | Account ID | I | ✅ Correct |
| `row['Account id']` | Account id | AS | ✅ Correct (lowercase) |
| `row['Account Type']` | Account Type | AT | ✅ Correct |
| `row['Account type']` | Account type | J | ✅ Correct (lowercase) |
| `row['Customer Name']` | Customer Name | Q | ✅ Correct |
| `row['Sales Rep']` | Sales Rep | R | ✅ Correct |
| `row['Sales person']` | Sales person | AA | ✅ Correct |
| `row['Sales order Number']` | Sales order Number | Y | ✅ Correct |
| `row['Sales Order ID']` | Sales Order ID | AB | ✅ Correct |
| `row['SO Item ID']` | SO Item ID | AD | ✅ Correct |
| `row['Date fulfillment']` | Date fulfillment | C | ✅ Correct |
| `row['Date fulfilled']` | NOT IN EXPORT | - | ⚠️ Fallback (doesn't exist) |
| `row['Total Price']` | Total Price | AX | ✅ Correct |
| `row['Unit price']` | Unit price | AW | ✅ Correct |

## ❌ INCORRECT Mappings

| Code Field | Issue | Should Be |
|------------|-------|-----------|
| `row['Account Number']` | **DOESN'T EXIST** | Remove - use 'Account ID' |
| `row['UNIT PRICE']` | Case mismatch | Use 'Unit price' |
| `row['Part Number']` | **DOESN'T EXIST** | Use 'SO Item Product Number' (AC) |

## 🔍 CRITICAL FINDING: No Account Order ID in Conversight

**The Problem:**
- Conversight export **does NOT include** the Account Order ID field
- "Account ID" (Column I) is the **customer's internal ID**, NOT the Account Order ID
- Copper stores Account Order ID separately (like "1341" for RRR Wholesale)
- **Result:** Fishbowl customers are created with NO Account Order ID

**The Solution:**
- ✅ Use name+address matching (just implemented) to match Fishbowl → Copper
- ✅ Auto-fill accountNumber from Copper's Account Order ID during sync
- ✅ This is the ONLY way to get Account Order IDs into Fishbowl

## Next Steps

1. Fix "Account Number" references (remove, use 'Account ID' only)
2. Fix "Part Number" → "SO Item Product Number"  
3. Fix case sensitivity issues
4. Verify ALL field names match source of truth exactly
