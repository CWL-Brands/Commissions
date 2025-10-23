'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase/config';
import { onAuthStateChanged } from 'firebase/auth';
import { Calculator, TrendingUp, Users, Settings, FileText } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
      
      if (user) {
        // Redirect authenticated users to dashboard
        router.push('/dashboard');
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="spinner border-primary-600"></div>
      </div>
    );
  }

  if (user) {
    return null; // Will redirect to dashboard
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100">
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center mb-6">
            <Calculator className="w-16 h-16 text-primary-600" />
          </div>
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Kanva Commission Calculator
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Multi-rep commission tracking with Copper CRM integration. 
            Track goals, calculate payouts, and monitor team performance.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <TrendingUp className="w-12 h-12 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Smart Calculations</h3>
            <p className="text-gray-600 text-sm">
              75% minimum threshold, 125% performance cap, automatic payout calculations
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Users className="w-12 h-12 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Multi-Bucket System</h3>
            <p className="text-gray-600 text-sm">
              New Business, Product Mix, Maintain Business, and Effort tracking
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <Settings className="w-12 h-12 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Copper Integration</h3>
            <p className="text-gray-600 text-sm">
              Automatic metrics sync from Copper CRM opportunities and activities
            </p>
          </div>

          <div className="card text-center">
            <div className="flex justify-center mb-4">
              <FileText className="w-12 h-12 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Detailed Reports</h3>
            <p className="text-gray-600 text-sm">
              Quarterly summaries, team rankings, and exportable reports
            </p>
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <button
            onClick={() => router.push('/login')}
            className="btn btn-primary text-lg px-8 py-3"
          >
            Sign In to Get Started
          </button>
          <p className="mt-4 text-gray-600">
            Authorized for @kanvabotanicals.com and @cwlbrands.com users
          </p>
        </div>

        {/* Business Rules Summary */}
        <div className="mt-16 card max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Commission Structure</h2>
          <div className="space-y-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 w-32 font-semibold text-gray-700">Bucket A (50%)</div>
              <div className="text-gray-600">New Business - Growth goal % vs actual growth %</div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-32 font-semibold text-gray-700">Bucket B (15%)</div>
              <div className="text-gray-600">Product Mix - Multiple products with target % and sub-weights</div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-32 font-semibold text-gray-700">Bucket C (20%)</div>
              <div className="text-gray-600">Maintain Business - Revenue goal $ vs actual revenue $</div>
            </div>
            <div className="flex items-start">
              <div className="flex-shrink-0 w-32 font-semibold text-gray-700">Bucket D (15%)</div>
              <div className="text-gray-600">Effort - Activities with goals and sub-weights (calls, emails, etc.)</div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-3xl font-bold text-primary-600">$25,000</div>
                <div className="text-sm text-gray-600">Max Bonus Per Rep</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-yellow-600">75%</div>
                <div className="text-sm text-gray-600">Minimum to Pay</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-green-600">125%</div>
                <div className="text-sm text-gray-600">Performance Cap</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-8">
        <div className="container mx-auto px-4 text-center text-gray-600">
          <p>© 2025 Kanva Botanicals / CWL Brands. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
