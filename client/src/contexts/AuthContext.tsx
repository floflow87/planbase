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
  updateUserProfile: (patch: Partial<UserProfile>) => void;
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
      setUserProfile(prev => ({
        firstName: metadata.firstName,
        lastName: metadata.lastName,
        gender: metadata.gender,
        position: metadata.position,
        avatarUrl: metadata.avatarUrl,
        role: prev?.role,
      }));
    } else {
      setAccountId(null);
      setUserProfile(null);
    }
  };

  const fetchUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        return;
      }
      
      const response = await fetch('/api/me', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        credentials: 'include',
      });
      if (response.ok) {
        const userData = await response.json();
        if (userData.role) {
          setUserProfile(prev => {
            if (prev) {
              return { ...prev, role: userData.role };
            }
            return { role: userData.role };
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch user role:', error);
    }
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      extractUserData(session);
      setLoading(false);
      if (session?.user) {
        fetchUserRole().catch(() => {
          setTimeout(() => fetchUserRole(), 1000);
        });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      extractUserData(session);
      setLoading(false);
      if (session?.user) {
        fetchUserRole().catch(() => {
          setTimeout(() => fetchUserRole(), 1000);
        });
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
    queryClient.clear();
    localStorage.removeItem("demo_account_id");
    localStorage.removeItem("demo_user_id");
  };

  const updateUserProfile = (patch: Partial<UserProfile>) => {
    setUserProfile(prev => prev ? { ...prev, ...patch } : patch as UserProfile);
  };

  const value = {
    user,
    session,
    loading,
    accountId,
    userProfile,
    signIn,
    signOut,
    updateUserProfile,
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
