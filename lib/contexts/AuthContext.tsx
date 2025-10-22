'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'sales';
  title?: string; // Job title (e.g., "VP Finance", "Account Executive")
  salesPerson?: string; // Fishbowl sales person ID
  canViewAllCommissions?: boolean; // Explicit permission to view all team data
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  canViewAllCommissions: boolean; // Can view all team member commissions
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  canViewAllCommissions: false,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Dynamic import to ensure client-side only
    import('@/lib/firebase/config').then(({ auth, db }) => {
      if (!auth) {
        setLoading(false);
        return;
      }

      const { onAuthStateChanged } = require('firebase/auth');
      
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: User | null) => {
        setUser(firebaseUser);

        if (firebaseUser && db) {
          try {
            // Load user profile from Firestore
            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
            if (userDoc.exists()) {
              const data = userDoc.data();
              const profile = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: data.name || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                role: (data.role || 'sales').toLowerCase() as 'admin' | 'manager' | 'sales', // Normalize to lowercase
              };
              console.log('✅ User profile loaded:', profile);
              setUserProfile(profile);
            } else {
              // Fallback profile
              console.warn('⚠️ No user document found, creating fallback profile');
              setUserProfile({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
                role: 'sales',
              });
            }
          } catch (error) {
            console.error('❌ Error loading user profile:', error);
            setUserProfile(null);
          }
        } else {
          setUserProfile(null);
        }

        setLoading(false);
      });

      return () => unsubscribe();
    });
  }, []);

  const isAdmin = userProfile?.role === 'admin';
  const isManager = userProfile?.role === 'manager' || userProfile?.role === 'admin';
  
  // Determine if user can view all commissions
  // VPs, Admins, or users with explicit permission can view all data
  const canViewAllCommissions = 
    isAdmin || 
    userProfile?.canViewAllCommissions === true ||
    (userProfile?.title?.toUpperCase().includes('VP') ?? false);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, isManager, canViewAllCommissions }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
