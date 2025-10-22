import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

/**
 * Sync Copper → Fishbowl
 * 
 * Matches ACTIVE Copper companies to Fishbowl customers by:
 * - Company Name
 * - Street Address
 * - City
 * - State
 * - Zip
 * 
 * Updates fishbowl_customers with:
 * - accountType from Copper (Distributor/Wholesale/Retail)
 * - copperId from Copper
 * - accountTypeSource = "copper_sync"
 */

// State abbreviation mapping
const stateMap: Record<string, string> = {
  'alabama': 'al', 'alaska': 'ak', 'arizona': 'az', 'arkansas': 'ar', 'california': 'ca',
  'colorado': 'co', 'connecticut': 'ct', 'delaware': 'de', 'florida': 'fl', 'georgia': 'ga',
  'hawaii': 'hi', 'idaho': 'id', 'illinois': 'il', 'indiana': 'in', 'iowa': 'ia',
  'kansas': 'ks', 'kentucky': 'ky', 'louisiana': 'la', 'maine': 'me', 'maryland': 'md',
  'massachusetts': 'ma', 'michigan': 'mi', 'minnesota': 'mn', 'mississippi': 'ms',
  'missouri': 'mo', 'montana': 'mt', 'nebraska': 'ne', 'nevada': 'nv', 'new hampshire': 'nh',
  'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny', 'north carolina': 'nc',
  'north dakota': 'nd', 'ohio': 'oh', 'oklahoma': 'ok', 'oregon': 'or', 'pennsylvania': 'pa',
  'rhode island': 'ri', 'south carolina': 'sc', 'south dakota': 'sd', 'tennessee': 'tn',
  'texas': 'tx', 'utah': 'ut', 'vermont': 'vt', 'virginia': 'va', 'washington': 'wa',
  'west virginia': 'wv', 'wisconsin': 'wi', 'wyoming': 'wy'
};

// Normalize string for matching (lowercase, trim, remove extra spaces)
function normalize(s: any): string {
  if (!s) return '';
  return String(s).toLowerCase().trim().replace(/\s+/g, ' ');
}

// Normalize state to 2-letter abbreviation
function normalizeState(s: any): string {
  if (!s) return '';
  const lower = String(s).toLowerCase().trim();
  // If already 2 letters, return lowercase
  if (lower.length === 2) return lower;
  // Otherwise look up in state map
  return stateMap[lower] || lower;
}

// Map Copper accountType values to commission system values
function normalizeAccountType(copperType: string): string {
  if (!copperType || copperType.trim() === '') return 'Retail';
  
  const normalized = copperType.toLowerCase().trim();
  
  // Distributor (gets commission)
  if (normalized === 'distributor' || normalized.includes('distributor')) return 'Distributor';
  
  // Wholesale (gets commission)
  // - "Wholesale" (explicit)
  // - "Independent Store" (independently owned, buying wholesale)
  // - "Chain" (chain stores like 7-11, buying wholesale) BUT NOT "Chain HQ"
  // - "Cash & Carry" (wholesale customers)
  if (normalized === 'wholesale') return 'Wholesale';
  if (normalized === 'independent store') return 'Wholesale';
  if (normalized === 'chain') return 'Wholesale'; // Only exact "Chain", not "Chain HQ"
  if (normalized.includes('cash & carry')) return 'Wholesale';
  
  // Retail (NO commission)
  // - "Chain HQ" (corporate, no commission)
  // - Everything else (end consumers)
  if (normalized === 'chain hq') return 'Retail';
  
  // Default to Retail
  console.log(`⚠️ Unknown Copper accountType: "${copperType}" - defaulting to Retail`);
  return 'Retail';
}

// Create composite key for matching
function makeKey(name: string, street: string, city: string, state: string, zip: any): string {
  const n = normalize(name);
  const st = normalize(street);
  const c = normalize(city);
  const s = normalizeState(state); // Use state normalizer
  const z = String(zip || '').trim();
  return `${n}|${st}|${c}|${s}|${z}`;
}

interface SyncStats {
  copperLoaded: number;
  fishbowlLoaded: number;
  matched: number;
  updated: number;
  alreadyCorrect: number;
  noMatch: number;
}

async function syncCopperToFishbowl(): Promise<SyncStats> {
  console.log('🔄 Starting Copper → Fishbowl sync...');
  
  const stats: SyncStats = {
    copperLoaded: 0,
    fishbowlLoaded: 0,
    matched: 0,
    updated: 0,
    alreadyCorrect: 0,
    noMatch: 0
  };
  
  // STEP 1: Load ACTIVE Copper companies WITH Account Order ID populated
  console.log('📥 Loading ACTIVE Copper companies with Account Order ID...');
  const fieldActive = 'Active Customer cf_712751';
  const fieldType = 'Account Type cf_675914'; // Contains "Distributor", "Wholesale", or empty (Retail)
  const fieldCopperId = 'Account ID cf_713477';
  const fieldAccountOrderId = 'Account Order ID cf_698467'; // Direct match to Fishbowl accountNumber
  const fieldName = 'Name';
  
  // Load ALL Copper companies and filter in memory (avoids index requirements)
  console.log('📥 Fetching all Copper companies...');
  const allCopperSnap = await adminDb.collection('copper_companies').get();
  console.log(`📦 Retrieved ${allCopperSnap.size} total Copper companies`);
  
  // Build Copper lookup map (by Account Order ID = Fishbowl accountNumber)
  const copperByAccountNumber = new Map<string, { accountType: string; copperId: any; name: string }>();
  
  let debugCount = 0;
  let withAccountOrderId = 0;
  let activeCount = 0;
  
  allCopperSnap.forEach(doc => {
    const d = doc.data() || {};
    const name = d[fieldName] ?? d['name'];
    const accountType = d[fieldType]; // "Distributor", "Wholesale", or empty
    const copperId = d[fieldCopperId] ?? doc.id;
    const accountOrderId = d[fieldAccountOrderId]; // This matches Fishbowl accountNumber
    const isActive = d[fieldActive];
    
    // Filter: ACTIVE companies only
    const activeValues = ['checked', 'true', 'Checked', true];
    if (!activeValues.includes(isActive)) {
      return; // Skip inactive companies
    }
    activeCount++;
    
    // ONLY include companies that have Account Order ID populated
    if (!accountOrderId || accountOrderId === '' || accountOrderId === null) {
      return; // Skip companies without Account Order ID
    }
    
    withAccountOrderId++;
    
    // Debug first 5 Copper records
    if (debugCount < 5) {
      console.log(`🔍 Copper ${debugCount + 1}: "${name}"`);
      console.log(`   Account Order ID: ${accountOrderId}`);
      console.log(`   Account Type: ${accountType || '(empty - will be Retail)'}`);
      console.log(`   Copper ID: ${copperId}`);
      debugCount++;
    }
    
    // Key by Account Order ID (direct match to Fishbowl accountNumber)
    const key = String(accountOrderId).trim();
    const normalizedAccountType = normalizeAccountType(accountType || '');
    
    copperByAccountNumber.set(key, {
      accountType: normalizedAccountType,
      copperId: copperId,
      name: String(name)
    });
    
    stats.copperLoaded++;
  });
  
  console.log(`✅ Loaded ${stats.copperLoaded} ACTIVE Copper companies with Account Order ID`);
  console.log(`   (${withAccountOrderId} have Account Order ID populated)`);
  
  // STEP 2: Load ALL Fishbowl customers
  console.log('📥 Loading Fishbowl customers...');
  const fishbowlSnap = await adminDb.collection('fishbowl_customers').get();
  stats.fishbowlLoaded = fishbowlSnap.size;
  console.log(`✅ Loaded ${stats.fishbowlLoaded} Fishbowl customers`);
  
  // STEP 3: Match and update
  console.log('🔍 Matching and updating...');
  let batch = adminDb.batch();
  let batchCount = 0;
  const MAX_BATCH = 450;
  
  let fbDebugCount = 0;
  for (const doc of fishbowlSnap.docs) {
    const d = doc.data() || {};
    
    // Get Fishbowl accountNumber (directly matches Copper Account Order ID)
    const name = d.name ?? d.customerName;
    const accountNumber = d.accountNumber ?? d.accountId;
    
    if (!accountNumber) {
      stats.noMatch++;
      continue;
    }
    
    // Direct lookup by Account Number
    const accountNumberKey = String(accountNumber).trim();
    const copper = copperByAccountNumber.get(accountNumberKey);
    
    // Debug first 5 Fishbowl records
    if (fbDebugCount < 5) {
      console.log(`🐟 Fishbowl ${fbDebugCount + 1}: "${name}"`);
      console.log(`   Account Number: ${accountNumber}`);
      console.log(`   Match: ${copper ? '✅ ' + copper.name + ' (' + copper.accountType + ')' : '❌ No Copper match'}`);
      fbDebugCount++;
    }
    
    if (!copper) {
      stats.noMatch++;
      continue;
    }
    
    stats.matched++;
    
    // Check if already correct
    if (d.accountType === copper.accountType && 
        d.accountTypeSource === 'copper_sync' &&
        d.copperId === copper.copperId) {
      stats.alreadyCorrect++;
      continue;
    }
    
    // Update needed
    const updateData = {
      accountType: copper.accountType,
      accountTypeSource: 'copper_sync',
      copperId: copper.copperId,
      copperSyncedAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    };
    
    batch.update(doc.ref, updateData);
    batchCount++;
    stats.updated++;
    
    // Commit batch if full
    if (batchCount >= MAX_BATCH) {
      await batch.commit();
      console.log(`✅ Committed batch of ${batchCount} updates`);
      batch = adminDb.batch();
      batchCount = 0;
    }
    
    // Log progress every 100 matches
    if (stats.matched % 100 === 0) {
      console.log(`📊 Matched: ${stats.matched}, Updated: ${stats.updated}`);
    }
  }
  
  // Final commit
  if (batchCount > 0) {
    await batch.commit();
    console.log(`✅ Committed final batch of ${batchCount} updates`);
  }
  
  console.log('\n✅ Sync Complete!');
  console.log(`   Copper companies loaded: ${stats.copperLoaded}`);
  console.log(`   Fishbowl customers loaded: ${stats.fishbowlLoaded}`);
  console.log(`   Matched: ${stats.matched}`);
  console.log(`   Updated: ${stats.updated}`);
  console.log(`   Already correct: ${stats.alreadyCorrect}`);
  console.log(`   No match: ${stats.noMatch}`);
  
  return stats;
}

/**
 * POST /api/sync-copper-to-fishbowl
 * Sync Copper accountType data to Fishbowl customers
 */
export async function POST() {
  try {
    const stats = await syncCopperToFishbowl();
    
    return NextResponse.json({
      success: true,
      message: 'Copper → Fishbowl sync completed successfully',
      stats
    });
    
  } catch (error: any) {
    console.error('Error syncing Copper to Fishbowl:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to sync Copper to Fishbowl' },
      { status: 500 }
    );
  }
}
