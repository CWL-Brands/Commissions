'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { ArrowLeft, Users, Search, Filter, AlertCircle, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface Customer {
  id: string;
  customerNum: string;
  customerName: string;
  accountType: 'Retail' | 'Wholesale' | 'Distributor';
  salesPerson?: string;
  lastOrderDate?: any;
  totalOrders?: number;
}

export default function CustomersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<Customer[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRep, setSelectedRep] = useState('all');
  const [selectedAccountType, setSelectedAccountType] = useState('all');
  const [editingCustomer, setEditingCustomer] = useState<string | null>(null);
  const [savingCustomer, setSavingCustomer] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      setUser(user);
      
      const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
      const admin = adminEmails.includes(user.email || '');
      setIsAdmin(admin);
      
      if (!admin) {
        toast.error('Access denied. Admin only.');
        router.push('/dashboard');
        return;
      }

      await loadCustomers();
      setLoading(false);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadCustomers = async () => {
    try {
      const customersQuery = query(
        collection(db, 'fishbowl_customers'),
        orderBy('customerName', 'asc')
      );
      
      const snapshot = await getDocs(customersQuery);
      const customersData: Customer[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        customersData.push({
          id: doc.id,
          customerNum: data.customerNum || data.customerNumber || '',
          customerName: data.customerName || data.name || '',
          accountType: data.accountType || 'Retail',
          salesPerson: data.salesPerson || '',
          lastOrderDate: data.lastOrderDate,
          totalOrders: data.totalOrders || 0,
        });
      });
      
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('Failed to load customers');
    }
  };

  useEffect(() => {
    let filtered = customers;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.customerNum.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by sales rep
    if (selectedRep !== 'all') {
      filtered = filtered.filter(c => c.salesPerson === selectedRep);
    }

    // Filter by account type
    if (selectedAccountType !== 'all') {
      filtered = filtered.filter(c => c.accountType === selectedAccountType);
    }

    setFilteredCustomers(filtered);
  }, [searchTerm, selectedRep, selectedAccountType, customers]);

  const updateAccountType = async (customerId: string, newAccountType: 'Retail' | 'Wholesale' | 'Distributor') => {
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

      toast.success(`Account type updated to ${newAccountType}`);
      setEditingCustomer(null);
    } catch (error) {
      console.error('Error updating account type:', error);
      toast.error('Failed to update account type');
    } finally {
      setSavingCustomer(null);
    }
  };

  const uniqueReps = Array.from(new Set(customers.map(c => c.salesPerson).filter(Boolean))).sort();

  const stats = {
    total: customers.length,
    retail: customers.filter(c => c.accountType === 'Retail').length,
    wholesale: customers.filter(c => c.accountType === 'Wholesale').length,
    distributor: customers.filter(c => c.accountType === 'Distributor').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading customers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/database')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-primary-600" />
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Customer Management</h1>
                <p className="text-gray-600">Manage customer account types for commission calculations</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Customers</h3>
              <Users className="w-5 h-5 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Retail</h3>
              <AlertCircle className="w-5 h-5 text-yellow-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.retail}</p>
            <p className="text-xs text-gray-500 mt-1">No commission</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Wholesale</h3>
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.wholesale}</p>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Distributor</h3>
              <Check className="w-5 h-5 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{stats.distributor}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-8">
          <div className="grid md:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="w-4 h-4 inline mr-2" />
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

            {/* Sales Rep Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
                Sales Representative
              </label>
              <select
                value={selectedRep}
                onChange={(e) => setSelectedRep(e.target.value)}
                className="input w-full"
              >
                <option value="all">All Reps</option>
                {uniqueReps.map(rep => (
                  <option key={rep} value={rep}>{rep}</option>
                ))}
              </select>
            </div>

            {/* Account Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="w-4 h-4 inline mr-2" />
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Customers ({filteredCustomers.length})
            </h2>
          </div>

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
                            onChange={(e) => updateAccountType(customer.id, e.target.value as any)}
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
                          <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 flex items-center w-fit">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            No Commission
                          </span>
                        ) : (
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 flex items-center w-fit">
                            <Check className="w-3 h-3 mr-1" />
                            Active
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
    </div>
  );
}
