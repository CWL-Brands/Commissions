import { CalculationInput, CalculationResult } from '@/types';

/**
 * Core commission calculation engine
 * Implements the 75% floor and 125% cap logic
 */

/**
 * Calculate attainment percentage
 * @param actual - Actual value achieved
 * @param goal - Goal value
 * @returns Attainment as decimal (e.g., 1.10 = 110%)
 */
export function calculateAttainment(actual: number, goal: number): number {
  if (goal === 0) return 0;
  return actual / goal;
}

/**
 * Apply floor and cap to attainment
 * @param attainment - Raw attainment value
 * @param minAttainment - Minimum threshold (default 0.75)
 * @param maxAttainment - Maximum cap (default 1.25)
 * @returns Capped attainment or 0 if below floor
 */
export function applyFloorAndCap(
  attainment: number,
  minAttainment: number = 0.75,
  maxAttainment: number = 1.25
): number {
  if (attainment < minAttainment) return 0;
  return Math.min(attainment, maxAttainment);
}

/**
 * Calculate bucket max payout
 * @param maxBonus - Maximum bonus per rep
 * @param bucketWeight - Bucket weight (0-1)
 * @param subWeight - Optional sub-weight for B/D buckets (0-1)
 * @returns Maximum payout for this bucket/row
 */
export function calculateBucketMax(
  maxBonus: number,
  bucketWeight: number,
  subWeight?: number
): number {
  if (subWeight !== undefined) {
    return maxBonus * bucketWeight * subWeight;
  }
  return maxBonus * bucketWeight;
}

/**
 * Calculate payout for a single entry
 * @param input - Calculation input parameters
 * @returns Calculation result with attainment, bucketMax, and payout
 */
export function calculatePayout(input: CalculationInput): CalculationResult {
  // Step 1: Calculate raw attainment
  const attainment = calculateAttainment(input.actualValue, input.goalValue);

  // Step 2: Calculate bucket max
  const bucketMax = calculateBucketMax(
    input.maxBonus,
    input.bucketWeight,
    input.subWeight
  );

  // Step 3: Apply floor and cap
  const cappedAttainment = applyFloorAndCap(
    attainment,
    input.minAttainment,
    input.maxAttainment
  );

  // Step 4: Calculate payout
  const payout = cappedAttainment * bucketMax;

  return {
    attainment,
    bucketMax,
    payout,
  };
}

/**
 * Calculate total payout for a bucket with sub-goals (B or D)
 * @param entries - Array of sub-goal entries
 * @param maxBonus - Maximum bonus per rep
 * @param bucketWeight - Bucket weight (0-1)
 * @param minAttainment - Minimum threshold (default 0.75)
 * @param maxAttainment - Maximum cap (default 1.25)
 * @returns Total bucket payout
 */
export function calculateBucketWithSubGoals(
  entries: Array<{
    goalValue: number;
    actualValue: number;
    subWeight: number;
  }>,
  maxBonus: number,
  bucketWeight: number,
  minAttainment: number = 0.75,
  maxAttainment: number = 1.25
): { totalPayout: number; rowResults: CalculationResult[] } {
  const rowResults: CalculationResult[] = [];
  let totalPayout = 0;

  for (const entry of entries) {
    const result = calculatePayout({
      goalValue: entry.goalValue,
      actualValue: entry.actualValue,
      maxBonus,
      bucketWeight,
      subWeight: entry.subWeight,
      minAttainment,
      maxAttainment,
    });

    rowResults.push(result);
    totalPayout += result.payout;
  }

  return { totalPayout, rowResults };
}

/**
 * Validate that weights sum to 100%
 * @param weights - Array of weight values (0-1)
 * @param tolerance - Acceptable deviation (default 0.0001)
 * @returns True if weights sum to ~1.0
 */
export function validateWeightsSum(
  weights: number[],
  tolerance: number = 0.0001
): boolean {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 1.0) < tolerance;
}

/**
 * Get status indicator based on attainment
 * @param attainment - Attainment value (0-1+)
 * @returns Status: 'hit' (>=100%), 'close' (75-99%), 'low' (<75%)
 */
export function getAttainmentStatus(
  attainment: number
): 'hit' | 'close' | 'low' {
  if (attainment >= 1.0) return 'hit';
  if (attainment >= 0.75) return 'close';
  return 'low';
}

/**
 * Format attainment as percentage string
 * @param attainment - Attainment value (0-1+)
 * @param decimals - Number of decimal places (default 1)
 * @returns Formatted percentage (e.g., "110.5%")
 */
export function formatAttainment(
  attainment: number,
  decimals: number = 1
): string {
  return `${(attainment * 100).toFixed(decimals)}%`;
}

/**
 * Format currency
 * @param amount - Dollar amount
 * @returns Formatted currency (e.g., "$25,000")
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
