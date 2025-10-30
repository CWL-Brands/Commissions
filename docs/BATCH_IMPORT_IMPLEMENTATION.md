# Batch/Chunked Import Implementation

## Overview

Implemented intelligent batch loading for Fishbowl data imports to handle large files efficiently and provide real-time progress tracking.

## Features

### Automatic File Size Detection
- **Small files (<2MB)**: Direct upload for maximum speed
- **Large files (>2MB)**: Chunked upload with progress tracking

### Chunked Upload Process
1. **File Splitting**: Divides file into 2MB chunks
2. **Sequential Upload**: Uploads each chunk with progress updates
3. **Server Reassembly**: Backend reassembles chunks when all received
4. **Background Processing**: Import runs in background with Firestore progress tracking

### Progress Tracking
- **Upload Progress**: Shows chunk upload progress (e.g., "Uploading chunk 3/10")
- **Processing Progress**: Real-time updates from Firestore
  - Current row / Total rows
  - Percentage complete
  - Current customer being processed
  - Running statistics (customers, orders, items created/updated)
- **Toast Notifications**: Live updates in UI
- **Auto-refresh**: Polls every 2 seconds for progress

## Technical Implementation

### Frontend (`app/settings/page.tsx`)

#### handleFishbowlImport()
```typescript
- Checks file size
- If >2MB: Uses chunked upload
- If <2MB: Uses direct upload
- Starts progress polling for chunked imports
```

#### pollImportProgress()
```typescript
- Polls /api/fishbowl/import-progress
- Updates UI with progress
- Completes when status='complete'
- 10-minute safety timeout
```

### Backend

#### `/api/fishbowl/import-chunked` (Existing)
- Receives chunks via FormData
- Stores in memory map by fileId
- Reassembles when all chunks received
- Generates importId for tracking
- Calls `importUnifiedReport()` in background

#### `/api/fishbowl/import-progress` (Existing)
- Reads from `import_progress` Firestore collection
- Returns current status, percentage, stats
- Used for polling

#### Firestore Progress Tracking
Collection: `import_progress`
Document ID: `import_${timestamp}`

Fields:
```javascript
{
  status: 'parsing' | 'processing' | 'complete',
  totalRows: number,
  currentRow: number,
  percentage: number,
  currentCustomer: string,
  currentOrder: string,
  stats: {
    processed: number,
    customersCreated: number,
    customersUpdated: number,
    ordersCreated: number,
    ordersUpdated: number,
    itemsCreated: number,
    itemsUpdated: number,
    skipped: number
  },
  startedAt: Timestamp,
  completedAt: Timestamp,
  updatedAt: Timestamp
}
```

## User Experience

### Small File Import
1. User selects file <2MB
2. Upload starts immediately
3. Processing completes in seconds
4. Success notification with stats

### Large File Import
1. User selects file >2MB (e.g., 15MB)
2. "Splitting into 8 chunks..."
3. "Uploading chunk 1/8 (12%)"
4. "Uploading chunk 2/8 (25%)"
5. ... continues until all chunks uploaded
6. "Processing import..."
7. "Processing: 1000 / 5000 (20%) - Customer ABC"
8. ... live updates every 2 seconds
9. "Processing: 5000 / 5000 (100%)"
10. "✅ Imported 4,523 line items, 321 customers, 1,234 orders!"

## Benefits

1. **No Timeout Errors**: Large files processed reliably
2. **User Feedback**: Always know import status
3. **Faster for Small Files**: No overhead for small files
4. **Resumable**: Chunks can be retried individually (future enhancement)
5. **Better UX**: No "black box" - user sees exactly what's happening

## Configuration

### Chunk Size
- **Current**: 2MB per chunk
- **Configurable**: Change `CHUNK_SIZE` constant in `handleFishbowlImport`
- **Recommended**: 1-5MB (Vercel limit is 4.5MB body size)

### Polling Interval
- **Current**: 2 seconds
- **Configurable**: Change interval in `pollImportProgress`
- **Recommended**: 1-3 seconds (balance between responsiveness and API calls)

### Timeout
- **Current**: 10 minutes
- **Configurable**: Change timeout in `pollImportProgress`
- **Recommended**: 5-15 minutes depending on expected file sizes

## Testing

### Test Cases

1. **Small File (<2MB)**
   - ✅ Uses direct upload
   - ✅ No chunking overhead
   - ✅ Fast completion

2. **Medium File (2-10MB)**
   - ✅ Uses chunked upload
   - ✅ Progress tracking works
   - ✅ All chunks uploaded successfully

3. **Large File (>10MB)**
   - ✅ Handles many chunks
   - ✅ Progress updates smoothly
   - ✅ No timeout errors

4. **Error Handling**
   - ✅ Chunk upload failure shows error
   - ✅ Processing error shows in toast
   - ✅ Timeout shows helpful message

## Future Enhancements

1. **Retry Failed Chunks**: Automatically retry failed chunk uploads
2. **Pause/Resume**: Allow user to pause and resume imports
3. **Parallel Chunks**: Upload multiple chunks in parallel (requires backend changes)
4. **Compression**: Compress chunks before upload
5. **Validation**: Validate CSV format before uploading
6. **Preview**: Show data preview before importing

## Related Files

- `app/settings/page.tsx` - Frontend implementation
- `app/api/fishbowl/import-chunked/route.ts` - Chunked upload handler
- `app/api/fishbowl/import-unified/route.ts` - Direct upload handler (small files)
- `app/api/fishbowl/import-progress/route.ts` - Progress polling endpoint

## Deployment Notes

- ✅ Build passes successfully
- ✅ No breaking changes
- ✅ Backward compatible (still supports direct upload)
- ✅ Ready to deploy

---

**Implementation Date**: October 29, 2025
**Status**: ✅ Complete & Tested
**Build Status**: ✅ Passing
