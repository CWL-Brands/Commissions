'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { doc, getDoc, setDoc, collection, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
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
  Calendar,
  Calculator,
  Upload,
  Database as DatabaseIcon,
  Search,
  Filter,
  Users,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  Map as MapIcon
} from 'lucide-react';
import toast from 'react-hot-toast';
import RegionMap from './RegionMap';
import RegionManager from './RegionManager';
import CustomerMap from './CustomerMap';
import { CommissionConfig, CommissionBucket, ProductSubGoal, ActivitySubGoal, RoleCommissionScale, RepRole, CommissionEntry } from '@/types';
import { validateWeightsSum, calculatePayout, formatCurrency, formatAttainment } from '@/lib/commission/calculator';
import MonthYearModal from '@/components/MonthYearModal';

export default function SettingsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState('Q4 2025');
  const [quarters, setQuarters] = useState<string[]>(['Q4 2025', 'Q1 2026']);
  const [activeTab, setActiveTab] = useState<'quarterly' | 'monthly' | 'customers' | 'team' | 'orgchart'>('quarterly');

  // Configuration state
  const [config, setConfig] = useState<CommissionConfig>({
    quarter: 'Q4 2025',
    maxBonusPerRep: 25000,
    overPerfCap: 125,
    minAttainment: 75,
    buckets: [],
    roleScales: [
      { role: 'Sr. Account Executive', percentage: 1.0 },
      { role: 'Account Executive', percentage: 0.85 },
      { role: 'Jr. Account Executive', percentage: 0.70 },
      { role: 'Account Manager', percentage: 0.60 },
    ],
    budgets: [
      { title: 'Sr. Account Executive', bucketA: 500000, bucketB: 100000, bucketC: 300000, bucketD: 50 },
      { title: 'Account Executive', bucketA: 400000, bucketB: 80000, bucketC: 250000, bucketD: 40 },
      { title: 'Jr. Account Executive', bucketA: 300000, bucketB: 60000, bucketC: 200000, bucketD: 30 },
      { title: 'Account Manager', bucketA: 250000, bucketB: 50000, bucketC: 150000, bucketD: 25 },
    ],
  });

  const [products, setProducts] = useState<ProductSubGoal[]>([]);
  const [activities, setActivities] = useState<ActivitySubGoal[]>([]);
  const [reps, setReps] = useState<any[]>([]);
  
  // Monthly commission rates state
  const [commissionRates, setCommissionRates] = useState<any>({
    rates: [],
    specialRules: {
      repTransfer: {
        enabled: true,
        flatFee: 500,
        percentFallback: 5.0,
        useGreater: true
      },
      inactivityThreshold: 12
    },
    titles: [
      "Account Executive",
      "Jr. Account Executive",
      "Account Manager",
      "Sr. Account Executive"
    ],
    segments: [
      { id: "distributor", name: "Distributor" },
      { id: "wholesale", name: "Wholesale" }
    ]
  });
  const [selectedTitle, setSelectedTitle] = useState<string>("Account Executive");
  const [showMonthYearModal, setShowMonthYearModal] = useState(false);
  
  // Commission calculation rules
  const [commissionRules, setCommissionRules] = useState({
    excludeShipping: true,
    useOrderValue: true,
    applyReorgRule: true, // July 2025 reorg - transferred customers get 2%
    reorgDate: '2025-07-01', // Date of the reorg
  });

  // Org Chart state
  const [orgUsers, setOrgUsers] = useState<any[]>([]);
  const [selectedOrgLevel, setSelectedOrgLevel] = useState<'all' | 'vp' | 'director' | 'regional' | 'division' | 'territory' | 'rep'>('all');
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [orgChartSubTab, setOrgChartSubTab] = useState<'team' | 'regions' | 'regionManager' | 'map'>('team');


  // Customer Management state
  const [customers, setCustomers] = useState<any[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [savingCustomer, setSavingCustomer] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'customerNum' | 'customerName' | 'accountType' | 'salesPerson' | 'originalOwner' | 'shippingCity' | 'shippingState'>('customerName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedCity, setSelectedCity] = useState('all');
  const [selectedState, setSelectedState] = useState('all');
  const [confirmAdminChange, setConfirmAdminChange] = useState<{ customerId: string; newRep: string; customerName: string } | null>(null);
  
  // Batch edit state
  const [batchEditMode, setBatchEditMode] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<Set<string>>(new Set());
  const [batchAccountType, setBatchAccountType] = useState('');
  const [batchSalesRep, setBatchSalesRep] = useState('');
  const [batchTransferStatus, setBatchTransferStatus] = useState('');
  const [savingBatch, setSavingBatch] = useState(false);

  // Fishbowl Import state
  const [fishbowlFile, setFishbowlFile] = useState<File | null>(null);
  const [fishbowlLoading, setFishbowlLoading] = useState(false);
  const [fishbowlResult, setFishbowlResult] = useState<any>(null);

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

  const loadOrgUsers = async () => {
    try {
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: any[] = [];
      usersSnapshot.forEach((doc) => {
        usersData.push({ id: doc.id, ...doc.data() });
      });
      setOrgUsers(usersData);
      console.log('Loaded org users:', usersData.length);
    } catch (error) {
      console.error('Error loading org users:', error);
      toast.error('Failed to load users');
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
        // Ensure budgets exists
        if (!loadedConfig.budgets) {
          loadedConfig.budgets = [
            { title: 'Sr. Account Executive', bucketA: 500000, bucketB: 100000, bucketC: 300000, bucketD: 50 },
            { title: 'Account Executive', bucketA: 400000, bucketB: 80000, bucketC: 250000, bucketD: 40 },
            { title: 'Jr. Account Executive', bucketA: 300000, bucketB: 60000, bucketC: 200000, bucketD: 30 },
            { title: 'Account Manager', bucketA: 250000, bucketB: 50000, bucketC: 150000, bucketD: 25 },
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
          // Ensure budgets exists
          if (!defaultConfig.budgets) {
            defaultConfig.budgets = [
              { title: 'Sr. Account Executive', bucketA: 500000, bucketB: 100000, bucketC: 300000, bucketD: 50 },
              { title: 'Account Executive', bucketA: 400000, bucketB: 80000, bucketC: 250000, bucketD: 40 },
              { title: 'Jr. Account Executive', bucketA: 300000, bucketB: 60000, bucketC: 200000, bucketD: 30 },
              { title: 'Account Manager', bucketA: 250000, bucketB: 50000, bucketC: 150000, bucketD: 25 },
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

      // Load reps from users collection (commissioned users only)
      const usersQuery = query(
        collection(db, 'users'),
        where('isCommissioned', '==', true)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const repsData: any[] = [];
      usersSnapshot.forEach((doc) => {
        const userData = doc.data();
        repsData.push({
          id: doc.id,
          name: userData.name,
          email: userData.email,
          title: userData.title,
          salesPerson: userData.salesPerson, // This is the Fishbowl username
          fishbowlUsername: userData.salesPerson, // Alias for compatibility
          active: userData.isActive,
          startDate: userData.createdAt,
          notes: userData.notes || ''
        });
      });
      setReps(repsData);

      // Load commission rates for selected title
      const titleKey = selectedTitle.replace(/\s+/g, '_');
      const ratesDoc = await getDoc(doc(db, 'settings', `commission_rates_${titleKey}`));
      if (ratesDoc.exists()) {
        const ratesData = ratesDoc.data();
        setCommissionRates(ratesData);
        console.log(`Loaded commission rates for ${selectedTitle} from Firestore`);
      } else {
        console.log(`No commission rates found for ${selectedTitle}, using defaults`);
      }

      // Load commission rules
      const rulesDoc = await getDoc(doc(db, 'settings', 'commission_rules'));
      if (rulesDoc.exists()) {
        setCommissionRules(rulesDoc.data() as any);
        console.log('Loaded commission rules from Firestore');
      }
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
    if (activeTab === 'orgchart') {
      loadOrgUsers();
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, authLoading, router]);

  useEffect(() => {
    if (selectedQuarter) {
      loadSettings();
    }
  }, [selectedQuarter, loadSettings]);

  useEffect(() => {
    if (activeTab === 'orgchart') {
      loadOrgUsers();
    }
  }, [activeTab, user, isAdmin]);

  // Load customers when customers tab is active
  useEffect(() => {
    if (activeTab === 'customers' && isAdmin) {
      console.log('Loading customers for Customers tab...');
      loadCustomers();
    }
  }, [activeTab, isAdmin]);

  // Load commission rates when title changes
  useEffect(() => {
    const loadRatesForTitle = async () => {
      try {
        const titleKey = selectedTitle.replace(/\s+/g, '_');
        const ratesDoc = await getDoc(doc(db, 'settings', `commission_rates_${titleKey}`));
        if (ratesDoc.exists()) {
          const ratesData = ratesDoc.data();
          setCommissionRates(ratesData);
          console.log(`Loaded commission rates for ${selectedTitle}`);
        } else {
          // Reset to defaults if no rates found for this title
          setCommissionRates({
            rates: [],
            specialRules: {
              repTransfer: {
                enabled: true,
                flatFee: 0,
                percentFallback: 2,
                useGreater: true
              },
              inactivityThreshold: 12
            },
            titles: commissionRates.titles || [],
            segments: commissionRates.segments || [
              { id: "distributor", name: "Distributor" },
              { id: "wholesale", name: "Wholesale" }
            ]
          });
          console.log(`No rates found for ${selectedTitle}, using defaults`);
        }
      } catch (error) {
        console.error('Error loading rates for title:', error);
      }
    };

    if (selectedTitle && activeTab === 'monthly') {
      loadRatesForTitle();
    }
  }, [selectedTitle, activeTab]);

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
      
      // Save role-based bonus scales (global, not quarter-specific)
      await setDoc(doc(db, 'settings', 'bonus_scales'), {
        scales: config.roleScales.map(scale => ({
          role: scale.role,
          percentage: scale.percentage,
          maxBonus: config.maxBonusPerRep * scale.percentage
        })),
        maxBonusPerRep: config.maxBonusPerRep,
        updatedAt: new Date(),
        updatedBy: user?.uid || 'unknown'
      });
      
      toast.success(`Bonus configuration saved for ${selectedQuarter}`);
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
        const { id, ...data } = rep;
        
        // Get the Fishbowl username - it's stored as 'salesPerson' in the reps array
        const fishbowlUsername = data.salesPerson || data.fishbowlUsername || '';
        
        console.log(`Saving rep ${data.name}: salesPerson = ${fishbowlUsername}`);
        
        // Map to users collection schema
        const userData: any = {
          name: data.name,
          email: data.email,
          title: data.title,
          salesPerson: fishbowlUsername, // This is the Fishbowl username field
          isActive: data.active,
          role: 'sales',
          isCommissioned: true,
          updatedAt: new Date()
        };
        
        if (data.notes) {
          userData.notes = data.notes;
        }
        
        if (id.startsWith('new_')) {
          // Creating new user - need more fields
          userData.createdAt = new Date();
          userData.passwordChanged = false;
          userData.photoUrl = null;
          await addDoc(collection(db, 'users'), userData);
        } else {
          // Updating existing user
          await updateDoc(doc(db, 'users', id), userData);
          console.log(`✅ Updated user ${id} with salesPerson: ${fishbowlUsername}`);
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

  // Helper to get rate value
  const getRateValue = (segmentId: string, status: string): number | string => {
    const rate = commissionRates.rates.find(
      (r: any) => r.title === selectedTitle && r.segmentId === segmentId && r.status === status
    );
    // Return saved value or default
    if (rate) return rate.percentage;
    
    // Default values
    if (status === 'new_business') {
      return segmentId === 'distributor' ? 8.0 : 10.0;
    } else if (status === '6_month_active') {
      return segmentId === 'distributor' ? 5.0 : 7.0;
    } else if (status === '12_month_active') {
      return segmentId === 'distributor' ? 3.0 : 5.0;
    }
    return '';
  };

  // Helper to update rate value
  const updateRateValue = (segmentId: string, status: string, percentage: number | string, active: boolean = true) => {
    const existingRateIndex = commissionRates.rates.findIndex(
      (r: any) => r.title === selectedTitle && r.segmentId === segmentId && r.status === status
    );

    // Convert to number, but allow empty string to stay as empty
    const percentageValue = percentage === '' ? '' : (typeof percentage === 'string' ? parseFloat(percentage) : percentage);

    const newRate = {
      title: selectedTitle,
      segmentId,
      status,
      percentage: percentageValue,
      active
    };

    let updatedRates;
    if (existingRateIndex >= 0) {
      updatedRates = [...commissionRates.rates];
      updatedRates[existingRateIndex] = newRate;
    } else {
      updatedRates = [...commissionRates.rates, newRate];
    }

    setCommissionRates({
      ...commissionRates,
      rates: updatedRates
    });
  };

  const handleSaveCommissionRates = async () => {
    setSaving(true);
    try {
      const titleKey = selectedTitle.replace(/\s+/g, '_');
      await setDoc(doc(db, 'settings', `commission_rates_${titleKey}`), commissionRates);
      toast.success(`Commission rates saved for ${selectedTitle}!`);
      console.log(`Saved commission rates for ${selectedTitle} to Firestore:`, commissionRates);
    } catch (error) {
      console.error('Error saving commission rates:', error);
      toast.error('Failed to save commission rates');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCommissionRules = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'commission_rules'), commissionRules);
      toast.success('Commission rules saved successfully!');
      console.log('Saved commission rules to Firestore:', commissionRules);
    } catch (error) {
      console.error('Error saving commission rules:', error);
      toast.error('Failed to save commission rules');
    } finally {
      setSaving(false);
    }
  };


  const loadCustomers = async () => {
    console.log('Loading customers...');
    try {
      // Load reps first to map salesPerson to rep names
      const usersQuery = query(
        collection(db, 'users'),
        where('isCommissioned', '==', true)
      );
      const usersSnapshot = await getDocs(usersQuery);
      const repsMap = new Map();
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.salesPerson) {
          repsMap.set(data.salesPerson, data.name);
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
        const customerId = data.id || data.customerNum || doc.id;
        
        // Get the assigned rep (from manual assignment or from orders)
        const assignedRep = data.salesPerson || customerSalesRepMap.get(customerId) || data.salesRep || '';
        const repName = repsMap.get(assignedRep) || assignedRep || 'Unassigned';
        
        // Get the original owner from Fishbowl orders
        const originalOwner = customerSalesRepMap.get(customerId) || data.salesRep || 'Unassigned';
        
        customersData.push({
          id: doc.id,
          customerNum: data.id || data.accountNumber?.toString() || doc.id,
          customerName: data.name || data.customerContact || 'Unknown',
          accountType: data.accountType || 'Retail',
          salesPerson: repName,
          fishbowlUsername: assignedRep, // This is what the dropdown binds to
          originalOwner: originalOwner, // Original from Fishbowl
          shippingCity: data.shippingCity || '',
          shippingState: data.shippingState || ''
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

  const updateTransferStatus = async (customerId: string, newStatus: string) => {
    setSavingCustomer(customerId);
    try {
      const customerRef = doc(db, 'fishbowl_customers', customerId);
      await updateDoc(customerRef, {
        transferStatus: newStatus === 'auto' ? null : newStatus
      });
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, transferStatus: newStatus === 'auto' ? null : newStatus } : c
      ));
      setFilteredCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, transferStatus: newStatus === 'auto' ? null : newStatus } : c
      ));
      
      toast.success('Transfer status updated');
    } catch (error) {
      console.error('Error updating transfer status:', error);
      toast.error('Failed to update transfer status');
    } finally {
      setSavingCustomer(null);
    }
  };

  const updateAccountType = async (customerId: string, newAccountType: string) => {
    setSavingCustomer(customerId);
    try {
      const customerRef = doc(db, 'fishbowl_customers', customerId);
      await updateDoc(customerRef, {
        accountType: newAccountType
      });
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, accountType: newAccountType } : c
      ));
      setFilteredCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, accountType: newAccountType } : c
      ));
      
      toast.success('Account type updated!');
    } catch (error) {
      console.error('Error updating account type:', error);
      toast.error('Failed to update account type');
    } finally {
      setSavingCustomer(null);
    }
  };

  // Check if a customer's sales rep should be locked (protected system accounts)
  const isRepLocked = (originalOwner: string): { locked: boolean; reason: string } => {
    const owner = originalOwner.toLowerCase();
    
    if (owner === 'shopify') {
      return { locked: true, reason: 'SHOPIFY accounts are retail customers - do not modify' };
    }
    if (owner === 'shipstation') {
      return { locked: true, reason: 'ShipStation system account - do not modify' };
    }
    // admin can be changed if needed, so not locked
    return { locked: false, reason: '' };
  };

  const handleSalesRepChange = (customerId: string, newFishbowlUsername: string, originalOwner: string, customerName: string) => {
    // If changing from admin, show confirmation
    if (originalOwner.toLowerCase() === 'admin' && newFishbowlUsername.toLowerCase() !== 'admin') {
      setConfirmAdminChange({ customerId, newRep: newFishbowlUsername, customerName });
    } else {
      // Proceed with update
      updateSalesRep(customerId, newFishbowlUsername);
    }
  };

  const confirmAdminRepChange = () => {
    if (confirmAdminChange) {
      updateSalesRep(confirmAdminChange.customerId, confirmAdminChange.newRep);
      setConfirmAdminChange(null);
    }
  };

  const updateSalesRep = async (customerId: string, newFishbowlUsername: string) => {
    setSavingCustomer(customerId);
    try {
      const customerRef = doc(db, 'fishbowl_customers', customerId);
      const repName = reps.find(r => r.salesPerson === newFishbowlUsername)?.name || newFishbowlUsername || 'Unassigned';
      
      // Update both fishbowlUsername (manual assignment) and salesPerson (display name)
      await updateDoc(customerRef, {
        fishbowlUsername: newFishbowlUsername,  // This is the manual override
        salesPerson: repName  // Display name for UI
      });
      
      // Update local state
      setCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, salesPerson: repName, fishbowlUsername: newFishbowlUsername } : c
      ));
      setFilteredCustomers(prev => prev.map(c => 
        c.id === customerId ? { ...c, salesPerson: repName, fishbowlUsername: newFishbowlUsername } : c
      ));
      
      toast.success('Sales rep updated!');
    } catch (error) {
      console.error('Error updating sales rep:', error);
      toast.error('Failed to update sales rep');
    } finally {
      setSavingCustomer(null);
    }
  };

  const handleSort = (field: 'customerNum' | 'customerName' | 'accountType' | 'salesPerson' | 'shippingCity' | 'shippingState') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Batch edit functions
  const toggleCustomerSelection = (customerId: string) => {
    const newSelected = new Set(selectedCustomers);
    if (newSelected.has(customerId)) {
      newSelected.delete(customerId);
    } else {
      newSelected.add(customerId);
    }
    setSelectedCustomers(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.size === filteredCustomers.length) {
      setSelectedCustomers(new Set());
    } else {
      setSelectedCustomers(new Set(filteredCustomers.map(c => c.id)));
    }
  };

  const handleBatchUpdate = async () => {
    if (selectedCustomers.size === 0) {
      toast.error('No customers selected');
      return;
    }

    if (!batchAccountType && !batchSalesRep && !batchTransferStatus) {
      toast.error('Please select at least one field to update');
      return;
    }

    setSavingBatch(true);
    const loadingToast = toast.loading(`Updating ${selectedCustomers.size} customers...`);

    try {
      const updates: any = {};
      
      if (batchAccountType) {
        updates.accountType = batchAccountType;
      }
      
      if (batchSalesRep) {
        const selectedRep = reps.find(r => r.id === batchSalesRep);
        if (selectedRep) {
          updates.salesPerson = selectedRep.name;
          updates.fishbowlUsername = selectedRep.salesPerson;
        }
      }

      if (batchTransferStatus) {
        updates.transferStatus = batchTransferStatus === 'auto' ? null : batchTransferStatus;
      }

      // Update in Firestore
      const promises = Array.from(selectedCustomers).map(customerId => {
        const customerRef = doc(db, 'fishbowl_customers', customerId);
        return updateDoc(customerRef, updates);
      });

      await Promise.all(promises);

      // Update local state
      setCustomers(prev => prev.map(c => 
        selectedCustomers.has(c.id) ? { ...c, ...updates } : c
      ));
      setFilteredCustomers(prev => prev.map(c => 
        selectedCustomers.has(c.id) ? { ...c, ...updates } : c
      ));

      toast.success(`✅ Updated ${selectedCustomers.size} customers!`, { id: loadingToast });
      
      // Reset batch state
      setSelectedCustomers(new Set());
      setBatchAccountType('');
      setBatchSalesRep('');
      setBatchTransferStatus('');
      setBatchEditMode(false);
    } catch (error) {
      console.error('Error batch updating customers:', error);
      toast.error('Failed to update customers', { id: loadingToast });
    } finally {
      setSavingBatch(false);
    }
  };

  // Filter and sort customers
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
      filtered = filtered.filter(c => c.fishbowlUsername === selectedRep);
    }

    if (selectedAccountType !== 'all') {
      filtered = filtered.filter(c => c.accountType === selectedAccountType);
    }

    if (selectedCity !== 'all') {
      filtered = filtered.filter(c => c.shippingCity === selectedCity);
    }

    if (selectedState !== 'all') {
      filtered = filtered.filter(c => c.shippingState === selectedState);
    }

    // Sort
    filtered.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const comparison = aVal.toString().localeCompare(bVal.toString());
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredCustomers(filtered);
  }, [searchTerm, selectedRep, selectedAccountType, selectedCity, selectedState, customers, activeTab, sortField, sortDirection]);


  const handleFishbowlImport = async () => {
    if (!fishbowlFile) {
      toast.error('Please select a file to import');
      return;
    }

    setFishbowlLoading(true);
    setFishbowlResult(null);
    const loadingToast = toast.loading('Importing Fishbowl data...');

    try {
      const formData = new FormData();
      formData.append('file', fishbowlFile);

      const response = await fetch('/api/fishbowl/import-unified', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Import failed');
      }

      setFishbowlResult(data);
      setFishbowlFile(null);
      
      toast.success(
        `✅ Imported ${data.stats.itemsCreated} line items, ${data.stats.customersCreated + data.stats.customersUpdated} customers, ${data.stats.ordersCreated + data.stats.ordersUpdated} orders!`,
        { id: loadingToast, duration: 5000 }
      );
      
      // Reload customers if on that tab
      if (activeTab === 'customers') {
        loadCustomers();
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to import data', { id: loadingToast });
    } finally {
      setFishbowlLoading(false);
    }
  };

  const handleCalculateMonthlyCommissions = async (month: string, year: number) => {
    setSaving(true);
    const loadingToast = toast.loading('Calculating monthly commissions...');
    
    try {
      const response = await fetch('/api/calculate-monthly-commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Calculation failed');
      }
      
      // Show detailed success message
      if (data.commissionsCalculated > 0) {
        toast.success(
          `✅ Calculated ${data.commissionsCalculated} commissions! Total: $${data.totalCommission.toFixed(2)}`,
          { id: loadingToast, duration: 8000 }
        );
      } else {
        // Show warning if no commissions calculated
        toast.error(
          `⚠️ No commissions calculated. Check console for details.`,
          { id: loadingToast, duration: 10000 }
        );
      }
      
      // Log detailed summary to console for user
      console.log('\n🎯 COMMISSION CALCULATION COMPLETE');
      console.log(`✅ Commissions: ${data.commissionsCalculated}`);
      console.log(`💰 Total: $${data.totalCommission?.toFixed(2) || '0.00'}`);
      console.log(`📋 Orders Processed: ${data.processed}`);
      
    } catch (error: any) {
      toast.error(error.message || 'Failed to calculate commissions', { id: loadingToast });
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

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4">
          <nav className="flex space-x-8" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('quarterly')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'quarterly'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Quarterly Bonus
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'monthly'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Monthly Commissions
            </button>
            <button
              onClick={() => setActiveTab('customers')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'customers'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => setActiveTab('team')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'team'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Sales Team
            </button>
            <button
              onClick={() => setActiveTab('orgchart')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'orgchart'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Org Chart
            </button>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Quarterly Bonus Tab */}
        {activeTab === 'quarterly' && (
          <>
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
          
          {/* Total Quarterly Bonus Budget */}
          <div className="mt-4 p-4 bg-primary-50 border border-primary-200 rounded-lg flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-700">Total Quarterly Bonus Budget</span>
              <p className="text-xs text-gray-500 mt-1">
                {reps.filter(r => r.active).length} active reps × ${config.maxBonusPerRep.toLocaleString()} max bonus
              </p>
            </div>
            <span className="text-2xl font-bold text-primary-600">
              ${(config.maxBonusPerRep * reps.filter(r => r.active).length).toLocaleString()}
            </span>
          </div>
        </div>

        {/* Role-Based Bonus Scales */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Role-Based Bonus Scales</h2>
            <button
              onClick={addRoleScale}
              className="btn btn-secondary flex items-center"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Role
            </button>
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            Set different bonus percentages based on rep role. Max Bonus Per Rep (${config.maxBonusPerRep.toLocaleString()}) is for Sr. Account Executive (100%).
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

        {/* Quarterly Goals by Title */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quarterly Goals by Title</h2>
          <p className="text-sm text-gray-600 mb-4">
            Set revenue and activity goals for each bucket based on rep title. These are used when calculating bonuses.
          </p>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Bucket A Goal ($)<br/><span className="text-xs font-normal text-gray-500">New Business Revenue</span></th>
                  <th>Bucket B Goal ($)<br/><span className="text-xs font-normal text-gray-500">Product Mix Revenue</span></th>
                  <th>Bucket C Goal ($)<br/><span className="text-xs font-normal text-gray-500">Maintain Business Revenue</span></th>
                  <th>Bucket D Goal (#)<br/><span className="text-xs font-normal text-gray-500">Activities Count</span></th>
                </tr>
              </thead>
              <tbody>
                {config.budgets?.map((budget, index) => (
                  <tr key={budget.title}>
                    <td className="font-medium">{budget.title}</td>
                    <td>
                      <input
                        type="number"
                        value={budget.bucketA}
                        onChange={(e) => {
                          const newBudgets = [...(config.budgets || [])];
                          newBudgets[index].bucketA = Number(e.target.value);
                          setConfig({ ...config, budgets: newBudgets });
                        }}
                        className="input w-full"
                        placeholder="500000"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={budget.bucketB}
                        onChange={(e) => {
                          const newBudgets = [...(config.budgets || [])];
                          newBudgets[index].bucketB = Number(e.target.value);
                          setConfig({ ...config, budgets: newBudgets });
                        }}
                        className="input w-full"
                        placeholder="100000"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={budget.bucketC}
                        onChange={(e) => {
                          const newBudgets = [...(config.budgets || [])];
                          newBudgets[index].bucketC = Number(e.target.value);
                          setConfig({ ...config, budgets: newBudgets });
                        }}
                        className="input w-full"
                        placeholder="300000"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={budget.bucketD}
                        onChange={(e) => {
                          const newBudgets = [...(config.budgets || [])];
                          newBudgets[index].bucketD = Number(e.target.value);
                          setConfig({ ...config, budgets: newBudgets });
                        }}
                        className="input w-full"
                        placeholder="50"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Bonus Buckets */}
        <div className="card mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Bonus Buckets</h2>
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
          </>
        )}

        {/* Monthly Commissions Tab */}
        {activeTab === 'monthly' && (
          <div className="space-y-8">
            {/* Fishbowl Import Section */}
            <div className="bg-gradient-to-r from-purple-50 to-blue-50 border-2 border-purple-300 rounded-lg shadow-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">🐟</span>
                <div>
                  <h2 className="text-2xl font-bold text-purple-900">Fishbowl Data Import</h2>
                  <p className="text-sm text-purple-700">Import Conversight report - Creates Customers, Orders, AND Line Items!</p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-300 rounded-lg">
                  <p className="text-sm text-green-900 font-semibold">
                    ✨ <strong>ONE UPLOAD = EVERYTHING!</strong>
                  </p>
                  <ul className="mt-2 text-sm text-green-800 space-y-1">
                    <li>✅ Creates/updates Customers (with shipping city/state)</li>
                    <li>✅ Creates/updates Sales Orders (with commission dates)</li>
                    <li>✅ Creates Line Items (with Product, Revenue, Cost data)</li>
                    <li>✅ All properly linked together!</li>
                    <li>✅ Handles Excel dates automatically</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    📊 Conversight Export (CSV or Excel)
                  </label>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => setFishbowlFile(e.target.files?.[0] || null)}
                    disabled={fishbowlLoading}
                    className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100 disabled:opacity-50"
                  />
                  {fishbowlFile && (
                    <p className="mt-2 text-sm text-green-600">
                      ✅ Selected: {fishbowlFile.name} ({(fishbowlFile.size / 1024 / 1024).toFixed(1)} MB)
                    </p>
                  )}
                </div>

                <button
                  onClick={handleFishbowlImport}
                  disabled={fishbowlLoading || !fishbowlFile}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white px-6 py-4 rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-bold text-lg shadow-lg"
                >
                  {fishbowlLoading ? '⏳ Importing All Data...' : '🚀 Import Fishbowl Data'}
                </button>
              </div>

              {fishbowlResult && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="text-lg font-semibold text-green-900 mb-3">
                    ✅ Import Complete!
                  </h3>
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Customers</p>
                      <p className="text-xl font-bold text-blue-600">
                        {(fishbowlResult.stats.customersCreated + fishbowlResult.stats.customersUpdated).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fishbowlResult.stats.customersCreated} new, {fishbowlResult.stats.customersUpdated} updated
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Sales Orders</p>
                      <p className="text-xl font-bold text-green-600">
                        {(fishbowlResult.stats.ordersCreated + fishbowlResult.stats.ordersUpdated).toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">
                        {fishbowlResult.stats.ordersCreated} new, {fishbowlResult.stats.ordersUpdated} updated
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-600">Line Items</p>
                      <p className="text-xl font-bold text-purple-600">
                        {fishbowlResult.stats.itemsCreated.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">Product-level data</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Calculate Commissions Section */}
            <div className="card bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">💰 Calculate Monthly Commissions</h3>
                  <p className="text-sm text-gray-600">
                    Process imported orders and calculate commissions
                  </p>
                </div>
                <button
                  onClick={() => setShowMonthYearModal(true)}
                  disabled={saving}
                  className="btn btn-success flex items-center"
                >
                  <Calculator className="w-4 h-4 mr-2" />
                  {saving ? 'Calculating...' : 'Calculate'}
                </button>
              </div>
            </div>

            {/* Commission Calculation Rules */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Commission Calculation Rules</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure how commissions are calculated from Fishbowl data
                  </p>
                </div>
                <button
                  onClick={handleSaveCommissionRules}
                  disabled={saving}
                  className="btn btn-primary flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Rules'}
                </button>
              </div>

              <div className="space-y-6">
                {/* Exclude Shipping */}
                <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="excludeShipping"
                    checked={commissionRules.excludeShipping}
                    onChange={(e) => setCommissionRules({...commissionRules, excludeShipping: e.target.checked})}
                    className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="excludeShipping" className="ml-3 flex-1">
                    <span className="text-sm font-medium text-gray-900">Exclude Shipping from Commissions</span>
                    <p className="text-sm text-gray-500 mt-1">
                      Line items with Product = &quot;Shipping&quot; will not count toward commission calculations
                    </p>
                  </label>
                </div>

                {/* Use Order Value */}
                <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="useOrderValue"
                    checked={commissionRules.useOrderValue}
                    onChange={(e) => setCommissionRules({...commissionRules, useOrderValue: e.target.checked})}
                    className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="useOrderValue" className="ml-3 flex-1">
                    <span className="text-sm font-medium text-gray-900">Use Order Value (not Revenue)</span>
                    <p className="text-sm text-gray-500 mt-1">
                      Calculate commissions based on orderValue field instead of revenue field from Fishbowl data
                    </p>
                  </label>
                </div>

                {/* Apply Reorg Rule */}
                <div className="flex items-start p-4 bg-gray-50 rounded-lg">
                  <input
                    type="checkbox"
                    id="applyReorgRule"
                    checked={commissionRules.applyReorgRule}
                    onChange={(e) => setCommissionRules({...commissionRules, applyReorgRule: e.target.checked})}
                    className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                  />
                  <label htmlFor="applyReorgRule" className="ml-3 flex-1">
                    <span className="text-sm font-medium text-gray-900">Apply July 2025 Reorg Rule (Transferred Customers = 2%)</span>
                    <p className="text-sm text-gray-500 mt-1">
                      Customers transferred to a rep after <strong>{commissionRules.reorgDate}</strong> automatically receive 2% commission rate. 
                      This rule expires January 1, 2026.
                    </p>
                    {commissionRules.applyReorgRule && (
                      <div className="mt-3">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Reorg Effective Date</label>
                        <input
                          type="date"
                          value={commissionRules.reorgDate}
                          onChange={(e) => setCommissionRules({...commissionRules, reorgDate: e.target.value})}
                          className="input text-sm max-w-xs"
                        />
                      </div>
                    )}
                  </label>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Note:</strong> These rules apply to both monthly commissions and quarterly bonus calculations. 
                    Changes will take effect on the next calculation run.
                  </p>
                </div>
              </div>
            </div>

            {/* Commission Rate Matrix */}
            <div className="card">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Monthly Commission Rates</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Configure commission percentages based on rep title, customer segment, and customer status
                  </p>
                </div>
                <button
                  onClick={handleSaveCommissionRates}
                  disabled={saving}
                  className="btn btn-primary flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {saving ? 'Saving...' : 'Save Rates'}
                </button>
              </div>

              {/* Title Selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Title to Configure
                </label>
                <select
                  value={selectedTitle}
                  onChange={(e) => setSelectedTitle(e.target.value)}
                  className="input max-w-xs"
                >
                  {commissionRates.titles.map((title: string) => (
                    <option key={title} value={title}>{title}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  Commission rates can be configured per title. Currently showing rates for all titles.
                </p>
              </div>

              {/* Rate Matrix for Each Segment */}
              {commissionRates.segments.map((segment: any) => (
                <div key={segment.id} className="mb-8">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                    {segment.name} Segment
                    <span className="ml-2 text-sm font-normal text-gray-500">
                      ({segment.description || 'Customer segment'})
                    </span>
                  </h3>
                  
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Customer Status
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Description
                          </th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">
                            Commission %
                          </th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-700">
                            Active
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            New Business
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            No orders in last 12 months
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center max-w-xs">
                              <input
                                type="number"
                                value={getRateValue(segment.id, 'new_business')}
                                onChange={(e) => updateRateValue(segment.id, 'new_business', e.target.value)}
                                step="0.1"
                                min="0"
                                max="100"
                                className="input"
                                placeholder="0.0"
                              />
                              <span className="ml-2 text-gray-600">%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={commissionRates.rates.find((r: any) => r.title === selectedTitle && r.segmentId === segment.id && r.status === 'new_business')?.active ?? true}
                              onChange={(e) => updateRateValue(segment.id, 'new_business', getRateValue(segment.id, 'new_business'), e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            6-Month Active
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            Ordered within last 6 months
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center max-w-xs">
                              <input
                                type="number"
                                value={getRateValue(segment.id, '6_month_active')}
                                onChange={(e) => updateRateValue(segment.id, '6_month_active', e.target.value)}
                                step="0.1"
                                min="0"
                                max="100"
                                className="input"
                                placeholder="0.0"
                              />
                              <span className="ml-2 text-gray-600">%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={commissionRates.rates.find((r: any) => r.title === selectedTitle && r.segmentId === segment.id && r.status === '6_month_active')?.active ?? true}
                              onChange={(e) => updateRateValue(segment.id, '6_month_active', getRateValue(segment.id, '6_month_active'), e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                        </tr>
                        <tr className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">
                            12-Month Active
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">
                            Ordered 6-12 months ago
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center max-w-xs">
                              <input
                                type="number"
                                value={getRateValue(segment.id, '12_month_active')}
                                onChange={(e) => updateRateValue(segment.id, '12_month_active', e.target.value)}
                                step="0.1"
                                min="0"
                                max="100"
                                className="input"
                                placeholder="0.0"
                              />
                              <span className="ml-2 text-gray-600">%</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={commissionRates.rates.find((r: any) => r.title === selectedTitle && r.segmentId === segment.id && r.status === '12_month_active')?.active ?? true}
                              onChange={(e) => updateRateValue(segment.id, '12_month_active', getRateValue(segment.id, '12_month_active'), e.target.checked)}
                              className="w-4 h-4"
                            />
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}

              {/* Special Rules Section */}
              <div className="mt-8 border-t border-gray-200 pt-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Special Rules</h3>
                
                <div className="space-y-6">
                  {/* Rep Transfer Rule */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-semibold text-gray-900">Rep Transfer Commission</h4>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={commissionRates.specialRules.repTransfer.enabled}
                          onChange={(e) => setCommissionRates({
                            ...commissionRates,
                            specialRules: {
                              ...commissionRates.specialRules,
                              repTransfer: {
                                ...commissionRates.specialRules.repTransfer,
                                enabled: e.target.checked
                              }
                            }
                          })}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Enabled</span>
                      </label>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">
                      When a customer changes sales reps, apply special commission rate for the new rep
                    </p>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Flat Fee
                        </label>
                        <div className="flex items-center">
                          <span className="text-gray-600 mr-1">$</span>
                          <input
                            type="number"
                            value={commissionRates.specialRules.repTransfer.flatFee}
                            onChange={(e) => setCommissionRates({
                              ...commissionRates,
                              specialRules: {
                                ...commissionRates.specialRules,
                                repTransfer: {
                                  ...commissionRates.specialRules.repTransfer,
                                  flatFee: Number(e.target.value)
                                }
                              }
                            })}
                            className="input"
                            placeholder="500"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Percent Fallback
                        </label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            value={commissionRates.specialRules.repTransfer.percentFallback}
                            onChange={(e) => setCommissionRates({
                              ...commissionRates,
                              specialRules: {
                                ...commissionRates.specialRules,
                                repTransfer: {
                                  ...commissionRates.specialRules.repTransfer,
                                  percentFallback: Number(e.target.value)
                                }
                              }
                            })}
                            step="0.1"
                            className="input"
                            placeholder="5.0"
                          />
                          <span className="ml-2 text-gray-600">%</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Calculation
                        </label>
                        <label className="flex items-center mt-2">
                          <input
                            type="checkbox"
                            checked={commissionRates.specialRules.repTransfer.useGreater}
                            onChange={(e) => setCommissionRates({
                              ...commissionRates,
                              specialRules: {
                                ...commissionRates.specialRules,
                                repTransfer: {
                                  ...commissionRates.specialRules.repTransfer,
                                  useGreater: e.target.checked
                                }
                              }
                            })}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Use Greater of Two</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Inactivity Threshold */}
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 mb-2">Customer Inactivity Threshold</h4>
                    <p className="text-sm text-gray-600 mb-4">
                      Customer reverts to &quot;New Business&quot; status after this many months of no orders
                    </p>
                    <div className="max-w-xs">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Months of Inactivity
                      </label>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={commissionRates.specialRules.inactivityThreshold}
                          onChange={(e) => setCommissionRates({
                            ...commissionRates,
                            specialRules: {
                              ...commissionRates.specialRules,
                              inactivityThreshold: Number(e.target.value)
                            }
                          })}
                          min="1"
                          max="24"
                          className="input"
                          placeholder="12"
                        />
                        <span className="ml-2 text-gray-600">months</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Customers Tab */}
        {activeTab === 'customers' && (
          <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid md:grid-cols-4 gap-6">
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
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
              <div className="grid md:grid-cols-5 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Search className="w-4 h-4 inline mr-1" />
                    Search
                  </label>
                  <input
                    type="text"
                    placeholder="Customer name or #..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Sales Rep</label>
                  <select
                    value={selectedRep}
                    onChange={(e) => setSelectedRep(e.target.value)}
                    className="input w-full"
                  >
                    <option value="all">All Reps</option>
                    {reps
                      .filter(r => r.active)
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map(rep => (
                        <option key={rep.id} value={rep.salesPerson}>
                          {rep.name} ({rep.salesPerson})
                        </option>
                      ))}
                    <option value="">Unassigned</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Type</label>
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <select
                    value={selectedCity}
                    onChange={(e) => setSelectedCity(e.target.value)}
                    className="input w-full"
                  >
                    <option value="all">All Cities</option>
                    {Array.from(new Set(customers.map(c => c.shippingCity).filter(Boolean))).sort().map(city => (
                      <option key={city} value={city}>{city}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="input w-full"
                  >
                    <option value="all">All States</option>
                    {Array.from(new Set(customers.map(c => c.shippingState).filter(Boolean))).sort().map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Batch Edit Actions */}
            {batchEditMode && (
              <div className="card bg-blue-50 border-2 border-blue-300">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-blue-900">
                      📝 Batch Edit Mode ({selectedCustomers.size} selected)
                    </h3>
                    <p className="text-sm text-blue-700">Select customers and update their account type or sales rep</p>
                  </div>
                  <button
                    onClick={() => {
                      setBatchEditMode(false);
                      setSelectedCustomers(new Set());
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Update Account Type
                    </label>
                    <select
                      value={batchAccountType}
                      onChange={(e) => setBatchAccountType(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Don&apos;t Change</option>
                      <option value="Retail">Retail</option>
                      <option value="Wholesale">Wholesale</option>
                      <option value="Distributor">Distributor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Assign Sales Rep
                    </label>
                    <select
                      value={batchSalesRep}
                      onChange={(e) => setBatchSalesRep(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Don&apos;t Change</option>
                      <option value="UNASSIGNED">⚠️ Unassigned (Remove Rep)</option>
                      {reps.filter(r => r.active).map(rep => (
                        <option key={rep.id} value={rep.salesPerson}>
                          {rep.name} ({rep.salesPerson})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transfer Status
                    </label>
                    <select
                      value={batchTransferStatus}
                      onChange={(e) => setBatchTransferStatus(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Don&apos;t Change</option>
                      <option value="auto">🤖 Auto (Calculate)</option>
                      <option value="own">👤 Own (8%)</option>
                      <option value="transferred">🔄 Transferred (2%)</option>
                    </select>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={handleBatchUpdate}
                      disabled={savingBatch || selectedCustomers.size === 0}
                      className="btn btn-primary w-full"
                    >
                      {savingBatch ? '⏳ Saving...' : `💾 Update ${selectedCustomers.size} Customers`}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Customers Table */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Customers ({filteredCustomers.length})
                </h3>
                <button
                  onClick={() => setBatchEditMode(!batchEditMode)}
                  className={`btn ${batchEditMode ? 'btn-secondary' : 'btn-primary'}`}
                >
                  {batchEditMode ? '❌ Cancel Batch Edit' : '📝 Batch Edit'}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {batchEditMode && (
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          <input
                            type="checkbox"
                            checked={selectedCustomers.size === filteredCustomers.length && filteredCustomers.length > 0}
                            onChange={toggleSelectAll}
                            className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                        </th>
                      )}
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div 
                          className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                          onClick={() => handleSort('customerNum')}
                        >
                          <span>Customer #</span>
                          {sortField === 'customerNum' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div 
                          className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                          onClick={() => handleSort('customerName')}
                        >
                          <span>Customer Name</span>
                          {sortField === 'customerName' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                        <div 
                          className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                          onClick={() => handleSort('accountType')}
                        >
                          <span>Account Type</span>
                          {sortField === 'accountType' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div 
                          className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                          onClick={() => handleSort('originalOwner')}
                        >
                          <span>Current Owner</span>
                          <span className="ml-1 text-xs text-gray-400">(Fishbowl)</span>
                          {sortField === 'originalOwner' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-56">
                        <div 
                          className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                          onClick={() => handleSort('salesPerson')}
                        >
                          <span>Assign Sales Rep</span>
                          {sortField === 'salesPerson' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-48">
                        Transfer Status
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div 
                          className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                          onClick={() => handleSort('shippingCity')}
                        >
                          <span>City</span>
                          {sortField === 'shippingCity' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div 
                          className="flex items-center space-x-1 cursor-pointer hover:text-primary-600"
                          onClick={() => handleSort('shippingState')}
                        >
                          <span>State</span>
                          {sortField === 'shippingState' ? (
                            sortDirection === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                          ) : (
                            <ArrowUpDown className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={batchEditMode ? 10 : 9} className="px-4 py-8 text-center text-gray-500">
                          No customers found
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          {batchEditMode && (
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedCustomers.has(customer.id)}
                                onChange={() => toggleCustomerSelection(customer.id)}
                                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                              />
                            </td>
                          )}
                          <td className="px-4 py-3 text-sm font-medium text-gray-900">{customer.customerNum}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{customer.customerName}</td>
                          <td className="px-4 py-3">
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
                          <td className="px-4 py-3">
                            <span className={`text-sm font-mono ${
                              customer.originalOwner === 'Unassigned' || 
                              customer.originalOwner === 'admin' || 
                              customer.originalOwner === 'shopify' ||
                              customer.originalOwner === 'house'
                                ? 'text-gray-400 italic'
                                : 'text-gray-700'
                            }`}>
                              {customer.originalOwner}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {(() => {
                              const lockStatus = isRepLocked(customer.originalOwner);
                              
                              if (savingCustomer === customer.id) {
                                return (
                                  <div className="flex items-center space-x-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                                  </div>
                                );
                              }
                              
                              if (lockStatus.locked) {
                                return (
                                  <div className="flex items-center space-x-2">
                                    <Lock className="w-4 h-4 text-red-500" />
                                    <span className="text-sm text-gray-500 italic">
                                      Protected
                                    </span>
                                    <div className="group relative">
                                      <AlertCircle className="w-4 h-4 text-gray-400 cursor-help" />
                                      <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded shadow-lg -top-2 left-6">
                                        {lockStatus.reason}
                                      </div>
                                    </div>
                                  </div>
                                );
                              }
                              
                              return (
                                <select
                                  value={customer.fishbowlUsername || ''}
                                  onChange={(e) => handleSalesRepChange(customer.id, e.target.value, customer.originalOwner, customer.customerName)}
                                  className="input text-sm w-full"
                                >
                                  <option value="">Unassigned</option>
                                  {reps.filter(r => r.active).map(rep => (
                                    <option key={rep.id} value={rep.salesPerson}>
                                      {rep.name} ({rep.salesPerson})
                                    </option>
                                  ))}
                                </select>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <select
                              value={customer.transferStatus || 'auto'}
                              onChange={(e) => updateTransferStatus(customer.id, e.target.value)}
                              className={`input text-sm ${
                                !customer.transferStatus || customer.transferStatus === 'auto'
                                  ? 'bg-gray-50 border-gray-300'
                                  : customer.transferStatus === 'own'
                                  ? 'bg-purple-50 border-purple-300'
                                  : 'bg-blue-50 border-blue-300'
                              }`}
                            >
                              <option value="auto">🤖 Auto</option>
                              <option value="own">👤 Own (8%)</option>
                              <option value="transferred">🔄 Transferred (2%)</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{customer.shippingCity || '-'}</td>
                          <td className="px-4 py-3 text-sm text-gray-600">{customer.shippingState || '-'}</td>
                          <td className="px-4 py-3">
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
          </div>
        )}

        {/* Sales Team Tab */}
        {activeTab === 'team' && (
          <div className="space-y-8">
            {/* Sales Team Roster */}
            <div className="card">
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

              <p className="text-sm text-gray-600 mb-4">
                <strong>Fishbowl Username</strong> is used for quarterly bonus calculations. 
                Must match the <code className="px-1 py-0.5 bg-gray-100 rounded text-xs">salesPerson</code> field in Fishbowl (e.g., BenW, JaredM, BrandonG).
              </p>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Title (Bonus Tier)</th>
                      <th>Email</th>
                      <th>
                        Fishbowl Username
                        <span className="block text-xs font-normal text-gray-500">For Bonus Calc</span>
                      </th>
                      <th>Start Date</th>
                      <th>Active</th>
                      <th>Notes</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {reps.map((rep, index) => (
                      <tr key={rep.id}>
                        <td className="min-w-[150px]">
                          <input
                            type="text"
                            value={rep.name}
                            onChange={(e) => {
                              const newReps = [...reps];
                              newReps[index].name = e.target.value;
                              setReps(newReps);
                            }}
                            className="input w-full"
                            placeholder="Rep Name"
                          />
                        </td>
                        <td className="min-w-[180px]">
                          <select
                            value={rep.title}
                            onChange={(e) => {
                              const newReps = [...reps];
                              newReps[index].title = e.target.value;
                              setReps(newReps);
                            }}
                            className="input w-full"
                          >
                            <option value="Account Executive">Account Executive</option>
                            <option value="Jr. Account Executive">Jr. Account Executive</option>
                            <option value="Sr. Account Executive">Sr. Account Executive</option>
                            <option value="Account Manager">Account Manager</option>
                            <option value="Sales Manager">Sales Manager</option>
                          </select>
                        </td>
                        <td className="min-w-[200px]">
                          <input
                            type="email"
                            value={rep.email}
                            onChange={(e) => {
                              const newReps = [...reps];
                              newReps[index].email = e.target.value;
                              setReps(newReps);
                            }}
                            className="input w-full"
                            placeholder="email@kanvabotanicals.com"
                          />
                        </td>
                        <td className="min-w-[140px]">
                          <input
                            type="text"
                            value={rep.salesPerson || ''}
                            onChange={(e) => {
                              const newReps = [...reps];
                              newReps[index].salesPerson = e.target.value;
                              setReps(newReps);
                            }}
                            className="input w-full"
                            placeholder="BenW, BrandonG, etc."
                            title="Fishbowl username for commission tracking"
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
            </div>
          </div>
        )}

        {/* Org Chart Tab */}
        {activeTab === 'orgchart' && (
          <div className="space-y-8">
            {/* Header with Sub-Tabs */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">🏢 Organizational Structure</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage your sales organization hierarchy and territory assignments
                  </p>
                </div>
                {orgChartSubTab === 'team' && (
                  <button
                    onClick={() => {
                      setEditingUser(null);
                      setShowAddUserModal(true);
                    }}
                    className="btn btn-primary flex items-center"
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                  </button>
                )}
              </div>

              {/* Sub-Tabs */}
              <div className="border-b border-gray-200 mb-4">
                <nav className="-mb-px flex space-x-8">
                  <button
                    onClick={() => setOrgChartSubTab('team')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      orgChartSubTab === 'team'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Users className="w-4 h-4 inline mr-2" />
                    Team Members
                  </button>
                  <button
                    onClick={() => setOrgChartSubTab('regionManager')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      orgChartSubTab === 'regionManager'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <SettingsIcon className="w-4 h-4 inline mr-2" />
                    Manage Regions
                  </button>
                  <button
                    onClick={() => setOrgChartSubTab('map')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      orgChartSubTab === 'map'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <MapIcon className="w-4 h-4 inline mr-2" />
                    Customer Map
                  </button>
                  <button
                    onClick={() => setOrgChartSubTab('regions')}
                    className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      orgChartSubTab === 'regions'
                        ? 'border-primary-500 text-primary-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <DatabaseIcon className="w-4 h-4 inline mr-2" />
                    Region Stats
                  </button>
                </nav>
              </div>

              {/* Filter by Org Level - Only show on Team tab */}
              {orgChartSubTab === 'team' && (
                <div className="flex items-center space-x-4">
                  <label className="text-sm font-medium text-gray-700">Filter by Level:</label>
                  <select
                    value={selectedOrgLevel}
                    onChange={(e) => setSelectedOrgLevel(e.target.value as any)}
                    className="input"
                  >
                    <option value="all">All Levels</option>
                    <option value="vp">VP Sales</option>
                    <option value="director">Directors</option>
                    <option value="regional">Regional Managers</option>
                    <option value="division">Division Managers</option>
                    <option value="territory">Territory Managers</option>
                    <option value="rep">Sales Reps</option>
                  </select>
                </div>
              )}
            </div>

            {/* Region Manager Sub-Tab */}
            {orgChartSubTab === 'regionManager' && (
              <RegionManager />
            )}

            {/* Customer Map Sub-Tab */}
            {orgChartSubTab === 'map' && (
              <CustomerMap />
            )}

            {/* Regional Stats Sub-Tab */}
            {orgChartSubTab === 'regions' && (
              <RegionMap />
            )}

            {/* Users Table - Only show on Team tab */}
            {orgChartSubTab === 'team' && (
            <>
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Team Members ({orgUsers.filter(u => selectedOrgLevel === 'all' || u.orgRole === selectedOrgLevel).length})
              </h3>

              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Org Level</th>
                      <th>Region/Territory</th>
                      <th>Fishbowl Username</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orgUsers.filter(u => selectedOrgLevel === 'all' || u.orgRole === selectedOrgLevel).length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-gray-500 py-8">
                          No users found. Click &quot;Add User&quot; to get started.
                        </td>
                      </tr>
                    ) : (
                      orgUsers
                        .filter(u => selectedOrgLevel === 'all' || u.orgRole === selectedOrgLevel)
                        .map((user) => (
                          <tr key={user.id}>
                            <td className="font-medium">{user.name}</td>
                            <td className="text-sm text-gray-600">{user.email}</td>
                            <td className="text-sm">{user.title || user.role}</td>
                            <td>
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                user.orgRole === 'vp' ? 'bg-purple-100 text-purple-800' :
                                user.orgRole === 'director' ? 'bg-blue-100 text-blue-800' :
                                user.orgRole === 'regional' ? 'bg-green-100 text-green-800' :
                                user.orgRole === 'division' ? 'bg-yellow-100 text-yellow-800' :
                                user.orgRole === 'territory' ? 'bg-orange-100 text-orange-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {user.orgRole === 'vp' ? 'VP Sales' :
                                 user.orgRole === 'director' ? 'Director' :
                                 user.orgRole === 'regional' ? 'Regional Mgr' :
                                 user.orgRole === 'division' ? 'Division Mgr' :
                                 user.orgRole === 'territory' ? 'Territory Mgr' :
                                 'Sales Rep'}
                              </span>
                            </td>
                            <td className="text-sm text-gray-600">
                              {user.region || user.territory || user.division || '-'}
                            </td>
                            <td className="text-sm font-mono">{user.salesPerson || '-'}</td>
                            <td>
                              {user.isActive ? (
                                <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                  Active
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">
                                  Inactive
                                </span>
                              )}
                            </td>
                            <td>
                              <button
                                onClick={() => {
                                  setEditingUser(user);
                                  setShowAddUserModal(true);
                                }}
                                className="text-primary-600 hover:text-primary-800 text-sm font-medium"
                              >
                                Edit
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid md:grid-cols-6 gap-4">
              <div className="card text-center">
                <div className="text-2xl font-bold text-purple-600">{orgUsers.filter(u => u.orgRole === 'vp').length}</div>
                <div className="text-xs text-gray-600">VP Sales</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-blue-600">{orgUsers.filter(u => u.orgRole === 'director').length}</div>
                <div className="text-xs text-gray-600">Directors</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-green-600">{orgUsers.filter(u => u.orgRole === 'regional').length}</div>
                <div className="text-xs text-gray-600">Regional</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-yellow-600">{orgUsers.filter(u => u.orgRole === 'division').length}</div>
                <div className="text-xs text-gray-600">Division</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-orange-600">{orgUsers.filter(u => u.orgRole === 'territory').length}</div>
                <div className="text-xs text-gray-600">Territory</div>
              </div>
              <div className="card text-center">
                <div className="text-2xl font-bold text-gray-600">{orgUsers.filter(u => u.orgRole === 'rep' || !u.orgRole).length}</div>
                <div className="text-xs text-gray-600">Sales Reps</div>
              </div>
            </div>
            </>
            )}
          </div>
        )}

      </div>

      {/* Month/Year Selection Modal */}
      <MonthYearModal
        isOpen={showMonthYearModal}
        onClose={() => setShowMonthYearModal(false)}
        onSubmit={handleCalculateMonthlyCommissions}
        title="Calculate Monthly Commissions"
        description="Select the month and year to process Fishbowl sales orders"
      />

      {/* Add/Edit User Modal */}
      {showAddUserModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingUser ? 'Edit User' : 'Add New User'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddUserModal(false);
                    setEditingUser(null);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const userData = {
                  name: formData.get('name') as string,
                  email: formData.get('email') as string,
                  role: formData.get('role') as string,
                  orgRole: formData.get('orgRole') as string,
                  title: formData.get('title') as string,
                  salesPerson: formData.get('salesPerson') as string,
                  region: formData.get('region') as string,
                  regionalTerritory: formData.get('regionalTerritory') as string,
                  division: formData.get('division') as string,
                  territory: formData.get('territory') as string,
                  isActive: formData.get('isActive') === 'true',
                  isCommissioned: formData.get('isCommissioned') === 'true',
                  updatedAt: new Date(),
                };

                try {
                  if (editingUser) {
                    // Update existing user
                    await updateDoc(doc(db, 'users', editingUser.id), userData);
                    toast.success('User updated successfully!');
                  } else {
                    // Create new user
                    await addDoc(collection(db, 'users'), {
                      ...userData,
                      createdAt: new Date(),
                    });
                    toast.success('User added successfully!');
                  }
                  setShowAddUserModal(false);
                  setEditingUser(null);
                  loadOrgUsers();
                } catch (error) {
                  console.error('Error saving user:', error);
                  toast.error('Failed to save user');
                }
              }}>
                <div className="space-y-6">
                  {/* Basic Info */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        defaultValue={editingUser?.name || ''}
                        required
                        className="input w-full"
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        defaultValue={editingUser?.email || ''}
                        required
                        className="input w-full"
                        placeholder="john@example.com"
                      />
                    </div>
                  </div>

                  {/* Org Structure */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Organizational Level *
                      </label>
                      <select
                        name="orgRole"
                        defaultValue={editingUser?.orgRole || 'rep'}
                        required
                        className="input w-full"
                      >
                        <option value="vp">VP Sales</option>
                        <option value="director">Director</option>
                        <option value="regional">Regional Manager</option>
                        <option value="division">Division Manager</option>
                        <option value="territory">Territory Manager</option>
                        <option value="rep">Sales Rep</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Job Title
                      </label>
                      <input
                        type="text"
                        name="title"
                        defaultValue={editingUser?.title || ''}
                        className="input w-full"
                        placeholder="Account Executive"
                      />
                    </div>
                  </div>

                  {/* Fishbowl Integration */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Fishbowl Username
                    </label>
                    <input
                      type="text"
                      name="salesPerson"
                      defaultValue={editingUser?.salesPerson || ''}
                      className="input w-full"
                      placeholder="BenW"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Must match the salesPerson field in Fishbowl for commission calculations
                    </p>
                  </div>

                  {/* Geographic Assignment */}
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-semibold text-gray-900 mb-3">Geographic Assignment</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Region
                        </label>
                        <select name="region" defaultValue={editingUser?.region || ''} className="input w-full">
                          <option value="">None</option>
                          <option value="West">West</option>
                          <option value="East">East</option>
                          <option value="Central">Central</option>
                          <option value="South East">South East</option>
                          <option value="South West">South West</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Regional Territory
                        </label>
                        <input
                          type="text"
                          name="regionalTerritory"
                          defaultValue={editingUser?.regionalTerritory || ''}
                          className="input w-full"
                          placeholder="Pacific Northwest"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Division
                        </label>
                        <input
                          type="text"
                          name="division"
                          defaultValue={editingUser?.division || ''}
                          className="input w-full"
                          placeholder="Boise"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Territory Number
                        </label>
                        <input
                          type="text"
                          name="territory"
                          defaultValue={editingUser?.territory || ''}
                          className="input w-full"
                          placeholder="01"
                        />
                      </div>
                    </div>
                  </div>

                  {/* System Role */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      System Role
                    </label>
                    <select
                      name="role"
                      defaultValue={editingUser?.role || 'sales'}
                      className="input w-full"
                    >
                      <option value="admin">Admin</option>
                      <option value="sales">Sales</option>
                    </select>
                  </div>

                  {/* Status Toggles */}
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="isActive"
                        value="true"
                        defaultChecked={editingUser?.isActive !== false}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Active User
                      </label>
                    </div>

                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        name="isCommissioned"
                        value="true"
                        defaultChecked={editingUser?.isCommissioned !== false}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label className="ml-2 text-sm text-gray-700">
                        Eligible for Commissions
                      </label>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end space-x-3 mt-6 pt-6 border-t">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddUserModal(false);
                      setEditingUser(null);
                    }}
                    className="btn btn-secondary"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    {editingUser ? 'Update User' : 'Add User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Admin Change Confirmation Modal */}
      {confirmAdminChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-yellow-600" />
              <h2 className="text-xl font-bold text-gray-900">Confirm Admin Account Change</h2>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                You are about to change the sales rep for an <strong>admin</strong> account:
              </p>
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-3">
                <p className="text-sm font-medium text-gray-900">{confirmAdminChange.customerName}</p>
                <p className="text-xs text-gray-600 mt-1">
                  Current Owner: <span className="font-mono">admin</span>
                </p>
              </div>
              <p className="text-sm text-gray-600">
                Are you sure you want to assign this account to a sales rep?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setConfirmAdminChange(null)}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={confirmAdminRepChange}
                className="btn bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Yes, Change Rep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
