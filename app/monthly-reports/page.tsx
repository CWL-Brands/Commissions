'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { ArrowLeft, Download, DollarSign, TrendingUp, Users, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface CommissionSummary {
  id: string;
  salesPerson: string;
  repName: string;
  month: string;
  year: number;
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  paidStatus: string;
  calculatedAt: any;
}

interface CommissionDetail {
  id: string;
  repName: string;
  salesPerson: string;
  orderNum: string;
  customerName: string;
  customerSegment: string;
  customerStatus: string;
  orderRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  orderDate: any;
  notes: string;
}

export default function MonthlyReportsPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<CommissionSummary[]>([]);
  const [details, setDetails] = useState<CommissionDetail[]>([]);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [viewMode, setViewMode] = useState<'summary' | 'details'>('summary');

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

    loadData();
  }, [user, isAdmin, authLoading, router]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load summaries
      const summariesSnapshot = await getDocs(
        query(
          collection(db, 'monthly_commission_summary'),
          orderBy('month', 'desc')
        )
      );
      
      const summariesData: CommissionSummary[] = [];
      summariesSnapshot.forEach((doc) => {
        summariesData.push({ id: doc.id, ...doc.data() } as CommissionSummary);
      });
      setSummaries(summariesData);

      // Set default month to most recent
      if (summariesData.length > 0 && !selectedMonth) {
        setSelectedMonth(summariesData[0].month);
      }

      // Load details for selected month
      if (selectedMonth) {
        await loadDetails(selectedMonth);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load commission data');
    } finally {
      setLoading(false);
    }
  };

  const loadDetails = async (month: string) => {
    try {
      const detailsSnapshot = await getDocs(
        query(
          collection(db, 'monthly_commissions'),
          where('commissionMonth', '==', month),
          orderBy('repName')
        )
      );
      
      const detailsData: CommissionDetail[] = [];
      detailsSnapshot.forEach((doc) => {
        detailsData.push({ id: doc.id, ...doc.data() } as CommissionDetail);
      });
      setDetails(detailsData);
    } catch (error) {
      console.error('Error loading details:', error);
    }
  };

  useEffect(() => {
    if (selectedMonth) {
      loadDetails(selectedMonth);
    }
  }, [selectedMonth]);

  const exportToCSV = () => {
    const filteredSummaries = selectedRep === 'all' 
      ? summaries.filter(s => s.month === selectedMonth)
      : summaries.filter(s => s.month === selectedMonth && s.salesPerson === selectedRep);

    const csvContent = [
      ['Rep Name', 'Sales Person', 'Month', 'Total Orders', 'Total Revenue', 'Total Commission', 'Status'].join(','),
      ...filteredSummaries.map(s => [
        s.repName,
        s.salesPerson,
        s.month,
        s.totalOrders,
        s.totalRevenue.toFixed(2),
        s.totalCommission.toFixed(2),
        s.paidStatus
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-commissions-${selectedMonth}.csv`;
    a.click();
    toast.success('Exported to CSV!');
  };

  const getMonthlyTotals = () => {
    const filtered = summaries.filter(s => s.month === selectedMonth);
    return {
      totalReps: new Set(filtered.map(s => s.salesPerson)).size,
      totalOrders: filtered.reduce((sum, s) => sum + s.totalOrders, 0),
      totalRevenue: filtered.reduce((sum, s) => sum + s.totalRevenue, 0),
      totalCommission: filtered.reduce((sum, s) => sum + s.totalCommission, 0)
    };
  };

  const filteredSummaries = selectedRep === 'all'
    ? summaries.filter(s => s.month === selectedMonth)
    : summaries.filter(s => s.month === selectedMonth && s.salesPerson === selectedRep);

  const filteredDetails = selectedRep === 'all'
    ? details
    : details.filter(d => d.salesPerson === selectedRep);

  const uniqueMonths = Array.from(new Set(summaries.map(s => s.month))).sort().reverse();
  const uniqueReps = Array.from(new Set(summaries.map(s => ({ name: s.repName, salesPerson: s.salesPerson }))));

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner border-primary-600"></div>
      </div>
    );
  }

  const totals = getMonthlyTotals();

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
              <DollarSign className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Monthly Commission Reports</h1>
                <p className="text-sm text-gray-600">View and export monthly commission data</p>
              </div>
            </div>
            
            <button
              onClick={exportToCSV}
              className="btn btn-primary flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Filters */}
        <div className="card mb-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input w-48"
                >
                  <option value="">Select Month</option>
                  {uniqueMonths.map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sales Rep</label>
                <select
                  value={selectedRep}
                  onChange={(e) => setSelectedRep(e.target.value)}
                  className="input w-48"
                >
                  <option value="all">All Reps</option>
                  {uniqueReps.map((rep) => (
                    <option key={rep.salesPerson} value={rep.salesPerson}>
                      {rep.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">View</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewMode('summary')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'summary'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    onClick={() => setViewMode('details')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'details'
                        ? 'bg-primary-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {selectedMonth && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="card bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-600">Active Reps</p>
                  <p className="text-2xl font-bold text-blue-900">{totals.totalReps}</p>
                </div>
                <Users className="w-8 h-8 text-blue-600" />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-green-50 to-green-100 border-green-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-green-600">Total Orders</p>
                  <p className="text-2xl font-bold text-green-900">{totals.totalOrders}</p>
                </div>
                <Calendar className="w-8 h-8 text-green-600" />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-purple-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-purple-900">
                    ${totals.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <TrendingUp className="w-8 h-8 text-purple-600" />
              </div>
            </div>

            <div className="card bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-orange-600">Total Commission</p>
                  <p className="text-2xl font-bold text-orange-900">
                    ${totals.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-orange-600" />
              </div>
            </div>
          </div>
        )}

        {/* Summary View */}
        {viewMode === 'summary' && selectedMonth && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Commission Summary by Rep</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rep Name</th>
                    <th>Sales Person</th>
                    <th className="text-right">Orders</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Commission</th>
                    <th className="text-right">Avg Rate</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSummaries.map((summary) => (
                    <tr key={summary.id}>
                      <td className="font-medium">{summary.repName}</td>
                      <td className="text-gray-600">{summary.salesPerson}</td>
                      <td className="text-right">{summary.totalOrders}</td>
                      <td className="text-right">
                        ${summary.totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right font-semibold text-green-600">
                        ${summary.totalCommission.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right text-gray-600">
                        {((summary.totalCommission / summary.totalRevenue) * 100).toFixed(2)}%
                      </td>
                      <td>
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          summary.paidStatus === 'paid'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {summary.paidStatus}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Details View */}
        {viewMode === 'details' && selectedMonth && (
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Detailed Commission Breakdown</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rep</th>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Segment</th>
                    <th>Status</th>
                    <th className="text-right">Revenue</th>
                    <th className="text-right">Rate</th>
                    <th className="text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDetails.map((detail) => (
                    <tr key={detail.id}>
                      <td className="font-medium text-sm">{detail.repName}</td>
                      <td className="text-sm text-gray-600">{detail.orderNum}</td>
                      <td className="text-sm">{detail.customerName}</td>
                      <td className="text-sm">
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {detail.customerSegment}
                        </span>
                      </td>
                      <td className="text-sm">
                        <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                          {detail.customerStatus}
                        </span>
                      </td>
                      <td className="text-right text-sm">
                        ${detail.orderRevenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right text-sm text-gray-600">
                        {detail.commissionRate.toFixed(2)}%
                      </td>
                      <td className="text-right text-sm font-semibold text-green-600">
                        ${detail.commissionAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!selectedMonth && (
          <div className="card text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Month Selected</h3>
            <p className="text-gray-600">Select a month from the dropdown above to view commission reports</p>
          </div>
        )}

        {selectedMonth && filteredSummaries.length === 0 && (
          <div className="card text-center py-12">
            <DollarSign className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Data Found</h3>
            <p className="text-gray-600">No commission data available for the selected filters</p>
          </div>
        )}
      </div>
    </div>
  );
}
