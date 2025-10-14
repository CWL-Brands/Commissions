'use client';

import { useEffect, useState } from 'react';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { Plus, Trash2, Save, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface Region {
  id: string;
  name: string;
  states: string[];
  color: string;
  managerId?: string;
  managerName?: string;
}

interface User {
  id: string;
  name: string;
  salesPerson: string;
  region?: string;
  orgRole?: string;
}

const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

const COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#8B5CF6', // purple
  '#F59E0B', // amber
  '#EF4444', // red
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#14B8A6', // teal
];

export default function RegionManager() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingRegion, setEditingRegion] = useState<Region | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // Load regions
      const regionsSnapshot = await getDocs(collection(db, 'regions'));
      const regionsData: Region[] = [];
      regionsSnapshot.forEach((doc) => {
        regionsData.push({ id: doc.id, ...doc.data() } as Region);
      });

      // Load users (regional managers)
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const usersData: User[] = [];
      usersSnapshot.forEach((doc) => {
        const data = doc.data();
        usersData.push({
          id: doc.id,
          name: data.name,
          salesPerson: data.salesPerson,
          region: data.region,
          orgRole: data.orgRole
        });
      });

      // Map manager names to regions
      const regionsWithManagers = regionsData.map(region => {
        const manager = usersData.find(u => u.id === region.managerId);
        return {
          ...region,
          managerName: manager?.name || 'Unassigned'
        };
      });

      setRegions(regionsWithManagers);
      setUsers(usersData);
      setLoading(false);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load regions');
      setLoading(false);
    }
  };

  const handleSaveRegion = async (region: Region) => {
    try {
      const regionData = {
        name: region.name,
        states: region.states,
        color: region.color,
        managerId: region.managerId || null,
        updatedAt: new Date()
      };

      if (region.id && region.id !== 'new') {
        // Update existing
        await updateDoc(doc(db, 'regions', region.id), regionData);
        toast.success('Region updated!');
      } else {
        // Create new
        const newDoc = doc(collection(db, 'regions'));
        await setDoc(newDoc, { ...regionData, createdAt: new Date() });
        toast.success('Region created!');
      }

      // Update user's region field if manager assigned
      if (region.managerId) {
        await updateDoc(doc(db, 'users', region.managerId), {
          region: region.name
        });
      }

      setShowModal(false);
      setEditingRegion(null);
      loadData();
    } catch (error) {
      console.error('Error saving region:', error);
      toast.error('Failed to save region');
    }
  };

  const handleDeleteRegion = async (regionId: string) => {
    if (!confirm('Are you sure you want to delete this region?')) return;

    try {
      await deleteDoc(doc(db, 'regions', regionId));
      toast.success('Region deleted!');
      loadData();
    } catch (error) {
      console.error('Error deleting region:', error);
      toast.error('Failed to delete region');
    }
  };

  const getAssignedStates = () => {
    return new Set(regions.flatMap(r => r.states));
  };

  const getUnassignedStates = () => {
    const assigned = getAssignedStates();
    return US_STATES.filter(state => !assigned.has(state));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">🗺️ Region Management</h3>
            <p className="text-sm text-gray-600 mt-1">
              Configure sales regions and assign states to each region
            </p>
          </div>
          <button
            onClick={() => {
              setEditingRegion({
                id: 'new',
                name: '',
                states: [],
                color: COLORS[regions.length % COLORS.length],
              });
              setShowModal(true);
            }}
            className="btn btn-primary flex items-center"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Region
          </button>
        </div>

        {/* Unassigned States Warning */}
        {getUnassignedStates().length > 0 && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start">
              <div className="text-yellow-600 font-medium text-sm">
                ⚠️ {getUnassignedStates().length} states not assigned to any region
              </div>
            </div>
            <div className="mt-2 text-xs text-yellow-700">
              {getUnassignedStates().join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* Regions Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regions.map((region) => (
          <div
            key={region.id}
            className="card border-2 hover:shadow-lg transition-all"
            style={{ borderColor: region.color }}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: region.color }}
                />
                <h4 className="font-semibold text-gray-900">{region.name}</h4>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    setEditingRegion(region);
                    setShowModal(true);
                  }}
                  className="text-primary-600 hover:text-primary-800"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDeleteRegion(region.id)}
                  className="text-red-600 hover:text-red-800"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm text-gray-600">
                <span className="font-medium">Manager:</span> {region.managerName}
              </div>
              <div className="text-sm text-gray-600">
                <span className="font-medium">States ({region.states.length}):</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {region.states.sort().map((state) => (
                  <span
                    key={state}
                    className="px-2 py-1 text-xs rounded-md text-white font-medium"
                    style={{ backgroundColor: region.color }}
                  >
                    {state}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {showModal && editingRegion && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h3 className="text-xl font-semibold text-gray-900 mb-4">
                {editingRegion.id === 'new' ? 'Create Region' : 'Edit Region'}
              </h3>

              <div className="space-y-4">
                {/* Region Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Region Name
                  </label>
                  <input
                    type="text"
                    value={editingRegion.name}
                    onChange={(e) =>
                      setEditingRegion({ ...editingRegion, name: e.target.value })
                    }
                    className="input w-full"
                    placeholder="e.g., Central, West, East"
                  />
                </div>

                {/* Color Picker */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Region Color
                  </label>
                  <div className="flex space-x-2">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setEditingRegion({ ...editingRegion, color })}
                        className={`w-8 h-8 rounded-full border-2 ${
                          editingRegion.color === color
                            ? 'border-gray-900 scale-110'
                            : 'border-gray-300'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Manager Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Regional Manager
                  </label>
                  <select
                    value={editingRegion.managerId || ''}
                    onChange={(e) =>
                      setEditingRegion({ ...editingRegion, managerId: e.target.value })
                    }
                    className="input w-full"
                  >
                    <option value="">Unassigned</option>
                    {users
                      .filter((u) => u.name && u.salesPerson) // Show all users with name and salesPerson
                      .sort((a, b) => {
                        // Sort by orgRole priority, then by name
                        const rolePriority: any = {
                          'executive': 1,
                          'director': 2,
                          'regional': 3,
                          'division': 4,
                          'territory': 5,
                          'rep': 6
                        };
                        const aPriority = rolePriority[a.orgRole || 'rep'] || 99;
                        const bPriority = rolePriority[b.orgRole || 'rep'] || 99;
                        if (aPriority !== bPriority) return aPriority - bPriority;
                        return a.name.localeCompare(b.name);
                      })
                      .map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.salesPerson}) {user.orgRole ? `- ${user.orgRole}` : ''}
                        </option>
                      ))}
                  </select>
                  {users.length === 0 && (
                    <p className="text-sm text-yellow-600 mt-1">
                      ⚠️ No users found. Make sure users are created in the Team Members tab.
                    </p>
                  )}
                </div>

                {/* State Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assign States ({editingRegion.states.length} selected)
                  </label>
                  <div className="border border-gray-300 rounded-lg p-3 max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-6 gap-2">
                      {US_STATES.map((state) => {
                        const isAssignedToOther =
                          !editingRegion.states.includes(state) &&
                          regions.some(
                            (r) => r.id !== editingRegion.id && r.states.includes(state)
                          );
                        const isSelected = editingRegion.states.includes(state);

                        return (
                          <button
                            key={state}
                            onClick={() => {
                              if (isAssignedToOther) return;
                              const newStates = isSelected
                                ? editingRegion.states.filter((s) => s !== state)
                                : [...editingRegion.states, state];
                              setEditingRegion({ ...editingRegion, states: newStates });
                            }}
                            disabled={isAssignedToOther}
                            className={`px-2 py-1 text-xs rounded-md font-medium transition-all ${
                              isSelected
                                ? 'text-white'
                                : isAssignedToOther
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                            style={
                              isSelected
                                ? { backgroundColor: editingRegion.color }
                                : {}
                            }
                          >
                            {state}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingRegion(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleSaveRegion(editingRegion)}
                  disabled={!editingRegion.name || editingRegion.states.length === 0}
                  className="btn btn-primary flex items-center"
                >
                  <Save className="w-4 h-4 mr-2" />
                  Save Region
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
