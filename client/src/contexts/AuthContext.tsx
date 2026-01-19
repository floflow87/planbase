import { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { queryClient } from '@/lib/queryClient';

interface UserProfile {
  firstName?: string;
  lastName?: string;
  gender?: string;
  position?: string;
  avatarUrl?: string;
  role?: 'owner' | 'collaborator' | 'client_viewer';
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  accountId: string | null;
  userProfile: UserProfile | null;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const extractUserData = (session: Session | null) => {
    const metadata = session?.user?.user_metadata;
    
    if (metadata) {
      setAccountId(metadata.account_id || null);
      // Initial profile from metadata (role will be fetched from API)
      setUserProfile(prev => ({
        firstName: metadata.firstName,
        lastName: metadata.lastName,
        gender: metadata.gender,
        position: metadata.position,
        avatarUrl: metadata.avatarUrl,
        role: prev?.role, // Keep existing role until API returns
      }));
    } else {
      setAccountId(null);
      setUserProfile(null);
    }
  };

  // Fetch user role from /api/me
  const fetchUserRole = async () => {
    try {
      const response = await fetch('/api/me', {
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });
      if (response.ok) {
        const userData = await response.json();
        if (userData.role) {
          setUserProfile(prev => prev ? { ...prev, role: userData.role } : null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error);
    }
  };

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      extractUserData(session);
      setLoading(false);
      // Fetch role after session is established
      if (session?.user) {
        fetchUserRole();
      }
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      extractUserData(session);
      setLoading(false);
      // Fetch role after auth change
      if (session?.user) {
        fetchUserRole();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAccountId(null);
    // Clear ALL React Query cache to prevent data leaks between accounts
    queryClient.clear();
    // Clear localStorage
    localStorage.removeItem("demo_account_id");
    localStorage.removeItem("demo_user_id");
  };

  const value = {
    user,
    session,
    loading,
    accountId,
    userProfile,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
