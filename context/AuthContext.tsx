import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
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

  // Fonction pour récupérer le profil complet
  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) return null;
      return data as Profile;
    } catch (err) {
      return null;
    }
  };

  // Fonction d'auto-réparation : Crée le profil s'il manque (Utilise UPSERT pour éviter les doublons)
  const createProfileIfMissing = async (sessionUser: any) => {
    try {
        const newProfileDb = {
          id: sessionUser.id,
          full_name: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Utilisateur',
          role: (sessionUser.user_metadata?.role as UserRole) || UserRole.CLIENT,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        // Utilisation de UPSERT au lieu de INSERT
        // Cela met à jour si ça existe, ou crée si ça n'existe pas. Beaucoup plus robuste.
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
  };

  // Logique centralisée de gestion de session
  const processSession = async (session: any) => {
    if (!session?.user) {
      if (mountedRef.current) setUser(null);
      return;
    }

    try {
      // 1. Essayer de récupérer le profil existant
      let profile = await fetchProfile(session.user.id);

      // 2. Si pas de profil, essayer de le créer (Auto-Healing)
      if (!profile) {
        profile = await createProfileIfMissing(session.user);
      }

      // 3. Mettre à jour l'état
      if (mountedRef.current) {
        if (profile) {
          // Cas Idéal : On a le profil de la base de données
          if (!profile.email && session.user.email) {
            profile.email = session.user.email;
          }
          setUser(profile);
        } else {
          // CAS DE SECOURS (FALLBACK) : La base de données ne répond pas ou erreur RLS
          // On construit un profil temporaire avec les infos de la session pour ne pas bloquer l'utilisateur
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
      }
    } catch (error) {
      console.error("Erreur processSession:", error);
      // Même en cas d'erreur grave, on essaie de ne pas déconnecter l'utilisateur si la session est là
      if (mountedRef.current && session.user) {
         setUser({
            id: session.user.id,
            email: session.user.email || '',
            role: (session.user.user_metadata?.role as UserRole) || UserRole.CLIENT,
            full_name: 'Mode Secours'
         });
      } else if (mountedRef.current) {
        setUser(null);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    let authListener: any = null;

    const initializeAuth = async () => {
      try {
        // 1. Récupérer la session initiale
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;
        
        if (session) {
            await processSession(session);
        }
      } catch (error) {
        console.error("Erreur init auth:", error);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    };

    // Timeout de sécurité : Force la fin du chargement après 2 secondes 
    // si Supabase ne répond pas (ex: réseau lent ou bug interne)
    const safetyTimeout = setTimeout(() => {
        if (loading && mountedRef.current) {
            console.warn("Auth: Safety Timeout triggered");
            setLoading(false);
        }
    }, 2000);

    initializeAuth();

    // Abonnement aux changements
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await processSession(session);
      } else if (event === 'SIGNED_OUT') {
        if (mountedRef.current) setUser(null);
      }
      // On s'assure que le loading est désactivé après un event
      if (mountedRef.current) setLoading(false);
    });
    authListener = data;

    return () => {
      mountedRef.current = false;
      clearTimeout(safetyTimeout);
      if (authListener) authListener.subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });
        
        if (error) return { error };
        
        if (data.session) {
            await processSession(data.session);
        }
        return { error: null };
    } catch (err: any) {
        return { error: err };
    } finally {
        if (mountedRef.current) setLoading(false);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
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

        if (error) return { error, data };
        
        if (data.session) {
            await processSession(data.session);
        }
        return { error: null, data };
    } catch (err: any) {
        return { error: err, data: null };
    } finally {
        if (mountedRef.current) setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
        await supabase.auth.signOut();
        if (mountedRef.current) setUser(null);
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
}