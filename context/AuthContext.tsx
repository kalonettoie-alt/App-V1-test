import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
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

  // Fonction d'auto-réparation : Crée le profil s'il manque
  const createProfileIfMissing = async (sessionUser: any) => {
    console.log("Tentative de création du profil manquant pour :", sessionUser.id);
    
    // NOTE : On n'inclut PAS 'email' ici car la colonne n'existe souvent pas dans le schéma SQL initial.
    // L'email est géré via Supabase Auth et réinjecté localement ensuite.
    const newProfileDb = {
      id: sessionUser.id,
      full_name: sessionUser.user_metadata?.full_name || sessionUser.email?.split('@')[0] || 'Utilisateur',
      role: (sessionUser.user_metadata?.role as UserRole) || UserRole.CLIENT,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 1. Tenter l'insertion
    const { error } = await supabase.from('profiles').insert([newProfileDb]);

    if (error) {
      // Log détaillé de l'erreur (converti en string pour être lisible)
      console.error("ERREUR CRITIQUE DB:", JSON.stringify(error, null, 2));
      console.error("Solution probable : Vérifiez que la Policy RLS 'INSERT' est bien activée sur la table 'profiles'.");
      return null;
    }

    console.log("Profil créé avec succès !");
    // On retourne l'objet combiné (DB + Email session)
    return { ...newProfileDb, email: sessionUser.email } as Profile;
  };

  const handleSession = async (session: any) => {
    if (!session?.user) {
      setUser(null);
      setLoading(false);
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
      if (profile) {
        // Si le profil DB n'a pas d'email (cas fréquent), on injecte celui de la session
        if (!profile.email && session.user.email) {
          profile.email = session.user.email;
        }
        setUser(profile);
      } else {
        // Cas critique : Auth OK mais impossible d'avoir un profil (bloqué par RLS)
        console.error("Profil introuvable et création échouée.");
        alert("Erreur de configuration : Votre compte est créé mais le profil de données n'a pas pu être généré. Vérifiez la console pour l'erreur exacte (souvent un problème de droits RLS).");
        await supabase.auth.signOut();
        setUser(null);
      }
    } catch (error) {
      console.error("Erreur inattendue dans handleSession:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initialisation
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      await handleSession(session);
    };
    init();

    // Écouteur de changements
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED') {
        await handleSession(session);
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
        console.error("Erreur Login:", error.message);
        setLoading(false);
    } else if (data.session) {
        await handleSession(data.session);
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string, role: string) => {
    setLoading(true);
    console.log("Inscription en cours...", { email, role });
    
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
        console.error("Erreur Inscription:", error.message);
        setLoading(false);
    } else if (data.session) {
        await handleSession(data.session);
    }

    return { data, error };
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setLoading(false);
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