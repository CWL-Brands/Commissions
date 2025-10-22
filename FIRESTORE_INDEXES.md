# Firestore Composite Index Requirements

These indexes are required for optimal query performance with the unified import and commission calculator.

## Required Composite Indexes

### 1. fishbowl_sales_orders
**Purpose**: Filter orders by commission month and sales person for commission calculations

```
Collection: fishbowl_sales_orders
Fields:
  - commissionMonth (Ascending)
  - salesPerson (Ascending)
```

### 2. fishbowl_soitems (Order Items Query)
**Purpose**: Retrieve all line items for a specific order

```
Collection: fishbowl_soitems
Fields:
  - salesOrderId (Ascending)
  - commissionMonth (Ascending)
```

### 3. fishbowl_soitems (Product Query)
**Purpose**: Find all line items for a specific product in a month (for spiff calculations)

```
Collection: fishbowl_soitems
Fields:
  - commissionMonth (Ascending)
  - partNumber (Ascending)
```

### 4. monthly_commissions
**Purpose**: Retrieve all commission records for a rep/month combination

```
Collection: monthly_commissions
Fields:
  - commissionMonth (Ascending)
  - salesPerson (Ascending)
```

### 5. spiff_earnings
**Purpose**: Retrieve all spiff earnings for a rep/month combination

```
Collection: spiff_earnings
Fields:
  - commissionMonth (Ascending)
  - salesPerson (Ascending)
```

## How to Create These Indexes

### Option 1: Firebase Console (Recommended for Production)
1. Go to Firebase Console → Firestore Database → Indexes
2. Click "Create Index"
3. Enter the collection name and field configurations above
4. Click "Create"

### Option 2: Automatic Creation (Development)
The first time you run a query that needs an index, Firestore will provide a clickable link in the error message to create it automatically.

### Option 3: Firebase CLI (`firestore.indexes.json`)
Add to your `firestore.indexes.json` file:

```json
{
  "indexes": [
    {
      "collectionGroup": "fishbowl_sales_orders",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "commissionMonth", "order": "ASCENDING" },
        { "fieldPath": "salesPerson", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "fishbowl_soitems",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "salesOrderId", "order": "ASCENDING" },
        { "fieldPath": "commissionMonth", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "fishbowl_soitems",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "commissionMonth", "order": "ASCENDING" },
        { "fieldPath": "partNumber", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "monthly_commissions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "commissionMonth", "order": "ASCENDING" },
        { "fieldPath": "salesPerson", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "spiff_earnings",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "commissionMonth", "order": "ASCENDING" },
        { "fieldPath": "salesPerson", "order": "ASCENDING" }
      ]
    }
  ]
}
```

Then deploy with:
```bash
firebase deploy --only firestore:indexes
```

## Index Creation Time
- Small datasets (<1000 docs): ~5 minutes
- Medium datasets (1000-10000 docs): ~15-30 minutes
- Large datasets (>10000 docs): Can take hours

You can continue development while indexes are building, but queries will be slower until complete.
