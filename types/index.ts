// Commission Calculator Types

export interface Rep {
  id: string;
  name: string;
  title: string;
  email: string;
  active: boolean;
  startDate: Date;
}

export interface Quarter {
  id: string;
  code: string; // e.g., "Q1-2025"
  startDate: Date;
  endDate: Date;
}

export interface CommissionBucket {
  id: string;
  code: string; // e.g., 'A', 'B', 'C', 'D', or custom
  name: string;
  weight: number; // 0-1 (e.g., 0.50 for 50%)
  hasSubGoals: boolean;
  active: boolean;
}

export interface ProductSubGoal {
  id: string;
  sku: string;
  productNum?: string; // Product number (same as sku, for compatibility)
  productDescription?: string; // Product description
  targetPercent: number; // 0-1 (e.g., 0.25 for 25%)
  subWeight: number; // 0-1 (e.g., 0.30 for 30%)
  msrp?: number;
  active: boolean;
  notes?: string;
}

export interface ActivitySubGoal {
  id: string;
  activity: string;
  goal: number; // Numeric goal (count/hours)
  subWeight: number; // 0-1 (e.g., 0.40 for 40%)
  dataSource: string;
  active: boolean;
  notes?: string;
}

export type RepRole = 'Account Manager' | 'Jr. Account Executive' | 'Account Executive' | 'Sr. Account Executive';

export interface RoleCommissionScale {
  role: RepRole;
  percentage: number; // 0-1 (e.g., 0.80 for 80% of max bonus)
}

export interface CommissionConfig {
  quarter: string; // e.g., "Q4 2025"
  maxBonusPerRep: number; // e.g., 25000 (for Sr. Account Executive)
  overPerfCap: number; // e.g., 1.25 for 125%
  minAttainment: number; // e.g., 0.75 for 75%
  buckets: CommissionBucket[];
  roleScales: RoleCommissionScale[]; // Different bonus amounts by role
  budgets?: BudgetByTitle[]; // Quarterly goals by rep title
}

export interface BudgetByTitle {
  title: string; // Rep title (e.g., "Account Executive")
  bucketA: number; // New Business goal ($)
  bucketB: number; // Product Mix goal ($)
  bucketC: number; // Maintain Business goal ($)
  bucketD: number; // Effort goal (count)
}

export interface BucketGoal {
  bucketCode: 'A' | 'B' | 'C' | 'D';
  goalValue: number | string; // Number for A/C, "See Sub-Goals" for B/D
}

export interface CommissionEntry {
  id: string;
  quarterId: string;
  repId: string;
  repName?: string; // Rep's full name for display
  bucketCode: 'A' | 'B' | 'C' | 'D';
  subGoalId?: string; // For B/D buckets
  subGoalLabel?: string; // Human-readable label
  goalValue: number;
  actualValue: number;
  attainment?: number; // Calculated: actualValue / goalValue
  bucketMax?: number; // Calculated: MaxBonus × BucketWeight × SubWeight (if any)
  payout?: number; // Calculated: IF(att<0.75, 0, MIN(att, 1.25) × bucketMax)
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CommissionPayout {
  id: string;
  entryId: string;
  attainment: number;
  payout: number;
  computedAt: Date;
}

export interface DashboardMetrics {
  totalPayout: number;
  avgAttainment: number;
  budget: number;
  utilization: number; // totalPayout / budget
}

export interface RepPerformance {
  repId: string;
  repName: string;
  totalPayout: number;
  avgAttainment: number;
  bucketPayouts: {
    A: number;
    B: number;
    C: number;
    D: number;
  };
  rank: number;
}

export interface BucketPerformance {
  bucketCode: 'A' | 'B' | 'C' | 'D';
  bucketName: string;
  maxPayout: number;
  attainment: number;
  payout: number;
  status: 'hit' | 'close' | 'low'; // ✓ Hit (>=100%), → Close (75-99%), ⚠ Low (<75%)
}

// Copper Integration Types
export interface CopperContext {
  type: string;
  id: string;
  name: string;
  email?: string;
  phone?: string;
  customFields?: any;
}

export interface CopperActivity {
  type: string;
  details: string;
  date: Date;
  parentType: string;
  parentId: string;
}

// Calculation Helper Types
export interface CalculationInput {
  goalValue: number;
  actualValue: number;
  maxBonus: number;
  bucketWeight: number;
  subWeight?: number; // For B/D buckets
  minAttainment: number; // 0.75
  maxAttainment: number; // 1.25
}

export interface CalculationResult {
  attainment: number;
  bucketMax: number;
  payout: number;
}
