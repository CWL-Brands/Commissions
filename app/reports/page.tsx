'use client';

import { useEffect, useState, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/firebase/config';
import { collection, query, where, getDocs, doc, getDoc, orderBy } from 'firebase/firestore';
import { useAuth } from '@/lib/contexts/AuthContext';
import { 
  FileText, 
  ArrowLeft,
  Download,
  TrendingUp,
  Award,
  Target,
  DollarSign,
  Calendar,
  Users,
  ChevronDown,
  ChevronRight,
  Package,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CommissionEntry, RepPerformance, BucketPerformance } from '@/types';
import { formatAttainment, formatCurrency } from '@/lib/commission/calculator';
import * as XLSX from 'xlsx';

interface MonthlyCommissionSummary {
  id: string;
  salesPerson: string;
  repName: string;
  month: string;
  year: number;
  totalOrders: number;
  totalRevenue: number;
  totalCommission: number;
  paidStatus: string;
}

interface MonthlyCommissionDetail {
  id: string;
  repName: string;
  salesPerson: string;
  orderNum: string;
  customerName: string;
  customerId?: string;
  customerSegment: string;
  customerStatus: string;
  accountType?: string;
  orderRevenue: number;
  commissionRate: number;
  commissionAmount: number;
  orderDate: any;
  hasSpiff?: boolean; // Flag to indicate if order has spiff overrides
  isOverride?: boolean; // Flag to indicate if commission was manually overridden
  overrideReason?: string; // Reason for manual override
}

interface OrderLineItem {
  id: string;
  orderNum: string;
  productNum: string;
  product: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  commissionAmount: number;
}

export default function ReportsPage() {
  const router = useRouter();
  const { user, userProfile, loading: authLoading, canViewAllCommissions } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'quarterly' | 'monthly'>('quarterly');
  
  // Quarterly Bonus State
  const [selectedQuarter, setSelectedQuarter] = useState('Q1-2025');
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [repPerformance, setRepPerformance] = useState<RepPerformance[]>([]);
  const [bucketPerformance, setBucketPerformance] = useState<BucketPerformance[]>([]);
  
  // Monthly Commission State
  const [selectedMonth, setSelectedMonth] = useState('');
  const [monthlySummaries, setMonthlySummaries] = useState<MonthlyCommissionSummary[]>([]);
  const [monthlyDetails, setMonthlyDetails] = useState<MonthlyCommissionDetail[]>([]);
  const [orderLineItems, setOrderLineItems] = useState<Map<string, OrderLineItem[]>>(new Map());
  const [monthlyViewMode, setMonthlyViewMode] = useState<'summary' | 'detailed' | 'calculation_log'>('summary');
  const [expandedCustomers, setExpandedCustomers] = useState<Set<string>>(new Set());
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [selectedRep, setSelectedRep] = useState<string>('all');
  const [calculationLogs, setCalculationLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      router.push('/login');
      return;
    }

    const loadData = async () => {
      await loadReportData(user.uid, canViewAllCommissions);
      await loadMonthlyData(user.uid, canViewAllCommissions);
      setLoading(false);
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user, router, selectedQuarter, selectedMonth, canViewAllCommissions]);

  const loadMonthlyData = async (userId: string, admin: boolean) => {
    try {
      // Load monthly summaries
      const summariesQuery = admin
        ? query(collection(db, 'monthly_commission_summary'), orderBy('month', 'desc'))
        : query(collection(db, 'monthly_commission_summary'), where('salesPerson', '==', userId), orderBy('month', 'desc'));
      
      const summariesSnapshot = await getDocs(summariesQuery);
      const summariesData: MonthlyCommissionSummary[] = [];
      summariesSnapshot.forEach((doc) => {
        summariesData.push({ id: doc.id, ...doc.data() } as MonthlyCommissionSummary);
      });
      setMonthlySummaries(summariesData);

      // Set default month
      if (summariesData.length > 0 && !selectedMonth) {
        setSelectedMonth(summariesData[0].month);
      }

      // Load details if month is selected
      if (selectedMonth) {
        const detailsQuery = admin
          ? query(collection(db, 'monthly_commissions'), where('commissionMonth', '==', selectedMonth))
          : query(collection(db, 'monthly_commissions'), where('commissionMonth', '==', selectedMonth), where('salesPerson', '==', userId));
        
        const detailsSnapshot = await getDocs(detailsQuery);
        const detailsData: MonthlyCommissionDetail[] = [];
        detailsSnapshot.forEach((doc) => {
          detailsData.push({ id: doc.id, ...doc.data() } as MonthlyCommissionDetail);
        });
        
        // Recalculate commissions with spiff overrides
        const updatedDetails = await recalculateCommissionsWithSpiffs(detailsData, selectedMonth);
        setMonthlyDetails(updatedDetails);
      }
    } catch (error) {
      console.error('Error loading monthly data:', error);
    }
  };

  // Recalculate order commissions to account for spiff overrides
  const recalculateCommissionsWithSpiffs = async (details: MonthlyCommissionDetail[], month: string): Promise<MonthlyCommissionDetail[]> => {
    try {
      // Load active spiffs for the month
      const [year, monthNum] = month.split('-');
      const periodStart = new Date(parseInt(year), parseInt(monthNum) - 1, 1);
      const periodEnd = new Date(parseInt(year), parseInt(monthNum), 0, 23, 59, 59);
      
      const spiffsQuery = query(collection(db, 'spiffs'));
      const spiffsSnapshot = await getDocs(spiffsQuery);
      const activeSpiffs = new Map();
      
      spiffsSnapshot.forEach(doc => {
        const spiff = doc.data();
        const startDate = spiff.startDate?.toDate?.() || new Date(spiff.startDate);
        const endDate = spiff.endDate?.toDate?.() || (spiff.endDate ? new Date(spiff.endDate) : null);
        
        if (startDate <= periodEnd && (!endDate || endDate >= periodStart)) {
          activeSpiffs.set(spiff.productNum, { id: doc.id, ...spiff });
        }
      });

      // If no spiffs, return original details
      if (activeSpiffs.size === 0) {
        return details;
      }

      // Recalculate commission for each order
      const updatedDetails = await Promise.all(details.map(async (detail) => {
        try {
          // Load line items for this order
          const itemsQuery = query(
            collection(db, 'fishbowl_soitems'),
            where('salesOrderNum', '==', detail.orderNum)
          );
          
          const itemsSnapshot = await getDocs(itemsQuery);
          let totalCommission = 0;
          let hasSpiff = false;
          
          itemsSnapshot.forEach((doc) => {
            const data = doc.data();
            const lineTotal = data.revenue || 0;
            const quantity = data.quantity || 0;
            const productNumber = data.partNumber || data.productNum || '';
            
            // Check if shipping or CC processing
            const productName = (data.product || data.description || '').toLowerCase();
            const productNum = productNumber.toLowerCase();
            const isShipping = productName.includes('shipping') || productNum.includes('shipping') || productName === 'shipping';
            const isCCProcessing = productName.includes('cc processing') || productName.includes('credit card processing') || productNum.includes('cc processing');
            
            if (isShipping || isCCProcessing) {
              return; // No commission
            }
            
            // Check for spiff override
            const spiff = activeSpiffs.get(productNumber);
            if (spiff) {
              hasSpiff = true; // Mark that this order has a spiff
              const typeNormalized = (spiff.incentiveType || '').toLowerCase().replace(/[^a-z]/g, '');
              if (typeNormalized === 'flat') {
                totalCommission += quantity * spiff.incentiveValue;
              } else if (typeNormalized === 'percentage') {
                totalCommission += lineTotal * (spiff.incentiveValue / 100);
              }
            } else {
              // Use percentage commission
              totalCommission += lineTotal * (detail.commissionRate / 100);
            }
          });
          
          // Return updated detail with recalculated commission and spiff flag
          // IMPORTANT: Don't override manual adjustments!
          if (detail.isOverride) {
            // Keep the manually adjusted commission amount
            return { ...detail, hasSpiff: hasSpiff };
          } else {
            // Use recalculated commission
            return { ...detail, commissionAmount: totalCommission, hasSpiff: hasSpiff };
          }
        } catch (error) {
          console.error(`Error recalculating commission for order ${detail.orderNum}:`, error);
          return detail; // Return original on error
        }
      }));

      return updatedDetails;
    } catch (error) {
      console.error('Error recalculating commissions with spiffs:', error);
      return details; // Return original on error
    }
  };

  // Group monthly details by customer
  const groupOrdersByCustomer = () => {
    const grouped = new Map<string, {
      customerName: string;
      customerStatus: string;
      customerSegment: string;
      accountType: string;
      commissionRate: number;
      orders: MonthlyCommissionDetail[];
      totalRevenue: number;
      totalCommission: number;
    }>();

    monthlyDetails
      .filter(detail => selectedRep === 'all' || detail.repName === selectedRep)
      .forEach((detail) => {
      if (!grouped.has(detail.customerName)) {
        grouped.set(detail.customerName, {
          customerName: detail.customerName,
          customerStatus: detail.customerStatus,
          customerSegment: detail.customerSegment,
          accountType: detail.accountType || 'Unknown',
          commissionRate: detail.commissionRate,
          orders: [],
          totalRevenue: 0,
          totalCommission: 0,
        });
      }

      const customer = grouped.get(detail.customerName)!;
      customer.orders.push(detail);
      customer.totalRevenue += detail.orderRevenue;
      customer.totalCommission += detail.commissionAmount;
    });

    return Array.from(grouped.values()).sort((a, b) => 
      a.customerName.localeCompare(b.customerName)
    );
  };

  const toggleCustomer = (customerName: string) => {
    const newExpanded = new Set(expandedCustomers);
    if (newExpanded.has(customerName)) {
      newExpanded.delete(customerName);
    } else {
      newExpanded.add(customerName);
    }
    setExpandedCustomers(newExpanded);
  };

  const loadCalculationLogs = async () => {
    if (!selectedMonth) return;
    
    setLogsLoading(true);
    try {
      const response = await fetch(`/api/commission-calculation-logs?month=${selectedMonth}&rep=${selectedRep}`);
      const data = await response.json();
      
      if (data.success) {
        setCalculationLogs(data.logs);
        console.log(`Loaded ${data.logs.length} calculation logs`);
      } else {
        console.error('Failed to load calculation logs:', data.error);
        toast.error('Failed to load calculation logs');
      }
    } catch (error) {
      console.error('Error loading calculation logs:', error);
      toast.error('Failed to load calculation logs');
    } finally {
      setLogsLoading(false);
    }
  };

  const exportCalculationLogsToCSV = () => {
    if (calculationLogs.length === 0) {
      toast.error('No calculation logs to export');
      return;
    }

    // Filter logs by selected rep
    const filteredLogs = calculationLogs.filter(log => selectedRep === 'all' || log.repName === selectedRep);
    
    // Prepare CSV data
    const csvData = filteredLogs.map(log => ({
      'Order #': log.orderNum,
      'Customer': log.customerName,
      'Sales Rep': log.repName,
      'Rep Title': log.repTitle,
      'Segment': log.customerSegment,
      'Status': log.customerStatus,
      'Account Type': log.accountType,
      'Revenue': log.orderAmount,
      'Rate': `${log.commissionRate.toFixed(2)}%`,
      'Commission': log.commissionAmount,
      'Rate Source': log.rateSource === 'configured' ? 'Found' : 'Default',
      'Calculated At': new Date(log.calculatedAt).toLocaleString(),
      'Order Date': log.orderDate ? new Date(log.orderDate).toLocaleDateString() : '',
      'Notes': log.notes || ''
    }));

    // Create and download CSV
    const ws = XLSX.utils.json_to_sheet(csvData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Calculation Log');
    
    const fileName = `commission-calculation-log-${selectedMonth}-${selectedRep === 'all' ? 'all-reps' : selectedRep.replace(/\s+/g, '-')}.xlsx`;
    XLSX.writeFile(wb, fileName);
    
    toast.success(`Exported ${filteredLogs.length} calculation logs to ${fileName}`);
  };

  const toggleOrder = async (orderNum: string, commissionRate: number) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderNum)) {
      newExpanded.delete(orderNum);
    } else {
      newExpanded.add(orderNum);
      // Load line items if not already loaded
      if (!orderLineItems.has(orderNum)) {
        await loadLineItems(orderNum, commissionRate);
      }
    }
    setExpandedOrders(newExpanded);
  };

  const loadLineItems = async (orderNum: string, commissionRate: number) => {
    try {
      // Load active spiffs for the selected month
      const activeSpiffs = new Map();
      if (selectedMonth) {
        const [year, month] = selectedMonth.split('-');
        const periodStart = new Date(parseInt(year), parseInt(month) - 1, 1);
        const periodEnd = new Date(parseInt(year), parseInt(month), 0, 23, 59, 59);
        
        const spiffsQuery = query(collection(db, 'spiffs'));
        const spiffsSnapshot = await getDocs(spiffsQuery);
        
        spiffsSnapshot.forEach(doc => {
          const spiff = doc.data();
          const startDate = spiff.startDate?.toDate?.() || new Date(spiff.startDate);
          const endDate = spiff.endDate?.toDate?.() || (spiff.endDate ? new Date(spiff.endDate) : null);
          
          if (startDate <= periodEnd && (!endDate || endDate >= periodStart)) {
            activeSpiffs.set(spiff.productNum, { id: doc.id, ...spiff });
          }
        });
      }
      
      // Query fishbowl_soitems for this order
      const itemsQuery = query(
        collection(db, 'fishbowl_soitems'),
        where('salesOrderNum', '==', orderNum)
      );
      
      const itemsSnapshot = await getDocs(itemsQuery);
      const items: OrderLineItem[] = [];
      
      itemsSnapshot.forEach((doc) => {
        const data = doc.data();
        const lineTotal = (data.revenue || 0);
        const quantity = data.quantity || 0;
        
        // Check if this is a shipping or CC processing line (should not be commissioned)
        const productName = (data.product || data.description || '').toLowerCase();
        const productNumber = data.partNumber || data.productNum || '';
        const productNum = productNumber.toLowerCase();
        
        const isShipping = productName.includes('shipping') || 
                          productNum.includes('shipping') ||
                          productName === 'shipping';
        
        const isCCProcessing = productName.includes('cc processing') ||
                              productName.includes('credit card processing') ||
                              productNum.includes('cc processing');
        
        let commissionAmount = 0;
        
        // Check for spiff override first
        const spiff = activeSpiffs.get(productNumber);
        if (spiff && !isShipping && !isCCProcessing) {
          // Spiff overrides percentage commission
          const typeNormalized = (spiff.incentiveType || '').toLowerCase().replace(/[^a-z]/g, '');
          if (typeNormalized === 'flat') {
            commissionAmount = quantity * spiff.incentiveValue;
          } else if (typeNormalized === 'percentage') {
            commissionAmount = lineTotal * (spiff.incentiveValue / 100);
          }
        } else if (!isShipping && !isCCProcessing) {
          // No spiff, use percentage commission
          commissionAmount = lineTotal * (commissionRate / 100);
        }
        
        items.push({
          id: doc.id,
          orderNum: orderNum,
          productNum: productNumber,
          product: data.product || '',
          description: data.description || data.productDesc || '',
          quantity: quantity,
          unitPrice: data.unitPrice || 0,
          lineTotal: lineTotal,
          commissionAmount: commissionAmount,
        });
      });
      
      // Calculate total commission from line items (to reflect spiff overrides)
      const totalLineItemCommission = items.reduce((sum, item) => sum + item.commissionAmount, 0);
      
      // Update the order's commission amount in monthlyDetails to reflect actual line item totals
      // IMPORTANT: Don't override manual adjustments!
      setMonthlyDetails(prev => prev.map(detail => {
        if (detail.orderNum === orderNum) {
          // If this order has a manual override, keep the override amount
          if (detail.isOverride) {
            return detail; // Don't change the commission amount
          }
          // Otherwise, update with calculated line item total
          return { ...detail, commissionAmount: totalLineItemCommission };
        }
        return detail;
      }));
      
      // Update the map
      setOrderLineItems(prev => new Map(prev).set(orderNum, items));
    } catch (error) {
      console.error('Error loading line items:', error);
      toast.error('Failed to load line items');
    }
  };

  const loadReportData = async (userId: string, admin: boolean) => {
    try {
      // Load all entries for the quarter
      const entriesRef = collection(db, 'commission_entries');
      const q = admin
        ? query(entriesRef, where('quarterId', '==', selectedQuarter))
        : query(entriesRef, where('repId', '==', userId), where('quarterId', '==', selectedQuarter));
      
      const snapshot = await getDocs(q);
      const entriesData: CommissionEntry[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        entriesData.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as CommissionEntry);
      });
      
      setEntries(entriesData);
      
      // Calculate rep performance
      if (admin) {
        calculateRepPerformance(entriesData);
      }
      
      // Calculate bucket performance
      calculateBucketPerformance(entriesData, userId);
    } catch (error) {
      console.error('Error loading report data:', error);
      toast.error('Failed to load report data');
    }
  };

  const calculateRepPerformance = (entries: CommissionEntry[]) => {
    const repMap = new Map<string, RepPerformance>();
    
    entries.forEach((entry) => {
      if (!repMap.has(entry.repId)) {
        repMap.set(entry.repId, {
          repId: entry.repId,
          repName: entry.repId.slice(0, 8) + '...', // TODO: Load actual rep name
          totalPayout: 0,
          avgAttainment: 0,
          bucketPayouts: { A: 0, B: 0, C: 0, D: 0 },
          rank: 0,
        });
      }
      
      const rep = repMap.get(entry.repId)!;
      rep.totalPayout += entry.payout || 0;
      rep.bucketPayouts[entry.bucketCode] += entry.payout || 0;
    });
    
    // Calculate average attainment per rep
    repMap.forEach((rep, repId) => {
      const repEntries = entries.filter(e => e.repId === repId);
      const totalAttainment = repEntries.reduce((sum, e) => sum + (e.attainment || 0), 0);
      rep.avgAttainment = repEntries.length > 0 ? totalAttainment / repEntries.length : 0;
    });
    
    // Sort by total payout and assign ranks
    const sortedReps = Array.from(repMap.values()).sort((a, b) => b.totalPayout - a.totalPayout);
    sortedReps.forEach((rep, index) => {
      rep.rank = index + 1;
    });
    
    setRepPerformance(sortedReps);
  };

  const calculateBucketPerformance = async (entries: CommissionEntry[], userId: string) => {
    try {
      const configDoc = await getDoc(doc(db, 'settings', 'commission_config'));
      const config = configDoc.exists() ? configDoc.data() : null;
      
      if (!config) return;
      
      const buckets: BucketPerformance[] = [];
      
      ['A', 'B', 'C', 'D'].forEach((code) => {
        const bucketEntries = entries.filter(e => e.bucketCode === code && e.repId === userId);
        const bucket = config.buckets.find((b: any) => b.code === code);
        
        if (!bucket) return;
        
        const totalPayout = bucketEntries.reduce((sum, e) => sum + (e.payout || 0), 0);
        const totalAttainment = bucketEntries.reduce((sum, e) => sum + (e.attainment || 0), 0);
        const avgAttainment = bucketEntries.length > 0 ? totalAttainment / bucketEntries.length : 0;
        const maxPayout = config.maxBonusPerRep * bucket.weight;
        
        let status: 'hit' | 'close' | 'low' = 'low';
        if (avgAttainment >= 1.0) status = 'hit';
        else if (avgAttainment >= 0.75) status = 'close';
        
        buckets.push({
          bucketCode: code as 'A' | 'B' | 'C' | 'D',
          bucketName: bucket.name,
          maxPayout,
          attainment: avgAttainment,
          payout: totalPayout,
          status,
        });
      });
      
      setBucketPerformance(buckets);
    } catch (error) {
      console.error('Error calculating bucket performance:', error);
    }
  };

  const exportToExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Summary sheet
      const summaryData = [
        ['Commission Report'],
        ['Quarter', selectedQuarter],
        ['Generated', new Date().toLocaleDateString()],
        [],
        ['Total Entries', entries.length],
        ['Total Payout', formatCurrency(entries.reduce((sum, e) => sum + (e.payout || 0), 0))],
        ['Avg Attainment', formatAttainment(entries.reduce((sum, e) => sum + (e.attainment || 0), 0) / entries.length)],
      ];
      const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
      
      // Entries sheet
      const entriesData = [
        ['Quarter', 'Rep ID', 'Bucket', 'Sub-Goal', 'Goal Value', 'Actual Value', 'Attainment %', 'Bucket Max $', 'Payout $', 'Notes'],
        ...entries.map(e => [
          e.quarterId,
          e.repId,
          e.bucketCode,
          e.subGoalLabel || '',
          e.goalValue,
          e.actualValue,
          (e.attainment || 0) * 100,
          e.bucketMax || 0,
          e.payout || 0,
          e.notes || '',
        ]),
      ];
      const entriesSheet = XLSX.utils.aoa_to_sheet(entriesData);
      XLSX.utils.book_append_sheet(workbook, entriesSheet, 'Entries');
      
      // Rep performance sheet (admin/VP only)
      if (canViewAllCommissions && repPerformance.length > 0) {
        const repData = [
          ['Rank', 'Rep Name', 'Total Payout', 'Avg Attainment', 'Bucket A', 'Bucket B', 'Bucket C', 'Bucket D'],
          ...repPerformance.map(r => [
            r.rank,
            r.repName,
            r.totalPayout,
            r.avgAttainment * 100,
            r.bucketPayouts.A,
            r.bucketPayouts.B,
            r.bucketPayouts.C,
            r.bucketPayouts.D,
          ]),
        ];
        const repSheet = XLSX.utils.aoa_to_sheet(repData);
        XLSX.utils.book_append_sheet(workbook, repSheet, 'Rep Performance');
      }
      
      // Bucket performance sheet
      if (bucketPerformance.length > 0) {
        const bucketData = [
          ['Bucket', 'Name', 'Max Payout', 'Attainment %', 'Actual Payout', 'Status'],
          ...bucketPerformance.map(b => [
            b.bucketCode,
            b.bucketName,
            b.maxPayout,
            b.attainment * 100,
            b.payout,
            b.status === 'hit' ? '✓ Hit' : b.status === 'close' ? '→ Close' : '⚠ Low',
          ]),
        ];
        const bucketSheet = XLSX.utils.aoa_to_sheet(bucketData);
        XLSX.utils.book_append_sheet(workbook, bucketSheet, 'Bucket Performance');
      }
      
      // Export
      XLSX.writeFile(workbook, `Commission_Report_${selectedQuarter}_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success('Report exported successfully');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export report');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="spinner border-primary-600"></div>
      </div>
    );
  }

  const totalPayout = entries.reduce((sum, e) => sum + (e.payout || 0), 0);
  const avgAttainment = entries.length > 0 
    ? entries.reduce((sum, e) => sum + (e.attainment || 0), 0) / entries.length 
    : 0;

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
              <FileText className="w-8 h-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-xl font-bold text-gray-900">Full Compensation Report</h1>
                <p className="text-sm text-gray-600">View your complete quarterly bonuses and monthly commissions</p>
              </div>
            </div>
            <button
              onClick={exportToExcel}
              className="btn btn-primary flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export to Excel
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="container mx-auto px-4">
          <div className="flex border-b border-gray-200">
            <button
              onClick={() => setActiveTab('quarterly')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'quarterly'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <Award className="w-4 h-4 inline mr-2" />
              Quarterly Bonuses
            </button>
            <button
              onClick={() => setActiveTab('monthly')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'monthly'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
              }`}
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Monthly Commissions
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* QUARTERLY BONUS TAB */}
        {activeTab === 'quarterly' && (
          <>
            {/* Quarter Selector */}
            <div className="card mb-8">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Select Quarter:</label>
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(e.target.value)}
                  className="input"
                >
                  <option value="Q1-2025">Q1 2025</option>
                  <option value="Q2-2025">Q2 2025</option>
                  <option value="Q3-2025">Q3 2025</option>
                  <option value="Q4-2025">Q4 2025</option>
                </select>
              </div>
            </div>

        {/* KPI Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Payout</h3>
              <Award className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(totalPayout)}</p>
            <p className="text-xs text-gray-500 mt-1">{selectedQuarter}</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Avg Attainment</h3>
              <Target className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{formatAttainment(avgAttainment)}</p>
            <p className="text-xs text-gray-500 mt-1">Across all buckets</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Entries</h3>
              <TrendingUp className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{entries.length}</p>
            <p className="text-xs text-gray-500 mt-1">Commission records</p>
          </div>
        </div>

        {/* Bucket Performance */}
        <div className="card mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Bucket Performance</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Name</th>
                  <th>Max Payout</th>
                  <th>Attainment</th>
                  <th>Actual Payout</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {bucketPerformance.map((bucket) => (
                  <tr key={bucket.bucketCode}>
                    <td className="font-semibold">{bucket.bucketCode}</td>
                    <td>{bucket.bucketName}</td>
                    <td>{formatCurrency(bucket.maxPayout)}</td>
                    <td className="font-medium">{formatAttainment(bucket.attainment)}</td>
                    <td className="font-bold text-primary-600">{formatCurrency(bucket.payout)}</td>
                    <td>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${
                        bucket.status === 'hit' ? 'status-hit' :
                        bucket.status === 'close' ? 'status-close' : 'status-low'
                      }`}>
                        {bucket.status === 'hit' ? '✓ Hit' :
                         bucket.status === 'close' ? '→ Close' : '⚠ Low'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Rep Performance (Admin/VP Only) */}
        {canViewAllCommissions && repPerformance.length > 0 && (
          <div className="card mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Performance</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Rep</th>
                    <th>Total Payout</th>
                    <th>Avg Attainment</th>
                    <th>Bucket A</th>
                    <th>Bucket B</th>
                    <th>Bucket C</th>
                    <th>Bucket D</th>
                  </tr>
                </thead>
                <tbody>
                  {repPerformance.map((rep) => (
                    <tr key={rep.repId}>
                      <td className="font-bold">#{rep.rank}</td>
                      <td>{rep.repName}</td>
                      <td className="font-bold text-primary-600">{formatCurrency(rep.totalPayout)}</td>
                      <td className="font-medium">{formatAttainment(rep.avgAttainment)}</td>
                      <td>{formatCurrency(rep.bucketPayouts.A)}</td>
                      <td>{formatCurrency(rep.bucketPayouts.B)}</td>
                      <td>{formatCurrency(rep.bucketPayouts.C)}</td>
                      <td>{formatCurrency(rep.bucketPayouts.D)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Detailed Entries */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Detailed Entries</h2>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Bucket</th>
                  <th>Sub-Goal</th>
                  <th>Goal</th>
                  <th>Actual</th>
                  <th>Attainment</th>
                  <th>Payout</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-500 py-8">
                      No entries found for {selectedQuarter}
                    </td>
                  </tr>
                ) : (
                  entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="font-semibold">{entry.bucketCode}</td>
                      <td className="text-sm">{entry.subGoalLabel || 'N/A'}</td>
                      <td>{entry.goalValue.toLocaleString()}</td>
                      <td>{entry.actualValue.toLocaleString()}</td>
                      <td className="font-medium">{formatAttainment(entry.attainment || 0)}</td>
                      <td className="font-bold text-primary-600">{formatCurrency(entry.payout || 0)}</td>
                      <td className="text-sm text-gray-600">{entry.notes || '-'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
          </>
        )}

        {/* MONTHLY COMMISSIONS TAB */}
        {activeTab === 'monthly' && (
          <>
            {/* Month Selector */}
            <div className="card mb-8">
              <div className="flex items-center space-x-4">
                <label className="text-sm font-medium text-gray-700">Select Month:</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input"
                >
                  <option value="">Select Month</option>
                  {Array.from(new Set(monthlySummaries.map(s => s.month))).sort().reverse().map((month) => (
                    <option key={month} value={month}>{month}</option>
                  ))}
                </select>
              </div>
            </div>

            {selectedMonth && (
              <>
                {/* Monthly Stats */}
                <div className="grid md:grid-cols-3 gap-6 mb-8">
                  <div className="card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Total Orders</h3>
                      <Calendar className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {monthlySummaries.filter(s => s.month === selectedMonth).reduce((sum, s) => sum + s.totalOrders, 0)}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{selectedMonth}</p>
                  </div>

                  <div className="card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Total Revenue</h3>
                      <TrendingUp className="w-5 h-5 text-purple-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {formatCurrency(monthlySummaries.filter(s => s.month === selectedMonth).reduce((sum, s) => sum + s.totalRevenue, 0))}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Sales revenue</p>
                  </div>

                  <div className="card">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-gray-600">Total Commission</h3>
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <p className="text-3xl font-bold text-gray-900">
                      {formatCurrency(monthlySummaries.filter(s => s.month === selectedMonth).reduce((sum, s) => sum + s.totalCommission, 0))}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Commission earned</p>
                  </div>
                </div>

                {/* Monthly Summary Table */}
                <div className="card mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Commission Summary</h2>
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700">Filter by Rep:</label>
                      <select
                        value={selectedRep}
                        onChange={(e) => setSelectedRep(e.target.value)}
                        className="input"
                      >
                        <option value="all">All Reps</option>
                        {monthlySummaries
                          .filter(s => s.month === selectedMonth)
                          .map(s => s.repName)
                          .filter((name, index, self) => self.indexOf(name) === index)
                          .sort()
                          .map(name => (
                            <option key={name} value={name}>{name}</option>
                          ))}
                      </select>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Rep Name</th>
                          <th className="text-right">Orders</th>
                          <th className="text-right">Revenue</th>
                          <th className="text-right">Commission</th>
                          <th className="text-right">Avg Rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {monthlySummaries
                          .filter(s => s.month === selectedMonth)
                          .filter(s => selectedRep === 'all' || s.repName === selectedRep)
                          .map((summary) => (
                          <tr key={summary.id}>
                            <td className="font-medium">{summary.repName}</td>
                            <td className="text-right">{summary.totalOrders}</td>
                            <td className="text-right">{formatCurrency(summary.totalRevenue)}</td>
                            <td className="text-right font-bold text-green-600">{formatCurrency(summary.totalCommission)}</td>
                            <td className="text-right text-gray-600">
                              {((summary.totalCommission / summary.totalRevenue) * 100).toFixed(2)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Detailed Orders */}
                <div className="card">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Detailed Orders</h2>
                    <div className="flex items-center space-x-2">
                      {monthlyViewMode === 'calculation_log' && calculationLogs.length > 0 && (
                        <button
                          onClick={exportCalculationLogsToCSV}
                          className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors flex items-center space-x-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>Export CSV</span>
                        </button>
                      )}
                      </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setMonthlyViewMode('summary')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          monthlyViewMode === 'summary'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Summary View
                      </button>
                      <button
                        onClick={() => setMonthlyViewMode('detailed')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          monthlyViewMode === 'detailed'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Detailed by Customer
                      </button>
                      <button
                        onClick={() => {
                          setMonthlyViewMode('calculation_log');
                          loadCalculationLogs();
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                          monthlyViewMode === 'calculation_log'
                            ? 'bg-primary-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Calculation Log
                      </button>
                    </div>
                  </div>
                  {monthlyViewMode === 'summary' ? (
                    <div className="overflow-x-auto">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Order #</th>
                            <th>Customer</th>
                            <th>Sales Rep</th>
                            <th>Segment</th>
                            <th>Status</th>
                            <th className="text-right">Revenue</th>
                            <th className="text-right">Rate</th>
                            <th className="text-right">Commission</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlyDetails.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="text-center text-gray-500 py-8">
                                No orders found for {selectedMonth}
                              </td>
                            </tr>
                          ) : (
                            monthlyDetails
                              .filter(detail => selectedRep === 'all' || detail.repName === selectedRep)
                              .map((detail) => (
                              <tr key={detail.id}>
                                <td className="text-sm font-medium">{detail.orderNum}</td>
                                <td className="text-sm">{detail.customerName}</td>
                                <td className="text-sm text-gray-600">{detail.repName}</td>
                                <td>
                                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                    {detail.customerSegment}
                                  </span>
                                </td>
                                <td>
                                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                                    {detail.customerStatus}
                                  </span>
                                </td>
                                <td className="text-right">{formatCurrency(detail.orderRevenue)}</td>
                                <td className="text-right text-gray-600">{detail.commissionRate.toFixed(2)}%</td>
                                <td className="text-right font-bold text-green-600">{formatCurrency(detail.commissionAmount)}</td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  ) : monthlyViewMode === 'detailed' ? (
                    <div className="space-y-4">
                      {monthlyDetails.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          No orders found for {selectedMonth}
                        </div>
                      ) : (
                        groupOrdersByCustomer().map((customer) => (
                          <div key={customer.customerName} className="border border-gray-200 rounded-lg overflow-hidden">
                            {/* Customer Header */}
                            <div
                              className="bg-gray-50 p-4 cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleCustomer(customer.customerName)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  {expandedCustomers.has(customer.customerName) ? (
                                    <ChevronDown className="w-5 h-5 text-gray-600" />
                                  ) : (
                                    <ChevronRight className="w-5 h-5 text-gray-600" />
                                  )}
                                  <Package className="w-5 h-5 text-primary-600" />
                                  <div>
                                    <div className="flex items-center space-x-2">
                                      <h3 className="font-semibold text-gray-900">{customer.customerName}</h3>
                                      <span className="text-xs text-gray-500">({customer.orders[0]?.repName})</span>
                                      {customer.accountType === 'Retail' && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800 flex items-center">
                                          <AlertCircle className="w-3 h-3 mr-1" />
                                          Retail - No Commission
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center space-x-2 mt-1">
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                                        {customer.customerSegment}
                                      </span>
                                      <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800">
                                        {customer.customerStatus}
                                      </span>
                                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                                        customer.accountType === 'Wholesale' ? 'bg-green-100 text-green-800' :
                                        customer.accountType === 'Distributor' ? 'bg-blue-100 text-blue-800' :
                                        'bg-gray-100 text-gray-800'
                                      }`}>
                                        {customer.accountType}
                                      </span>
                                      {customer.orders.some(order => order.hasSpiff) && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-800 font-medium">
                                          🎁 Spiff
                                        </span>
                                      )}
                                      {customer.orders.some(order => order.isOverride) && (
                                        <span className="px-2 py-0.5 text-xs rounded-full bg-orange-100 text-orange-800 font-medium">
                                          ⚠️ Override
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-600">
                                        {customer.commissionRate.toFixed(1)}% rate
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm text-gray-600">{customer.orders.length} orders</div>
                                  <div className="text-lg font-semibold text-gray-900">{formatCurrency(customer.totalRevenue)}</div>
                                  <div className="text-sm font-bold text-green-600">{formatCurrency(customer.totalCommission)} comm</div>
                                </div>
                              </div>
                            </div>

                            {/* Expanded Orders */}
                            {expandedCustomers.has(customer.customerName) && (
                              <div className="bg-white">
                                <table className="w-full">
                                  <thead className="bg-gray-100 border-t border-gray-200">
                                    <tr>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">SO #</th>
                                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Date</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Revenue</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Rate</th>
                                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Commission</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                  {customer.orders.map((order) => (
  <Fragment key={order.id}>
    <tr 
      className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
      onClick={() => toggleOrder(order.orderNum, order.commissionRate)}
    >
      <td className="px-4 py-3 text-sm font-medium text-gray-900">
        <div className="flex items-center gap-2">
          {expandedOrders.has(order.orderNum) ? (
            <ChevronDown className="w-4 h-4 text-gray-600" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-600" />
          )}
          <span>{order.orderNum}</span>
          {order.hasSpiff && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              🎁 Spiff
            </span>
          )}
          {order.isOverride && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
              ⚠️ Override
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {order.orderDate?.toDate?.().toLocaleDateString() || '-'}
      </td>
      <td className="px-4 py-3 text-sm text-right">{formatCurrency(order.orderRevenue)}</td>
      <td className="px-4 py-3 text-sm text-right text-gray-600">{order.commissionRate.toFixed(2)}%</td>
      <td className="px-4 py-3 text-sm text-right font-semibold text-green-600">
        {formatCurrency(order.commissionAmount)}
      </td>
    </tr>

    {/* Line Items - Expanded */}
    {expandedOrders.has(order.orderNum) && orderLineItems.has(order.orderNum) && (
      <tr>
        <td colSpan={5} className="px-0 py-0">
          <div className="bg-gray-50 px-8 py-4">
            <table className="w-full">
              <thead>
                <tr className="text-xs text-gray-600">
                  <th className="text-left pb-2">Product</th>
                  <th className="text-left pb-2">Description</th>
                  <th className="text-right pb-2">Qty</th>
                  <th className="text-right pb-2">Unit Price</th>
                  <th className="text-right pb-2">Line Total</th>
                  <th className="text-right pb-2">Commission</th>
                </tr>
              </thead>
              <tbody>
                {orderLineItems.get(order.orderNum)!.map((item) => (
                  <tr key={item.id} className="text-sm border-t border-gray-200">
                    <td className="py-2 font-medium text-gray-900">{item.productNum}</td>
                    <td className="py-2 text-gray-600 text-xs">{item.description}</td>
                    <td className="py-2 text-right">{item.quantity}</td>
                    <td className="py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="py-2 text-right font-medium">{formatCurrency(item.lineTotal)}</td>
                    <td className="py-2 text-right text-green-600 font-semibold">
                      {formatCurrency(item.commissionAmount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            
            {/* Override Reason Display */}
            {order.isOverride && order.overrideReason && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-orange-600 font-semibold text-sm">⚠️ Override Reason:</span>
                  <span className="text-orange-900 text-sm">{order.overrideReason}</span>
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
    )}
  </Fragment>
))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  ) : (
                    /* Calculation Log View */
                    <div className="overflow-x-auto">
                      {logsLoading ? (
                        <div className="text-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                          <p className="text-gray-600 mt-2">Loading calculation logs...</p>
                        </div>
                      ) : calculationLogs.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">
                          No calculation logs found for {selectedMonth}
                          <br />
                          <span className="text-sm">Run a commission calculation to generate logs</span>
                        </div>
                      ) : (
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Order #</th>
                              <th>Customer</th>
                              <th>Sales Rep</th>
                              <th>Segment</th>
                              <th>Status</th>
                              <th>Account Type</th>
                              <th className="text-right">Revenue</th>
                              <th className="text-right">Rate</th>
                              <th className="text-right">Commission</th>
                              <th className="text-center">Rate Source</th>
                              <th>Calculated At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calculationLogs
                              .filter(log => selectedRep === 'all' || log.repName === selectedRep)
                              .map((log) => (
                              <tr key={log.id} className="hover:bg-gray-50">
                                <td className="text-sm font-medium">{log.orderNum}</td>
                                <td className="text-sm">{log.customerName}</td>
                                <td className="text-sm text-gray-600">{log.repName}</td>
                                <td>
                                  <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                                    {log.customerSegment}
                                  </span>
                                </td>
                                <td>
                                  <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                                    {log.customerStatus}
                                  </span>
                                </td>
                                <td>
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    log.accountType === 'Wholesale' ? 'bg-green-100 text-green-800' :
                                    log.accountType === 'Distributor' ? 'bg-blue-100 text-blue-800' :
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {log.accountType}
                                  </span>
                                </td>
                                <td className="text-right">{formatCurrency(log.orderAmount)}</td>
                                <td className="text-right text-gray-600">{log.commissionRate.toFixed(2)}%</td>
                                <td className="text-right font-bold text-green-600">{formatCurrency(log.commissionAmount)}</td>
                                <td className="text-center">
                                  <span className={`px-2 py-1 text-xs rounded-full ${
                                    log.rateSource === 'configured' 
                                      ? 'bg-green-100 text-green-800' 
                                      : 'bg-yellow-100 text-yellow-800'
                                  }`}>
                                    {log.rateSource === 'configured' ? '✓ Found' : '⚠ Default'}
                                  </span>
                                </td>
                                <td className="text-sm text-gray-600">
                                  {new Date(log.calculatedAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {!selectedMonth && (
              <div className="card text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Month Selected</h3>
                <p className="text-gray-600">Select a month from the dropdown above to view commission reports</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
