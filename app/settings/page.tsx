'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  Settings as SettingsIcon, 
  Save, 
  Plus, 
  Trash2, 
  AlertCircle,
  CheckCircle,
  ArrowLeft,
  UserPlus,
  Download,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CommissionConfig, CommissionBucket, ProductSubGoal, ActivitySubGoal, RoleCommissionScale, RepRole } from '@/types';
import { validateWeightsSum } from '@/lib/commission/calculator';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState('Q4 2025');
  const [quarters, setQuarters] = useState<string[]>(['Q4 2025', 'Q1 2026']);

  // Configuration state
  const [config, setConfig] = useState<CommissionConfig>({
    quarter: 'Q4 2025',
    maxBonusPerRep: 25000,
    overPerfCap: 1.25,
    minAttainment: 0.75,
    buckets: [
      { id: 'A', code: 'A', name: 'New Business', weight: 0.50, hasSubGoals: false, active: true },
      { id: 'B', code: 'B', name: 'Product Mix', weight: 0.15, hasSubGoals: true, active: true },
      { id: 'C', code: 'C', name: 'Maintain Business', weight: 0.20, hasSubGoals: false, active: true },
      { id: 'D', code: 'D', name: 'Effort', weight: 0.15, hasSubGoals: true, active: true },
    ],
    roleScales: [
      { role: 'Sr. Account Executive', percentage: 1.00 },
      { role: 'Account Executive', percentage: 0.85 },
      { role: 'Jr. Account Executive', percentage: 0.70 },
      { role: 'Account Manager', percentage: 0.60 },
    ],
  });

  const [products, setProducts] = useState<ProductSubGoal[]>([]);
  const [activities, setActivities] = useState<ActivitySubGoal[]>([]);
  const [reps, setReps] = useState<any[]>([]);

  const loadQuarters = async () => {
    try {
      const quartersSnapshot = await getDocs(collection(db, 'quarters'));
      const quartersList: string[] = [];
      quartersSnapshot.forEach((doc) => {
        quartersList.push(doc.data().code);
      });
      setQuarters(quartersList.sort());
    } catch (error) {
      console.error('Error loading quarters:', error);
    }
  };

  const loadSettings = useCallback(async () => {
    try {
      // Load commission config for selected quarter
      const configDoc = await getDoc(doc(db, 'settings', `commission_config_${selectedQuarter.replace(/ /g, '_')}`));
      if (configDoc.exists()) {
        const loadedConfig = configDoc.data() as CommissionConfig;
        // Ensure roleScales exists
        if (!loadedConfig.roleScales) {
          loadedConfig.roleScales = [
            { role: 'Sr. Account Executive', percentage: 1.00 },
            { role: 'Account Executive', percentage: 0.85 },
            { role: 'Jr. Account Executive', percentage: 0.70 },
            { role: 'Account Manager', percentage: 0.60 },
          ];
        }
        setConfig(loadedConfig);
      } else {
        // Load default config if quarter-specific doesn't exist
        const defaultConfigDoc = await getDoc(doc(db, 'settings', 'commission_config'));
        if (defaultConfigDoc.exists()) {
          const defaultConfig = defaultConfigDoc.data() as CommissionConfig;
          // Ensure roleScales exists
          if (!defaultConfig.roleScales) {
            defaultConfig.roleScales = [
              { role: 'Sr. Account Executive', percentage: 1.00 },
              { role: 'Account Executive', percentage: 0.85 },
              { role: 'Jr. Account Executive', percentage: 0.70 },
              { role: 'Account Manager', percentage: 0.60 },
            ];
          }
          setConfig({ ...defaultConfig, quarter: selectedQuarter });
        }
      }

      // Load products
      const productsSnapshot = await getDocs(collection(db, 'products'));
      const productsData: ProductSubGoal[] = [];
      productsSnapshot.forEach((doc) => {
        productsData.push({ id: doc.id, ...doc.data() } as ProductSubGoal);
      });
      setProducts(productsData);

      // Load activities
      const activitiesSnapshot = await getDocs(collection(db, 'activities'));
      const activitiesData: ActivitySubGoal[] = [];
      activitiesSnapshot.forEach((doc) => {
        activitiesData.push({ id: doc.id, ...doc.data() } as ActivitySubGoal);
      });
      setActivities(activitiesData);

      // Load reps
      const repsSnapshot = await getDocs(collection(db, 'reps'));
      const repsData: any[] = [];
      repsSnapshot.forEach((doc) => {
        repsData.push({ id: doc.id, ...doc.data() });
      });
      setReps(repsData);
    } catch (error) {
      console.error('Error loading settings:', error);
      toast.error('Failed to load settings');
    }
  }, [selectedQuarter]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!isAdmin) {
      toast.error('Admin access required');
      router.push('/dashboard');
      return;
    }

    loadQuarters();
    loadSettings();
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, router]);

  useEffect(() => {
    if (selectedQuarter) {
      loadSettings();
    }
  }, [selectedQuarter, loadSettings]);

  const addBucket = () => {
    const newBucket: CommissionBucket = {
      id: `bucket_${Date.now()}`,
      code: String.fromCharCode(65 + config.buckets.length), // A, B, C, D, E, etc.
      name: 'New Bucket',
      weight: 0,
      hasSubGoals: false,
      active: true,
    };
    setConfig({ ...config, buckets: [...config.buckets, newBucket] });
  };

  const removeBucket = (bucketId: string) => {
    setConfig({ ...config, buckets: config.buckets.filter(b => b.id !== bucketId) });
  };

  const addRoleScale = () => {
    const newRole: RoleCommissionScale = {
      role: 'Account Executive',
      percentage: 0.80,
    };
    setConfig({ ...config, roleScales: [...config.roleScales, newRole] });
  };

  const removeRoleScale = (index: number) => {
    const newScales = config.roleScales.filter((_, i) => i !== index);
    setConfig({ ...config, roleScales: newScales });
  };

  const suggestNextQuarter = (): string => {
    if (quarters.length === 0) return 'Q1 2025';
    
    // Parse the latest quarter
    const sorted = [...quarters].sort().reverse();
    const latest = sorted[0];
    const match = latest.match(/Q(\d) (\d{4})/);
    
    if (match) {
      let quarter = parseInt(match[1]);
      let year = parseInt(match[2]);
      
      quarter++;
      if (quarter > 4) {
        quarter = 1;
        year++;
      }
      
      return `Q${quarter} ${year}`;
    }
    
    return 'Q1 2025';
  };

  const addQuarter = async () => {
    const newQuarter = prompt('Enter new quarter (e.g., Q1 2026):', suggestNextQuarter());
    
    if (!newQuarter) return;
    
    // Validate format
    if (!/^Q[1-4] \d{4}$/.test(newQuarter)) {
      toast.error('Invalid format. Use: Q1 2025, Q2 2025, etc.');
      return;
    }
    
    if (quarters.includes(newQuarter)) {
      toast.error('This quarter already exists');
      return;
    }
    
    try {
      // Calculate start and end dates
      const match = newQuarter.match(/Q(\d) (\d{4})/);
      if (!match) return;
      
      const quarter = parseInt(match[1]);
      const year = parseInt(match[2]);
      
      const startMonth = (quarter - 1) * 3;
      const endMonth = startMonth + 2;
      
      const startDate = new Date(year, startMonth, 1);
      const endDate = new Date(year, endMonth + 1, 0); // Last day of month
      
      await setDoc(doc(db, 'quarters', newQuarter), {
        code: newQuarter,
        startDate,
        endDate,
      });
      
      setQuarters([...quarters, newQuarter].sort());
      setSelectedQuarter(newQuarter);
      toast.success(`Quarter ${newQuarter} added successfully`);
    } catch (error) {
      console.error('Error adding quarter:', error);
      toast.error('Failed to add quarter');
    }
  };

  const exportToCSV = async () => {
    try {
      toast.loading('Generating export...');
      
      // Fetch all commission entries for selected quarter
      const entriesSnapshot = await getDocs(collection(db, 'commission_entries'));
      const entries: any[] = [];
      
      entriesSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.quarter === selectedQuarter) {
          entries.push({ id: doc.id, ...data });
        }
      });
      
      // Build CSV
      const headers = [
        'Quarter',
        'Rep Name',
        'Rep Email',
        'Rep Title',
        'Bucket Code',
        'Bucket Name',
        'Goal Value',
        'Actual Value',
        'Attainment %',
        'Bucket Weight',
        'Weighted Score',
        'Total Commission',
        'Max Bonus',
        'Date Created'
      ];
      
      const rows = entries.map(entry => {
        const rep = reps.find(r => r.id === entry.repId);
        return [
          entry.quarter || selectedQuarter,
          rep?.name || 'Unknown',
          rep?.email || '',
          rep?.title || '',
          entry.bucketCode || '',
          entry.bucketName || '',
          entry.goalValue || 0,
          entry.actualValue || 0,
          ((entry.attainment || 0) * 100).toFixed(2) + '%',
          ((entry.bucketWeight || 0) * 100).toFixed(2) + '%',
          ((entry.weightedScore || 0) * 100).toFixed(2) + '%',
          '$' + (entry.commission || 0).toFixed(2),
          '$' + (entry.maxBonus || config.maxBonusPerRep).toFixed(2),
          entry.createdAt ? new Date(entry.createdAt.seconds * 1000).toLocaleDateString() : ''
        ];
      });
      
      const csv = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');
      
      // Download
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `commission_data_${selectedQuarter.replace(/ /g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.dismiss();
      toast.success('Export downloaded successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.dismiss();
      toast.error('Failed to export data');
    }
  };

  const handleSaveConfig = async () => {
    // Validate bucket weights sum to 100%
    const weights = config.buckets.filter(b => b.active).map(b => b.weight);
    if (!validateWeightsSum(weights)) {
      toast.error('Bucket weights must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      // Save quarter-specific config
      await setDoc(doc(db, 'settings', `commission_config_${selectedQuarter.replace(/ /g, '_')}`), config);
      toast.success(`Configuration saved for ${selectedQuarter}`);
    } catch (error) {
      console.error('Error saving config:', error);
      toast.error('Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProducts = async () => {
    // Validate product sub-weights sum to 100%
    const activeProducts = products.filter(p => p.active);
    const subWeights = activeProducts.map(p => p.subWeight);
    if (!validateWeightsSum(subWeights)) {
      toast.error('Product sub-weights must sum to 100%');
      return;
    }

    // Validate target percentages sum to 100%
    const targetPercents = activeProducts.map(p => p.targetPercent);
    if (!validateWeightsSum(targetPercents)) {
      toast.error('Product target percentages must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      // Save each product
      for (const product of products) {
        if (product.id.startsWith('new_')) {
          // New product - add to collection
          const { id, ...data } = product;
          await addDoc(collection(db, 'products'), data);
        } else {
          // Existing product - update
          const { id, ...data } = product;
          await updateDoc(doc(db, 'products', id), data);
        }
      }
      toast.success('Products saved successfully');
      await loadSettings(); // Reload to get new IDs
    } catch (error) {
      console.error('Error saving products:', error);
      toast.error('Failed to save products');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveActivities = async () => {
    // Validate activity sub-weights sum to 100%
    const activeActivities = activities.filter(a => a.active);
    const subWeights = activeActivities.map(a => a.subWeight);
    if (!validateWeightsSum(subWeights)) {
      toast.error('Activity sub-weights must sum to 100%');
      return;
    }

    setSaving(true);
    try {
      // Save each activity
      for (const activity of activities) {
        if (activity.id.startsWith('new_')) {
          // New activity - add to collection
          const { id, ...data } = activity;
          await addDoc(collection(db, 'activities'), data);
        } else {
          // Existing activity - update
          const { id, ...data } = activity;
          await updateDoc(doc(db, 'activities', id), data);
        }
      }
      toast.success('Activities saved successfully');
      await loadSettings(); // Reload to get new IDs
    } catch (error) {
      console.error('Error saving activities:', error);
      toast.error('Failed to save activities');
    } finally {
      setSaving(false);
    }
  };

  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: `new_${Date.now()}`,
        sku: '',
        targetPercent: 0,
        subWeight: 0,
        active: true,
      },
    ]);
  };

  const removeProduct = async (id: string) => {
    if (id.startsWith('new_')) {
      setProducts(products.filter(p => p.id !== id));
    } else {
      try {
        await deleteDoc(doc(db, 'products', id));
        setProducts(products.filter(p => p.id !== id));
        toast.success('Product removed');
      } catch (error) {
        toast.error('Failed to remove product');
      }
    }
  };

  const addActivity = () => {
    setActivities([
      ...activities,
      {
        id: `new_${Date.now()}`,
        activity: '',
        goal: 0,
        subWeight: 0,
        dataSource: '',
        active: true,
      },
    ]);
  };

  const removeActivity = async (id: string) => {
    if (id.startsWith('new_')) {
      setActivities(activities.filter(a => a.id !== id));
    } else {
      try {
        await deleteDoc(doc(db, 'activities', id));
        setActivities(activities.filter(a => a.id !== id));
        toast.success('Activity removed');
      } catch (error) {
        toast.error('Failed to remove activity');
      }
    }
  };

  const getBucketWeightSum = () => {
    return config.buckets.filter(b => b.active).reduce((sum, b) => sum + b.weight, 0);
  };

  const getProductSubWeightSum = () => {
    return products.filter(p => p.active).reduce((sum, p) => sum + p.subWeight, 0);
  };

  const getProductTargetSum = () => {
    return products.filter(p => p.active).reduce((sum, p) => sum + p.targetPercent, 0);
  };

  const getActivitySubWeightSum = () => {
    return activities.filter(a => a.active).reduce((sum, a) => sum + a.subWeight, 0);
  };

  const addRep = () => {
    setReps([
      ...reps,
      {
        id: `new_${Date.now()}`,
        name: '',
        title: 'Account Executive',
        email: '',
        active: true,
        startDate: new Date(),
      },
    ]);
  };

  const removeRep = async (id: string) => {
    if (id.startsWith('new_')) {
      setReps(reps.filter(r => r.id !== id));
    } else {
      try {
        await deleteDoc(doc(db, 'reps', id));
        setReps(reps.filter(r => r.id !== id));
        toast.success('Rep removed');
      } catch (error) {
        toast.error('Failed to remove rep');
      }
    }
  };

  const handleSaveReps = async () => {
    setSaving(true);
    try {
      for (const rep of reps) {
        if (rep.id.startsWith('new_')) {
          const { id, ...data } = rep;
          await addDoc(collection(db, 'reps'), data);
        } else {
          const { id, ...data } = rep;
          await updateDoc(doc(db, 'reps', id), data);
        }
      }
      toast.success('Sales reps saved successfully');
      await loadSettings();
    } catch (error) {
      console.error('Error saving reps:', error);
      toast.error('Failed to save sales reps');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <SettingsIcon className="w-8 h-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Commission Settings</h1>
                <p className="text-sm text-gray-600">Configure buckets, weights, and goals</p>
              </div>
            </div>
            
            {/* Quarter Selector & Actions */}
            <div className="flex items-center gap-3">
              <button
                onClick={addQuarter}
                className="btn btn-secondary flex items-center"
                title="Add new quarter for forecasting"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Add Quarter
              </button>
              
              <button
                onClick={exportToCSV}
                className="btn btn-primary flex items-center"
                title="Export commission data to CSV"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Data
              </button>
              
              <div className="flex items-center">
                <label className="text-sm font-medium text-gray-700 mr-2">Quarter:</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="input w-40"
                >
                  {quarters.map((q) => (
                    <option key={q} value={q}>{q}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Global Settings */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Global Settings</h2>
            <button
              onClick={handleSaveConfig}
              disabled={saving}
              className="btn btn-primary flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Saving...' : 'Save Config'}
            </button>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Max Bonus Per Rep ($)
              </label>
              <input
                type="number"
                value={config.maxBonusPerRep}
                onChange={(e) => setConfig({ ...config, maxBonusPerRep: Number(e.target.value) })}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Over-Performance Cap (%)
              </label>
              <input
                type="number"
                value={config.overPerfCap * 100}
                onChange={(e) => setConfig({ ...config, overPerfCap: Number(e.target.value) / 100 })}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">Default: 125%</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Attainment (%)
              </label>
              <input
                type="number"
                value={config.minAttainment * 100}
                onChange={(e) => setConfig({ ...config, minAttainment: Number(e.target.value) / 100 })}
                className="input"
              />
              <p className="text-xs text-gray-500 mt-1">Default: 75%</p>
            </div>
          </div>
        </div>

        {/* Sales Team Roster */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Sales Team Roster</h2>
            <div className="flex space-x-2">
              <button
                onClick={addRep}
                className="btn btn-secondary flex items-center"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Rep
              </button>
              <button
                onClick={handleSaveReps}
                disabled={saving}
                className="btn btn-primary flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Reps
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Title</th>
                  <th>Email</th>
                  <th>Start Date</th>
                  <th>Active</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reps.map((rep, index) => (
                  <tr key={rep.id}>
                    <td>
                      <input
                        type="text"
                        value={rep.name}
                        onChange={(e) => {
                          const newReps = [...reps];
                          newReps[index].name = e.target.value;
                          setReps(newReps);
                        }}
                        className="input"
                        placeholder="Rep Name"
                      />
                    </td>
                    <td>
                      <select
                        value={rep.title}
                        onChange={(e) => {
                          const newReps = [...reps];
                          newReps[index].title = e.target.value;
                          setReps(newReps);
                        }}
                        className="input"
                      >
                        <option value="Account Executive">Account Executive</option>
                        <option value="Jr. Account Executive">Jr. Account Executive</option>
                        <option value="Sr. Account Executive">Sr. Account Executive</option>
                        <option value="Account Manager">Account Manager</option>
                        <option value="Sales Manager">Sales Manager</option>
                      </select>
                    </td>
                    <td>
                      <input
                        type="email"
                        value={rep.email}
                        onChange={(e) => {
                          const newReps = [...reps];
                          newReps[index].email = e.target.value;
                          setReps(newReps);
                        }}
                        className="input"
                        placeholder="email@kanvabotanicals.com"
                      />
                    </td>
                    <td>
                      <input
                        type="date"
                        value={
                          rep.startDate 
                            ? (rep.startDate.toDate ? rep.startDate.toDate().toISOString().split('T')[0] : 
                               rep.startDate instanceof Date ? rep.startDate.toISOString().split('T')[0] : 
                               rep.startDate)
                            : ''
                        }
                        onChange={(e) => {
                          const newReps = [...reps];
                          newReps[index].startDate = new Date(e.target.value);
                          setReps(newReps);
                        }}
                        className="input"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={rep.active}
                        onChange={(e) => {
                          const newReps = [...reps];
                          newReps[index].active = e.target.checked;
                          setReps(newReps);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={rep.notes || ''}
                        onChange={(e) => {
                          const newReps = [...reps];
                          newReps[index].notes = e.target.value;
                          setReps(newReps);
                        }}
                        className="input"
                        placeholder="Optional notes"
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => removeRep(rep.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-md flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Active Reps:</span>
            <span className="text-lg font-bold text-primary-600">
              {reps.filter(r => r.active).length}
            </span>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-md flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total Quarterly Budget:</span>
            <span className="text-lg font-bold text-primary-600">
              ${(config.maxBonusPerRep * reps.filter(r => r.active).length).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Role-Based Commission Scales */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Role-Based Commission Scales</h2>
            <button
              onClick={addRoleScale}
              className="btn btn-secondary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Role
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Set different commission percentages based on rep role. Max Bonus Per Rep (${config.maxBonusPerRep.toLocaleString()}) is for Sr. Account Executive (100%).
          </p>

          <div className="space-y-3">
            {config.roleScales.map((scale, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <select
                    value={scale.role}
                    onChange={(e) => {
                      const newScales = [...config.roleScales];
                      newScales[index].role = e.target.value as RepRole;
                      setConfig({ ...config, roleScales: newScales });
                    }}
                    className="input"
                  >
                    <option value="Sr. Account Executive">Sr. Account Executive</option>
                    <option value="Account Executive">Account Executive</option>
                    <option value="Jr. Account Executive">Jr. Account Executive</option>
                    <option value="Account Manager">Account Manager</option>
                  </select>
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Percentage of Max</label>
                  <input
                    type="number"
                    value={scale.percentage * 100}
                    onChange={(e) => {
                      const newScales = [...config.roleScales];
                      newScales[index].percentage = Number(e.target.value) / 100;
                      setConfig({ ...config, roleScales: newScales });
                    }}
                    className="input"
                    step="1"
                    min="0"
                    max="100"
                  />
                </div>
                
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Max Bonus</label>
                  <div className="text-lg font-semibold text-primary-600">
                    ${(config.maxBonusPerRep * scale.percentage).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </div>
                </div>
                
                <button
                  onClick={() => removeRoleScale(index)}
                  className="text-red-600 hover:text-red-800 mt-6"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Commission Buckets */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Commission Buckets</h2>
            <button
              onClick={addBucket}
              className="btn btn-secondary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Bucket
            </button>
          </div>
          
          <div className="space-y-4">
            {config.buckets.map((bucket, index) => (
              <div key={bucket.id} className="border border-gray-200 rounded-lg p-4">
                <div className="grid md:grid-cols-5 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Code
                    </label>
                    <input
                      type="text"
                      value={bucket.code}
                      onChange={(e) => {
                        const newBuckets = [...config.buckets];
                        newBuckets[index].code = e.target.value;
                        setConfig({ ...config, buckets: newBuckets });
                      }}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={bucket.name}
                      onChange={(e) => {
                        const newBuckets = [...config.buckets];
                        newBuckets[index].name = e.target.value;
                        setConfig({ ...config, buckets: newBuckets });
                      }}
                      className="input"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Weight (%)
                    </label>
                    <input
                      type="number"
                      value={bucket.weight * 100}
                      onChange={(e) => {
                        const newBuckets = [...config.buckets];
                        newBuckets[index].weight = Number(e.target.value) / 100;
                        setConfig({ ...config, buckets: newBuckets });
                      }}
                      className="input"
                      step="0.1"
                    />
                  </div>

                  <div className="flex items-end">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={bucket.hasSubGoals}
                        onChange={(e) => {
                          const newBuckets = [...config.buckets];
                          newBuckets[index].hasSubGoals = e.target.checked;
                          setConfig({ ...config, buckets: newBuckets });
                        }}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Has Sub-Goals</span>
                    </label>
                  </div>
                  
                  <div className="flex items-end">
                    <button
                      onClick={() => removeBucket(bucket.id)}
                      className="btn btn-danger w-full"
                    >
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-md flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total Weight:</span>
            <span className={`text-lg font-bold ${
              Math.abs(getBucketWeightSum() - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(getBucketWeightSum() * 100).toFixed(1)}%
            </span>
          </div>
          
          {Math.abs(getBucketWeightSum() - 1.0) >= 0.001 && (
            <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md flex items-start">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">Bucket weights must sum to 100%</p>
            </div>
          )}
        </div>

        {/* Product Mix Sub-Goals (Bucket B) */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Product Mix Sub-Goals (Bucket B)</h2>
            <div className="flex space-x-2">
              <button
                onClick={addProduct}
                className="btn btn-secondary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Product
              </button>
              <button
                onClick={handleSaveProducts}
                disabled={saving}
                className="btn btn-primary flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Products
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Target %</th>
                  <th>Sub-Weight %</th>
                  <th>MSRP</th>
                  <th>Active</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {products.map((product, index) => (
                  <tr key={product.id}>
                    <td>
                      <input
                        type="text"
                        value={product.sku}
                        onChange={(e) => {
                          const newProducts = [...products];
                          newProducts[index].sku = e.target.value;
                          setProducts(newProducts);
                        }}
                        className="input"
                        placeholder="SKU-001"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={product.targetPercent * 100}
                        onChange={(e) => {
                          const newProducts = [...products];
                          newProducts[index].targetPercent = Number(e.target.value) / 100;
                          setProducts(newProducts);
                        }}
                        className="input"
                        step="0.1"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={product.subWeight * 100}
                        onChange={(e) => {
                          const newProducts = [...products];
                          newProducts[index].subWeight = Number(e.target.value) / 100;
                          setProducts(newProducts);
                        }}
                        className="input"
                        step="0.1"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={product.msrp || ''}
                        onChange={(e) => {
                          const newProducts = [...products];
                          newProducts[index].msrp = Number(e.target.value) || undefined;
                          setProducts(newProducts);
                        }}
                        className="input"
                        placeholder="0"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={product.active}
                        onChange={(e) => {
                          const newProducts = [...products];
                          newProducts[index].active = e.target.checked;
                          setProducts(newProducts);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={product.notes || ''}
                        onChange={(e) => {
                          const newProducts = [...products];
                          newProducts[index].notes = e.target.value;
                          setProducts(newProducts);
                        }}
                        className="input"
                        placeholder="Optional notes"
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => removeProduct(product.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid md:grid-cols-2 gap-4">
            <div className="p-3 bg-gray-50 rounded-md flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Target % Sum:</span>
              <span className={`text-lg font-bold ${
                Math.abs(getProductTargetSum() - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(getProductTargetSum() * 100).toFixed(1)}%
              </span>
            </div>
            <div className="p-3 bg-gray-50 rounded-md flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Sub-Weight Sum:</span>
              <span className={`text-lg font-bold ${
                Math.abs(getProductSubWeightSum() - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'
              }`}>
                {(getProductSubWeightSum() * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>

        {/* Effort Sub-Goals (Bucket D) */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Effort Sub-Goals (Bucket D)</h2>
            <div className="flex space-x-2">
              <button
                onClick={addActivity}
                className="btn btn-secondary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Activity
              </button>
              <button
                onClick={handleSaveActivities}
                disabled={saving}
                className="btn btn-primary flex items-center"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Activities
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Activity</th>
                  <th>Goal</th>
                  <th>Sub-Weight %</th>
                  <th>Data Source</th>
                  <th>Active</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {activities.map((activity, index) => (
                  <tr key={activity.id}>
                    <td>
                      <input
                        type="text"
                        value={activity.activity}
                        onChange={(e) => {
                          const newActivities = [...activities];
                          newActivities[index].activity = e.target.value;
                          setActivities(newActivities);
                        }}
                        className="input"
                        placeholder="Phone Calls"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={activity.goal}
                        onChange={(e) => {
                          const newActivities = [...activities];
                          newActivities[index].goal = Number(e.target.value);
                          setActivities(newActivities);
                        }}
                        className="input"
                        placeholder="100"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={activity.subWeight * 100}
                        onChange={(e) => {
                          const newActivities = [...activities];
                          newActivities[index].subWeight = Number(e.target.value) / 100;
                          setActivities(newActivities);
                        }}
                        className="input"
                        step="0.1"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={activity.dataSource}
                        onChange={(e) => {
                          const newActivities = [...activities];
                          newActivities[index].dataSource = e.target.value;
                          setActivities(newActivities);
                        }}
                        className="input"
                        placeholder="Copper/JustCall"
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        checked={activity.active}
                        onChange={(e) => {
                          const newActivities = [...activities];
                          newActivities[index].active = e.target.checked;
                          setActivities(newActivities);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={activity.notes || ''}
                        onChange={(e) => {
                          const newActivities = [...activities];
                          newActivities[index].notes = e.target.value;
                          setActivities(newActivities);
                        }}
                        className="input"
                        placeholder="Optional notes"
                      />
                    </td>
                    <td>
                      <button
                        onClick={() => removeActivity(activity.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-3 bg-gray-50 rounded-md flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Sub-Weight Sum:</span>
            <span className={`text-lg font-bold ${
              Math.abs(getActivitySubWeightSum() - 1.0) < 0.001 ? 'text-green-600' : 'text-red-600'
            }`}>
              {(getActivitySubWeightSum() * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        {/* Validation Summary */}
        <div className="card bg-primary-50 border-primary-200">
          <h3 className="font-semibold text-gray-900 mb-3">Validation Summary</h3>
          <div className="space-y-2">
            <div className="flex items-center">
              {Math.abs(getBucketWeightSum() - 1.0) < 0.001 ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <span className="text-sm">Bucket weights sum to 100%</span>
            </div>
            <div className="flex items-center">
              {Math.abs(getProductTargetSum() - 1.0) < 0.001 ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <span className="text-sm">Product target % sum to 100%</span>
            </div>
            <div className="flex items-center">
              {Math.abs(getProductSubWeightSum() - 1.0) < 0.001 ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <span className="text-sm">Product sub-weights sum to 100%</span>
            </div>
            <div className="flex items-center">
              {Math.abs(getActivitySubWeightSum() - 1.0) < 0.001 ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <span className="text-sm">Activity sub-weights sum to 100%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
