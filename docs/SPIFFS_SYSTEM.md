# Spiffs & Kickers System Documentation

## Overview
The Spiffs/Kickers system provides flexible product-based sales incentives that are automatically calculated during monthly commission processing.

## Features

### 1. Products Management
**Location:** Settings > Products Tab

- **Import Products:** Upload CSV file with product catalog
- **Add/Edit Products:** Manual product management
- **Product Images:** Upload product photos (stored in Firebase Storage `product-images/`)
- **Search/Filter:** Find products by number, description, or category
- **Quarterly Bonus Flag:** Mark products eligible for quarterly bonuses

**Product Fields:**
- Product Number (e.g., KB-038)
- Product Description
- Category, Product Type, Size, UOM
- Active/Inactive status
- Quarterly Bonus Eligible
- Image URL and metadata
- Notes

### 2. Spiff Management
**Location:** Settings > Monthly Commissions > Spiffs & Kickers

**Spiff Configuration:**
- **Name:** Descriptive name for the spiff
- **Product:** Dropdown selection (ensures exact matching)
- **Incentive Type:**
  - **Flat Dollar:** Fixed amount per unit (e.g., $16/unit)
  - **Percentage:** Percentage of line item revenue (e.g., 5%)
- **Incentive Value:** Dollar amount or percentage
- **Start Date:** When spiff begins
- **End Date:** Optional end date (blank = ongoing)
- **Active Toggle:** Enable/disable without deleting
- **Notes:** Additional context

### 3. Automatic Calculation
**Process:** Runs during monthly commission calculation

**Calculation Logic:**
```typescript
// Flat Dollar
spiffAmount = quantity × incentiveValue

// Percentage
spiffAmount = lineRevenue × (incentiveValue / 100)
```

**Data Flow:**
1. Load active spiffs for the period
2. For each sales order:
   - Calculate regular commission
   - Query line items from `fishbowl_soitems`
   - Match line items to spiffs by `productNum`
   - Calculate and save spiff earnings
3. Update rep summary with total spiffs

## Data Structure

### Collections

#### `products`
```typescript
{
  id: string,
  productNum: string,           // e.g., "KB-038"
  productDescription: string,
  category: string,
  productType: string,
  size: string,
  uom: string,
  isActive: boolean,
  quarterlyBonusEligible: boolean,
  imageUrl: string | null,
  imagePath: string | null,
  imageMetadata: {
    fileName: string,
    originalName: string,
    contentType: string,
    size: number,
    uploadedAt: string
  },
  notes: string,
  createdAt: string,
  updatedAt: string
}
```

#### `spiffs`
```typescript
{
  id: string,
  name: string,                 // e.g., "Q4 2025 Acrylic Kit Promotion"
  productNum: string,           // e.g., "KB-038"
  productDescription: string,
  incentiveType: 'flat' | 'percentage',
  incentiveValue: number,       // Dollar amount or percentage
  isActive: boolean,
  startDate: string,            // YYYY-MM-DD
  endDate: string | null,       // YYYY-MM-DD or null
  notes: string,
  createdAt: string,
  updatedAt: string
}
```

#### `spiff_earnings`
```typescript
{
  id: string,                   // {salesPerson}_{commissionMonth}_spiff_{lineItemId}
  repId: string,
  salesPerson: string,
  repName: string,
  
  spiffId: string,
  spiffName: string,
  productNum: string,
  productDescription: string,
  
  orderId: string,
  orderNum: string,
  customerId: string,
  customerName: string,
  
  quantity: number,
  lineRevenue: number,
  incentiveType: 'flat' | 'percentage',
  incentiveValue: number,
  spiffAmount: number,          // Calculated earnings
  
  orderDate: string,
  commissionMonth: string,      // YYYY-MM
  commissionYear: number,
  
  calculatedAt: Date,
  paidStatus: 'pending' | 'paid'
}
```

#### `monthly_commission_summary` (Updated)
```typescript
{
  // ... existing fields ...
  totalSpiffs: number,          // NEW: Sum of spiff earnings
  totalEarnings: number,        // NEW: totalCommission + totalSpiffs
}
```

## Usage Examples

### Example 1: Flat Dollar Spiff
**Setup:**
- Product: KB-038 (Acrylic Kit - Black)
- Type: Flat Dollar
- Value: $16 per unit
- Period: 2025-10-01 to 2025-12-31

**Sales Order:**
- Order #9011
- Line Item: KB-038, Qty: 1, Revenue: $260

**Result:**
- Spiff Earning: 1 × $16 = **$16**

### Example 2: Percentage Spiff
**Setup:**
- Product: KB-040 (Acrylic Kit - Black 4FF)
- Type: Percentage
- Value: 5%
- Period: 2025-10-01 to ongoing

**Sales Order:**
- Order #9012
- Line Item: KB-040, Qty: 2, Revenue: $398

**Result:**
- Spiff Earning: $398 × 5% = **$19.90**

### Example 3: Multiple Spiffs in One Order
**Order #9013 has:**
- KB-038 (Qty: 1) → $16 flat = $16
- KB-040 (Qty: 2, $398) → 5% = $19.90
- **Total Spiffs: $35.90**

## API Endpoints

### Import Products
```
POST /api/products/import-csv
Body: FormData with CSV file
```

### Upload Product Image
```
POST /api/products/upload-image
Body: FormData {
  file: File,
  productId: string,
  productNum: string
}
```

### Delete Product Image
```
DELETE /api/products/upload-image?productId={id}&imagePath={path}
```

## Console Logging

During commission calculation, spiff earnings are logged:
```
💰 SPIFF EARNED: {repName} | {productNum} | Qty: {qty} | ${value}/unit = ${amount}
```

Example:
```
💰 SPIFF EARNED: Jared Leuzinger | KB-038 | Qty: 1 | $16/unit = $16.00
```

## Best Practices

1. **Product Management:**
   - Import products from CSV first
   - Add images for visual identification
   - Keep product numbers consistent with Fishbowl

2. **Spiff Configuration:**
   - Use descriptive names (e.g., "Q4 2025 Acrylic Kit Promo")
   - Set clear start/end dates
   - Test with one product before rolling out
   - Use Active toggle to pause without deleting

3. **Monitoring:**
   - Check `spiff_earnings` collection after calculation
   - Review rep summaries for `totalSpiffs` field
   - Verify line item matching in console logs

4. **Troubleshooting:**
   - If spiff not calculated: Check product number matches exactly
   - If wrong amount: Verify incentive type and value
   - If not active: Check date range and Active toggle

## Future Enhancements

Potential additions:
- Spiff performance dashboard
- Rep-specific spiffs
- Tiered spiffs (e.g., $10 for 1-5 units, $15 for 6+)
- Spiff approval workflow
- Historical spiff earnings report
- Export spiff earnings to CSV

## Support

For questions or issues:
1. Check console logs during commission calculation
2. Verify product numbers match exactly
3. Confirm spiff is active and within date range
4. Review `spiff_earnings` collection in Firestore
