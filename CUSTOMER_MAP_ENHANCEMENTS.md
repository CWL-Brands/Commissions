# Customer Map Enhancement Plan

## ✅ Completed Features
1. **Interactive Google Maps** - Customers plotted with color-coded markers by region
2. **Sales Data Integration** - Shows total sales, order count, and last order date
3. **Geocoding System** - Auto and manual geocoding with error reporting
4. **Fixed Address Display** - Proper street address, city, state format
5. **State Abbreviation Mapping** - Converts "North Carolina" → "NC"

## 🚀 Requested Enhancements

### 1. **Customer Data Table** (Below Map)
- Full-width table showing all customers
- Columns: Name, Address, City/State, Region, Sales Rep, Type, Total Sales, Orders
- Clickable rows that:
  - Pan map to customer location
  - Zoom to level 12
  - Open info window
- Sortable columns
- Pagination (50 per page)

### 2. **Filter Controls** (Above Map)
- **Search Bar**: Filter by name, city, state, or sales rep
- **Region Dropdown**: Filter by region (all, Sales Team, Mountain, Pacific Northwest, etc.)
- **Sales Rep Dropdown**: Filter by sales rep
- **Account Type Dropdown**: Filter by Retail/Wholesale/Distributor
- **Toggle**: Show/Hide State Overlays
- Filters apply to BOTH map markers AND table rows

### 3. **State Boundary Overlays**
- Colored polygon overlays for each state
- Color matches the region color
- Semi-transparent (opacity: 0.15)
- States grouped by region
- Toggle on/off with checkbox

### 4. **Export Functionality**
- **Export to CSV** button
- Exports filtered customer data
- Includes: Name, Address, City, State, Zip, Region, Sales Rep, Type, Total Sales, Orders, Last Order
- Filename: `customers_YYYY-MM-DD.csv`

### 5. **Cool Additional Features**

#### A. **Marker Clustering**
- When zoomed out, group nearby markers into clusters
- Show count in cluster icon
- Click to zoom in and expand cluster
- Uses `@googlemaps/markerclusterer` library

#### B. **Heat Map Toggle**
- Toggle button to switch between:
  - **Pin View** (current markers)
  - **Heat Map View** (density visualization based on sales volume)
- Heat map intensity based on `totalSales`

#### C. **Quick Stats Cards**
- Total Customers
- Mapped Customers
- Needs Geocoding
- Total Regions
- **NEW**: Total Sales (sum of all filtered customers)
- **NEW**: Average Order Value

#### D. **Region Legend**
- Interactive legend showing each region with color
- Click region name to filter map to that region only
- Shows customer count per region

#### E. **Customer Details Sidebar** (Optional)
- Slide-out panel when clicking customer
- Shows full customer details
- Recent orders list
- Sales trend chart (last 12 months)
- Quick actions: Email, Call, View in CRM

## 📊 State Boundary Coordinates

### Implementation Approach:
1. Use Google Maps Data Layer
2. Load GeoJSON for US states
3. Style each state based on region assignment
4. Source: https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json

### State-to-Region Mapping:
```javascript
const stateRegionMap = {
  'CA': { region: 'Pacific Northwest', color: '#10B981' },
  'OR': { region: 'Pacific Northwest', color: '#10B981' },
  'WA': { region: 'Pacific Northwest', color: '#10B981' },
  'ID': { region: 'Mountain', color: '#EF4444' },
  'MT': { region: 'Mountain', color: '#EF4444' },
  'WY': { region: 'Mountain', color: '#EF4444' },
  // ... etc
};
```

## 🎨 UI/UX Improvements

### Filter Bar Layout:
```
┌─────────────────────────────────────────────────────────────┐
│  🔍 Search...    │ Region ▼  │ Sales Rep ▼  │ Type ▼       │
│  [              ]│ [All    ▼]│ [All      ▼]│ [All  ▼]     │
│                                                              │
│  ☐ Show State Overlays    📥 Export CSV    🗺️ Heat Map     │
└─────────────────────────────────────────────────────────────┘
```

### Table Layout:
```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Name ▲         │ Address        │ City, State │ Region  │ Rep  │ Sales      │
├──────────────────────────────────────────────────────────────────────────────┤
│ Olympia Whole  │ 203 G st       │ Davis, CA   │ Pacific │ BenW │ $45,234.56 │
│ Illusions/Moe  │ 123 Main St    │ Lacey, WA   │ Pacific │ John │ $32,100.00 │
│ ...                                                                           │
└──────────────────────────────────────────────────────────────────────────────┘
                          Showing 1-50 of 1076 customers
                          ◀ 1 2 3 ... 22 ▶
```

## 🔧 Technical Implementation

### New Dependencies:
```bash
npm install @googlemaps/markerclusterer
```

### New State Variables:
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');
const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
const [showStateOverlays, setShowStateOverlays] = useState(true);
const [showHeatMap, setShowHeatMap] = useState(false);
const [currentPage, setCurrentPage] = useState(1);
const [sortField, setSortField] = useState<string>('name');
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
```

### Filtered Customers Logic:
```typescript
const filteredCustomers = useMemo(() => {
  return customers.filter(customer => {
    if (searchQuery && !matchesSearch(customer, searchQuery)) return false;
    if (selectedRegionFilter !== 'all' && customer.region !== selectedRegionFilter) return false;
    if (selectedRepFilter !== 'all' && customer.salesPerson !== selectedRepFilter) return false;
    if (selectedTypeFilter !== 'all' && customer.accountType !== selectedTypeFilter) return false;
    return true;
  });
}, [customers, searchQuery, selectedRegionFilter, selectedRepFilter, selectedTypeFilter]);
```

## 🚀 Future Enhancements (KanvaPortal Integration)

When moving to main KanvaPortal system:
1. **Real-time Updates** - WebSocket connection for live customer updates
2. **Territory Assignment** - Drag-and-drop to reassign customers to reps
3. **Route Planning** - Optimize sales rep visit routes
4. **Performance Metrics** - Sales by region, rep performance dashboards
5. **Customer Segmentation** - RFM analysis, customer lifetime value
6. **Integration with CRM** - Sync with Copper, HubSpot, Salesforce
7. **Mobile App** - Field rep mobile view with offline support
8. **Predictive Analytics** - ML-based sales forecasting by region

## 📝 Implementation Priority

### Phase 1 (Immediate):
1. ✅ Filter controls (search, dropdowns)
2. ✅ Customer data table
3. ✅ Export to CSV

### Phase 2 (Next):
4. State boundary overlays
5. Marker clustering
6. Interactive legend

### Phase 3 (Future):
7. Heat map toggle
8. Customer details sidebar
9. Advanced analytics

---

**Note**: This document serves as a roadmap for enhancing the Customer Map feature. Implementation should be done incrementally with testing at each phase.
