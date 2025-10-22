import fieldMapping from './field-mapping.json';

/**
 * Get value from row using multiple possible field names
 */
export function getFieldValue(row: Record<string, any>, fieldNames: string[]): any {
  for (const fieldName of fieldNames) {
    if (row[fieldName] !== undefined && row[fieldName] !== null && row[fieldName] !== '') {
      return row[fieldName];
    }
  }
  return undefined;
}

/**
 * Get customer ID from row
 */
export function getCustomerId(row: Record<string, any>): string | undefined {
  return getFieldValue(row, fieldMapping.customerIdFields);
}

/**
 * Get sales order number from row
 */
export function getSalesOrderNumber(row: Record<string, any>): string | undefined {
  return getFieldValue(row, fieldMapping.salesOrderNumberFields);
}

/**
 * Get sales order ID from row
 */
export function getSalesOrderId(row: Record<string, any>): string | undefined {
  return getFieldValue(row, fieldMapping.salesOrderIdFields);
}

/**
 * Get SO Item ID from row
 */
export function getSOItemId(row: Record<string, any>): string | undefined {
  return getFieldValue(row, fieldMapping.soItemIdFields);
}

/**
 * Get posting date from row
 */
export function getPostingDate(row: Record<string, any>): any {
  return getFieldValue(row, fieldMapping.dateFields.postingDate);
}

/**
 * Get all customer fields from row
 */
export function getCustomerFields(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, fieldNames] of Object.entries(fieldMapping.customerFields)) {
    result[key] = getFieldValue(row, fieldNames) || '';
  }
  return result;
}

/**
 * Get all order fields from row
 */
export function getOrderFields(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, fieldNames] of Object.entries(fieldMapping.orderFields)) {
    result[key] = getFieldValue(row, fieldNames) || '';
  }
  return result;
}

/**
 * Get all line item fields from row
 */
export function getLineItemFields(row: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [key, fieldNames] of Object.entries(fieldMapping.lineItemFields)) {
    const value = getFieldValue(row, fieldNames);
    result[key] = value !== undefined ? value : '';
  }
  return result;
}

/**
 * Debug: Log available fields in row
 */
export function debugLogFields(row: Record<string, any>, rowNumber: number): void {
  console.log(`\n🔍 ROW ${rowNumber} DEBUG:`);
  console.log(`Available fields (${Object.keys(row).length} total):`);
  console.log(Object.keys(row).slice(0, 50).join(', '));
  
  console.log(`\n📋 Key Field Values:`);
  console.log(`  Customer ID: ${getCustomerId(row)} (tried: ${fieldMapping.customerIdFields.join(', ')})`);
  console.log(`  Sales Order #: ${getSalesOrderNumber(row)} (tried: ${fieldMapping.salesOrderNumberFields.join(', ')})`);
  console.log(`  Sales Order ID: ${getSalesOrderId(row)} (tried: ${fieldMapping.salesOrderIdFields.join(', ')})`);
  console.log(`  SO Item ID: ${getSOItemId(row)} (tried: ${fieldMapping.soItemIdFields.join(', ')})`);
}
