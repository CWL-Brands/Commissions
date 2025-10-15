import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';

/**
 * Import products from CSV file
 * Creates unified products collection for both quarterly bonuses and spiffs
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Read file
    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let imported = 0;
    let updated = 0;
    let skipped = 0;

    const batch = adminDb.batch();
    let batchCount = 0;

    for (const row of data) {
      const rowData: any = row;
      
      // Skip header row if it exists
      if (rowData.ProductNumber === 'ProductNumber') continue;
      
      const productNum = rowData['Product Number'] || rowData.ProductNumber;
      if (!productNum) {
        skipped++;
        continue;
      }

      // Check if product exists
      const existingQuery = await adminDb
        .collection('products')
        .where('productNum', '==', productNum.trim())
        .limit(1)
        .get();

      if (!existingQuery.empty) {
        // Update existing - only update CSV fields, preserve user settings
        const existingData = existingQuery.docs[0].data();
        const docRef = existingQuery.docs[0].ref;
        
        const updateData: any = {
          productNum: productNum.trim(),
          productDescription: rowData['Product Description'] || rowData.ProductDescription || '',
          category: rowData.Category || '',
          productType: rowData['Product Type'] || rowData.ProductType || '',
          size: rowData.Size || '',
          uom: rowData.UOM || '',
          updatedAt: new Date().toISOString(),
        };
        
        // Only update notes if provided in CSV
        if (rowData.Notes) {
          updateData.notes = rowData.Notes;
        }
        
        // Preserve existing user settings: isActive, quarterlyBonusEligible, imageUrl, imagePath
        // These are NOT overwritten from CSV
        
        batch.update(docRef, updateData);
        updated++;
      } else {
        // Create new product with defaults
        const docRef = adminDb.collection('products').doc();
        batch.set(docRef, {
          productNum: productNum.trim(),
          productDescription: rowData['Product Description'] || rowData.ProductDescription || '',
          category: rowData.Category || '',
          productType: rowData['Product Type'] || rowData.ProductType || '',
          size: rowData.Size || '',
          uom: rowData.UOM || '',
          notes: rowData.Notes || '',
          isActive: true, // Default for new products
          quarterlyBonusEligible: false, // Default for new products
          imageUrl: null,
          imagePath: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        imported++;
      }

      batchCount++;

      // Commit batch every 500 operations
      if (batchCount >= 500) {
        await batch.commit();
        batchCount = 0;
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    return NextResponse.json({
      success: true,
      stats: {
        imported,
        updated,
        skipped,
        total: imported + updated,
      },
    });
  } catch (error: any) {
    console.error('Error importing products:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to import products' },
      { status: 500 }
    );
  }
}
