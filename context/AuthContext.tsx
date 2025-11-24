import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { Profile, UserRole } from '../types';
import { supabase } from '../services/supabase';

interface AuthContextType {
  user: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, role: string) => Promise<{ error: any, data: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false); // ✅ NOUVEAU : Empêche les requêtes simultanées

  // ✅ FIX #1 : useCallback pour stabiliser fetchProfile
  const fetchProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current) return null; // Évite les doublons
    fetchingRef.current = true;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) return null;
      return data as Profile;
    } catch (err) {
      console.error('Erreur fetch profile:', err);
      return null;
    } finally {
      fetchingRef.current = false;
    }
  }, []); // Pas de dépendances → fonction stable

  // ✅ FIX #2 : useCallback pour stabiliser createProfileIfMissing
  const createProfileIfMissing = useCallback(async (sessionUser: any) => {
    try {
      const newProfileDb = {
        id: sessionUser.id,
        full_name: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Utilisateur',
        role: (sessionUser.user_metadata?.role as UserRole) || UserRole.CLIENT,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase.from('profiles').upsert([newProfileDb], { onConflict: 'id' });

      if (error) {
        console.error("Erreur création profil auto:", error);
        return null;
      }

      return { ...newProfileDb, email: sessionUser.email } as Profile;
    } catch (e) {
      console.error("Exception création profil:", e);
      return null;
    }
  }, []); // Fonction stable

  // ✅ FIX #3 : useCallback pour processSession (dépend de fetchProfile)
  const processSession = useCallback(async (session: any) => {
    if (!session?.user) {
      if (mountedRef.current) {
        setUser(null);
        setLoading(false); // ← IMPORTANT : Arrête le loading
      }
      return;
    }

    try {
      // 1. Essayer de récupérer le profil existant
      let profile = await fetchProfile(session.user.id);

      // 2. Si pas de profil, essayer de le créer
      if (!profile) {
        profile = await createProfileIfMissing(session.user);
      }

      // 3. Mettre à jour l'état (une seule fois)
      if (mountedRef.current) {
        if (profile) {
          if (!profile.email && session.user.email) {
            profile.email = session.user.email;
          }
          setUser(profile);
        } else {
          // Fallback : profil de secours
          console.warn("⚠️ Utilisation du profil de secours (Session Only)");
          
          const fallbackProfile: Profile = {
            id: session.user.id,
            email: session.user.email || '',
            role: (session.user.user_metadata?.role as UserRole) || UserRole.CLIENT,
            full_name: session.user.user_metadata?.full_name || 'Utilisateur',
            avatar_url: ''
          };
          
          setUser(fallbackProfile);
        }
        setLoading(false); // ← IMPORTANT : Arrête le loading
      }
    } catch (error) {
      console.error("Erreur processSession:", error);
      if (mountedRef.current) {
        if (session.user) {
          setUser({
            id: session.user.id,
            email: session.user.email || '',
            role: (session.user.user_metadata?.role as UserRole) || UserRole.CLIENT,
            full_name: 'Mode Secours'
          });
        } else {
          setUser(null);
        }
        setLoading(false); // ← IMPORTANT : Arrête le loading
      }
    }
  }, [fetchProfile, createProfileIfMissing]); // Dépendances stables

  // ✅ FIX #4 : useEffect avec dépendances correctes
  useEffect(() => {
    mountedRef.current = true;
    let authListener: any = null;
    let timeoutId: ReturnType<typeof setTimeout>;

    const initializeAuth = async () => {
      console.log('🔵 Initializing auth...');
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ Error getting session:', error);
          throw error;
        }

        console.log('✅ Session retrieved:', session?.user?.email || 'No session');
        
        if (session) {
          await processSession(session);
        } else {
          if (mountedRef.current) {
            setLoading(false); // Pas de session = arrête le loading
          }
        }
      } catch (error) {
        console.error("❌ Erreur init auth:", error);
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    // ✅ FIX #5 : Safety Timeout (force l'arrêt du loading après 3s)
    timeoutId = setTimeout(() => {
      if (loading && mountedRef.current) {
        console.warn("⚠️ Auth: Safety Timeout triggered (3s)");
        setLoading(false);
      }
    }, 3000);

    initializeAuth();

    // ✅ FIX #6 : Auth State Change Listener
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth event:', event, session?.user?.email);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await processSession(session);
      } else if (event === 'SIGNED_OUT') {
        if (mountedRef.current) {
          setUser(null);
          setLoading(false);
        }
      }
    });
    authListener = data;

    return () => {
      console.log('🔴 Cleaning up auth');
      mountedRef.current = false;
      clearTimeout(timeoutId);
      if (authListener) authListener.subscription.unsubscribe();
    };
  }, [processSession]); // ← Seule dépendance stable

  const signIn = async (email: string, password: string) => {
    console.log('🔵 Signing in:', email);
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('❌ Sign in error:', error);
        return { error };
      }
      
      console.log('✅ Signed in successfully');
      
      if (data.session) {
        await processSession(data.session);
      }
      return { error: null };
    } catch (err: any) {
      console.error('❌ Sign in exception:', err);
      return { error: err };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    console.log('🔵 Signing up:', email);
    setLoading(true);
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }
      });

      if (error) {
        console.error('❌ Sign up error:', error);
        return { error, data };
      }
      
      console.log('✅ Signed up successfully');
      
      if (data.session) {
        await processSession(data.session);
      }
      return { error: null, data };
    } catch (err: any) {
      console.error('❌ Sign up exception:', err);
      return { error: err, data: null };
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  const signOut = async () => {
    console.log('🔵 Signing out...');
    setLoading(true);
    
    try {
      await supabase.auth.signOut();
      if (mountedRef.current) {
        setUser(null);
      }
      console.log('✅ Signed out successfully');
    } catch (error) {
      console.error('❌ Sign out error:', error);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};