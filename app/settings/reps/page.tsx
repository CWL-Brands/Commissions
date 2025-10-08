'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Users, UserCheck, UserX, Plus, Trash2, Save } from 'lucide-react';
import { useAuth } from '@/lib/contexts/AuthContext';
import toast from 'react-hot-toast';

interface SalesRep {
  id: string;
  email: string;
  name: string;
  fishbowlUsername: string;
  isActive: boolean;
  isCommissioned: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

const COMMISSIONED_REPS = [
  'ben@kanvabotanicals.com',
  'brandon@kanvabotanicals.com',
  'joe@kanvabotanicals.com',
  'derek@kanvabotanicals.com',
  'jared@funktdistro.com',
];

export default function SalesRepsManagementPage() {
  const router = useRouter();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [editingRep, setEditingRep] = useState<SalesRep | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

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

    loadReps();
  }, [user, isAdmin, authLoading, router]);

  const loadReps = async () => {
    setLoading(true);
    try {
      const { db } = await import('@/lib/firebase/config');
      if (!db) throw new Error('Database not initialized');

      const repsRef = collection(db, 'sales_reps');
      const snapshot = await getDocs(repsRef);
      
      const repsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as SalesRep));

      setReps(repsData.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading reps:', error);
      toast.error('Failed to load sales reps');
    } finally {
      setLoading(false);
    }
  };

  const saveRep = async (rep: SalesRep) => {
    try {
      const { db } = await import('@/lib/firebase/config');
      if (!db) throw new Error('Database not initialized');

      const repRef = doc(db, 'sales_reps', rep.id);
      await setDoc(repRef, {
        email: rep.email,
        name: rep.name,
        fishbowlUsername: rep.fishbowlUsername,
        isActive: rep.isActive,
        isCommissioned: rep.isCommissioned,
        startDate: rep.startDate || null,
        endDate: rep.endDate || null,
        notes: rep.notes || '',
        updatedAt: new Date().toISOString(),
      });

      toast.success(`${rep.name} updated successfully`);
      setEditingRep(null);
      setShowAddForm(false);
      loadReps();
    } catch (error) {
      console.error('Error saving rep:', error);
      toast.error('Failed to save rep');
    }
  };

  const deleteRep = async (repId: string) => {
    if (!confirm('Are you sure you want to delete this rep? This action cannot be undone.')) {
      return;
    }

    try {
      const { db } = await import('@/lib/firebase/config');
      if (!db) throw new Error('Database not initialized');

      await deleteDoc(doc(db, 'sales_reps', repId));
      toast.success('Rep deleted successfully');
      loadReps();
    } catch (error) {
      console.error('Error deleting rep:', error);
      toast.error('Failed to delete rep');
    }
  };

  const toggleActive = async (rep: SalesRep) => {
    const updatedRep = {
      ...rep,
      isActive: !rep.isActive,
      endDate: !rep.isActive ? undefined : new Date().toISOString().split('T')[0],
    };
    await saveRep(updatedRep);
  };

  const addNewRep = () => {
    setEditingRep({
      id: `rep_${Date.now()}`,
      email: '',
      name: '',
      fishbowlUsername: '',
      isActive: true,
      isCommissioned: false,
      startDate: new Date().toISOString().split('T')[0],
    });
    setShowAddForm(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 mb-8">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-primary-600 mr-3" />
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales Reps Management</h1>
                <p className="text-sm text-gray-600">Manage active/inactive status and commission eligibility</p>
              </div>
            </div>

            <button
              onClick={addNewRep}
              className="btn btn-primary flex items-center"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add Rep
            </button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-7xl">
        {/* Stats Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Active Reps</span>
              <UserCheck className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {reps.filter(r => r.isActive).length}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Commissioned Reps</span>
              <Users className="w-5 h-5 text-primary-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {reps.filter(r => r.isCommissioned && r.isActive).length}
            </p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">Inactive Reps</span>
              <UserX className="w-5 h-5 text-red-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {reps.filter(r => !r.isActive).length}
            </p>
          </div>
        </div>

        {/* Add/Edit Form */}
        {(showAddForm || editingRep) && (
          <div className="card mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {showAddForm ? 'Add New Rep' : 'Edit Rep'}
            </h2>
            
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={editingRep?.name || ''}
                  onChange={(e) => setEditingRep(prev => prev ? {...prev, name: e.target.value} : null)}
                  className="input"
                  placeholder="Ben Wallner"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  value={editingRep?.email || ''}
                  onChange={(e) => setEditingRep(prev => prev ? {...prev, email: e.target.value} : null)}
                  className="input"
                  placeholder="ben@kanvabotanicals.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Fishbowl Username *
                </label>
                <input
                  type="text"
                  value={editingRep?.fishbowlUsername || ''}
                  onChange={(e) => setEditingRep(prev => prev ? {...prev, fishbowlUsername: e.target.value} : null)}
                  className="input"
                  placeholder="BenW"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={editingRep?.startDate || ''}
                  onChange={(e) => setEditingRep(prev => prev ? {...prev, startDate: e.target.value} : null)}
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date (if inactive)
                </label>
                <input
                  type="date"
                  value={editingRep?.endDate || ''}
                  onChange={(e) => setEditingRep(prev => prev ? {...prev, endDate: e.target.value} : null)}
                  className="input"
                  disabled={editingRep?.isActive}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={editingRep?.notes || ''}
                  onChange={(e) => setEditingRep(prev => prev ? {...prev, notes: e.target.value} : null)}
                  className="input"
                  placeholder="Optional notes"
                />
              </div>

              <div className="flex items-center space-x-6">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingRep?.isActive || false}
                    onChange={(e) => setEditingRep(prev => prev ? {...prev, isActive: e.target.checked} : null)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>

                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={editingRep?.isCommissioned || false}
                    onChange={(e) => setEditingRep(prev => prev ? {...prev, isCommissioned: e.target.checked} : null)}
                    className="mr-2"
                  />
                  <span className="text-sm font-medium text-gray-700">Commissioned</span>
                </label>
              </div>
            </div>

            <div className="flex items-center space-x-3 mt-6">
              <button
                onClick={() => editingRep && saveRep(editingRep)}
                className="btn btn-primary flex items-center"
                disabled={!editingRep?.name || !editingRep?.email || !editingRep?.fishbowlUsername}
              >
                <Save className="w-5 h-5 mr-2" />
                Save
              </button>
              <button
                onClick={() => {
                  setEditingRep(null);
                  setShowAddForm(false);
                }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Reps Table */}
        <div className="card">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">All Sales Reps</h2>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Fishbowl Username</th>
                  <th>Status</th>
                  <th>Commissioned</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {reps.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center text-gray-500 py-8">
                      No sales reps found. Click &quot;Add Rep&quot; to get started.
                    </td>
                  </tr>
                ) : (
                  reps.map((rep) => (
                    <tr key={rep.id} className={!rep.isActive ? 'bg-gray-50' : ''}>
                      <td className="font-medium text-gray-900">{rep.name}</td>
                      <td className="text-gray-600">{rep.email}</td>
                      <td className="font-mono text-sm text-gray-600">{rep.fishbowlUsername}</td>
                      <td>
                        {rep.isActive ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <UserCheck className="w-3 h-3 mr-1" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            <UserX className="w-3 h-3 mr-1" />
                            Inactive
                          </span>
                        )}
                      </td>
                      <td>
                        {rep.isCommissioned ? (
                          <span className="text-green-600 font-medium">Yes</span>
                        ) : (
                          <span className="text-gray-400">No</span>
                        )}
                      </td>
                      <td className="text-gray-600">{rep.startDate || '—'}</td>
                      <td className="text-gray-600">{rep.endDate || '—'}</td>
                      <td>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => setEditingRep(rep)}
                            className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => toggleActive(rep)}
                            className={`text-sm font-medium ${
                              rep.isActive ? 'text-red-600 hover:text-red-700' : 'text-green-600 hover:text-green-700'
                            }`}
                          >
                            {rep.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => deleteRep(rep.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">Commission Eligibility</h3>
          <p className="text-sm text-blue-800">
            Only reps marked as &quot;Commissioned&quot; and &quot;Active&quot; will have their sales counted for commission calculations.
            When a rep leaves the company, set their end date and mark them as inactive to exclude future sales.
          </p>
        </div>
      </div>
    </div>
  );
}
