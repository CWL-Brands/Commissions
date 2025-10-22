import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getCopperUserId } from '@/lib/copper/shared-data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

/**
 * Update Copper Company Owner (Assignee)
 * 
 * When a sales rep is changed in the app, this syncs it back to Copper
 * to keep the systems in sync.
 */

interface UpdateOwnerRequest {
  copperId: string;          // Copper company ID
  newSalesPerson: string;    // New sales rep username (e.g., "BenW", "DerekW")
  customerName?: string;     // For logging
}

export async function POST(request: NextRequest) {
  try {
    const { copperId, newSalesPerson, customerName }: UpdateOwnerRequest = await request.json();
    
    if (!copperId || !newSalesPerson) {
      return NextResponse.json({ 
        error: 'copperId and newSalesPerson required' 
      }, { status: 400 });
    }

    console.log(`🔄 Updating Copper owner for ${customerName || copperId}`);
    console.log(`   New sales rep: ${newSalesPerson}`);

    // Step 1: Get Copper user ID for this sales rep
    const usersSnapshot = await adminDb.collection('users')
      .where('salesPerson', '==', newSalesPerson)
      .where('isCommissioned', '==', true)
      .limit(1)
      .get();

    if (usersSnapshot.empty) {
      console.log(`⚠️  No user found with salesPerson: ${newSalesPerson}`);
      return NextResponse.json({ 
        error: `No user found for ${newSalesPerson}` 
      }, { status: 404 });
    }

    const userData = usersSnapshot.docs[0].data();
    const userEmail = userData.email;

    if (!userEmail) {
      return NextResponse.json({ 
        error: 'User email not found' 
      }, { status: 404 });
    }

    // Step 2: Get Copper user ID from settings/copper_users_map
    const copperUserId = await getCopperUserId(userEmail);

    if (!copperUserId) {
      console.log(`⚠️  No Copper user mapping for ${userEmail}`);
      console.log(`   💡 Add mapping to Firestore: settings/copper_users_map/${userEmail}`);
      return NextResponse.json({ 
        error: `No Copper mapping for ${userEmail}`,
        warning: 'Sales rep updated in Fishbowl but not synced to Copper'
      }, { status: 200 }); // Return 200 so Fishbowl update succeeds
    }

    console.log(`   Copper User ID: ${copperUserId} (${userEmail})`);

    // Step 3: Update Copper company owner via API
    const updateResponse = await fetch(`${COPPER_API_BASE}/companies/${copperId}`, {
      method: 'PUT',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        assignee_id: copperUserId
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`❌ Copper API error: ${updateResponse.status} - ${errorText}`);
      
      return NextResponse.json({ 
        error: `Copper API error: ${updateResponse.status}`,
        details: errorText,
        warning: 'Sales rep updated in Fishbowl but Copper sync failed'
      }, { status: 200 }); // Still return 200 so Fishbowl update succeeds
    }

    const updatedCompany = await updateResponse.json();

    console.log(`✅ Copper company updated successfully`);

    return NextResponse.json({ 
      success: true,
      copperId,
      copperUserId,
      newSalesPerson,
      customerName,
      userEmail,
      message: 'Sales rep updated in both Fishbowl and Copper'
    });

  } catch (error: any) {
    console.error('Error updating Copper owner:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update Copper',
      warning: 'Sales rep may have updated in Fishbowl only'
    }, { status: 200 }); // Return 200 so Fishbowl update still succeeds
  }
}
