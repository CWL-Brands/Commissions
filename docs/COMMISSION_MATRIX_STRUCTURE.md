# Commission Calculator - Complete System Structure

## 🎯 **CRITICAL: Two Separate Compensation Systems**

This app manages **TWO DISTINCT** compensation systems:

### 1. **Quarterly Bonus System** (Performance Bonuses)
- **What**: Goal-based quarterly bonuses tied to performance buckets
- **When**: Calculated quarterly (Q1, Q2, Q3, Q4)
- **How**: Attainment % against goals → Bonus payout
- **Max Payout**: $25,000 per rep per quarter (configurable by role)
- **Buckets**: A (New Business), B (Product Mix), C (Maintain), D (Effort)
- **Collections**: `commission_entries`, `commission_payouts`, `settings/commission_config`, `settings/bonus_scales`

### 2. **Monthly Commission System** (Ongoing Sales Commissions)
- **What**: Percentage-based commissions on every sales order
- **When**: Calculated monthly from Fishbowl sales orders
- **How**: Order revenue × Commission rate (based on title/segment/status)
- **Rates**: Variable (3%-10%) based on customer type and rep title
- **Collections**: `monthly_commissions`, `monthly_commission_summary`, `settings/commission_rates`

---

## ⚠️ **IMPORTANT TERMINOLOGY**

**Quarterly System** = "BONUS" (not commission)
**Monthly System** = "COMMISSION" (not bonus)

**DO NOT MIX THESE TERMS!**

---

## Monthly Commission System Design

### Commission Matrix Variables

#### 1. **Sales Rep Title** (Scalable)
- Account Executive
- Jr. Account Executive  
- Account Manager
- Sr. Account Executive
- *(Admin can add more)*

#### 2. **Customer Segment**
- Distribution
- Wholesale

#### 3. **Customer Status (Time-Based)**
- **New Business** - No orders in last 12 months OR new customer
- **6-Month Business** - Ordered within last 6 months
- **12-Month Business** - Ordered within last 12 months

#### 4. **Special Cases**
- **Rep Transfer** - Customer changes sales rep
  - If new to the rep: Treated as "New Business" with special rate
  - Configurable payout amount

---

## Commission Rate Matrix

### Example Structure:

| Title | Segment | Customer Status | Commission % | Notes |
|-------|---------|----------------|--------------|-------|
| Account Executive | Distribution | New (0-12mo inactive) | 8% | First order after 12mo |
| Account Executive | Distribution | 6-Month Active | 5% | Ordered in last 6mo |
| Account Executive | Distribution | 12-Month Active | 3% | Ordered 6-12mo ago |
| Account Executive | Wholesale | New (0-12mo inactive) | 10% | First order after 12mo |
| Account Executive | Wholesale | 6-Month Active | 7% | Ordered in last 6mo |
| Account Executive | Wholesale | 12-Month Active | 5% | Ordered 6-12mo ago |
| Jr. Account Executive | Distribution | New | 6% | Lower rate for Jr. |
| Jr. Account Executive | Distribution | 6-Month Active | 4% | |
| Jr. Account Executive | Distribution | 12-Month Active | 2% | |
| Jr. Account Executive | Wholesale | New | 8% | |
| Jr. Account Executive | Wholesale | 6-Month Active | 5% | |
| Jr. Account Executive | Wholesale | 12-Month Active | 3% | |

### Rep Transfer Special Rate:
- **New Rep Assigned**: $500 flat fee OR 5% (whichever is greater)
- Applies when customer changes from Rep A to Rep B

---

## Firestore Structure

### Collection: `settings/commission_rates`

```javascript
{
  // Commission rate matrix
  rates: [
    {
      id: "ae_dist_new",
      title: "Account Executive",
      segment: "Distribution",
      customerStatus: "new",
      statusDefinition: "No orders in last 12 months",
      commissionPercent: 8.0,
      active: true,
      notes: "New business rate"
    },
    {
      id: "ae_dist_6mo",
      title: "Account Executive",
      segment: "Distribution",
      customerStatus: "6month",
      statusDefinition: "Ordered within last 6 months",
      commissionPercent: 5.0,
      active: true,
      notes: "Active customer rate"
    },
    {
      id: "ae_dist_12mo",
      title: "Account Executive",
      segment: "Distribution",
      customerStatus: "12month",
      statusDefinition: "Ordered 6-12 months ago",
      commissionPercent: 3.0,
      active: true,
      notes: "Maintaining customer rate"
    },
    // ... more rates for each combination
  ],
  
  // Special rules
  specialRules: {
    repTransfer: {
      enabled: true,
      flatFee: 500,
      percentFallback: 5.0,
      useGreater: true,
      description: "When customer changes sales rep"
    },
    inactivityThreshold: {
      newBusinessMonths: 12,
      description: "Customer reverts to 'new' after 12 months of no orders"
    }
  },
  
  // Available titles (scalable)
  titles: [
    "Account Executive",
    "Jr. Account Executive",
    "Account Manager",
    "Sr. Account Executive"
  ],
  
  // Customer segments
  segments: [
    {
      id: "distribution",
      name: "Distribution",
      description: "Distributors and resellers"
    },
    {
      id: "wholesale",
      name: "Wholesale",
      description: "Direct wholesale customers"
    }
  ]
}
```

---

## Settings Page - New Tab Structure

### Tab 1: **Quarterly Bonus**
- Commission Buckets (A, B, C, D)
- Bucket Weights
- Product Mix Sub-Goals
- Effort Sub-Goals
- Quarterly Budgets
- Quarterly Goals by Title

### Tab 2: **Monthly Commissions** (NEW)
- Commission Rate Matrix
- Customer Segments
- Time Period Rules
- Special Rules (Rep Transfer, etc.)
- Title Management

### Tab 3: **Sales Team**
- Sales Team Roster
- Rep Details
- Fishbowl Usernames

---

## Commission Calculation Logic

### Monthly Commission Calculation:

```javascript
function calculateMonthlyCommission(order) {
  // 1. Get rep's title
  const repTitle = getRep(order.salesPerson).title;
  
  // 2. Determine customer segment
  const segment = getCustomerSegment(order.customerId);
  
  // 3. Determine customer status
  const lastOrderDate = getLastOrderDate(order.customerId, order.salesPerson);
  const monthsSinceLastOrder = getMonthsDiff(lastOrderDate, order.date);
  
  let customerStatus;
  if (monthsSinceLastOrder >= 12 || !lastOrderDate) {
    customerStatus = "new";
  } else if (monthsSinceLastOrder <= 6) {
    customerStatus = "6month";
  } else {
    customerStatus = "12month";
  }
  
  // 4. Check for rep transfer
  const previousRep = getPreviousRep(order.customerId);
  if (previousRep && previousRep !== order.salesPerson) {
    // Apply rep transfer rule
    const transferRule = getSpecialRule("repTransfer");
    const flatFee = transferRule.flatFee;
    const percentCommission = order.revenue * (transferRule.percentFallback / 100);
    return Math.max(flatFee, percentCommission);
  }
  
  // 5. Look up commission rate
  const rate = getCommissionRate(repTitle, segment, customerStatus);
  
  // 6. Calculate commission
  return order.revenue * (rate.commissionPercent / 100);
}
```

---

## UI Design - Commission Matrix Editor

```
┌─────────────────────────────────────────────────────────────────┐
│ Monthly Commission Rates                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│ Filter by Title: [All Titles ▼]                                │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Account Executive - Distribution                           │  │
│ ├───────────────────────────────────────────────────────────┤  │
│ │ New Business (12+ mo inactive)      [8.0] %    [Active ✓] │  │
│ │ 6-Month Active                      [5.0] %    [Active ✓] │  │
│ │ 12-Month Active                     [3.0] %    [Active ✓] │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Account Executive - Wholesale                              │  │
│ ├───────────────────────────────────────────────────────────┤  │
│ │ New Business (12+ mo inactive)      [10.0] %   [Active ✓] │  │
│ │ 6-Month Active                      [7.0] %    [Active ✓] │  │
│ │ 12-Month Active                     [5.0] %    [Active ✓] │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Special Rules                                              │  │
│ ├───────────────────────────────────────────────────────────┤  │
│ │ Rep Transfer:                                              │  │
│ │   Flat Fee: $ [500]                                        │  │
│ │   Percent Fallback: [5.0] %                                │  │
│ │   Use Greater: [✓]                                         │  │
│ │                                                            │  │
│ │ Inactivity Threshold:                                      │  │
│ │   Revert to New After: [12] months                         │  │
│ └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│                                          [Save Commission Rates] │
└─────────────────────────────────────────────────────────────────┘
```

---

## Implementation Plan

### Phase 1: Settings UI
1. Add tabs to Settings page (Quarterly Bonus, Monthly Commissions, Sales Team)
2. Build Commission Matrix editor
3. Add Title management (add/remove titles)
4. Add Segment management
5. Add Special Rules editor

### Phase 2: Calculation Engine
1. Create `calculateMonthlyCommission()` function
2. Determine customer status from order history
3. Handle rep transfer logic
4. Apply commission rates from matrix

### Phase 3: Monthly Commission Tracking
1. New collection: `monthly_commissions`
2. Calculate commissions per order
3. Aggregate by rep per month
4. Display in Reports page

### Phase 4: Integration
1. Connect to Fishbowl order data
2. Track customer order history
3. Detect rep changes
4. Generate monthly commission reports

---

## Questions to Clarify

1. **Customer Segment Detection**: How do we determine if a customer is Distribution vs Wholesale?
   - Is it a field in Fishbowl?
   - Do we need to manually tag customers?
   - Is it based on order volume/type?

2. **Rep Transfer Detection**: How do we know when a customer changes reps?
   - Is there a history in Fishbowl?
   - Do we track it manually?
   - Is it based on the salesPerson field changing?

3. **Order History**: Do we need to import historical orders to determine customer status?
   - Or do we start fresh and track going forward?

4. **Commission Payout Timing**: When are commissions paid?
   - Monthly on the 1st?
   - After order ships?
   - After payment received?

5. **Revenue Calculation**: What revenue amount do we use?
   - Gross revenue?
   - Net revenue (after discounts)?
   - Margin?

Let me know your answers and I'll build this out! 🚀
