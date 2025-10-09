# Commission Structure Design

## Goal Types by Bucket

### Bucket A - New Business (50% weight)
**Goal Type:** Revenue Target
- **Metric:** Total revenue from NEW customers
- **Goal Value:** $200,000 (for Account Executives)
- **Varies by Title:** Yes
  - Account Executive: $200,000
  - Jr. Account Executive: $100,000
  - Sr. Account Executive: $300,000

### Bucket B - Product Mix (15% weight)
**Goal Type:** Product-Specific Revenue Targets
- **Metric:** Revenue per product SKU
- **Has Sub-Goals:** Yes (each product has its own target)
- **Example:**
  - Rebasen 80mg: Target 10%, Sub-Weight 10%, MSRP $9.99
  - Zoom: Target 10%, Sub-Weight 10%, MSRP $6.99
  - Mango: Target 10%, Sub-Weight 10%, MSRP $9.99

### Bucket C - Maintain Business (20% weight)
**Goal Type:** Revenue Target
- **Metric:** Total revenue from EXISTING customers
- **Goal Value:** $500,000 (for Account Executives)
- **Varies by Title:** Yes

### Bucket D - Effort (15% weight)
**Goal Type:** Activity-Based Goals
- **Metric:** Count of activities completed
- **Has Sub-Goals:** Yes (each activity has its own target)
- **Example:**
  - Phone Calls: Goal 1200, Sub-Weight 30%, Data Source: JustCall
  - Emails Sent: Goal 600, Sub-Weight 25%, Data Source: Copper CRM
  - SMS Messages: Goal 600, Sub-Weight 20%, Data Source: JustCall

## Firestore Structure

```javascript
settings/commission_config = {
  buckets: [
    {
      id: "A",
      code: "A",
      name: "New Business",
      weight: 0.5,
      active: true,
      hasSubGoals: false,
      goalType: "revenue", // revenue, count, percentage
      metric: "newCustomerRevenue",
      goalsByTitle: {
        "Account Executive": 200000,
        "Jr. Account Executive": 100000,
        "Sr. Account Executive": 300000,
      }
    },
    {
      id: "B",
      code: "B",
      name: "Product Mix",
      weight: 0.15,
      active: true,
      hasSubGoals: true,
      goalType: "revenue",
      metric: "productRevenue",
      // Sub-goals defined in products collection
    },
    {
      id: "C",
      code: "C",
      name: "Maintain Business",
      weight: 0.2,
      active: true,
      hasSubGoals: false,
      goalType: "revenue",
      metric: "existingCustomerRevenue",
      goalsByTitle: {
        "Account Executive": 500000,
        "Jr. Account Executive": 300000,
        "Sr. Account Executive": 750000,
      }
    },
    {
      id: "D",
      code: "D",
      name: "Effort",
      weight: 0.15,
      active: true,
      hasSubGoals: true,
      goalType: "count",
      metric: "activityCount",
      // Sub-goals defined in activities collection
    }
  ],
  
  // Quarterly budgets remain the same
  budgets: [
    {
      title: "Account Executive",
      bucketA: 25000,
      bucketB: 125000,
      bucketC: 75000,
      bucketD: 0.75 // 75% attainment default
    }
  ]
}
```

## How It Works

1. **Admin sets up goals in Settings:**
   - Bucket A: $200K new business for AEs
   - Bucket B: Product targets (via Product Mix section)
   - Bucket C: $500K maintain business for AEs
   - Bucket D: Activity targets (via Effort section)

2. **Calculate Commissions button:**
   - Fetches actual values from Fishbowl
   - Fetches goal values from Settings (based on rep's title)
   - Creates commission_entries with BOTH goalValue and actualValue
   - Calculates attainment automatically

3. **Database page:**
   - Shows pre-filled entries
   - Admin can adjust goals if needed
   - Everything else is read-only

4. **Reports page:**
   - Reads from commission_entries
   - Shows attainment vs goals
   - All connected to Settings configuration
