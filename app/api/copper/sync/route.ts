import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { Timestamp } from 'firebase-admin/firestore';
import { getCopperUserId, getCopperMetadata, getUserData } from '@/lib/copper/shared-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

interface SyncMetricsRequest {
  userId: string;
  quarterId: string;
  startDate: string;
  endDate: string;
}

async function fetchWithRetry(url: string, init: RequestInit, retries = 4, baseDelayMs = 400): Promise<Response> {
  let attempt = 0;
  let lastErr: any = null;
  while (attempt <= retries) {
    const res = await fetch(url, init);
    if (res.ok) return res;
    if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
      const delay = Math.min(5000, baseDelayMs * Math.pow(2, attempt));
      await new Promise(r => setTimeout(r, delay));
      attempt++;
      continue;
    }
    lastErr = new Error(`${url} -> ${res.status}`);
    break;
  }
  throw lastErr || new Error('Copper request failed');
}

async function fetchAll(endpoint: string, body: any) {
  const all: any[] = [];
  const pageSize = Number(body?.page_size) || 200;
  let page = 1;
  while (true) {
    const res = await fetchWithRetry(`${COPPER_API_BASE}${endpoint}`, {
      method: 'POST',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ...body, page_number: page, page_size: pageSize }),
    });
    if (!res.ok) break;
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    page += 1;
    if (page > 50) break;
  }
  return all;
}

export async function POST(request: NextRequest) {
  try {
    const { userId, quarterId, startDate, endDate }: SyncMetricsRequest = await request.json();
    
    if (!userId || !quarterId) {
      return NextResponse.json({ error: 'userId and quarterId required' }, { status: 400 });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const startUnix = Math.floor(start.getTime() / 1000);
    const endUnix = Math.floor(end.getTime() / 1000);

    // Check database initialization
    if (!adminDb) {
      return NextResponse.json({ error: 'Database not initialized' }, { status: 500 });
    }
    
    // Load user data from shared users collection
    const userData = await getUserData(userId);
    const userEmail = userData?.email;
    
    if (!userEmail) {
      return NextResponse.json({ error: 'User email not found' }, { status: 404 });
    }

    // Get Copper user ID from shared copper_users_map
    const ownerId = await getCopperUserId(userEmail);
    
    if (!ownerId) {
      return NextResponse.json({ 
        error: `No Copper user mapping found for ${userEmail}` 
      }, { status: 404 });
    }

    // Load Copper metadata for configuration
    const metadata = await getCopperMetadata();
    const closedWonStages = metadata?.defaults?.CLOSED_WON_STAGES || ['Payment Received'];
    const results = {
      opportunities: 0,
      revenue: 0,
      activities: 0,
    };

    // Sync opportunities (for New Business and Maintain Business buckets)
    try {
      const opps = await fetchAll('/opportunities/search', {
        sort_by: 'name',
        sort_direction: 'asc',
        assignee_ids: [ownerId],
        minimum_close_date: startUnix,
        maximum_close_date: endUnix,
      });

      if (Array.isArray(opps)) {
        results.opportunities = opps.length;
        
        // Calculate total revenue from closed-won opportunities using shared config
        const revenue = opps
          .filter((opp: any) => closedWonStages.includes(opp.pipeline_stage_name || opp.stage_name))
          .reduce((sum: number, opp: any) => sum + (opp.monetary_value || 0), 0);
        
        results.revenue = revenue;

        // Create/update commission entry for Bucket C (Maintain Business)
        const entryId = `${userId}_C_${quarterId}`;
        await adminDb.collection('commission_entries').doc(entryId).set({
          id: entryId,
          quarterId,
          repId: userId,
          bucketCode: 'C',
          goalValue: 0, // Admin sets this in settings
          actualValue: revenue,
          notes: `Auto-synced from Copper on ${new Date().toISOString()}`,
          updatedAt: Timestamp.fromDate(new Date()),
        }, { merge: true });
      }
    } catch (error) {
      console.error('Error syncing opportunities:', error);
    }

    // Sync activities (for Effort bucket)
    try {
      const activities = await fetchAll('/activities/search', {
        sort_by: 'activity_date',
        sort_direction: 'desc',
        user_ids: [ownerId],
        minimum_activity_date: startUnix,
        maximum_activity_date: endUnix,
      });

      if (Array.isArray(activities)) {
        results.activities = activities.length;

        // Count by activity type
        const activityCounts: Record<string, number> = {};
        activities.forEach((activity: any) => {
          const type = activity.type?.name || 'Unknown';
          activityCounts[type] = (activityCounts[type] || 0) + 1;
        });

        // Update commission entries for Bucket D (Effort) sub-goals
        // Match activity types to configured activities from shared metadata
        const userActivityTypes = metadata?.activityTypes?.user || [];
        const activitiesSnapshot = await adminDb.collection('activities').where('active', '==', true).get();
        
        for (const activityDoc of activitiesSnapshot.docs) {
          const activityConfig = activityDoc.data();
          const activityName = activityConfig.activity;
          
          // Match activity name with Copper activity types
          const copperActivityType = userActivityTypes.find((at: any) => 
            at.name?.toLowerCase() === activityName?.toLowerCase()
          );
          
          const actualCount = activityCounts[activityName] || 0;
          
          const entryId = `${userId}_D_${activityDoc.id}_${quarterId}`;
          await adminDb.collection('commission_entries').doc(entryId).set({
            id: entryId,
            quarterId,
            repId: userId,
            bucketCode: 'D',
            subGoalId: activityDoc.id,
            subGoalLabel: activityName,
            copperActivityTypeId: copperActivityType?.id,
            goalValue: activityConfig.goal || 0,
            actualValue: actualCount,
            notes: `Auto-synced from Copper on ${new Date().toISOString()}`,
            updatedAt: Timestamp.fromDate(new Date()),
          }, { merge: true });
        }
      }
    } catch (error) {
      console.error('Error syncing activities:', error);
    }

    return NextResponse.json({ 
      success: true, 
      userId, 
      quarterId,
      copperUserId: ownerId,
      userEmail,
      results,
      metadata: {
        closedWonStages,
        activityTypesCount: metadata?.activityTypes?.user?.length || 0
      }
    });
  } catch (error: any) {
    console.error('Sync error:', error);
    return NextResponse.json({ 
      error: error.message || 'Sync failed' 
    }, { status: 500 });
  }
}
