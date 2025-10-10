'use client';

import { useEffect, useState, useCallback } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { TrendingUp, TrendingDown, DollarSign, Users, ShoppingCart, Target } from 'lucide-react';

interface CustomerSummary {
  customerId: string;
  customerName: string;
  totalSales: number;
  totalSalesYTD: number;
  orderCount: number;
  orderCountYTD: number;
  sales_30d: number;
  sales_90d: number;
  sales_12m: number;
  orders_30d: number;
  orders_90d: number;
  orders_12m: number;
  avgOrderValue: number;
  salesPerson: string;
  salesPersonName: string;
  salesPersonRegion: string;
  region: string;
  regionColor: string;
  accountType: string;
  shippingState: string;
  shippingCity: string;
  lastOrderDate: string | null;
}

interface StateStats {
  count: number;
  sales: number;
  sales_30d: number;
  sales_90d: number;
  activeCustomers: number;
  growth: number;
}

interface RegionConfig {
  name: string;
  color: string;
  states: string[];
}

interface RegionStats {
  name: string;
  color: string;
  customerCount: number;
  totalSales: number;
  totalSalesYTD: number;
  avgOrderValue: number;
  orderCount: number;
  orderCountYTD: number;
  sales_30d: number;
  sales_90d: number;
  activeCustomers_30d: number;
  activeCustomers_90d: number;
  topCustomers: CustomerSummary[];
}

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
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [regions, setRegions] = useState<RegionConfig[]>([]);
  const [regionStats, setRegionStats] = useState<{ [key: string]: RegionStats }>({});
  const [loading, setLoading] = useState(true);
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [stateStats, setStateStats] = useState<{ [key: string]: StateStats }>({});
  const [sortBy, setSortBy] = useState<'sales' | 'customers' | 'growth'>('sales');

  const loadCustomers = useCallback(async () => {
    try {
      console.log('Loading regions from Firestore...');
      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      const regionsData: RegionConfig[] = [];
      regionsSnapshot.forEach((doc) => {
        const data = doc.data();
        regionsData.push({
          name: data.name || '',
          color: data.color || '#808080',
          states: data.states || []
        });
      });
      console.log(`Loaded ${regionsData.length} regions`);
      setRegions(regionsData);

      console.log('Loading customer summaries...');
      const snapshot = await getDocs(collection(db, 'customer_sales_summary'));
      const customersData: CustomerSummary[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        customersData.push({
          customerId: data.customerId || doc.id,
          customerName: data.customerName || '',
          totalSales: data.totalSales || 0,
          totalSalesYTD: data.totalSalesYTD || 0,
          orderCount: data.orderCount || 0,
          orderCountYTD: data.orderCountYTD || 0,
          sales_30d: data.sales_30d || 0,
          sales_90d: data.sales_90d || 0,
          sales_12m: data.sales_12m || 0,
          orders_30d: data.orders_30d || 0,
          orders_90d: data.orders_90d || 0,
          orders_12m: data.orders_12m || 0,
          avgOrderValue: data.avgOrderValue || 0,
          salesPerson: data.salesPerson || '',
          salesPersonName: data.salesPersonName || '',
          salesPersonRegion: data.salesPersonRegion || '',
          region: data.region || '',
          regionColor: data.regionColor || '#808080',
          accountType: data.accountType || '',
          shippingState: normalizeState(data.shippingState || ''),
          shippingCity: data.shippingCity || '',
          lastOrderDate: data.lastOrderDate || null
        });
      });

      console.log(`Loaded ${customersData.length} customer summaries`);
      setCustomers(customersData);
      
      // Calculate state stats with growth metrics
      const stats: { [key: string]: StateStats } = {};
      customersData.forEach(c => {
        if (!stats[c.shippingState]) {
          stats[c.shippingState] = { 
            count: 0, 
            sales: 0, 
            sales_30d: 0, 
            sales_90d: 0, 
            activeCustomers: 0,
            growth: 0
          };
        }
        stats[c.shippingState].count++;
        stats[c.shippingState].sales += c.totalSales;
        stats[c.shippingState].sales_30d += c.sales_30d;
        stats[c.shippingState].sales_90d += c.sales_90d;
        if (c.orders_30d > 0) {
          stats[c.shippingState].activeCustomers++;
        }
      });

      // Calculate growth percentage for each state
      Object.keys(stats).forEach(state => {
        const avg90d = stats[state].sales_90d / 3; // Average per 30 days over 90 days
        if (avg90d > 0) {
          stats[state].growth = ((stats[state].sales_30d - avg90d) / avg90d) * 100;
        }
      });

      setStateStats(stats);

      // Calculate region stats - match customers to regions by state
      const regStats: { [key: string]: RegionStats } = {};
      regionsData.forEach((region: RegionConfig) => {
        // Match customers by state instead of region field
        const regionCustomers = customersData.filter(c => 
          region.states.includes(c.shippingState)
        );
        
        regStats[region.name] = {
          name: region.name,
          color: region.color,
          customerCount: regionCustomers.length,
          totalSales: regionCustomers.reduce((sum, c) => sum + c.totalSales, 0),
          totalSalesYTD: regionCustomers.reduce((sum, c) => sum + c.totalSalesYTD, 0),
          avgOrderValue: regionCustomers.length > 0 
            ? regionCustomers.reduce((sum, c) => sum + c.avgOrderValue, 0) / regionCustomers.length 
            : 0,
          orderCount: regionCustomers.reduce((sum, c) => sum + c.orderCount, 0),
          orderCountYTD: regionCustomers.reduce((sum, c) => sum + c.orderCountYTD, 0),
          sales_30d: regionCustomers.reduce((sum, c) => sum + c.sales_30d, 0),
          sales_90d: regionCustomers.reduce((sum, c) => sum + c.sales_90d, 0),
          activeCustomers_30d: regionCustomers.filter(c => c.orders_30d > 0).length,
          activeCustomers_90d: regionCustomers.filter(c => c.orders_90d > 0).length,
          topCustomers: regionCustomers
            .sort((a, b) => b.totalSales - a.totalSales)
            .slice(0, 5)
        };
      });
      setRegionStats(regStats);
      
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
    return regions.find((r: RegionConfig) => r.states.includes(state));
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const totalSales = Object.values(regionStats).reduce((sum, r) => sum + r.totalSales, 0);
  const totalSalesYTD = Object.values(regionStats).reduce((sum, r) => sum + r.totalSalesYTD, 0);
  const totalCustomers = customers.length;
  const activeCustomers_30d = customers.filter(c => c.orders_30d > 0).length;

  return (
    <div className="space-y-6">
      {/* Executive Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-blue-900">Total Revenue (All-Time)</div>
            <DollarSign className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-blue-900">{formatCurrency(totalSales)}</div>
          <div className="text-xs text-blue-700 mt-1">YTD: {formatCurrency(totalSalesYTD)}</div>
        </div>

        <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-green-900">Total Customers</div>
            <Users className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-900">{formatNumber(totalCustomers)}</div>
          <div className="text-xs text-green-700 mt-1">
            {activeCustomers_30d} active (30d)
          </div>
        </div>

        <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-purple-900">Active Regions</div>
            <Target className="w-5 h-5 text-purple-600" />
          </div>
          <div className="text-3xl font-bold text-purple-900">
            {Object.keys(regionStats).length}
          </div>
          <div className="text-xs text-purple-700 mt-1">{Object.keys(stateStats).length} states</div>
        </div>

        <div className="card bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-medium text-amber-900">Avg Order Value</div>
            <ShoppingCart className="w-5 h-5 text-amber-600" />
          </div>
          <div className="text-3xl font-bold text-amber-900">
            {formatCurrency(
              totalCustomers > 0
                ? customers.reduce((sum, c) => sum + c.avgOrderValue, 0) / totalCustomers
                : 0
            )}
          </div>
          <div className="text-xs text-amber-700 mt-1">Across all regions</div>
        </div>
      </div>

      {/* Region Performance Cards */}
      <div className="card">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">📊 Region Performance</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.values(regionStats)
            .sort((a, b) => b.totalSales - a.totalSales)
            .map(region => {
              const growth = region.sales_90d > 0 
                ? ((region.sales_30d - (region.sales_90d / 3)) / (region.sales_90d / 3)) * 100 
                : 0;
              const isGrowing = growth > 0;

              return (
                <button
                  key={region.name}
                  onClick={() => setSelectedRegion(selectedRegion === region.name ? null : region.name)}
                  className={`p-5 rounded-lg border-2 transition-all text-left ${
                    selectedRegion === region.name
                      ? 'border-gray-900 shadow-lg scale-105'
                      : 'border-gray-200 hover:border-gray-400 hover:shadow-md'
                  }`}
                  style={{ backgroundColor: `${region.color}08` }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: region.color }}
                      />
                      <span className="font-bold text-gray-900">{region.name}</span>
                    </div>
                    {isGrowing ? (
                      <TrendingUp className="w-5 h-5 text-green-600" />
                    ) : (
                      <TrendingDown className="w-5 h-5 text-red-600" />
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {formatCurrency(region.totalSales)}
                      </div>
                      <div className="text-xs text-gray-600">Total Revenue</div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-200">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {region.customerCount}
                        </div>
                        <div className="text-xs text-gray-600">Customers</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {region.activeCustomers_30d}
                        </div>
                        <div className="text-xs text-gray-600">Active (30d)</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(region.sales_30d)}
                        </div>
                        <div className="text-xs text-gray-600">Last 30d</div>
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">
                          {formatCurrency(region.avgOrderValue)}
                        </div>
                        <div className="text-xs text-gray-600">Avg Order</div>
                      </div>
                    </div>

                    {Math.abs(growth) > 0.1 && (
                      <div className={`text-xs font-medium ${isGrowing ? 'text-green-700' : 'text-red-700'}`}>
                        {isGrowing ? '↑' : '↓'} {Math.abs(growth).toFixed(1)}% vs 90d avg
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      </div>

      {/* State Distribution Heat Map */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            🗺️ Customer Distribution by State
            {selectedRegion && ` - ${selectedRegion} Region`}
          </h3>
          
          {/* Sort Options */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <button
              onClick={() => setSortBy('sales')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'sales'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setSortBy('customers')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'customers'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => setSortBy('growth')}
              className={`px-3 py-1 text-sm rounded ${
                sortBy === 'growth'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Growth
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg border-2 border-gray-300">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-semibold text-gray-900 mb-2">🔥 Heat Map Intensity (by Revenue)</div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-red-100 to-red-500 border border-red-600" />
                  <span className="text-xs font-medium text-gray-700">Top 20% - 🔥 HOT</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-orange-100 to-orange-400 border border-orange-500" />
                  <span className="text-xs text-gray-600">Top 40%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-yellow-100 to-yellow-400 border border-yellow-500" />
                  <span className="text-xs text-gray-600">Top 60%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-blue-100 to-blue-300 border border-blue-400" />
                  <span className="text-xs text-gray-600">Top 80%</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-12 h-6 rounded bg-gradient-to-r from-gray-50 to-gray-200 border border-gray-300" />
                  <span className="text-xs text-gray-600">Bottom 20% - ❄️ COLD</span>
                </div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">Growth Indicators</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-gray-600">Growing (vs 90d avg)</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingDown className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-gray-600">Declining (vs 90d avg)</span>
                </div>
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-900 mb-2">Active Accounts</div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <span className="text-xs text-gray-600">Customers with orders in last 30 days</span>
              </div>
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(stateStats)
            .filter(([state]) => {
              if (!selectedRegion) return true;
              const region = regions.find((r: RegionConfig) => r.name === selectedRegion);
              return region?.states.includes(state);
            })
            .sort((a, b) => {
              if (sortBy === 'sales') return b[1].sales - a[1].sales;
              if (sortBy === 'customers') return b[1].count - a[1].count;
              return b[1].growth - a[1].growth;
            })
            .map(([state, stats]) => {
              const region = regions.find((r: RegionConfig) => r.states.includes(state));
              if (!region) return null;

              // Calculate heat map intensity (0-1 scale based on sales)
              const maxSales = Math.max(...Object.values(stateStats).map(s => s.sales));
              const intensity = maxSales > 0 ? stats.sales / maxSales : 0;
              
              const isGrowing = stats.growth > 0;
              const hasSignificantChange = Math.abs(stats.growth) > 5;

              // Heat map color gradient from light to very intense
              const getHeatMapColor = (intensity: number) => {
                if (intensity > 0.8) return 'from-red-100 to-red-500'; // Top 20% - HOT
                if (intensity > 0.6) return 'from-orange-100 to-orange-400'; // Top 40%
                if (intensity > 0.4) return 'from-yellow-100 to-yellow-400'; // Top 60%
                if (intensity > 0.2) return 'from-blue-100 to-blue-300'; // Top 80%
                return 'from-gray-50 to-gray-200'; // Bottom 20% - COLD
              };

              const getTextColor = (intensity: number) => {
                if (intensity > 0.6) return 'text-white';
                return 'text-gray-900';
              };

              return (
                <div
                  key={state}
                  className={`p-3 rounded-lg border-2 hover:shadow-lg transition-all cursor-pointer relative overflow-hidden bg-gradient-to-br ${getHeatMapColor(intensity)}`}
                  style={{ 
                    borderColor: intensity > 0.6 ? '#DC2626' : region.color,
                    borderWidth: intensity > 0.7 ? '3px' : '2px'
                  }}
                >
                  {/* Growth Indicator Badge */}
                  {hasSignificantChange && (
                    <div className={`absolute top-1 right-1 ${
                      isGrowing ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {isGrowing ? (
                        <TrendingUp className="w-4 h-4" />
                      ) : (
                        <TrendingDown className="w-4 h-4" />
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold text-lg ${getTextColor(intensity)}`}>{state}</span>
                    <div
                      className="w-3 h-3 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: region.color }}
                    />
                  </div>
                  
                  <div className={`text-2xl font-bold mb-1 ${getTextColor(intensity)}`}>
                    {stats.count}
                  </div>
                  
                  <div className={`text-xs mb-2 ${intensity > 0.6 ? 'text-white/90' : 'text-gray-600'}`}>
                    {STATE_NAMES[state]}
                  </div>
                  
                  <div className={`space-y-1 pt-2 ${intensity > 0.6 ? 'border-white/30' : 'border-gray-200'} border-t`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className={intensity > 0.6 ? 'text-white/90' : 'text-gray-600'}>Revenue:</span>
                      <span className={`font-semibold ${getTextColor(intensity)}`}>
                        {formatCurrency(stats.sales)}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-between text-xs">
                      <span className={`flex items-center gap-1 ${intensity > 0.6 ? 'text-white/90' : 'text-gray-600'}`}>
                        <Users className="w-3 h-3" />
                        Active:
                      </span>
                      <span className={`font-semibold ${intensity > 0.6 ? 'text-white' : 'text-blue-700'}`}>
                        {stats.activeCustomers}
                      </span>
                    </div>
                    
                    {hasSignificantChange && (
                      <div className={`flex items-center justify-between text-xs font-semibold ${
                        intensity > 0.6 
                          ? 'text-white' 
                          : isGrowing ? 'text-green-700' : 'text-red-700'
                      }`}>
                        <span>Growth:</span>
                        <span>{isGrowing ? '↑' : '↓'} {Math.abs(stats.growth).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Top Customers by Region */}
      {selectedRegion && regionStats[selectedRegion] && (
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            🏆 Top 5 Customers - {selectedRegion} Region
          </h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total Sales</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Last 30d</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Orders</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Sales Rep</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {regionStats[selectedRegion].topCustomers.map((customer, index) => (
                  <tr key={customer.customerId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-bold text-gray-900">#{index + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.customerName}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {customer.shippingCity}, {customer.shippingState}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-right text-green-700">
                      {formatCurrency(customer.totalSales)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {formatCurrency(customer.sales_30d)}
                    </td>
                    <td className="px-4 py-3 text-sm text-right text-gray-600">
                      {customer.orderCount}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{customer.salesPersonName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
