'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { 
  Calculator, 
  Settings, 
  Database, 
  FileText, 
  TrendingUp,
  LogOut,
  DollarSign,
  Award,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';

interface DashboardStats {
  totalPayout: number;
  avgAttainment: number;
  budget: number;
  utilization: number;
}

interface MonthlyStats {
  currentMonth: string;
  monthlyCommission: number;
  monthlySpiffs: number;
  monthlyOrders: number;
  ytdCommission: number;
  last3Months: Array<{
    month: string;
    commission: number;
    spiffs: number;
  }>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<DashboardStats>({
    totalPayout: 0,
    avgAttainment: 0,
    budget: 25000,
    utilization: 0,
  });
  const [monthlyStats, setMonthlyStats] = useState<MonthlyStats>({
    currentMonth: '',
    monthlyCommission: 0,
    monthlySpiffs: 0,
    monthlyOrders: 0,
    ytdCommission: 0,
    last3Months: [],
  });
  const [salesPersonId, setSalesPersonId] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);
      
      // Check if user is admin
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
      const admin = adminEmails.includes(user.email || '');
      setIsAdmin(admin);
      
      // Get user's salesPerson ID from users collection
      const userDoc = await getDocs(query(collection(db, 'users'), where('email', '==', user.email)));
      let userSalesPerson = '';
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        userSalesPerson = userData.salesPerson || '';
        setSalesPersonId(userSalesPerson);
      }
      
      // Load dashboard stats
      await loadDashboardStats(user.uid);
      await loadMonthlyStats(userSalesPerson);
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const loadDashboardStats = async (userId: string) => {
    try {
      // Load commission entries for current user
      const entriesRef = collection(db, 'commission_entries');
      const q = query(
        entriesRef,
        where('repId', '==', userId),
        orderBy('createdAt', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      let totalPayout = 0;
      let totalAttainment = 0;
      let count = 0;
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.payout) totalPayout += data.payout;
        if (data.attainment) {
          totalAttainment += data.attainment;
          count++;
        }
      });
      
      const avgAttainment = count > 0 ? totalAttainment / count : 0;
      const budget = 25000; // TODO: Load from settings
      const utilization = budget > 0 ? totalPayout / budget : 0;
      
      setStats({
        totalPayout,
        avgAttainment,
        budget,
        utilization,
      });
    } catch (error) {
      console.error('Error loading dashboard stats:', error);
    }
  };

  const loadMonthlyStats = async (salesPersonId: string) => {
    if (!salesPersonId) return;
    
    try {
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = String(now.getMonth() + 1).padStart(2, '0');
      const currentMonthKey = `${currentYear}-${currentMonth}`;
      
      // Load monthly commission summaries for this sales person
      const summariesQuery = query(
        collection(db, 'monthly_commission_summary'),
        where('salesPerson', '==', salesPersonId),
        orderBy('month', 'desc')
      );
      
      const summariesSnapshot = await getDocs(summariesQuery);
      const summaries: any[] = [];
      summariesSnapshot.forEach((doc) => {
        summaries.push({ id: doc.id, ...doc.data() });
      });
      
      // Get current month data
      const currentMonthData = summaries.find(s => s.month === currentMonthKey);
      const monthlyCommission = currentMonthData?.totalCommission || 0;
      const monthlySpiffs = currentMonthData?.totalSpiffs || 0;
      const monthlyOrders = currentMonthData?.totalOrders || 0;
      
      // Calculate YTD
      const ytdCommission = summaries
        .filter(s => s.year === currentYear)
        .reduce((sum, s) => sum + (s.totalCommission || 0), 0);
      
      // Get last 3 months
      const last3Months = summaries.slice(0, 3).map(s => ({
        month: s.month,
        commission: s.totalCommission || 0,
        spiffs: s.totalSpiffs || 0,
      }));
      
      setMonthlyStats({
        currentMonth: currentMonthKey,
        monthlyCommission,
        monthlySpiffs,
        monthlyOrders,
        ytdCommission,
        last3Months,
      });
    } catch (error) {
      console.error('Error loading monthly stats:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      toast.success('Signed out successfully');
      router.push('/');
    } catch (error) {
      toast.error('Failed to sign out');
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
              <Calculator className="w-8 h-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Commission Calculator</h1>
                <p className="text-sm text-gray-600">Kanva Botanicals</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">{user?.email}</p>
                <p className="text-xs text-gray-600">{isAdmin ? 'Admin' : 'Sales Rep'}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="btn btn-secondary flex items-center"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Monthly Commission Stats */}
        {salesPersonId && (
          <>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Monthly Commissions</h2>
            <div className="grid md:grid-cols-4 gap-6 mb-8">
              <div className="card bg-gradient-to-br from-green-50 to-green-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">This Month</h3>
                  <DollarSign className="w-5 h-5 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  ${monthlyStats.monthlyCommission.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">{monthlyStats.currentMonth}</p>
              </div>

              <div className="card bg-gradient-to-br from-purple-50 to-purple-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Spiffs</h3>
                  <Award className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  ${monthlyStats.monthlySpiffs.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">This month</p>
              </div>

              <div className="card bg-gradient-to-br from-blue-50 to-blue-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">Orders</h3>
                  <FileText className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  {monthlyStats.monthlyOrders}
                </p>
                <p className="text-xs text-gray-600 mt-1">This month</p>
              </div>

              <div className="card bg-gradient-to-br from-orange-50 to-orange-100">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-700">YTD Total</h3>
                  <TrendingUp className="w-5 h-5 text-orange-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  ${monthlyStats.ytdCommission.toLocaleString()}
                </p>
                <p className="text-xs text-gray-600 mt-1">Year to date</p>
              </div>
            </div>
          </>
        )}

        {/* Quarterly Bonus Stats */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Quarterly Bonus</h2>
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Payout</h3>
              <DollarSign className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${stats.totalPayout.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Current quarter</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Avg Attainment</h3>
              <Target className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {(stats.avgAttainment * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Across all buckets</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Budget</h3>
              <Award className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              ${stats.budget.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500 mt-1">Max bonus per rep</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Utilization</h3>
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">
              {(stats.utilization * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 mt-1">Of total budget</p>
          </div>
        </div>

        {/* Navigation Cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {isAdmin && (
            <button
              onClick={() => router.push('/settings')}
              className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="flex items-center mb-4">
                <Settings className="w-8 h-8 text-primary-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Settings</h3>
              </div>
              <p className="text-sm text-gray-600">
                Configure buckets, weights, goals, products, and activities
              </p>
            </button>
          )}

          <button
            onClick={() => router.push('/database')}
            className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
          >
            <div className="flex items-center mb-4">
              <Database className="w-8 h-8 text-primary-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Database</h3>
            </div>
            <p className="text-sm text-gray-600">
              System monitoring, data management, and API health status
            </p>
          </button>

          <button
            onClick={() => router.push('/reports')}
            className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
          >
            <div className="flex items-center mb-4">
              <FileText className="w-8 h-8 text-primary-600 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900">Quarterly Reports</h3>
            </div>
            <p className="text-sm text-gray-600">
              Generate quarterly bonus summaries and export data
            </p>
          </button>

          {isAdmin && (
            <button
              onClick={() => router.push('/monthly-reports')}
              className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="flex items-center mb-4">
                <DollarSign className="w-8 h-8 text-green-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Monthly Commissions</h3>
              </div>
              <p className="text-sm text-gray-600">
                View monthly commission reports and details
              </p>
            </button>
          )}

          {isAdmin && (
            <button
              onClick={() => router.push('/team')}
              className="card hover:shadow-lg transition-shadow cursor-pointer text-left"
            >
              <div className="flex items-center mb-4">
                <TrendingUp className="w-8 h-8 text-primary-600 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900">Team View</h3>
              </div>
              <p className="text-sm text-gray-600">
                View all reps performance and rankings
              </p>
            </button>
          )}
        </div>

        {/* Quick Info */}
        <div className="mt-8 card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Structure</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Buckets</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">A - New Business</span>
                  <span className="font-medium">50%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">B - Product Mix</span>
                  <span className="font-medium">15%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">C - Maintain Business</span>
                  <span className="font-medium">20%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">D - Effort</span>
                  <span className="font-medium">15%</span>
                </div>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-gray-900 mb-3">Rules</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start">
                  <span className="text-gray-600">• Minimum attainment to pay:</span>
                  <span className="font-medium ml-2">75%</span>
                </div>
                <div className="flex items-start">
                  <span className="text-gray-600">• Maximum performance cap:</span>
                  <span className="font-medium ml-2">125%</span>
                </div>
                <div className="flex items-start">
                  <span className="text-gray-600">• Max bonus per rep:</span>
                  <span className="font-medium ml-2">$25,000</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
