# Fishbowl Import - Complete Field Mapping

**Last Updated:** October 20, 2025  
**Purpose:** Complete documentation of all Conversight fields imported into Firestore collections

---

## 📊 COLLECTIONS & FIELDS

### 1. `fishbowl_customers` Collection

**Document ID:** Customer ID (sanitized, e.g., `1259`, `1632`)

**Fields:**

| Field Name | Source Column | Notes |
|------------|---------------|-------|
| `id` | Customer ID (sanitized) | Document ID |
| `name` | Customer Name | Customer display name |
| `accountNumber` | Account Number, Account ID | Customer account number |
| `accountId` | Account ID | Conversight Account ID |
| `accountType` | Account Type, Account type | **PRESERVED if exists** - manual corrections safe |
| `fishbowlUsername` | - | **PRESERVED if exists** - manual rep assignment |
| `companyId` | Company id | Company identifier |
| `companyName` | Company Name, Company name | Company display name |
| `parentCompanyId` | Parent Company ID | Parent company reference |
| `parentCustomerName` | Parent Customer Name | Parent customer name |
| `billingName` | Billing Name | Billing contact name |
| `billingAddress` | Billing Address | Billing street address |
| `billingCity` | Billing City | Billing city |
| `billingState` | Billing State | Billing state |
| `billingZip` | Billing Zip | Billing ZIP code |
| `shippingCity` | Shipping City, Billing City | Shipping city (fallback to billing) |
| `shippingState` | Shipping State, Billing State | Shipping state (fallback to billing) |
| `shippingAddress` | Shipping Address, Billing Address | Shipping address (fallback to billing) |
| `shippingCountry` | Shipping Country | Shipping country |
| `shipToName` | Ship to name | Ship-to contact name |
| `shipToZip` | Ship to zip, Billing Zip | Ship-to ZIP (fallback to billing) |
| `customerContact` | Customer contact | Primary contact name |
| `updatedAt` | - | Timestamp of last import |
| `source` | - | Always "fishbowl_unified" |

---

### 2. `fishbowl_sales_orders` Collection

**Document ID:** `fb_so_{Sales Order Number}` (e.g., `fb_so_8854`)

**Fields:**

| Field Name | Source Column | Notes |
|------------|---------------|-------|
| `id` | - | Document ID |
| `num` | Sales order Number | Customer-facing order number |
| `fishbowlNum` | Sales order Number | Fishbowl order number |
| `salesOrderId` | Sales Order ID | Fishbowl internal ID |
| `customerId` | Company id, Account ID | Links to customer (sanitized) |
| `customerName` | Customer Name | Customer display name |
| `salesPerson` | Sales person | Sales person full name |
| `salesRep` | Sales Rep | Sales rep short name |
| `salesRepInitials` | Sales Rep Initials | Rep initials |
| `soStatus` | SO Status | Order status |
| `soType` | SO Type | Order type |
| `priorityId` | Priority ID | Priority identifier |
| `yearMonth` | Year-month | Year-month string |
| `dateCreated` | Date created | Order creation date |
| `issuedDate` | Issued date | Order issued date |
| `dateLastFulfillment` | Date last fulfillment | Last fulfillment date |
| `dateFirstShip` | Date first ship | First ship date |
| `scheduledFulfillmentDate` | Scheduled Fulfillment Date | Scheduled date |
| `postingDate` | Date fulfillment | **PRIMARY** - Timestamp for commission |
| `postingDateStr` | Date fulfillment | String format of posting date |
| `commissionDate` | Date fulfillment | Commission trigger date (Timestamp) |
| `commissionMonth` | - | Calculated: "2025-10" format |
| `commissionYear` | - | Calculated: 2025 |
| `soC1` | So c1 | Sales order custom field 1 |
| `soC2` | So c2 | Sales order custom field 2 |
| `soC3` | Sales Order Custom Field 3 | Sales order custom field 3 |
| `soC4` | So c4 | Sales order custom field 4 |
| `soC5` | Sales Order Custom Field 5 | Sales order custom field 5 |
| `soC6` | Sales Order Custom Field 6 | Sales order custom field 6 |
| `revenue` | - | **AGGREGATED** from line items (excludes shipping/CC) |
| `orderValue` | - | **AGGREGATED** from line items |
| `lineItemCount` | - | Count of line items |
| `soCt` | So ct | Order count field |
| `updatedAt` | - | Timestamp of last import |
| `source` | - | Always "fishbowl_unified" |

---

### 3. `fishbowl_soitems` Collection

**Document ID:** `soitem_{SO Item ID}` (e.g., `soitem_12345`)

**Fields:**

| Field Name | Source Column | Notes |
|------------|---------------|-------|
| `id` | - | Document ID |
| `salesOrderId` | Sales Order ID | Links to order (Fishbowl ID) |
| `salesOrderNum` | Sales order Number | Links to order (number) |
| `soId` | - | Calculated: `fb_so_{orderNum}` |
| `customerId` | Company id, Account ID | Links to customer (sanitized) |
| `customerName` | Customer Name | Customer display name |
| `accountNumber` | Account Number, Account ID | Account number |
| `accountId` | Account ID | Conversight Account ID |
| `accountType` | Account Type, Account type | Account type |
| `companyId` | Company id | Company identifier |
| `companyName` | Company Name, Company name | Company name |
| `billingName` | Billing Name | Billing contact |
| `billingAddress` | Billing Address | Billing address |
| `billingCity` | Billing City | Billing city |
| `billingState` | Billing State | Billing state |
| `billingZip` | Billing Zip | Billing ZIP |
| `salesPerson` | Sales person | Sales person full name |
| `salesRep` | Sales Rep | Sales rep short name |
| `salesRepInitials` | Sales Rep Initials | Rep initials |
| `yearMonth` | Year-month | Year-month string |
| `dateCreated` | Date created | Creation date |
| `issuedDate` | Issued date | Issued date |
| `dateLastFulfillment` | Date last fulfillment | Last fulfillment |
| `dateFirstShip` | Date first ship | First ship date |
| `productCreationDate` | Product Creation Date | Product creation |
| `scheduledFulfillmentDate` | Scheduled Fulfillment Date | Scheduled date |
| `postingDate` | Date fulfillment | **PRIMARY** - Timestamp for commission |
| `postingDateStr` | Date fulfillment | String format |
| `commissionDate` | Date fulfillment | Commission date (Timestamp) |
| `commissionMonth` | - | Calculated: "2025-10" |
| `commissionYear` | - | Calculated: 2025 |
| `lineItemId` | SO Item ID | Unique line item ID |
| `soItemId` | SO Item ID, So item id | SO Item ID |
| `salesOrderLineItem` | Sales Order Line Item | Line item reference |
| `soStatus` | SO Status | Order status |
| `soType` | SO Type | Order type |
| `salesOrderItemStatus` | Sales Order Item Status | Line item status |
| `priorityId` | Priority ID | Priority ID |
| `partNumber` | SO Item Product Number, Part Number | **PRIMARY** - Product SKU (e.g., "KB-4000") |
| `partId` | Part id | Part identifier |
| `partDescription` | Part Description | Part description |
| `product` | Product | Product name |
| `productId` | Product ID | Product identifier |
| `productShortNumber` | Product Short Number | Short product number |
| `productC1` | Product Custom Field 1 | Product category 1 |
| `productC2` | Product Custom Field 2 | Product category 2 |
| `productC3` | Product Custom Field 3 | Product category 3 |
| `productC4` | Product Custom Field 4 | Product category 4 |
| `productC5` | Product c5 | Product category 5 |
| `productDesc` | Product description | Product description |
| `description` | Sales Order Item Description | Line item description |
| `itemType` | Sales Order Item Type | Item type |
| `uomCode` | UOM Code | Unit of measure code |
| `uomName` | UOM Name | Unit of measure name |
| `shippingCity` | Shipping City, Billing City | Shipping city |
| `shippingState` | Shipping State, Billing State | Shipping state |
| `shippingItemId` | Shipping Item ID | Shipping item ID |
| `revenue` | Total Price | **PRIMARY** - Line item revenue |
| `totalPrice` | Total Price | Total price |
| `unitPrice` | Unit price | Unit price |
| `lastUnitPrice` | Last Unit Price | Last unit price |
| `totalCost` | Total cost | Total cost |
| `invoicedCost` | Total cost | Invoiced cost |
| `margin` | Sales Order Product Margin | Margin amount |
| `itemMargin` | Item Margin | Item margin |
| `fulfilledRevenue` | Fulfilled revenue | Fulfilled revenue |
| `fulfilledMargin` | Fulfilled margin | Fulfilled margin |
| `quantity` | Qty fulfilled | **PRIMARY** - Quantity |
| `qtyFulfilled` | Qty fulfilled | Quantity fulfilled |
| `soCt` | So ct | Order count |
| `importedAt` | - | Timestamp of import |
| `source` | - | Always "fishbowl_unified" |

---

## 🔑 KEY FIELDS FOR COMMISSION CALCULATION

### Critical Fields:
1. **`postingDate`** (Timestamp) - Determines commission month
2. **`accountType`** - Determines commission rate (Wholesale vs Distributor)
3. **`customerId`** - Links orders to customers for history tracking
4. **`salesPerson`** - Identifies the sales rep
5. **`revenue`** / `totalPrice` - Commission base amount
6. **`partNumber`** - Product SKU for spiff matching

### Customer Age Calculation:
- Queries `fishbowl_sales_orders` by `customerId`
- Orders by `postingDate` ASC to find first order
- Calculates months since first order
- Determines: New (0-6mo), 6-Month (6-12mo), 12-Month (12+mo)

---

## ✅ PRESERVED FIELDS (Never Overwritten)

These fields are **PRESERVED** on subsequent imports:

1. **`fishbowl_customers.accountType`** - Manual admin corrections
2. **`fishbowl_customers.fishbowlUsername`** - Manual rep assignments

All other fields are **UPDATED** on each import.

---

## 🚀 IMPORT BEHAVIOR

### Deduplication:
- **Customers:** By `customerId` (Company id / Account ID)
- **Orders:** By `salesOrderNum` (Sales order Number)
- **Line Items:** By `lineItemId` (SO Item ID) - **OVERWRITES** existing

### Update Strategy:
- Customers: `batch.update()` if exists, `batch.set()` if new
- Orders: `batch.update()` if exists, `batch.set()` if new
- Line Items: `batch.set()` (complete overwrite, no merge)

---

## 📝 NOTES

- All date fields from Conversight are stored as strings or Timestamps
- Financial fields use `parseFloat()` for numeric conversion
- Empty fields default to empty string `''` or `0` for numbers
- All fields are created even if blank (placeholders for future use)
- Batch size: 400 operations per commit (Firestore limit is 500)

---

## 🔍 FIELD NAME VARIATIONS SUPPORTED

The import supports multiple field name variations:

- `Customer Id` / `Customer id` / `Company id` / `Account ID`
- `Account Type` / `Account type`
- `Sales order Id` / `Sales Order ID`
- `SO Item ID` / `So item id`
- `Product Custom Field 1` / `Product Custom 1` / `Product c1`

This ensures compatibility with different Conversight export formats.
