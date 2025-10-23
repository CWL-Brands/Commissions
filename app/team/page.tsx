'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Users, TrendingUp, TrendingDown, DollarSign, Target, Award } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';

interface RepPerformance {
  repId: string;
  repName: string;
  repEmail: string;
  totalPayout: number;
  attainment: number;
  bucketA: number;
  bucketB: number;
  bucketC: number;
  bucketD: number;
  rank: number;
  trend: 'up' | 'down' | 'stable';
}

export default function TeamPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selectedQuarter, setSelectedQuarter] = useState('Q4 2025');
  const [teamData, setTeamData] = useState<RepPerformance[]>([]);
  const [quarters, setQuarters] = useState<string[]>(['Q4 2025', 'Q1 2026']);

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

    const loadTeamData = async () => {
    setLoading(true);
    try {
      const { db } = await import('@/lib/firebase/config');
      if (!db) throw new Error('Database not initialized');

      // Load commission entries for selected quarter
      const entriesRef = collection(db, 'commission_entries');
      const q = query(entriesRef, where('quarter', '==', selectedQuarter));
      const snapshot = await getDocs(q);

      // Aggregate by rep
      const repMap = new Map<string, RepPerformance>();

      snapshot.forEach((doc) => {
        const data = doc.data();
        const repId = data.repId;
        const repName = data.repName || 'Unknown';
        const repEmail = data.repEmail || '';
        const bucket = data.bucket;
        const payout = data.payout || 0;

        if (!repMap.has(repId)) {
          repMap.set(repId, {
            repId,
            repName,
            repEmail,
            totalPayout: 0,
            attainment: 0,
            bucketA: 0,
            bucketB: 0,
            bucketC: 0,
            bucketD: 0,
            rank: 0,
            trend: 'stable',
          });
        }

        const rep = repMap.get(repId)!;
        rep.totalPayout += payout;

        if (bucket === 'A') rep.bucketA += payout;
        else if (bucket === 'B') rep.bucketB += payout;
        else if (bucket === 'C') rep.bucketC += payout;
        else if (bucket === 'D') rep.bucketD += payout;
      });

      // Calculate attainment and rank
      const reps = Array.from(repMap.values());
      
      // Load max bonus from settings
      const settingsDoc = await import('@/lib/firebase/config').then(({ db }) => 
        import('firebase/firestore').then(({ doc, getDoc }) => 
          getDoc(doc(db!, 'settings', 'commission_config'))
        )
      );
      const maxBonus = settingsDoc.exists() ? settingsDoc.data().maxBonusPerRep || 25000 : 25000;

      reps.forEach((rep) => {
        rep.attainment = maxBonus > 0 ? rep.totalPayout / maxBonus : 0;
      });

      // Sort by total payout and assign ranks
      reps.sort((a, b) => b.totalPayout - a.totalPayout);
      reps.forEach((rep, index) => {
        rep.rank = index + 1;
      });

      setTeamData(reps);
    } catch (error) {
      console.error('Error loading team data:', error);
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
    };

    loadTeamData();
  }, [user, isAdmin, authLoading, selectedQuarter, router]);

  const getTotalTeamPayout = () => {
    return teamData.reduce((sum, rep) => sum + rep.totalPayout, 0);
  };

  const getAverageAttainment = () => {
    if (teamData.length === 0) return 0;
    return teamData.reduce((sum, rep) => sum + rep.attainment, 0) / teamData.length;
  };

  const getTopPerformer = () => {
    return teamData.find((rep) => rep.rank === 1);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner border-primary-600"></div>
      </div>
    );
  }

  const topPerformer = getTopPerformer();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 mb-8">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Team Performance</h1>
                <p className="text-sm text-gray-600">Commission overview for all sales reps</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quarter</label>
              <select
                value={selectedQuarter}
                onChange={(e) => setSelectedQuarter(e.target.value)}
                className="input"
              >
                {quarters.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl">
        {/* Summary Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Total Payout</span>
              <DollarSign className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              ${getTotalTeamPayout().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Avg Attainment</span>
              <Target className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {(getAverageAttainment() * 100).toFixed(1)}%
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Active Reps</span>
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{teamData.length}</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Top Performer</span>
              <Award className="w-5 h-5 text-yellow-500" />
            </div>
            <p className="text-lg font-bold text-gray-900">
              {topPerformer ? topPerformer.repName : 'N/A'}
            </p>
            {topPerformer && (
              <p className="text-sm text-gray-600">
                ${topPerformer.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            )}
          </div>
        </div>

        {/* Team Table */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Leaderboard</h2>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Rep Name</th>
                  <th>Total Commission</th>
                  <th>Attainment</th>
                  <th>Bucket A</th>
                  <th>Bucket B</th>
                  <th>Bucket C</th>
                  <th>Bucket D</th>
                  <th>Trend</th>
                </tr>
              </thead>
              <tbody>
                {teamData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-gray-500 py-8">
                      No data available for {selectedQuarter}
                    </td>
                  </tr>
                ) : (
                  teamData.map((rep) => (
                    <tr key={rep.repId}>
                      <td>
                        <div className="flex items-center">
                          {rep.rank === 1 && <Award className="w-5 h-5 text-yellow-500 mr-2" />}
                          <span className="font-semibold">#{rep.rank}</span>
                        </div>
                      </td>
                      <td>
                        <div>
                          <p className="font-medium text-gray-900">{rep.repName}</p>
                          <p className="text-sm text-gray-500">{rep.repEmail}</p>
                        </div>
                      </td>
                      <td className="font-semibold text-gray-900">
                        ${rep.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td>
                        <div className="flex items-center">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">
                              {(rep.attainment * 100).toFixed(1)}%
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className={`h-2 rounded-full ${
                                  rep.attainment >= 1.0
                                    ? 'bg-green-500'
                                    : rep.attainment >= 0.75
                                    ? 'bg-yellow-500'
                                    : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(rep.attainment * 100, 100)}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>${rep.bucketA.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td>${rep.bucketB.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td>${rep.bucketC.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td>${rep.bucketD.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                      <td>
                        {rep.trend === 'up' && <TrendingUp className="w-5 h-5 text-green-500" />}
                        {rep.trend === 'down' && <TrendingDown className="w-5 h-5 text-red-500" />}
                        {rep.trend === 'stable' && <span className="text-gray-400">—</span>}
                      </td>
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
