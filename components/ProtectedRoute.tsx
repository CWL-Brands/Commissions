'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
}

export default function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    // Dynamic import to ensure client-side only
    import('@/lib/firebase/config').then(({ auth }) => {
      if (!auth) {
        console.error('Firebase auth not initialized');
        router.push('/login');
        return;
      }

      const unsubscribe = onAuthStateChanged(auth, (user) => {
        if (!user) {
          router.push('/login');
          return;
        }

        if (requireAdmin) {
          const adminEmails = process.env.NEXT_PUBLIC_ADMIN_EMAILS?.split(',') || [];
          const isAdmin = adminEmails.includes(user.email || '');
          
          if (!isAdmin) {
            router.push('/dashboard');
            return;
          }
        }

        setAuthorized(true);
        setLoading(false);
      });

      return () => unsubscribe();
    });
  }, [router, requireAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!authorized) {
    return null;
  }

  return <>{children}</>;
}
