# Database Page Documentation

## Overview
The `/database` route is a comprehensive admin/dev dashboard for system monitoring and data management.

## Access
- **Route**: `http://localhost:3000/database`
- **Access Level**: Admin only
- **Entry Point**: Dashboard tile or direct URL

## Features

### 📊 Overview Tab
- **Collection Statistics**: View all Firestore collections with record counts and last modified dates
- **Recent Import Activity**: Last 5 imports with status, record counts, and error details
- **System Health Banner**: Real-time system status indicator
- **Quick Stats Cards**:
  - Total Records across all collections
  - Number of Collections
  - Successful Imports count
  - Failed Imports count

### 🗄️ Data Viewer Tab
- Browse any Firestore collection
- View raw JSON data (first 100 records)
- Dropdown selector to switch between collections
- Useful for debugging and data inspection

### 📥 Import History Tab
- Complete log of all data imports
- Columns: Timestamp, Type (fishbowl/copper/manual), Status, Records Processed, User, Errors
- Color-coded status badges
- Error details when available

### ⚡ API Status Tab
- Real-time health checks for:
  - Fishbowl API
  - Copper CRM
  - Firebase
  - Google Maps
- Status indicators (online/offline/unknown)
- Last check timestamp
- Response time metrics
- Quick action buttons to manage customers and view commission data

## Technical Details

### Files Created
1. `/app/database/page.tsx` - Main database dashboard page
2. `/app/api/fishbowl/health/route.ts` - Fishbowl API health check endpoint
3. `/app/api/copper/health/route.ts` - Copper API health check endpoint

### Collections Monitored
- commission_entries
- monthly_commissions
- customers
- customer_sales_summary
- reps
- regions
- commission_config
- commission_rates
- products
- activities

### Future Enhancements (Optional)
- Manual sync triggers for each API
- Audit trail viewer
- Data export functionality
- Real-time notifications for failed imports
- Collection backup/restore tools
- Query builder for advanced data filtering

## User Roles

### Admin/Dev
- Full access to all tabs
- System monitoring and debugging
- Data inspection and management
- API health monitoring

### CFO (Future)
- Could have read-only access to specific data views
- Commission data summaries
- Import history for data verification

## Notes
- The database tab in Settings still exists and can reference this page
- Health check endpoints are lightweight (just check if credentials exist)
- Import logs require an `import_logs` collection to be created in Firestore
- All data is loaded on-demand to minimize initial load time
