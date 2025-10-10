'use client';

import { useEffect, useState, useCallback } from 'react';
import { GoogleMap, LoadScript, Marker, InfoWindow } from '@react-google-maps/api';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

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

      customersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.shippingState && data.shippingCity) {
          // Find region for this state
          const region = regionsData.find(r => 
            r.states.includes(normalizeState(data.shippingState))
          );

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
            regionColor: region?.color || '#6B7280'
          });
        }
      });

      setCustomers(customersData);
      
      // Geocode customers that don't have coordinates
      const needsGeocoding = customersData.filter(c => !c.lat || !c.lng);
      if (needsGeocoding.length > 0) {
        console.log(`Geocoding ${needsGeocoding.length} customers...`);
        setGeocodingProgress({ current: 0, total: needsGeocoding.length });
        await geocodeCustomers(needsGeocoding);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const normalizeState = (state: string): string => {
    const normalized = state.trim().toUpperCase();
    return normalized.length === 2 ? normalized : normalized.slice(0, 2);
  };

  const geocodeCustomers = async (customersToGeocode: Customer[]) => {
    const geocoder = new google.maps.Geocoder();
    const batchSize = 10; // Process in batches to avoid rate limits
    const delay = 200; // ms between requests

    for (let i = 0; i < customersToGeocode.length; i += batchSize) {
      const batch = customersToGeocode.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async (customer) => {
          try {
            const address = `${customer.shippingAddress}, ${customer.shippingCity}, ${customer.shippingState} ${customer.shippingZip}`;
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
            }
          } catch (error) {
            console.error(`Error geocoding ${customer.name}:`, error);
          }
        })
      );

      setGeocodingProgress({ current: i + batch.length, total: customersToGeocode.length });
      
      // Delay between batches
      if (i + batchSize < customersToGeocode.length) {
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // Reload data to show newly geocoded customers
    loadData();
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);

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

  const customersWithCoords = customers.filter(c => c.lat && c.lng);

  return (
    <div className="space-y-4">
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
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📍 Customer Locations</h3>
        
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
            {customersWithCoords.map((customer) => (
              <Marker
                key={customer.id}
                position={{ lat: customer.lat!, lng: customer.lng! }}
                onClick={() => setSelectedCustomer(customer)}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
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
                <div className="p-2">
                  <h4 className="font-semibold text-gray-900 mb-2">
                    {selectedCustomer.name}
                  </h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>
                      <span className="font-medium">Address:</span>{' '}
                      {selectedCustomer.shippingCity}, {selectedCustomer.shippingState}
                    </div>
                    <div>
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
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
        </LoadScript>
      </div>
    </div>
  );
}
