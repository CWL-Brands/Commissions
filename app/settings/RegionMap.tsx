'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

interface Customer {
  id: string;
  name: string;
  shippingState: string;
  shippingCity: string;
  salesPerson: string;
  accountType: string;
}

interface RegionConfig {
  name: string;
  color: string;
  states: string[];
}

const REGIONS: RegionConfig[] = [
  {
    name: 'West',
    color: '#3B82F6', // blue
    states: ['WA', 'OR', 'CA', 'NV', 'ID', 'MT', 'WY', 'AK', 'HI']
  },
  {
    name: 'Central',
    color: '#10B981', // green
    states: ['ND', 'SD', 'NE', 'KS', 'MN', 'IA', 'MO', 'WI', 'IL', 'IN', 'MI', 'OH']
  },
  {
    name: 'East',
    color: '#8B5CF6', // purple
    states: ['ME', 'NH', 'VT', 'MA', 'RI', 'CT', 'NY', 'NJ', 'PA', 'DE', 'MD', 'DC', 'WV', 'VA']
  },
  {
    name: 'South East',
    color: '#F59E0B', // amber
    states: ['KY', 'TN', 'NC', 'SC', 'GA', 'FL', 'AL', 'MS', 'LA', 'AR']
  },
  {
    name: 'South West',
    color: '#EF4444', // red
    states: ['TX', 'OK', 'NM', 'AZ', 'CO', 'UT']
  }
];

// State abbreviation to full name mapping
const STATE_NAMES: { [key: string]: string } = {
  'AL': 'Alabama', 'AK': 'Alaska', 'AZ': 'Arizona', 'AR': 'Arkansas', 'CA': 'California',
  'CO': 'Colorado', 'CT': 'Connecticut', 'DE': 'Delaware', 'FL': 'Florida', 'GA': 'Georgia',
  'HI': 'Hawaii', 'ID': 'Idaho', 'IL': 'Illinois', 'IN': 'Indiana', 'IA': 'Iowa',
  'KS': 'Kansas', 'KY': 'Kentucky', 'LA': 'Louisiana', 'ME': 'Maine', 'MD': 'Maryland',
  'MA': 'Massachusetts', 'MI': 'Michigan', 'MN': 'Minnesota', 'MS': 'Mississippi', 'MO': 'Missouri',
  'MT': 'Montana', 'NE': 'Nebraska', 'NV': 'Nevada', 'NH': 'New Hampshire', 'NJ': 'New Jersey',
  'NM': 'New Mexico', 'NY': 'New York', 'NC': 'North Carolina', 'ND': 'North Dakota', 'OH': 'Ohio',
  'OK': 'Oklahoma', 'OR': 'Oregon', 'PA': 'Pennsylvania', 'RI': 'Rhode Island', 'SC': 'South Carolina',
  'SD': 'South Dakota', 'TN': 'Tennessee', 'TX': 'Texas', 'UT': 'Utah', 'VT': 'Vermont',
  'VA': 'Virginia', 'WA': 'Washington', 'WV': 'West Virginia', 'WI': 'Wisconsin', 'WY': 'Wyoming',
  'DC': 'District of Columbia'
};

export default function RegionMap() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [stateStats, setStateStats] = useState<{ [key: string]: number }>({});

  const loadCustomers = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(db, 'fishbowl_customers'));
      const customersData: Customer[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.shippingState) {
          customersData.push({
            id: doc.id,
            name: data.name || 'Unknown',
            shippingState: normalizeState(data.shippingState),
            shippingCity: data.shippingCity || '',
            salesPerson: data.salesPerson || 'Unassigned',
            accountType: data.accountType || 'Retail'
          });
        }
      });

      setCustomers(customersData);
      
      // Calculate state stats
      const stats: { [key: string]: number } = {};
      customersData.forEach(c => {
        stats[c.shippingState] = (stats[c.shippingState] || 0) + 1;
      });
      setStateStats(stats);
      
      setLoading(false);
    } catch (error) {
      console.error('Error loading customers:', error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const normalizeState = (state: string): string => {
    const normalized = state.trim().toUpperCase();
    // If it's already 2 letters, return it
    if (normalized.length === 2) return normalized;
    
    // Try to find by full name
    const entry = Object.entries(STATE_NAMES).find(
      ([_, name]) => name.toUpperCase() === normalized
    );
    return entry ? entry[0] : normalized.slice(0, 2);
  };

  const getRegionForState = (state: string): RegionConfig | undefined => {
    return REGIONS.find(r => r.states.includes(state));
  };

  const getCustomersInRegion = (regionName: string) => {
    const region = REGIONS.find(r => r.name === regionName);
    if (!region) return [];
    return customers.filter(c => region.states.includes(c.shippingState));
  };

  const getStateColor = (state: string): string => {
    const region = getRegionForState(state);
    if (!region) return '#E5E7EB'; // gray for unmapped
    if (selectedRegion && selectedRegion !== region.name) return '#F3F4F6'; // lighter gray
    return region.color;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Region Legend */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">🗺️ Sales Regions</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {REGIONS.map(region => {
            const customerCount = getCustomersInRegion(region.name).length;
            return (
              <button
                key={region.name}
                onClick={() => setSelectedRegion(selectedRegion === region.name ? null : region.name)}
                className={`p-4 rounded-lg border-2 transition-all ${
                  selectedRegion === region.name
                    ? 'border-gray-900 shadow-lg scale-105'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
                style={{ backgroundColor: `${region.color}15` }}
              >
                <div className="flex items-center space-x-2 mb-2">
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: region.color }}
                  />
                  <span className="font-semibold text-gray-900">{region.name}</span>
                </div>
                <div className="text-2xl font-bold text-gray-900">{customerCount}</div>
                <div className="text-xs text-gray-600">customers</div>
                <div className="text-xs text-gray-500 mt-2">
                  {region.states.length} states
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* State-by-State Breakdown */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          📊 Customer Distribution by State
          {selectedRegion && ` - ${selectedRegion} Region`}
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {REGIONS
            .filter(r => !selectedRegion || r.name === selectedRegion)
            .flatMap(region => 
              region.states.map(state => ({
                state,
                region,
                count: stateStats[state] || 0
              }))
            )
            .sort((a, b) => b.count - a.count)
            .map(({ state, region, count }) => (
              <div
                key={state}
                className="p-3 rounded-lg border-2 border-gray-200 hover:border-gray-400 transition-all"
                style={{ 
                  backgroundColor: count > 0 ? `${region.color}10` : '#F9FAFB',
                  borderColor: count > 0 ? region.color : '#E5E7EB'
                }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-gray-900">{state}</span>
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: region.color }}
                  />
                </div>
                <div className="text-2xl font-bold" style={{ color: region.color }}>
                  {count}
                </div>
                <div className="text-xs text-gray-600">{STATE_NAMES[state]}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Region Details */}
      {selectedRegion && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {selectedRegion} Region - Customer Details
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">State</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Rep</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {getCustomersInRegion(selectedRegion).map(customer => (
                  <tr key={customer.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{customer.shippingCity}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{customer.shippingState}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{customer.salesPerson}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        customer.accountType === 'Retail' ? 'bg-yellow-100 text-yellow-800' :
                        customer.accountType === 'Wholesale' ? 'bg-blue-100 text-blue-800' :
                        'bg-green-100 text-green-800'
                      }`}>
                        {customer.accountType}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card bg-blue-50">
          <div className="text-sm font-medium text-blue-900 mb-1">Total Customers</div>
          <div className="text-3xl font-bold text-blue-600">{customers.length}</div>
        </div>
        <div className="card bg-green-50">
          <div className="text-sm font-medium text-green-900 mb-1">States Covered</div>
          <div className="text-3xl font-bold text-green-600">
            {Object.keys(stateStats).length}
          </div>
        </div>
        <div className="card bg-purple-50">
          <div className="text-sm font-medium text-purple-900 mb-1">Regions Active</div>
          <div className="text-3xl font-bold text-purple-600">
            {REGIONS.filter(r => getCustomersInRegion(r.name).length > 0).length}
          </div>
        </div>
      </div>
    </div>
  );
}
