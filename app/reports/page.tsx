'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { 
  FileText, 
  ArrowLeft,
  Download,
  TrendingUp,
  Award,
  Target
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CommissionEntry, RepPerformance, BucketPerformance } from '@/types';
import { formatAttainment, formatCurrency } from '@/lib/commission/calculator';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedQuarter, setSelectedQuarter] = useState('Q1-2025');
  const [entries, setEntries] = useState<CommissionEntry[]>([]);
  const [repPerformance, setRepPerformance] = useState<RepPerformance[]>([]);
  const [bucketPerformance, setBucketPerformance] = useState<BucketPerformance[]>([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);
      
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
      setIsAdmin(adminEmails.includes(user.email || ''));
      
      await loadReportData(user.uid);
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, selectedQuarter]);

  const loadReportData = async (userId: string) => {
    try {
      // Load all entries for the quarter
      const entriesRef = collection(db, 'commission_entries');
      const q = isAdmin
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
      if (isAdmin) {
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
      
      // Rep performance sheet (admin only)
      if (isAdmin && repPerformance.length > 0) {
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
                <h1 className="text-xl font-bold text-gray-900">Commission Reports</h1>
                <p className="text-sm text-gray-600">Quarterly summaries and performance analytics</p>
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
      </header>

      <div className="container mx-auto px-4 py-8 max-w-6xl">
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

        {/* Rep Performance (Admin Only) */}
        {isAdmin && repPerformance.length > 0 && (
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
      </div>
    </div>
  );
}
