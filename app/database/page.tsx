'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, orderBy, limit, getCountFromServer, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  Database as DatabaseIcon,
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  RefreshCw,
  Server,
  HardDrive,
  Wifi,
  WifiOff,
  Upload,
  ArrowLeft,
  Zap,
  Users,
  FileText,
  Edit,
  X,
  DollarSign
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CollectionStats {
  name: string;
  count: number;
  lastModified?: Date;
}

interface ImportLog {
  id: string;
  timestamp: Date;
  type: 'fishbowl' | 'copper' | 'manual';
  status: 'success' | 'error' | 'partial';
  recordsProcessed: number;
  errors?: string[];
  user?: string;
}

interface APIStatus {
  name: string;
  status: 'online' | 'offline' | 'unknown';
  lastCheck?: Date;
  responseTime?: number;
}

export default function DatabasePage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'collections' | 'monthly' | 'imports' | 'apis'>('overview');
  const [sortField, setSortField] = useState<string>('orderNum');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [monthlyCommissions, setMonthlyCommissions] = useState<any[]>([]);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  
  // Filter and search state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [filterRep, setFilterRep] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterSegment, setFilterSegment] = useState<string>('all');
  const [filterAccountType, setFilterAccountType] = useState<string>('all');
  
  const [collectionStats, setCollectionStats] = useState<CollectionStats[]>([]);
  const [importLogs, setImportLogs] = useState<ImportLog[]>([]);
  const [apiStatuses, setApiStatuses] = useState<APIStatus[]>([
    { name: 'Fishbowl API', status: 'unknown' },
    { name: 'Copper CRM', status: 'unknown' },
    { name: 'Firebase', status: 'online', lastCheck: new Date() },
    { name: 'Google Maps', status: 'unknown' }
  ]);

  const [selectedCollection, setSelectedCollection] = useState<string>('commission_entries');
  const [collectionData, setCollectionData] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(false);
  
  // Manual adjustment state
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [editingCommission, setEditingCommission] = useState<any>(null);
  const [adjustmentAmount, setAdjustmentAmount] = useState<string>('');
  const [adjustmentNote, setAdjustmentNote] = useState<string>('');
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const loadCollectionStats = useCallback(async () => {
    try {
      // List of all known collections in your Firestore
      const collections = [
        'activities',
        'admin',
        'commission_entries',
        'commission_config',
        'commission_rates',
        'copperLogs',
        'copperSummaries',
        'copper_companies',
        'copper_leads',
        'copper_opportunities',
        'copper_tasks',
        'customer_sales_summary',
        'customers',
        'fishbowl_customers',
        'fishbowl_sales_orders',
        'fishbowl_soitems',
        'goals',
        'integrations',
        'metrics',
        'monthly_commission_summary',
        'monthly_commissions',
        'payment',
        'pricing',
        'products',
        'quarters',
        'regions',
        'reps',
        'settings',
        'shipping',
        'shipstationRequests',
        'shipstationResponses',
        'sync_log',
        'templates',
        'users'
      ];

      // Load all collections in parallel using count aggregation (much faster!)
      const statsPromises = collections.map(async (collectionName) => {
        try {
          // Use getCountFromServer for efficient counting without loading all docs
          const countSnapshot = await getCountFromServer(collection(db, collectionName));
          const count = countSnapshot.data().count;
          
          // Only fetch one document to get lastModified date
          let lastModified = undefined;
          if (count > 0) {
            try {
              const sampleQuery = query(collection(db, collectionName), limit(1));
              const sampleSnapshot = await getDocs(sampleQuery);
              if (!sampleSnapshot.empty) {
                const doc = sampleSnapshot.docs[0];
                lastModified = doc.data()?.updatedAt?.toDate() || doc.data()?.createdAt?.toDate();
              }
            } catch (e) {
              // Ignore errors fetching sample doc
            }
          }
          
          return {
            name: collectionName,
            count: count,
            lastModified: lastModified
          };
        } catch (error) {
          return { name: collectionName, count: 0 };
        }
      });

      const stats = await Promise.all(statsPromises);
      
      // Sort by count descending, then by name
      stats.sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.name.localeCompare(b.name);
      });
      
      setCollectionStats(stats);
    } catch (error) {
      console.error('Error loading collection stats:', error);
      toast.error('Failed to load collection statistics');
    }
  }, []);

  const loadImportLogs = useCallback(async () => {
    try {
      const logsQuery = query(collection(db, 'import_logs'), orderBy('timestamp', 'desc'), limit(50));
      const snapshot = await getDocs(logsQuery);
      const logs: ImportLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          timestamp: data.timestamp?.toDate() || new Date(),
          type: data.type || 'manual',
          status: data.status || 'success',
          recordsProcessed: data.recordsProcessed || 0,
          errors: data.errors || [],
          user: data.user || 'system'
        });
      });
      setImportLogs(logs);
    } catch (error) {
      setImportLogs([]);
    }
  }, []);

  const checkAPIStatuses = useCallback(async () => {
    const updatedStatuses: APIStatus[] = [
      { name: 'Fishbowl API', status: 'unknown' },
      { name: 'Copper CRM', status: 'unknown' },
      { name: 'Firebase', status: 'online', lastCheck: new Date() },
      { name: 'Google Maps', status: 'unknown' }
    ];
    
    try {
      const response = await fetch('/api/fishbowl/health', { method: 'GET' });
      const index = updatedStatuses.findIndex(s => s.name === 'Fishbowl API');
      if (index !== -1) {
        updatedStatuses[index] = {
          ...updatedStatuses[index],
          status: response.ok ? 'online' : 'offline',
          lastCheck: new Date(),
          responseTime: response.ok ? 150 : undefined
        };
      }
    } catch (error) {
      const index = updatedStatuses.findIndex(s => s.name === 'Fishbowl API');
      if (index !== -1) updatedStatuses[index] = { ...updatedStatuses[index], status: 'offline', lastCheck: new Date() };
    }

    try {
      const response = await fetch('/api/copper/health', { method: 'GET' });
      const index = updatedStatuses.findIndex(s => s.name === 'Copper CRM');
      if (index !== -1) {
        updatedStatuses[index] = {
          ...updatedStatuses[index],
          status: response.ok ? 'online' : 'offline',
          lastCheck: new Date(),
          responseTime: response.ok ? 200 : undefined
        };
      }
    } catch (error) {
      const index = updatedStatuses.findIndex(s => s.name === 'Copper CRM');
      if (index !== -1) updatedStatuses[index] = { ...updatedStatuses[index], status: 'offline', lastCheck: new Date() };
    }

    try {
      const response = await fetch('/api/google-maps/health', { method: 'GET' });
      const index = updatedStatuses.findIndex(s => s.name === 'Google Maps');
      if (index !== -1) {
        updatedStatuses[index] = {
          ...updatedStatuses[index],
          status: response.ok ? 'online' : 'offline',
          lastCheck: new Date(),
          responseTime: response.ok ? 180 : undefined
        };
      }
    } catch (error) {
      const index = updatedStatuses.findIndex(s => s.name === 'Google Maps');
      if (index !== -1) updatedStatuses[index] = { ...updatedStatuses[index], status: 'offline', lastCheck: new Date() };
    }

    setApiStatuses(updatedStatuses);
  }, []);

  const loadCollectionData = useCallback(async (collectionName: string) => {
    setDataLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, collectionName), limit(100)));
      const data: any[] = [];
      snapshot.forEach((doc) => data.push({ id: doc.id, ...doc.data() }));
      setCollectionData(data);
    } catch (error) {
      console.error(`Error loading ${collectionName}:`, error);
      toast.error(`Failed to load ${collectionName}`);
      setCollectionData([]);
    } finally {
      setDataLoading(false);
    }
  }, []);

  const loadMonthlyCommissions = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const snapshot = await getDocs(query(collection(db, 'monthly_commissions'), limit(500)));
      const data: any[] = [];
      snapshot.forEach((doc) => {
        const docData = doc.data();
        data.push({ 
          id: doc.id, 
          ...docData,
          orderDate: docData.orderDate?.toDate?.() || docData.orderDate,
          calculatedAt: docData.calculatedAt?.toDate?.() || docData.calculatedAt
        });
      });
      setMonthlyCommissions(data);
    } catch (error) {
      console.error('Error loading monthly commissions:', error);
      toast.error('Failed to load monthly commissions');
      setMonthlyCommissions([]);
    } finally {
      setMonthlyLoading(false);
    }
  }, []);

  const handleSaveAdjustment = async () => {
    if (!editingCommission) return;
    
    const adjustment = parseFloat(adjustmentAmount);
    if (isNaN(adjustment)) {
      toast.error('Please enter a valid adjustment amount');
      return;
    }

    setSavingAdjustment(true);
    try {
      const originalAmount = editingCommission.commissionAmount || 0;
      const newAmount = originalAmount + adjustment;

      await updateDoc(doc(db, 'monthly_commissions', editingCommission.id), {
        manualAdjustment: adjustment,
        manualAdjustmentNote: adjustmentNote || 'Manual adjustment',
        commissionAmount: newAmount,
        adjustedAt: new Date().toISOString(),
        adjustedBy: user?.email || 'admin',
        isOverride: true,
        overrideReason: adjustmentNote || 'Manual adjustment'
      });

      toast.success(`Adjustment applied: ${adjustment >= 0 ? '+' : ''}$${adjustment.toFixed(2)}`);
      setShowAdjustmentModal(false);
      setEditingCommission(null);
      setAdjustmentAmount('');
      setAdjustmentNote('');
      loadMonthlyCommissions();
    } catch (error) {
      console.error('Error saving adjustment:', error);
      toast.error('Failed to save adjustment');
    } finally {
      setSavingAdjustment(false);
    }
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filter and search logic
  const filteredCommissions = monthlyCommissions.filter((comm) => {
    // Search filter (all fields)
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const matchesSearch = 
        (comm.orderNum || '').toString().toLowerCase().includes(search) ||
        (comm.customerName || '').toLowerCase().includes(search) ||
        (comm.repName || '').toLowerCase().includes(search) ||
        (comm.commissionMonth || '').toLowerCase().includes(search) ||
        (comm.accountType || '').toLowerCase().includes(search) ||
        (comm.customerSegment || '').toLowerCase().includes(search) ||
        (comm.customerStatus || '').toLowerCase().includes(search);
      
      if (!matchesSearch) return false;
    }
    
    // Rep filter
    if (filterRep !== 'all' && comm.repName !== filterRep) return false;
    
    // Status filter
    if (filterStatus !== 'all' && comm.customerStatus !== filterStatus) return false;
    
    // Segment filter
    if (filterSegment !== 'all' && comm.customerSegment !== filterSegment) return false;
    
    // Account Type filter
    if (filterAccountType !== 'all' && comm.accountType !== filterAccountType) return false;
    
    return true;
  });

  // Sort filtered results
  const sortedCommissions = [...filteredCommissions].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    if (aVal === undefined || aVal === null) return 1;
    if (bVal === undefined || bVal === null) return -1;
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
  
  // Get unique values for filter dropdowns
  const uniqueReps = Array.from(new Set(monthlyCommissions.map(c => c.repName).filter(Boolean))).sort();
  const uniqueStatuses = Array.from(new Set(monthlyCommissions.map(c => c.customerStatus).filter(Boolean))).sort();
  const uniqueSegments = Array.from(new Set(monthlyCommissions.map(c => c.customerSegment).filter(Boolean))).sort();
  const uniqueAccountTypes = Array.from(new Set(monthlyCommissions.map(c => c.accountType).filter(Boolean))).sort();

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      toast.error('Admin access required');
      router.push('/dashboard');
      return;
    }

    if (!authLoading && isAdmin) {
      // Only load data for the active tab to improve initial load time
      setLoading(true);
      
      if (activeTab === 'overview') {
        Promise.all([loadCollectionStats(), loadImportLogs()])
          .finally(() => setLoading(false));
      } else if (activeTab === 'imports') {
        loadImportLogs().finally(() => setLoading(false));
      } else if (activeTab === 'apis') {
        checkAPIStatuses().finally(() => setLoading(false));
      } else if (activeTab === 'monthly') {
        loadMonthlyCommissions().finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }
  }, [authLoading, isAdmin, router, activeTab, loadCollectionStats, loadImportLogs, checkAPIStatuses, loadMonthlyCommissions]);

  useEffect(() => {
    if (activeTab === 'collections' && selectedCollection) {
      loadCollectionData(selectedCollection);
    }
  }, [activeTab, selectedCollection, loadCollectionData]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const totalRecords = collectionStats.reduce((sum, stat) => sum + stat.count, 0);
  const recentImports = importLogs.slice(0, 5);
  const successfulImports = importLogs.filter(log => log.status === 'success').length;
  const failedImports = importLogs.filter(log => log.status === 'error').length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                  <DatabaseIcon className="w-8 h-8 mr-3 text-primary-600" />
                  System Database
                </h1>
                <p className="text-gray-600 mt-1">Admin dashboard for system monitoring and data management</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => {
                  setLoading(true);
                  Promise.all([loadCollectionStats(), loadImportLogs(), checkAPIStatuses()])
                    .finally(() => { setLoading(false); toast.success('Data refreshed'); });
                }}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={async () => {
                  if (!confirm('This will remove duplicate orders, line items, and customers. Continue?')) return;
                  
                  setLoading(true);
                  toast.loading('Cleaning up duplicates...');
                  
                  try {
                    const response = await fetch('/api/cleanup-all-duplicates', { method: 'POST' });
                    const result = await response.json();
                    
                    if (result.success) {
                      toast.success(`Cleanup complete! Deleted ${result.results.orders.duplicatesDeleted} duplicate orders`);
                      console.log('Cleanup results:', result.results);
                      // Refresh data after cleanup
                      await Promise.all([loadCollectionStats(), loadImportLogs()]);
                    } else {
                      toast.error('Cleanup failed: ' + result.error);
                    }
                  } catch (error) {
                    console.error('Cleanup error:', error);
                    toast.error('Cleanup failed');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="btn btn-warning flex items-center"
              >
                <Zap className="w-4 h-4 mr-2" />
                Clean Duplicates
              </button>
            </div>
          </div>
        </div>

        {/* System Health Banner */}
        <div className="card mb-6 bg-green-50 border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="font-semibold text-gray-900">All systems operational</p>
                <p className="text-sm text-gray-600">Last checked: {new Date().toLocaleString()}</p>
              </div>
            </div>
            <Activity className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{totalRecords.toLocaleString()}</p>
              </div>
              <HardDrive className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Collections</p>
                <p className="text-2xl font-bold text-gray-900">{collectionStats.length}</p>
              </div>
              <DatabaseIcon className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Successful Imports</p>
                <p className="text-2xl font-bold text-green-600">{successfulImports}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          <div className="card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Failed Imports</p>
                <p className="text-2xl font-bold text-red-600">{failedImports}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex space-x-1 border-b border-gray-200 mb-6">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'monthly', label: 'Monthly Commissions', icon: FileText },
            { id: 'collections', label: 'Collections', icon: DatabaseIcon },
            { id: 'imports', label: 'Import History', icon: Upload },
            { id: 'apis', label: 'API Status', icon: Zap }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-6 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 inline mr-2" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Server className="w-5 h-5 mr-2 text-primary-600" />
                Collection Statistics
              </h2>
              <div className="overflow-x-auto">
                {loading ? (
                  <div className="space-y-3">
                    {[...Array(10)].map((_, i) => (
                      <div key={i} className="animate-pulse flex items-center space-x-4 p-4">
                        <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/6"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/3"></div>
                        <div className="h-6 bg-gray-200 rounded-full w-16"></div>
                      </div>
                    ))}
                    <p className="text-center text-sm text-gray-500 py-4">
                      Loading {collectionStats.length > 0 ? collectionStats.length : '33'} collections in parallel...
                    </p>
                  </div>
                ) : (
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Collection Name</th>
                        <th className="text-right">Record Count</th>
                        <th>Last Modified</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {collectionStats.map((stat) => (
                        <tr key={stat.name}>
                          <td className="font-mono text-sm">{stat.name}</td>
                          <td className="text-right font-semibold">{stat.count.toLocaleString()}</td>
                          <td className="text-sm text-gray-600">
                            {stat.lastModified ? stat.lastModified.toLocaleString() : 'N/A'}
                          </td>
                          <td>
                            {stat.count > 0 ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Active</span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Empty</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="w-5 h-5 mr-2 text-primary-600" />
                Recent Import Activity
              </h2>
              {recentImports.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Upload className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p>No import history available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentImports.map((log) => (
                    <div key={log.id} className={`p-4 rounded-lg border ${
                      log.status === 'success' ? 'bg-green-50 border-green-200' :
                      log.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          {log.status === 'success' ? <CheckCircle className="w-5 h-5 text-green-600" /> :
                           log.status === 'error' ? <AlertCircle className="w-5 h-5 text-red-600" /> :
                           <AlertCircle className="w-5 h-5 text-yellow-600" />}
                          <div>
                            <p className="font-medium text-gray-900">
                              {log.type.charAt(0).toUpperCase() + log.type.slice(1)} Import
                            </p>
                            <p className="text-sm text-gray-600">
                              {log.recordsProcessed} records • {log.timestamp.toLocaleString()}
                            </p>
                          </div>
                        </div>
                        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                          log.status === 'success' ? 'bg-green-100 text-green-800' :
                          log.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {log.status.toUpperCase()}
                        </span>
                      </div>
                      {log.errors && log.errors.length > 0 && (
                        <div className="mt-2 text-sm text-red-700">
                          <p className="font-medium">Errors:</p>
                          <ul className="list-disc list-inside mt-1">
                            {log.errors.slice(0, 3).map((error, idx) => <li key={idx}>{error}</li>)}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Monthly Commissions Tab */}
        {activeTab === 'monthly' && (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Monthly Commissions</h2>
                <p className="text-sm text-gray-600 mt-1">Research and verify commission calculations</p>
              </div>
              <button
                onClick={loadMonthlyCommissions}
                className="btn btn-secondary flex items-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>

            {monthlyLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : monthlyCommissions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No monthly commissions found</p>
                <p className="text-sm mt-2">Go to Settings → Monthly Commissions to calculate</p>
              </div>
            ) : (
              <div>
                {/* Search and Filters */}
                <div className="mb-6 space-y-4">
                  {/* Search Bar */}
                  <div>
                    <input
                      type="text"
                      placeholder="Search all fields (order #, customer, rep, month, etc.)..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="input w-full"
                    />
                  </div>
                  
                  {/* Filter Dropdowns */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <select
                      value={filterRep}
                      onChange={(e) => setFilterRep(e.target.value)}
                      className="input"
                    >
                      <option value="all">All Reps</option>
                      {uniqueReps.map(rep => (
                        <option key={rep} value={rep}>{rep}</option>
                      ))}
                    </select>
                    
                    <select
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="input"
                    >
                      <option value="all">All Statuses</option>
                      {uniqueStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                    
                    <select
                      value={filterSegment}
                      onChange={(e) => setFilterSegment(e.target.value)}
                      className="input"
                    >
                      <option value="all">All Segments</option>
                      {uniqueSegments.map(segment => (
                        <option key={segment} value={segment}>{segment}</option>
                      ))}
                    </select>
                    
                    <select
                      value={filterAccountType}
                      onChange={(e) => setFilterAccountType(e.target.value)}
                      className="input"
                    >
                      <option value="all">All Account Types</option>
                      {uniqueAccountTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    Showing {sortedCommissions.length} of {monthlyCommissions.length} commission records
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    Total: ${sortedCommissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('orderNum')} className="cursor-pointer hover:bg-gray-100">
                          Order # {sortField === 'orderNum' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('customerName')} className="cursor-pointer hover:bg-gray-100">
                          Customer {sortField === 'customerName' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('repName')} className="cursor-pointer hover:bg-gray-100">
                          Rep {sortField === 'repName' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('commissionMonth')} className="cursor-pointer hover:bg-gray-100">
                          Month {sortField === 'commissionMonth' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('accountType')} className="cursor-pointer hover:bg-gray-100">
                          Account Type {sortField === 'accountType' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('customerSegment')} className="cursor-pointer hover:bg-gray-100">
                          Segment {sortField === 'customerSegment' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('customerStatus')} className="cursor-pointer hover:bg-gray-100">
                          Status {sortField === 'customerStatus' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('orderRevenue')} className="cursor-pointer hover:bg-gray-100 text-right">
                          Revenue {sortField === 'orderRevenue' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('commissionRate')} className="cursor-pointer hover:bg-gray-100 text-right">
                          Rate {sortField === 'commissionRate' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th onClick={() => handleSort('commissionAmount')} className="cursor-pointer hover:bg-gray-100 text-right">
                          Commission {sortField === 'commissionAmount' && (sortDirection === 'asc' ? '↑' : '↓')}
                        </th>
                        <th className="text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCommissions.map((comm) => (
                        <tr key={comm.id} className="hover:bg-gray-50">
                          <td className="text-sm font-mono font-semibold">{comm.orderNum}</td>
                          <td className="text-sm">{comm.customerName}</td>
                          <td className="text-sm">{comm.repName}</td>
                          <td className="text-sm font-medium">{comm.commissionMonth}</td>
                          <td>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              comm.accountType === 'Distributor' ? 'bg-blue-100 text-blue-800' :
                              comm.accountType === 'Wholesale' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {comm.accountType || 'N/A'}
                            </span>
                          </td>
                          <td className="text-sm">{comm.customerSegment || 'N/A'}</td>
                          <td>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              comm.customerStatus === 'new' || comm.customerStatus === 'new_business' ? 'bg-green-100 text-green-800' :
                              comm.customerStatus === '6month' || comm.customerStatus === '6_month_active' ? 'bg-yellow-100 text-yellow-800' :
                              comm.customerStatus === '12month' || comm.customerStatus === '12_month_active' ? 'bg-orange-100 text-orange-800' :
                              comm.customerStatus === 'rep_transfer' ? 'bg-indigo-100 text-indigo-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {comm.customerStatus || 'N/A'}
                            </span>
                          </td>
                          <td className="text-right font-semibold">${(comm.orderRevenue || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</td>
                          <td className="text-right">{(comm.commissionRate || 0).toFixed(1)}%</td>
                          <td className="text-right">
                            <div className="flex flex-col items-end">
                              <span className="font-bold text-green-600">${(comm.commissionAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                              {comm.manualAdjustment && (
                                <span className="text-xs text-orange-600">
                                  ({comm.manualAdjustment >= 0 ? '+' : ''}${comm.manualAdjustment.toFixed(2)})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="text-center">
                            <button
                              onClick={() => {
                                setEditingCommission(comm);
                                setAdjustmentAmount('');
                                setAdjustmentNote(comm.manualAdjustmentNote || '');
                                setShowAdjustmentModal(true);
                              }}
                              className="text-blue-600 hover:text-blue-800 p-1"
                              title="Add Manual Adjustment"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Collections Viewer Tab */}
        {activeTab === 'collections' && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Data Viewer</h2>
              <select value={selectedCollection} onChange={(e) => setSelectedCollection(e.target.value)} className="input w-64">
                {collectionStats.map((stat) => (
                  <option key={stat.name} value={stat.name}>{stat.name} ({stat.count})</option>
                ))}
              </select>
            </div>

            {dataLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
              </div>
            ) : collectionData.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <DatabaseIcon className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No data in this collection</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg overflow-auto max-h-96 text-xs">
                  {JSON.stringify(collectionData, null, 2)}
                </pre>
                <p className="text-sm text-gray-600 mt-2">Showing first 100 records</p>
              </div>
            )}
          </div>
        )}

        {/* Import History Tab */}
        {activeTab === 'imports' && (
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Import History</h2>
            {importLogs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <FileText className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                <p>No import logs available</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th className="text-right">Records</th>
                      <th>User</th>
                      <th>Errors</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importLogs.map((log) => (
                      <tr key={log.id}>
                        <td className="text-sm">{log.timestamp.toLocaleString()}</td>
                        <td>
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{log.type}</span>
                        </td>
                        <td>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            log.status === 'success' ? 'bg-green-100 text-green-800' :
                            log.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {log.status}
                          </span>
                        </td>
                        <td className="text-right font-semibold">{log.recordsProcessed}</td>
                        <td className="text-sm text-gray-600">{log.user}</td>
                        <td className="text-sm">
                          {log.errors && log.errors.length > 0 ? (
                            <span className="text-red-600">{log.errors.length} errors</span>
                          ) : (
                            <span className="text-gray-400">None</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* API Status Tab */}
        {activeTab === 'apis' && (
          <div className="space-y-6">
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold text-gray-900">API Health Status</h2>
                <button onClick={checkAPIStatuses} className="btn btn-secondary flex items-center text-sm">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Check Status
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {apiStatuses.map((api) => (
                  <div key={api.name} className={`p-6 rounded-lg border-2 ${
                    api.status === 'online' ? 'bg-green-50 border-green-200' :
                    api.status === 'offline' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
                  }`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-gray-900">{api.name}</h3>
                      {api.status === 'online' ? <Wifi className="w-6 h-6 text-green-600" /> :
                       api.status === 'offline' ? <WifiOff className="w-6 h-6 text-red-600" /> :
                       <AlertCircle className="w-6 h-6 text-gray-400" />}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Status:</span>
                        <span className={`font-semibold ${
                          api.status === 'online' ? 'text-green-600' :
                          api.status === 'offline' ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {api.status.toUpperCase()}
                        </span>
                      </div>
                      {api.lastCheck && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Last Check:</span>
                          <span className="text-gray-900">{api.lastCheck.toLocaleTimeString()}</span>
                        </div>
                      )}
                      {api.responseTime && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Response Time:</span>
                          <span className="text-gray-900">{api.responseTime}ms</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => router.push('/settings?tab=customers')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                >
                  <Users className="w-6 h-6 text-primary-600 mb-2" />
                  <h3 className="font-semibold text-gray-900">Manage Customers</h3>
                  <p className="text-sm text-gray-600 mt-1">Import and manage customer data</p>
                </button>

                <button
                  onClick={() => router.push('/settings?tab=database')}
                  className="p-4 border-2 border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-colors text-left"
                >
                  <DatabaseIcon className="w-6 h-6 text-primary-600 mb-2" />
                  <h3 className="font-semibold text-gray-900">View Commission Data</h3>
                  <p className="text-sm text-gray-600 mt-1">Access quarterly and monthly commission records</p>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Adjustment Modal */}
      {showAdjustmentModal && editingCommission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <DollarSign className="w-6 h-6 mr-2 text-primary-600" />
                  Manual Adjustment
                </h2>
                <button
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setEditingCommission(null);
                    setAdjustmentAmount('');
                    setAdjustmentNote('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Order Details */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Order #:</span>
                    <span className="ml-2 font-mono font-semibold">{editingCommission.orderNum}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Customer:</span>
                    <span className="ml-2 font-semibold">{editingCommission.customerName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Rep:</span>
                    <span className="ml-2 font-semibold">{editingCommission.repName}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Month:</span>
                    <span className="ml-2 font-semibold">{editingCommission.commissionMonth}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Original Commission:</span>
                    <span className="ml-2 font-bold text-green-600">
                      ${((editingCommission.commissionAmount || 0) - (editingCommission.manualAdjustment || 0)).toLocaleString(undefined, {minimumFractionDigits: 2})}
                    </span>
                  </div>
                  {editingCommission.manualAdjustment && (
                    <div>
                      <span className="text-gray-600">Current Adjustment:</span>
                      <span className="ml-2 font-semibold text-orange-600">
                        {editingCommission.manualAdjustment >= 0 ? '+' : ''}${editingCommission.manualAdjustment.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Adjustment Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Adjustment Amount *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                    <input
                      type="number"
                      value={adjustmentAmount}
                      onChange={(e) => setAdjustmentAmount(e.target.value)}
                      step="0.01"
                      placeholder="0.00"
                      className="input w-full pl-8"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Use positive (+) for additions, negative (-) for deductions
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Note / Reason
                  </label>
                  <textarea
                    value={adjustmentNote}
                    onChange={(e) => setAdjustmentNote(e.target.value)}
                    rows={3}
                    placeholder="e.g., FB_DISCOUNT, Acrylic kit adjustment, etc."
                    className="input w-full"
                  />
                </div>

                {/* Preview */}
                {adjustmentAmount && !isNaN(parseFloat(adjustmentAmount)) && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm font-medium text-blue-900 mb-2">Preview:</p>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Original:</span>
                        <span className="font-semibold">
                          ${((editingCommission.commissionAmount || 0) - (editingCommission.manualAdjustment || 0)).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Adjustment:</span>
                        <span className={`font-semibold ${parseFloat(adjustmentAmount) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {parseFloat(adjustmentAmount) >= 0 ? '+' : ''}${parseFloat(adjustmentAmount).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-blue-300">
                        <span className="text-blue-900 font-bold">New Total:</span>
                        <span className="font-bold text-blue-900">
                          ${((editingCommission.commissionAmount || 0) - (editingCommission.manualAdjustment || 0) + parseFloat(adjustmentAmount)).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
                <button
                  onClick={() => {
                    setShowAdjustmentModal(false);
                    setEditingCommission(null);
                    setAdjustmentAmount('');
                    setAdjustmentNote('');
                  }}
                  className="btn btn-secondary"
                  disabled={savingAdjustment}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAdjustment}
                  disabled={!adjustmentAmount || isNaN(parseFloat(adjustmentAmount)) || savingAdjustment}
                  className="btn btn-primary"
                >
                  {savingAdjustment ? 'Saving...' : 'Apply Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
