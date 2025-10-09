# Sales Order Upload Logic - Preserve Account Type

## Critical Rule
**DO NOT overwrite the `accountType` field in `fishbowl_customers` collection!**

## Upload Logic for Sales Orders

When uploading sales order data from Fishbowl Excel export:

### 1. Sales Orders Collection (`fishbowl_sales_orders`)
Upload all fields as normal - no restrictions.

```typescript
await adminDb.collection('fishbowl_sales_orders').doc(salesOrderId).set({
  num: orderNumber,
  customerId: customerId,
  customerName: customerName,
  salesPerson: salesPerson,
  revenue: revenue,
  orderValue: orderValue,
  postingDate: postingDate,
  commissionMonth: commissionMonth,
  // ... all other fields
  shippingState: shippingState, // NEW FIELD from Excel
  shippingCity: shippingCity,   // NEW FIELD from Excel
  // ... etc
});
```

### 2. Customers Collection (`fishbowl_customers`) - CRITICAL
**Use `merge: true` to preserve existing fields!**

```typescript
// CORRECT WAY - Preserves accountType
await adminDb.collection('fishbowl_customers').doc(customerId).set({
  name: customerName,
  customerNum: customerNum,
  salesPerson: salesPerson,
  shippingState: shippingState,  // NEW - Add from Excel
  shippingCity: shippingCity,    // NEW - Add from Excel
  lastOrderDate: postingDate,
  updatedAt: new Date()
  // DO NOT include accountType here!
}, { merge: true }); // ← CRITICAL: merge: true preserves existing fields
```

### 3. What `merge: true` Does
- **Adds new fields** (shippingState, shippingCity)
- **Updates existing fields** (name, lastOrderDate, etc.)
- **Preserves fields not mentioned** (accountType, custom fields, etc.)

### 4. Wrong Way (DO NOT DO THIS)
```typescript
// ❌ WRONG - Overwrites everything
await adminDb.collection('fishbowl_customers').doc(customerId).set({
  name: customerName,
  accountType: 'Retail', // ← This overwrites manually set values!
  // ...
}); // No merge option = replaces entire document
```

## New Fields from Fishbowl Export

Your new Excel export should include these columns:
- `shippingState` - 2-letter state code (e.g., "ID", "WA", "OR")
- `shippingCity` - City name (e.g., "Boise", "Seattle")
- All existing columns (orderValue, revenue, etc.)

## Testing Checklist

After upload, verify:
1. ✅ `shippingState` field appears in `fishbowl_customers`
2. ✅ `shippingCity` field appears in `fishbowl_customers`
3. ✅ `accountType` field is **NOT** changed (should still be Wholesale/Distributor if you set it manually)
4. ✅ Sales orders have all new fields
5. ✅ Customer Management page shows City column with data
6. ✅ State filter works (when you add State column later)

## Implementation

If you're using a Node.js script to upload:

```javascript
const admin = require('firebase-admin');
const XLSX = require('xlsx');

// Read Excel file
const workbook = XLSX.readFile('fishbowl_export.xlsx');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

// Process each row
for (const row of data) {
  // 1. Upload sales order (all fields)
  await admin.firestore().collection('fishbowl_sales_orders').doc(row.salesOrderId).set({
    num: row.orderNumber,
    customerId: row.customerId,
    customerName: row.customerName,
    salesPerson: row.salesPerson,
    revenue: parseFloat(row.revenue),
    orderValue: parseFloat(row.orderValue),
    postingDate: new Date(row.postingDate),
    commissionMonth: row.commissionMonth,
    shippingState: row.shippingState,  // NEW
    shippingCity: row.shippingCity,    // NEW
    // ... all other fields
  });

  // 2. Update customer (PRESERVE accountType)
  await admin.firestore().collection('fishbowl_customers').doc(row.customerId).set({
    name: row.customerName,
    customerNum: row.customerNum,
    salesPerson: row.salesPerson,
    shippingState: row.shippingState,  // NEW
    shippingCity: row.shippingCity,    // NEW
    lastOrderDate: new Date(row.postingDate),
    updatedAt: new Date()
    // DO NOT include accountType!
  }, { merge: true }); // ← CRITICAL!
}
```

## Summary

**Key Points:**
1. Always use `{ merge: true }` when updating `fishbowl_customers`
2. Never include `accountType` in upload script
3. Add new fields: `shippingState`, `shippingCity`
4. Test that manually set account types are preserved

**Result:**
- ✅ New data uploads successfully
- ✅ Account types stay as you set them (Wholesale/Distributor)
- ✅ New shipping fields populate
- ✅ Ready for territory assignment logic
