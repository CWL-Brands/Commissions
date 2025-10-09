'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  orderBy,
  Timestamp
} from 'firebase/firestore';
import { 
  Database as DatabaseIcon, 
  Plus, 
  ArrowLeft,
  Filter,
  Download,
  Trash2,
  Upload,
  Calendar,
  Calculator,
  Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CommissionEntry, CommissionConfig, ProductSubGoal, ActivitySubGoal } from '@/types';
import { calculatePayout, formatAttainment, formatCurrency } from '@/lib/commission/calculator';

export default function DatabasePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<'bonus' | 'customers'>('bonus');
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [config, setConfig] = useState<CommissionConfig | null>(null);
  const [products, setProducts] = useState<ProductSubGoal[]>([]);
  const [activities, setActivities] = useState<ActivitySubGoal[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  const [quarters, setQuarters] = useState<string[]>([]);
  const [selectedQuarter, setSelectedQuarter] = useState('');
  const [filterRep, setFilterRep] = useState('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [calculating, setCalculating] = useState(false);
  
  // Customer Management State
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [savingCustomer, setSavingCustomer] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);
      
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
      setIsAdmin(adminEmails.includes(user.email || ''));
      
      await loadData(user.uid);
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (user && selectedQuarter) {
      loadEntries(user.uid);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedQuarter, filterRep]);

  const loadData = async (userId: string) => {
    try {
      // Load config
      const configDoc = await getDoc(doc(db, 'settings', 'commission_config'));
      if (configDoc.exists()) {
        setConfig(configDoc.data() as CommissionConfig);
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

      // Load quarters from quarters collection
      const quartersSnapshot = await getDocs(collection(db, 'quarters'));
      const quartersData: string[] = [];
      quartersSnapshot.forEach((doc) => {
        const code = doc.data().code;
        // Normalize format to 'Q# YYYY'
        const normalized = code.replace('-', ' ');
        quartersData.push(normalized);
      });
      
      const sortedQuarters = quartersData.sort();
      setQuarters(sortedQuarters);
      
      // Set default to most recent quarter
      if (sortedQuarters.length > 0) {
        setSelectedQuarter(sortedQuarters[sortedQuarters.length - 1]);
      }
      
      console.log('Available quarters:', sortedQuarters);

      // Load entries
      await loadEntries(userId);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    }
  };

  const loadEntries = async (userId: string) => {
    if (!selectedQuarter) return;
    
    try {
      const entriesRef = collection(db, 'commission_entries');
      const snapshot = await getDocs(entriesRef);
      const entriesData: CommissionEntry[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // Normalize quarter format for comparison
        const entryQuarter = data.quarterId?.replace('-', ' ');
        const matchesQuarter = entryQuarter === selectedQuarter;
        
        // For admins: show all entries or filtered by rep
        // For non-admins: show only their entries
        const matchesRep = isAdmin 
          ? (filterRep === 'all' || data.repId === filterRep)
          : data.repId === userId;
        
        if (matchesQuarter && matchesRep) {
          entriesData.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          } as CommissionEntry);
        }
      });
      
      entriesData.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      setEntries(entriesData);
      console.log('Loaded entries:', entriesData.length, 'Quarter:', selectedQuarter);
    } catch (error) {
      console.error('Error loading entries:', error);
      toast.error('Failed to load entries');
    }
  };

  const loadCustomers = async () => {
    console.log('Loading customers...');
    try {
      // Load reps first to map salesPerson to rep names
      const repsSnapshot = await getDocs(collection(db, 'reps'));
      const repsMap = new Map();
      repsSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.salesPerson) {
          repsMap.set(data.salesPerson, data.name || data.salesPerson);
        }
      });
      console.log(`Loaded ${repsMap.size} reps for mapping`);

      // Get customers and their sales rep from most recent order
      const snapshot = await getDocs(collection(db, 'fishbowl_customers'));
      console.log(`Found ${snapshot.size} customers in Firestore`);
      
      // Get sales rep for each customer from their orders
      const ordersSnapshot = await getDocs(collection(db, 'fishbowl_sales_orders'));
      const customerSalesRepMap = new Map();
      ordersSnapshot.forEach(doc => {
        const order = doc.data();
        if (order.customerId && order.salesPerson) {
          customerSalesRepMap.set(order.customerId, order.salesPerson);
        }
      });
      console.log(`Mapped ${customerSalesRepMap.size} customers to sales reps from orders`);
      
      const customersData: any[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const customerId = data.id;
        const fishbowlUsername = customerSalesRepMap.get(customerId) || data.salesPerson || data.salesRep || '';
        const repName = repsMap.get(fishbowlUsername) || fishbowlUsername || 'Unassigned';
        
        customersData.push({
          id: doc.id,
          customerNum: data.id || data.accountNumber?.toString() || doc.id,
          customerName: data.name || data.customerContact || 'Unknown',
          accountType: data.accountType || 'Retail',
          salesPerson: repName, // Use mapped rep name
          fishbowlUsername: fishbowlUsername, // Keep original for filtering
          lastOrderDate: data.lastOrderDate || data.updatedAt,
          totalOrders: data.totalOrders || 0,
          accountNumber: data.accountNumber,
        });
      });
      
      // Sort by customer name
      customersData.sort((a, b) => a.customerName.localeCompare(b.customerName));
      
      console.log('Loaded customers:', customersData.length);
      console.log('Sample customer:', customersData[0]);
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    }
  };

  const updateAccountType = async (customerId: string, newAccountType: string) => {
    setSavingCustomer(customerId);
    try {
      const customerRef = doc(db, 'fishbowl_customers', customerId);
      await updateDoc(customerRef, {
        accountType: newAccountType
      });

      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, accountType: newAccountType } : c
      ));

      toast.success(`Account type updated to ${newAccountType}`);
    } catch (error) {
      console.error('Error updating account type:', error);
      toast.error('Failed to update account type');
    } finally {
      setSavingCustomer(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'customers' && isAdmin) {
      loadCustomers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAdmin]);

  useEffect(() => {
    if (activeTab !== 'customers') return;
    
    let filtered = customers;

    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerNum.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedRep !== 'all') {
      filtered = filtered.filter(c => c.salesPerson === selectedRep);
    }

    if (selectedAccountType !== 'all') {
      filtered = filtered.filter(c => c.accountType === selectedAccountType);
    }

    setFilteredCustomers(filtered);
  }, [searchTerm, selectedRep, selectedAccountType, customers, activeTab]);

  const createNewEntry = async () => {
    if (!user || !config) return;

    // For admins, prompt to select a rep
    let selectedRepId = user.uid;
    
    if (isAdmin && reps.length > 0) {
      const repOptions = reps.map((r, i) => (i + 1) + '. ' + r.name + ' (' + r.title + ')').join('\n');
      const repSelection = prompt('Select a rep by entering their number:\n\n' + repOptions);
      
      if (!repSelection) return; // User cancelled
      
      const repIndex = parseInt(repSelection) - 1;
      if (repIndex >= 0 && repIndex < reps.length) {
        selectedRepId = reps[repIndex].id;
      } else {
        toast.error('Invalid selection. Using first rep.');
        selectedRepId = reps[0].id;
      }
    }

    try {
      // Get rep name from reps collection
      const rep = reps.find(r => r.id === selectedRepId);
      const repName = rep ? rep.name : 'Unknown Rep';

      const newEntry: Partial<CommissionEntry> = {
        quarterId: selectedQuarter,
        repId: selectedRepId,
        repName: repName,
        bucketCode: 'A',
        goalValue: 0,
        actualValue: 0,
        attainment: 0,
        bucketMax: 0,
        payout: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const docRef = await addDoc(collection(db, 'commission_entries'), {
        ...newEntry,
        createdAt: Timestamp.fromDate(newEntry.createdAt!),
        updatedAt: Timestamp.fromDate(newEntry.updatedAt!),
      });

      toast.success('Bonus entry created');
      await loadEntries(user.uid);
    } catch (error) {
      console.error('Error creating entry:', error);
      toast.error('Failed to create entry');
    }
  };

  const updateEntry = async (entryId: string, updates: Partial<CommissionEntry>) => {
    if (!config) return;

    try {
      // Recalculate if goal or actual changed
      const entry = entries.find(e => e.id === entryId);
      if (!entry) return;

      const bucket = config.buckets.find(b => b.code === entry.bucketCode);
      if (!bucket) return;

      let subWeight: number | undefined;
      if (entry.bucketCode === 'B' && entry.subGoalId) {
        const product = products.find(p => p.id === entry.subGoalId);
        subWeight = product?.subWeight;
      } else if (entry.bucketCode === 'D' && entry.subGoalId) {
        const activity = activities.find(a => a.id === entry.subGoalId);
        subWeight = activity?.subWeight;
      }

      const goalValue = updates.goalValue ?? entry.goalValue;
      const actualValue = updates.actualValue ?? entry.actualValue;

      const result = calculatePayout({
        goalValue,
        actualValue,
        maxBonus: config.maxBonusPerRep,
        bucketWeight: bucket.weight,
        subWeight,
        minAttainment: config.minAttainment,
        maxAttainment: config.overPerfCap,
      });

      const finalUpdates = {
        ...updates,
        attainment: result.attainment,
        bucketMax: result.bucketMax,
        payout: result.payout,
        updatedAt: Timestamp.fromDate(new Date()),
      };

      await updateDoc(doc(db, 'commission_entries', entryId), finalUpdates);
      
      // Reload entries to show updated data
      if (user) {
        await loadEntries(user.uid);
      }
      
      toast.success('Entry updated');
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error('Failed to update entry');
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    if (!confirm('Are you sure you want to delete this entry? This cannot be undone.')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'commission_entries', entryId));
      toast.success('Entry deleted');
      await loadEntries(user.uid);
    } catch (error) {
      console.error('Error deleting entry:', error);
      toast.error('Failed to delete entry');
    }
  };

  const handleBulkUpload = async (csvText: string) => {
    if (!isAdmin || !config) {
      toast.error('Admin access required');
      return;
    }

    try {
      const lines = csvText.trim().split('\n');
      const headers = lines[0].split(',').map(h => h.trim());
      
      let successCount = 0;
      let errorCount = 0;

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        
        if (values.length < 5) continue; // Skip invalid rows

        const [quarterId, repId, bucketCode, goalValue, actualValue, subGoalId, notes] = values;

        try {
          const bucket = config.buckets.find(b => b.code === bucketCode);
          if (!bucket) {
            console.error('Invalid bucket code: ' + bucketCode);
            errorCount++;
            continue;
          }

          const goal = parseFloat(goalValue) || 0;
          const actual = parseFloat(actualValue) || 0;

          const result = calculatePayout({
            goalValue: goal,
            actualValue: actual,
            maxBonus: config.maxBonusPerRep,
            bucketWeight: bucket.weight,
            minAttainment: config.minAttainment,
            maxAttainment: config.overPerfCap,
          });

          await addDoc(collection(db, 'commission_entries'), {
            quarterId: quarterId.replace('-', ' '),
            repId,
            bucketCode,
            goalValue: goal,
            actualValue: actual,
            attainment: result.attainment,
            bucketMax: result.bucketMax,
            payout: result.payout,
            subGoalId: subGoalId || null,
            notes: notes || '',
            createdAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
          });

          successCount++;
        } catch (error) {
          console.error('Error importing row ' + i + ':', error);
          errorCount++;
        }
      }

      toast.success('Imported ' + successCount + ' entries. ' + errorCount + ' errors.');
      setShowUploadModal(false);
      await loadEntries(user.uid);
    } catch (error) {
      console.error('Error bulk uploading:', error);
      toast.error('Failed to upload CSV');
    }
  };

  const calculateCommissions = async () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    if (!selectedQuarter) {
      toast.error('Please select a quarter first');
      return;
    }

    // Get quarter date range
    const match = selectedQuarter.match(/Q(\d) (\d{4})/);
    if (!match) {
      toast.error('Invalid quarter format');
      return;
    }

    const q = parseInt(match[1]);
    const year = parseInt(match[2]);
    const startMonth = (q - 1) * 3;
    const endMonth = startMonth + 3;
    const startDate = new Date(year, startMonth, 1).toISOString();
    const endDate = new Date(year, endMonth, 0).toISOString();

    setCalculating(true);
    const loadingToast = toast.loading('Calculating bonuses from Fishbowl data... This may take a moment.');
    
    try {
      // Determine which reps to calculate for
      const targetReps = filterRep === 'all' 
        ? reps.filter(r => r.active) // All active reps
        : reps.filter(r => r.id === filterRep); // Just selected rep

      if (targetReps.length === 0) {
        throw new Error('No active reps found');
      }

      let totalRevenue = 0;
      let totalLineItems = 0;
      let successCount = 0;

      // Calculate for each rep
      for (const rep of targetReps) {
        try {
          toast.loading(`Calculating for ${rep.name}... (${successCount + 1}/${targetReps.length})`, {
            id: loadingToast,
          });

          const response = await fetch('/api/calculate-commissions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: rep.id,
              quarterId: selectedQuarter,
              startDate,
              endDate,
            }),
          });

          const data = await response.json();

          if (response.ok) {
            totalRevenue += data.results.totalRevenue || 0;
            totalLineItems += data.results.lineItemCount || 0;
            successCount++;
          } else {
            console.error(`Failed for ${rep.name}:`, data.error);
          }
        } catch (repError) {
          console.error(`Error calculating for ${rep.name}:`, repError);
        }
      }

      toast.success(
        `✅ Bonuses calculated for ${successCount}/${targetReps.length} reps! Total Revenue: $${totalRevenue.toFixed(2)} | ${totalLineItems} line items processed`,
        {
          id: loadingToast,
          duration: 5000,
        }
      );
      
      // Reload entries to show new calculations
      await loadEntries(user.uid);
    } catch (error: any) {
      console.error('Error calculating commissions:', error);
      toast.error(error.message || 'Failed to calculate commissions', {
        id: loadingToast,
      });
    } finally {
      setCalculating(false);
    }
  };

  const addQuarter = async () => {
    if (!isAdmin) {
      toast.error('Admin access required');
      return;
    }

    // Get the latest quarter and suggest next
    const latestQuarter = quarters[quarters.length - 1];
    let suggestedQuarter = 'Q1 2025';
    
    if (latestQuarter) {
      const match = latestQuarter.match(/Q(\d) (\d{4})/);
      if (match) {
        const q = parseInt(match[1]);
        const year = parseInt(match[2]);
        const nextQ = q === 4 ? 1 : q + 1;
        const nextYear = q === 4 ? year + 1 : year;
        suggestedQuarter = 'Q' + nextQ + ' ' + nextYear;
      }
    }

    const newQuarter = prompt('Enter new quarter (format: Q# YYYY):', suggestedQuarter);
    if (!newQuarter) return;

    // Validate format
    if (!/^Q[1-4] \d{4}$/.test(newQuarter)) {
      toast.error('Invalid format. Use Q# YYYY (e.g., Q1 2025)');
      return;
    }

    try {
      await addDoc(collection(db, 'quarters'), {
        code: newQuarter,
        createdAt: Timestamp.now()
      });
      
      toast.success('Quarter ' + newQuarter + ' added');
      setQuarters([...quarters, newQuarter].sort());
      setSelectedQuarter(newQuarter);
    } catch (error) {
      console.error('Error adding quarter:', error);
      toast.error('Failed to add quarter');
    }
  };

  const getStatusClass = (attainment: number): string => {
    if (attainment >= 1.0) return 'status-hit';
    if (attainment >= 0.75) return 'status-close';
    return 'status-low';
  };
  
  const getStatusIcon = (attainment: number): string => {
    if (attainment >= 1.0) return '✓';
    if (attainment >= 0.75) return '→';
    return '⚠';
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
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <button
                onClick={() => router.push('/dashboard')}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <DatabaseIcon className="w-8 h-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Database</h1>
                <p className="text-sm text-gray-600">Manage bonuses and customers</p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex space-x-8 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('bonus')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'bonus'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <DatabaseIcon className="w-4 h-4 inline mr-2" />
              Quarterly Bonuses
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'customers'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Customer Management
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* BONUS TAB */}
        {activeTab === 'bonus' && (
          <>
            {/* Action Buttons */}
            <div className="flex items-center space-x-3 mb-6">
              {isAdmin && (
                <>
                  <button
                    onClick={calculateCommissions}
                    disabled={calculating || !selectedQuarter}
                    className="btn btn-primary flex items-center"
                  >
                    {calculating ? (
                      <>
                        <span className="spinner mr-2"></span>
                        Calculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="w-4 h-4 mr-2" />
                        Calculate Bonuses
                      </>
                    )}
                  </button>
                  <button
                    onClick={addQuarter}
                    className="btn btn-secondary flex items-center"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Add Quarter
                  </button>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="btn btn-secondary flex items-center"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Bulk Upload
                  </button>
                </>
              )}
              <button
                onClick={createNewEntry}
                className="btn btn-secondary flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                New Entry
              </button>
            </div>

            {/* Filters */}
            <div className="card mb-6">
          <div className="flex items-center space-x-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Quarter
              </label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="input"
              >
                {quarters.map(q => (
                  <option key={q} value={q}>{q}</option>
                ))}
              </select>
            </div>
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rep
                </label>
                <select
                  value={filterRep}
                  onChange={(e) => setFilterRep(e.target.value)}
                  className="input"
                >
                  <option value="all">All Reps</option>
                  {reps.filter(r => r.active).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="flex-1"></div>
            <button className="btn btn-secondary flex items-center">
              <Download className="w-4 h-4 mr-2" />
              Export
            </button>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Attainment, Bucket Max, and Payout are automatically calculated. 
            Do not manually edit these fields.
          </p>
        </div>

        {/* Entries Table */}
        <div className="card overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[100px]">Quarter</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[150px]">Rep</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[180px]">Bucket</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[180px]">Sub-Goal</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Goal Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Actual Value</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Attainment %</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[120px]">Bucket Max $</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[100px]">Payout $</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[100px]">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[150px]">Notes</th>
                {isAdmin && <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700 min-w-[80px]">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 12 : 11} className="text-center text-gray-500 py-8">
                    No entries found. Click &quot;New Entry&quot; to add data.
                  </td>
                </tr>
              ) : (
                entries.map((entry) => {
                  const rep = reps.find(r => r.id === entry.repId);
                  const repName = rep?.name || 'Select Rep';
                  
                  return (
                  <tr key={entry.id} className="border-b border-gray-200 hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{entry.quarterId?.replace('-', ' ')}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {repName}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-primary-100 text-primary-800">
                        {entry.bucketCode === 'A' && 'A - New Business'}
                        {entry.bucketCode === 'B' && 'B - Product Mix'}
                        {entry.bucketCode === 'C' && 'C - Maintain Business'}
                        {entry.bucketCode === 'D' && 'D - Effort'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {entry.subGoalLabel || <span className="text-gray-400">N/A</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isAdmin ? (
                        <div className="flex items-center">
                          <span className="text-gray-600 mr-1">$</span>
                          <input
                            type="number"
                            value={entry.goalValue || 0}
                            onChange={(e) => updateEntry(entry.id, { goalValue: Number(e.target.value) })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="0"
                          />
                        </div>
                      ) : (
                        <span className="text-sm font-medium">{formatCurrency(entry.goalValue || 0)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {formatCurrency(entry.actualValue)}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm">
                      {formatAttainment(entry.attainment || 0)}
                    </td>
                    <td className="px-4 py-3 font-medium text-sm">
                      {formatCurrency(entry.bucketMax || 0)}
                    </td>
                    <td className="px-4 py-3 font-bold text-primary-600 text-sm">
                      {formatCurrency(entry.payout || 0)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${
                        getStatusClass(entry.attainment || 0)
                      }`}>
                        {getStatusIcon(entry.attainment || 0)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="text"
                        value={entry.notes || ''}
                        onChange={(e) => updateEntry(entry.id, { notes: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="Notes..."
                      />
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="text-red-600 hover:text-red-800 hover:bg-red-50 p-2 rounded transition-colors"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        {entries.length > 0 && (
          <div className="mt-6 card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quarter Summary</h3>
            <div className="grid md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900">{entries.length}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Payout</p>
                <p className="text-2xl font-bold text-primary-600">
                  {formatCurrency(entries.reduce((sum, e) => sum + (e.payout || 0), 0))}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Attainment</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatAttainment(
                    entries.reduce((sum, e) => sum + (e.attainment || 0), 0) / entries.length
                  )}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Budget Utilization</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatAttainment(
                    entries.reduce((sum, e) => sum + (e.payout || 0), 0) / (config?.maxBonusPerRep || 25000)
                  )}
                </p>
              </div>
            </div>
          </div>
        )}
          </>
        )}

        {/* CUSTOMER MANAGEMENT TAB */}
        {activeTab === 'customers' && (
          <>
            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Customers</h3>
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{customers.length}</p>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Retail</h3>
                  <Filter className="w-5 h-5 text-yellow-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {customers.filter(c => c.accountType === 'Retail').length}
                </p>
                <p className="text-xs text-gray-500 mt-1">No commission</p>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Wholesale</h3>
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {customers.filter(c => c.accountType === 'Wholesale').length}
                </p>
              </div>

              <div className="card">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Distributor</h3>
                  <Users className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {customers.filter(c => c.accountType === 'Distributor').length}
                </p>
              </div>
            </div>

            {/* Filters */}
            <div className="card mb-8">
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Customer
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by name or number..."
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Sales Representative
                  </label>
                  <select
                    value={selectedRep}
                    onChange={(e) => setSelectedRep(e.target.value)}
                    className="input w-full"
                  >
                    <option value="all">All Reps</option>
                    {Array.from(new Set(customers.map(c => c.salesPerson).filter(Boolean))).sort().map(rep => (
                      <option key={rep} value={rep}>{rep}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Account Type
                  </label>
                  <select
                    value={selectedAccountType}
                    onChange={(e) => setSelectedAccountType(e.target.value)}
                    className="input w-full"
                  >
                    <option value="all">All Types</option>
                    <option value="Retail">Retail</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Distributor">Distributor</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Customer Table */}
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Customers ({filteredCustomers.length})
              </h2>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Customer #</th>
                      <th>Customer Name</th>
                      <th>Account Type</th>
                      <th>Sales Rep</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center text-gray-500 py-8">
                          No customers found
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <tr key={customer.id}>
                          <td className="text-sm font-medium">{customer.customerNum}</td>
                          <td className="text-sm">{customer.customerName}</td>
                          <td>
                            {savingCustomer === customer.id ? (
                              <div className="flex items-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                <span className="text-sm text-gray-600">Saving...</span>
                              </div>
                            ) : (
                              <select
                                value={customer.accountType}
                                onChange={(e) => updateAccountType(customer.id, e.target.value)}
                                className={`input text-sm ${
                                  customer.accountType === 'Retail' 
                                    ? 'bg-yellow-50 border-yellow-300' 
                                    : customer.accountType === 'Wholesale'
                                    ? 'bg-blue-50 border-blue-300'
                                    : 'bg-green-50 border-green-300'
                                }`}
                              >
                                <option value="Retail">Retail</option>
                                <option value="Wholesale">Wholesale</option>
                                <option value="Distributor">Distributor</option>
                              </select>
                            )}
                          </td>
                          <td className="text-sm text-gray-600">{customer.salesPerson || '-'}</td>
                          <td>
                            {customer.accountType === 'Retail' ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800">
                                ⚠ No Commission
                              </span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                ✓ Active
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Bulk Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Bulk Upload Commission Data</h2>
              
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Upload a CSV file with the following columns:
                </p>
                <div className="bg-gray-50 p-3 rounded text-xs font-mono">
                  quarterId, repId, bucketCode, goalValue, actualValue, subGoalId (optional), notes (optional)
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  <strong>Example:</strong> Q4 2025, Giz2uYXnSjUIGGbXWFfT, A, 100000, 95000, , Great performance
                </p>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select CSV File
                </label>
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = async (event) => {
                        const text = event.target?.result as string;
                        await handleBulkUpload(text);
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
