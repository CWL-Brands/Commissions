import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COPPER_API_BASE = 'https://api.copper.com/developer_api/v1';
const COPPER_API_KEY = process.env.COPPER_API_KEY!;
const COPPER_USER_EMAIL = process.env.COPPER_USER_EMAIL!;

/**
 * Update Copper Company Account Type
 * 
 * When account type is changed in the app, this syncs it back to Copper
 * custom field "Account Type cf_675914"
 */

interface UpdateAccountTypeRequest {
  copperId: string;          // Copper company ID
  accountType: string;       // "Distributor", "Wholesale", or "Retail"
  customerName?: string;     // For logging
}

export async function POST(request: NextRequest) {
  try {
    const { copperId, accountType, customerName }: UpdateAccountTypeRequest = await request.json();
    
    if (!copperId || !accountType) {
      return NextResponse.json({ 
        error: 'copperId and accountType required' 
      }, { status: 400 });
    }

    console.log(`🔄 Updating Copper Account Type for ${customerName || copperId}`);
    console.log(`   New account type: ${accountType}`);

    // Account Type custom field ID in Copper: cf_675914
    const ACCOUNT_TYPE_FIELD_ID = 675914;

    // Account Type is a MultiSelect field - need to send option IDs, not strings!
    const ACCOUNT_TYPE_OPTIONS: Record<string, number> = {
      'Distributor': 1981470,
      'Wholesale': 2063862,
      'Retail': 2066840
    };

    // Map our values to Copper option IDs (MultiSelect requires array of IDs)
    const optionId = ACCOUNT_TYPE_OPTIONS[accountType];
    const copperAccountType = optionId ? [optionId] : []; // Array of option IDs, or empty array

    console.log(`   Copper field ID: ${ACCOUNT_TYPE_FIELD_ID}`);
    console.log(`   Account type: "${accountType}" → Option ID: ${optionId}`);

    // First, get the current company data to preserve other fields
    const getResponse = await fetch(`${COPPER_API_BASE}/companies/${copperId}`, {
      method: 'GET',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
      }
    });

    if (!getResponse.ok) {
      console.error(`❌ Failed to fetch company: ${getResponse.status}`);
      return NextResponse.json({ 
        error: `Failed to fetch company: ${getResponse.status}`,
        warning: 'Account type updated in Fishbowl but Copper sync failed'
      }, { status: 200 });
    }

    const companyData = await getResponse.json();
    
    // Find and update the custom field in existing data
    let customFields = companyData.custom_fields || [];
    const fieldIndex = customFields.findIndex((f: any) => f.custom_field_definition_id === ACCOUNT_TYPE_FIELD_ID);
    
    if (fieldIndex >= 0) {
      // Update existing field
      customFields[fieldIndex].value = copperAccountType;
    } else {
      // Add new field
      customFields.push({
        custom_field_definition_id: ACCOUNT_TYPE_FIELD_ID,
        value: copperAccountType
      });
    }

    console.log(`   Updating with custom_fields:`, JSON.stringify(customFields, null, 2));

    // Update Copper company custom field via API
    const updateResponse = await fetch(`${COPPER_API_BASE}/companies/${copperId}`, {
      method: 'PUT',
      headers: {
        'X-PW-AccessToken': COPPER_API_KEY,
        'X-PW-Application': 'developer_api',
        'X-PW-UserEmail': COPPER_USER_EMAIL,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        custom_fields: customFields
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error(`❌ Copper API error: ${updateResponse.status} - ${errorText}`);
      
      return NextResponse.json({ 
        error: `Copper API error: ${updateResponse.status}`,
        details: errorText,
        warning: 'Account type updated in Fishbowl but Copper sync failed'
      }, { status: 200 }); // Still return 200 so Fishbowl update succeeds
    }

    const updatedCompany = await updateResponse.json();

    console.log(`✅ Copper account type updated successfully`);

    return NextResponse.json({ 
      success: true,
      copperId,
      accountType,
      customerName,
      message: 'Account type updated in both Fishbowl and Copper'
    });

  } catch (error: any) {
    console.error('Error updating Copper account type:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to update Copper',
      warning: 'Account type may have updated in Fishbowl only'
    }, { status: 200 }); // Return 200 so Fishbowl update still succeeds
  }
}
