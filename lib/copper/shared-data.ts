import { adminDb } from '@/lib/firebase/admin';

/**
 * Shared Copper data utilities for KanvaPortal apps
 * Uses centralized Firestore collections for Copper metadata and user mappings
 */

export interface CopperUserMapping {
  [email: string]: number; // email -> Copper user ID
}

export interface CopperMetadata {
  activityTypes: {
    system: Array<{
      id: number;
      name: string;
      category: string;
      count_as_interaction: boolean;
      is_disabled: boolean;
    }>;
    user: Array<{
      id: number;
      name: string;
      category: string;
      count_as_interaction: boolean;
      is_disabled: boolean;
    }>;
  };
  customFieldDefinitions: Array<{
    id: number;
    name: string;
    data_type: string;
    available_on: string[];
    options?: Array<{
      id: number;
      name: string;
      rank: number;
    }>;
  }>;
  defaults: {
    CLOSED_WON_STAGES: string[];
    SALES_PIPELINE_ID: string;
    PRODUCT_FIELD_ID: string;
    SALE_TYPE_FIELD_ID: number;
    STAGE_MAPPING: {
      [key: string]: string;
    };
  };
  updatedAt: string;
}

/**
 * Get Copper user ID from email using shared mapping
 */
export async function getCopperUserId(email: string): Promise<number | null> {
  if (!adminDb) {
    console.error('Admin DB not initialized');
    return null;
  }

  try {
    const doc = await adminDb.collection('settings').doc('copper_users_map').get();
    const data = doc.data();
    
    // Check if mapping is under 'byEmail' field (current structure)
    const mapping = (data?.byEmail as CopperUserMapping) || (data as CopperUserMapping);
    
    return mapping?.[email] || null;
  } catch (error) {
    console.error('Error fetching Copper user mapping:', error);
    return null;
  }
}

/**
 * Get all Copper metadata (activity types, custom fields, defaults)
 */
export async function getCopperMetadata(): Promise<CopperMetadata | null> {
  if (!adminDb) {
    console.error('Admin DB not initialized');
    return null;
  }

  try {
    const doc = await adminDb.collection('settings').doc('copper_metadata').get();
    return doc.data() as CopperMetadata;
  } catch (error) {
    console.error('Error fetching Copper metadata:', error);
    return null;
  }
}

/**
 * Get activity type ID by name
 */
export async function getActivityTypeId(activityName: string): Promise<number | null> {
  const metadata = await getCopperMetadata();
  if (!metadata) return null;

  const allActivityTypes = [
    ...(metadata.activityTypes?.system || []),
    ...(metadata.activityTypes?.user || [])
  ];

  const activityType = allActivityTypes.find(
    at => at.name?.toLowerCase() === activityName?.toLowerCase()
  );

  return activityType?.id || null;
}

/**
 * Get custom field definition by name
 */
export async function getCustomFieldDefinition(fieldName: string) {
  const metadata = await getCopperMetadata();
  if (!metadata) return null;

  return metadata.customFieldDefinitions?.find(
    field => field.name?.toLowerCase() === fieldName?.toLowerCase()
  );
}

/**
 * Get closed-won stage names from shared config
 */
export async function getClosedWonStages(): Promise<string[]> {
  const metadata = await getCopperMetadata();
  return metadata?.defaults?.CLOSED_WON_STAGES || ['Payment Received'];
}

/**
 * Get sales pipeline ID from shared config
 */
export async function getSalesPipelineId(): Promise<string | null> {
  const metadata = await getCopperMetadata();
  return metadata?.defaults?.SALES_PIPELINE_ID || null;
}

/**
 * Check if activity type counts as interaction
 */
export async function isInteractionActivity(activityTypeId: number): Promise<boolean> {
  const metadata = await getCopperMetadata();
  if (!metadata) return false;

  const allActivityTypes = [
    ...(metadata.activityTypes?.system || []),
    ...(metadata.activityTypes?.user || [])
  ];

  const activityType = allActivityTypes.find(at => at.id === activityTypeId);
  return activityType?.count_as_interaction || false;
}

/**
 * Get user data from shared users collection
 */
export async function getUserData(userId: string) {
  if (!adminDb) {
    console.error('Admin DB not initialized');
    return null;
  }

  try {
    const doc = await adminDb.collection('users').doc(userId).get();
    return doc.data();
  } catch (error) {
    console.error('Error fetching user data:', error);
    return null;
  }
}
