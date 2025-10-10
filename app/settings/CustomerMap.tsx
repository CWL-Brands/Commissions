'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { Search, Download, ChevronUp, ChevronDown } from 'lucide-react';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  name: string;
  shippingAddress: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  salesPerson: string;
  accountType: string;
  lat?: number;
  lng?: number;
  region?: string;
  regionColor?: string;
  totalSales?: number;
  orderCount?: number;
  lastOrderDate?: string;
}

interface Region {
  id: string;
  name: string;
  states: string[];
  color: string;
}

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const center = {
  lat: 39.8283, // Center of USA
  lng: -98.5795,
};

export default function CustomerMap() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [geocodingProgress, setGeocodingProgress] = useState({ current: 0, total: 0 });
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [geocodingErrors, setGeocodingErrors] = useState<Array<{ customer: string; address: string; error: string }>>([]);
  const [showErrorReport, setShowErrorReport] = useState(false);
  const [hasAutoGeocoded, setHasAutoGeocoded] = useState(false);
  
  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>('all');
  const [selectedRepFilter, setSelectedRepFilter] = useState<string>('all');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<keyof Customer>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const itemsPerPage = 50;

  const loadData = useCallback(async () => {
    try {
      // Load regions first
      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      const regionsData: Region[] = [];
      regionsSnapshot.forEach((doc) => {
        regionsData.push({ id: doc.id, ...doc.data() } as Region);
      });
      setRegions(regionsData);

      // Load customers
      const customersSnapshot = await getDocs(collection(db, 'fishbowl_customers'));
      const customersData: Customer[] = [];

      // Load sales orders for aggregation
      const salesSnapshot = await getDocs(collection(db, 'fishbowl_sales_orders'));
      const salesByCustomer = new Map<string, { total: number; count: number; lastDate: string }>();
      
      salesSnapshot.forEach((doc) => {
        const data = doc.data();
        const customerId = String(data.customerId);
        // Use revenue field (primary) or orderValue as fallback
        const total = Number(data.revenue) || Number(data.orderValue) || 0;
        const postingDateStr = data.postingDateStr || '';
        
        if (!salesByCustomer.has(customerId)) {
          salesByCustomer.set(customerId, { total: 0, count: 0, lastDate: '' });
        }
        
        const existing = salesByCustomer.get(customerId)!;
        existing.total += total;
        existing.count += 1;
        
        // Track most recent order date
        if (!existing.lastDate || postingDateStr > existing.lastDate) {
          existing.lastDate = postingDateStr;
        }
      });

      customersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.shippingState && data.shippingCity) {
          // Find region for this state
          const region = regionsData.find(r => 
            r.states.includes(normalizeState(data.shippingState))
          );

          // Get sales data for this customer
          const salesData = salesByCustomer.get(doc.id);

          customersData.push({
            id: doc.id,
            name: data.name || 'Unknown',
            shippingAddress: data.shippingAddress || '',
            shippingCity: data.shippingCity || '',
            shippingState: normalizeState(data.shippingState),
            shippingZip: data.shipToZip || '',
            salesPerson: data.salesPerson || 'Unassigned',
            accountType: data.accountType || 'Retail',
            lat: data.lat,
            lng: data.lng,
            region: region?.name,
            regionColor: region?.color || '#6B7280',
            totalSales: salesData?.total || 0,
            orderCount: salesData?.count || 0,
            lastOrderDate: salesData?.lastDate || ''
          });
        }
      });

      setCustomers(customersData);
      setLoading(false);
      
      // DON'T geocode immediately - wait for maps to load
      // Geocoding will be triggered after map loads
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stateNameToAbbr: { [key: string]: string } = {
    'ALABAMA': 'AL', 'ALASKA': 'AK', 'ARIZONA': 'AZ', 'ARKANSAS': 'AR', 'CALIFORNIA': 'CA',
    'COLORADO': 'CO', 'CONNECTICUT': 'CT', 'DELAWARE': 'DE', 'FLORIDA': 'FL', 'GEORGIA': 'GA',
    'HAWAII': 'HI', 'IDAHO': 'ID', 'ILLINOIS': 'IL', 'INDIANA': 'IN', 'IOWA': 'IA',
    'KANSAS': 'KS', 'KENTUCKY': 'KY', 'LOUISIANA': 'LA', 'MAINE': 'ME', 'MARYLAND': 'MD',
    'MASSACHUSETTS': 'MA', 'MICHIGAN': 'MI', 'MINNESOTA': 'MN', 'MISSISSIPPI': 'MS', 'MISSOURI': 'MO',
    'MONTANA': 'MT', 'NEBRASKA': 'NE', 'NEVADA': 'NV', 'NEW HAMPSHIRE': 'NH', 'NEW JERSEY': 'NJ',
    'NEW MEXICO': 'NM', 'NEW YORK': 'NY', 'NORTH CAROLINA': 'NC', 'NORTH DAKOTA': 'ND', 'OHIO': 'OH',
    'OKLAHOMA': 'OK', 'OREGON': 'OR', 'PENNSYLVANIA': 'PA', 'RHODE ISLAND': 'RI', 'SOUTH CAROLINA': 'SC',
    'SOUTH DAKOTA': 'SD', 'TENNESSEE': 'TN', 'TEXAS': 'TX', 'UTAH': 'UT', 'VERMONT': 'VT',
    'VIRGINIA': 'VA', 'WASHINGTON': 'WA', 'WEST VIRGINIA': 'WV', 'WISCONSIN': 'WI', 'WYOMING': 'WY'
  };

  const normalizeState = (state: string): string => {
    const normalized = state.trim().toUpperCase();
    // If already 2 characters, return as-is
    if (normalized.length === 2) return normalized;
    // Look up full state name
    return stateNameToAbbr[normalized] || normalized.slice(0, 2);
  };

  const geocodeCustomers = async (customersToGeocode: Customer[]) => {
    const geocoder = new google.maps.Geocoder();
    const batchSize = 10; // Process in batches to avoid rate limits
    const delay = 200; // ms between requests
    let successCount = 0;
    const errors: Array<{ customer: string; address: string; error: string }> = [];

    const loadingToast = toast.loading(`Starting geocoding for ${customersToGeocode.length} customers...`);

    try {
      for (let i = 0; i < customersToGeocode.length; i += batchSize) {
        const batch = customersToGeocode.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (customer) => {
            const stateAbbr = normalizeState(customer.shippingState);
            const address = `${customer.shippingAddress}, ${customer.shippingCity}, ${stateAbbr} ${customer.shippingZip}`;
            try {
              const result = await geocoder.geocode({ address });
              
              if (result.results[0]) {
                const location = result.results[0].geometry.location;
                customer.lat = location.lat();
                customer.lng = location.lng();

                // Save to Firestore
                const customerRef = doc(db, 'fishbowl_customers', customer.id);
                await updateDoc(customerRef, {
                  lat: customer.lat,
                  lng: customer.lng
                });
                successCount++;
              } else {
                errors.push({
                  customer: customer.name,
                  address,
                  error: 'No results found - address may be invalid'
                });
              }
            } catch (error: any) {
              const errorMessage = error?.message || 'Unknown error';
              errors.push({
                customer: customer.name,
                address,
                error: errorMessage.includes('ZERO_RESULTS') 
                  ? 'Address not found by Google Maps'
                  : errorMessage.includes('INVALID_REQUEST')
                  ? 'Invalid address format'
                  : errorMessage.includes('OVER_QUERY_LIMIT')
                  ? 'Rate limit exceeded - try again later'
                  : errorMessage
              });
            }
          })
        );

        const progress = i + batch.length;
        setGeocodingProgress({ current: progress, total: customersToGeocode.length });
        
        // Update toast with progress
        toast.loading(`Geocoding... ${progress}/${customersToGeocode.length}`, { id: loadingToast });
        
        // Delay between batches
        if (i + batchSize < customersToGeocode.length) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      // Store errors for report
      setGeocodingErrors(errors);

      // Success toast with error count
      if (errors.length > 0) {
        toast.success(
          `✅ Geocoding complete! ${successCount} mapped, ${errors.length} failed. Click "View Error Report" for details.`,
          { id: loadingToast, duration: 8000 }
        );
        setShowErrorReport(true);
      } else {
        toast.success(
          `✅ Geocoding complete! All ${successCount} customers successfully mapped!`,
          { id: loadingToast, duration: 5000 }
        );
      }

      // Reload data to show newly geocoded customers
      loadData();
    } catch (error) {
      console.error('Geocoding error:', error);
      toast.error('❌ Geocoding failed. Please try again.', { id: loadingToast });
    } finally {
      setGeocodingProgress({ current: 0, total: 0 });
    }
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
    setMapsLoaded(true);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

  // Trigger geocoding after maps loads and we have customers (only once)
  useEffect(() => {
    if (mapsLoaded && customers.length > 0 && !loading && !hasAutoGeocoded) {
      const needsGeocoding = customers.filter(c => !c.lat || !c.lng);
      if (needsGeocoding.length > 0 && needsGeocoding.length < 100) {
        // Only auto-geocode if less than 100 to avoid rate limits
        console.log(`Auto-geocoding ${needsGeocoding.length} customers...`);
        setHasAutoGeocoded(true); // Prevent re-triggering
        setGeocodingProgress({ current: 0, total: needsGeocoding.length });
        geocodeCustomers(needsGeocoding);
      }
    }
  }, [mapsLoaded, customers, loading, hasAutoGeocoded]);

  const handleManualGeocode = async () => {
    if (!mapsLoaded) {
      toast.error('⏳ Please wait for Google Maps to load first');
      return;
    }
    const needsGeocoding = customers.filter(c => !c.lat || !c.lng);
    if (needsGeocoding.length === 0) {
      toast.success('✅ All customers already have coordinates!');
      return;
    }
    if (!confirm(`Geocode ${needsGeocoding.length} customers? This may take a few minutes.`)) {
      toast('Geocoding cancelled', { icon: 'ℹ️' });
      return;
    }
    setGeocodingProgress({ current: 0, total: needsGeocoding.length });
    await geocodeCustomers(needsGeocoding);
  };

  // Filtered and sorted customers
  const filteredCustomers = useMemo(() => {
    let filtered = customers.filter(customer => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = 
          customer.name.toLowerCase().includes(query) ||
          customer.shippingCity.toLowerCase().includes(query) ||
          customer.shippingState.toLowerCase().includes(query) ||
          customer.salesPerson.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      
      // Region filter
      if (selectedRegionFilter !== 'all' && customer.region !== selectedRegionFilter) {
        return false;
      }
      
      // Sales rep filter
      if (selectedRepFilter !== 'all' && customer.salesPerson !== selectedRepFilter) {
        return false;
      }
      
      // Account type filter
      if (selectedTypeFilter !== 'all' && customer.accountType !== selectedTypeFilter) {
        return false;
      }
      
      return true;
    });

    // Sort
    filtered.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      // Handle undefined values
      if (aVal === undefined) aVal = sortField === 'totalSales' || sortField === 'orderCount' ? 0 : '';
      if (bVal === undefined) bVal = sortField === 'totalSales' || sortField === 'orderCount' ? 0 : '';
      
      // Numeric sorting for sales and order count
      if (sortField === 'totalSales' || sortField === 'orderCount') {
        const aNum = Number(aVal) || 0;
        const bNum = Number(bVal) || 0;
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum;
      }
      
      // String sorting for everything else
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
      } else {
        return aStr > bStr ? -1 : aStr < bStr ? 1 : 0;
      }
    });

    return filtered;
  }, [customers, searchQuery, selectedRegionFilter, selectedRepFilter, selectedTypeFilter, sortField, sortDirection]);

  // Get unique values for filters
  const uniqueReps = useMemo(() => {
    const reps = new Set(customers.map(c => c.salesPerson));
    return Array.from(reps).sort();
  }, [customers]);
  
  const uniqueTypes = useMemo(() => {
    const types = new Set(customers.map(c => c.accountType));
    return Array.from(types).sort();
  }, [customers]);

  // Pagination
  const totalPages = Math.ceil(filteredCustomers.length / itemsPerPage);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Handle row click
  const handleCustomerRowClick = (customer: Customer) => {
    if (customer.lat && customer.lng && map) {
      setSelectedCustomer(customer);
      map.panTo({ lat: customer.lat, lng: customer.lng });
      map.setZoom(12);
    } else {
      toast.error('This customer has not been geocoded yet');
    }
  };

  // Handle sort
  const handleSort = (field: keyof Customer) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Export to CSV
  const handleExport = () => {
    const csv = [
      ['Name', 'Address', 'City', 'State', 'Zip', 'Region', 'Sales Rep', 'Type', 'Total Sales', 'Orders', 'Last Order'],
      ...filteredCustomers.map(c => [
        c.name,
        c.shippingAddress,
        c.shippingCity,
        c.shippingState,
        c.shippingZip,
        c.region || 'Unassigned',
        c.salesPerson,
        c.accountType,
        c.totalSales?.toFixed(2) || '0.00',
        c.orderCount || '0',
        c.lastOrderDate || ''
      ])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customers_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success(`✅ Exported ${filteredCustomers.length} customers to CSV!`);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex flex-col items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mb-4"></div>
          <div className="text-gray-600">Loading customer locations...</div>
          {geocodingProgress.total > 0 && (
            <div className="mt-2 text-sm text-gray-500">
              Geocoding: {geocodingProgress.current} / {geocodingProgress.total}
            </div>
          )}
        </div>
      </div>
    );
  }

  const customersWithCoords = filteredCustomers.filter(c => c.lat && c.lng);

  return (
    <div className="space-y-4">
      {/* Filter Controls */}
      <div className="card">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, city, state, or rep..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="input pl-10 w-full"
              />
            </div>
          </div>

          {/* Region Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedRegionFilter}
              onChange={(e) => {
                setSelectedRegionFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-full"
            >
              <option value="all">All Regions</option>
              {regions.map(region => (
                <option key={region.id} value={region.name}>{region.name}</option>
              ))}
              <option value="">Unassigned</option>
            </select>
          </div>

          {/* Sales Rep Filter */}
          <div className="w-full md:w-48">
            <select
              value={selectedRepFilter}
              onChange={(e) => {
                setSelectedRepFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-full"
            >
              <option value="all">All Sales Reps</option>
              {uniqueReps.map(rep => (
                <option key={rep} value={rep}>{rep}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="w-full md:w-40">
            <select
              value={selectedTypeFilter}
              onChange={(e) => {
                setSelectedTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="input w-full"
            >
              <option value="all">All Types</option>
              {uniqueTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            className="btn btn-secondary whitespace-nowrap"
            title="Export filtered customers to CSV"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </button>
        </div>

        {/* Active Filters Summary */}
        {(searchQuery || selectedRegionFilter !== 'all' || selectedRepFilter !== 'all' || selectedTypeFilter !== 'all') && (
          <div className="mt-3 flex items-center gap-2 text-sm text-gray-600">
            <span className="font-medium">Showing {filteredCustomers.length} of {customers.length} customers</span>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedRegionFilter('all');
                setSelectedRepFilter('all');
                setSelectedTypeFilter('all');
                setCurrentPage(1);
              }}
              className="text-primary-600 hover:text-primary-700 underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-blue-50">
          <div className="text-sm font-medium text-blue-900 mb-1">Total Customers</div>
          <div className="text-3xl font-bold text-blue-600">{customers.length}</div>
        </div>
        <div className="card bg-green-50">
          <div className="text-sm font-medium text-green-900 mb-1">Mapped</div>
          <div className="text-3xl font-bold text-green-600">{customersWithCoords.length}</div>
        </div>
        <div className="card bg-yellow-50">
          <div className="text-sm font-medium text-yellow-900 mb-1">Needs Geocoding</div>
          <div className="text-3xl font-bold text-yellow-600">
            {customers.length - customersWithCoords.length}
          </div>
        </div>
        <div className="card bg-purple-50">
          <div className="text-sm font-medium text-purple-900 mb-1">Regions</div>
          <div className="text-3xl font-bold text-purple-600">{regions.length}</div>
        </div>
      </div>

      {/* Map */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">📍 Customer Locations</h3>
          {customers.filter(c => !c.lat || !c.lng).length > 0 && (
            <button
              onClick={handleManualGeocode}
              disabled={!mapsLoaded || geocodingProgress.total > 0}
              className="btn btn-primary text-sm"
            >
              {geocodingProgress.total > 0
                ? `Geocoding... ${geocodingProgress.current}/${geocodingProgress.total}`
                : `🗺️ Geocode ${customers.filter(c => !c.lat || !c.lng).length} Customers`}
            </button>
          )}
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap gap-3 mb-4">
          {regions.map(region => {
            const count = customersWithCoords.filter(c => c.region === region.name).length;
            return (
              <div key={region.id} className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: region.color }}
                />
                <span className="text-sm text-gray-700">
                  {region.name} ({count})
                </span>
              </div>
            );
          })}
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 rounded-full bg-gray-400" />
            <span className="text-sm text-gray-700">
              Unassigned ({customersWithCoords.filter(c => !c.region).length})
            </span>
          </div>
        </div>

        <LoadScript googleMapsApiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ''}>
          <GoogleMap
            mapContainerStyle={mapContainerStyle}
            center={center}
            zoom={4}
            onLoad={onLoad}
            onUnmount={onUnmount}
          >
            {mapsLoaded && customersWithCoords.map((customer) => (
              <Marker
                key={customer.id}
                position={{ lat: customer.lat!, lng: customer.lng! }}
                onClick={() => setSelectedCustomer(customer)}
                icon={{
                  path: window.google?.maps?.SymbolPath?.CIRCLE || 0,
                  scale: 8,
                  fillColor: customer.regionColor,
                  fillOpacity: 0.8,
                  strokeColor: '#ffffff',
                  strokeWeight: 2,
                }}
              />
            ))}

            {selectedCustomer && selectedCustomer.lat && selectedCustomer.lng && (
              <InfoWindow
                position={{ lat: selectedCustomer.lat, lng: selectedCustomer.lng }}
                onCloseClick={() => setSelectedCustomer(null)}
              >
                <div className="p-2 min-w-[280px]">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {selectedCustomer.name}
                  </h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Address:</span>{' '}
                      {selectedCustomer.shippingAddress}
                    </div>
                    <div>
                      <span className="font-medium">City, State:</span>{' '}
                      {selectedCustomer.shippingCity}, {normalizeState(selectedCustomer.shippingState)} {selectedCustomer.shippingZip}
                    </div>
                    <div className="border-t border-gray-200 pt-1 mt-1">
                      <span className="font-medium">Region:</span>{' '}
                      {selectedCustomer.region || 'Unassigned'}
                    </div>
                    <div>
                      <span className="font-medium">Sales Rep:</span>{' '}
                      {selectedCustomer.salesPerson}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span>{' '}
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          selectedCustomer.accountType === 'Retail'
                            ? 'bg-yellow-100 text-yellow-800'
                            : selectedCustomer.accountType === 'Wholesale'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {selectedCustomer.accountType}
                      </span>
                    </div>
                    {selectedCustomer.orderCount && selectedCustomer.orderCount > 0 && (
                      <>
                        <div className="border-t border-gray-200 pt-1 mt-1">
                          <span className="font-medium">Total Sales:</span>{' '}
                          <span className="text-green-700 font-semibold">
                            ${selectedCustomer.totalSales?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium">Orders:</span>{' '}
                          {selectedCustomer.orderCount}
                        </div>
                        {selectedCustomer.lastOrderDate && (
                          <div>
                            <span className="font-medium">Last Order:</span>{' '}
                            {new Date(selectedCustomer.lastOrderDate).toLocaleDateString()}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </div>

      {/* Error Report Modal */}
      {showErrorReport && geocodingErrors.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    ⚠️ Geocoding Error Report
                  </h3>
                  <p className="text-sm text-gray-600 mt-1">
                    {geocodingErrors.length} customers could not be geocoded
                  </p>
                </div>
                <button
                  onClick={() => setShowErrorReport(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="space-y-4">
                {geocodingErrors.map((error, index) => (
                  <div
                    key={index}
                    className="p-4 border border-red-200 rounded-lg bg-red-50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900">{error.customer}</h4>
                        <p className="text-sm text-gray-600 mt-1">
                          <span className="font-medium">Address:</span> {error.address}
                        </p>
                        <p className="text-sm text-red-700 mt-2">
                          <span className="font-medium">Error:</span> {error.error}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <p className="font-medium">Common fixes:</p>
                  <ul className="list-disc list-inside mt-1 space-y-1">
                    <li>Verify addresses in Fishbowl are complete and accurate</li>
                    <li>Check for typos in city names or zip codes</li>
                    <li>Ensure state abbreviations are correct</li>
                  </ul>
                </div>
                <button
                  onClick={() => setShowErrorReport(false)}
                  className="btn btn-primary"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Error Report Button */}
      {geocodingErrors.length > 0 && !showErrorReport && (
        <div className="card bg-yellow-50 border-2 border-yellow-300">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-semibold text-yellow-900">
                ⚠️ {geocodingErrors.length} Geocoding Errors
              </h4>
              <p className="text-sm text-yellow-700 mt-1">
                Some customers could not be mapped due to invalid addresses
              </p>
            </div>
            <button
              onClick={() => setShowErrorReport(true)}
              className="btn btn-primary"
            >
              View Error Report
            </button>
          </div>
        </div>
      )}

      {/* Customer Table */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📋 Customer List</h3>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Name
                    {sortField === 'name' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address
                </th>
                <th
                  onClick={() => handleSort('shippingCity')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    City, State
                    {sortField === 'shippingCity' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('region')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Region
                    {sortField === 'region' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('salesPerson')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Sales Rep
                    {sortField === 'salesPerson' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('accountType')}
                  className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center gap-1">
                    Type
                    {sortField === 'accountType' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('totalSales')}
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-end gap-1">
                    Total Sales
                    {sortField === 'totalSales' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('orderCount')}
                  className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                >
                  <div className="flex items-center justify-end gap-1">
                    Orders
                    {sortField === 'orderCount' && (
                      sortDirection === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                    )}
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedCustomers.map((customer) => (
                <tr
                  key={customer.id}
                  onClick={() => handleCustomerRowClick(customer)}
                  className="hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="flex items-center">
                      <div
                        className="w-3 h-3 rounded-full mr-2"
                        style={{ backgroundColor: customer.regionColor }}
                      />
                      <div className="text-sm font-medium text-gray-900">{customer.name}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {customer.shippingAddress}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {customer.shippingCity}, {customer.shippingState}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {customer.region || <span className="text-gray-400">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                    {customer.salesPerson}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        customer.accountType === 'Retail'
                          ? 'bg-yellow-100 text-yellow-800'
                          : customer.accountType === 'Wholesale'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-green-100 text-green-800'
                      }`}
                    >
                      {customer.accountType}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-green-700">
                    ${customer.totalSales?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-600">
                    {customer.orderCount || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-gray-200 pt-4">
            <div className="text-sm text-gray-600">
              Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredCustomers.length)} of {filteredCustomers.length} customers
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === pageNum
                          ? 'bg-primary-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="btn btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
