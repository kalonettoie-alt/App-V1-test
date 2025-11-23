import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserRole } from '../types';
import { Shield, Key, User, Briefcase, Loader2, AlertCircle, ArrowRight } from 'lucide-react';

const Login = () => {
  const { signIn, signUp, loading } = useAuth();
  
  // Mode: 'login' ou 'register'
  const [mode, setMode] = useState<'login' | 'register'>('login');
  
  // Champs formulaire
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Rôle sélectionné (sert au login pour l'affichage, et à l'inscription pour la création)
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.CLIENT);
  
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Nettoyage de l'email (suppression des espaces accidentels)
    const cleanEmail = email.trim();

    try {
      if (mode === 'login') {
        const { error } = await signIn(cleanEmail, password);
        if (error) throw error;
      } else {
        if (!fullName.trim()) {
          setError("Le nom complet est requis pour l'inscription");
          return;
        }
        // Inscription
        const { error, data } = await signUp(cleanEmail, password, fullName, selectedRole);
        if (error) throw error;
        
        if (data.user && !data.session) {
          setSuccessMessage("Compte créé ! Si 'Confirm Email' est activé dans Supabase, veuillez valider votre email.");
          setMode('login');
        }
      }
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('Invalid login credentials')) {
        setError("Email ou mot de passe incorrect. Si vous venez de créer le compte, vérifiez que vous avez confirmé votre email (ou désactivez 'Confirm Email' dans Supabase).");
      } else {
        setError(err.message || 'Une erreur est survenue');
      }
    }
  };

  const roleConfig = {
    [UserRole.ADMIN]: { 
      icon: Shield, 
      color: 'text-purple-600', 
      bg: 'bg-purple-100',
      desc: 'Gestion globale, statistiques et attributions.' 
    },
    [UserRole.CLIENT]: { 
      icon: User, 
      color: 'text-blue-600', 
      bg: 'bg-blue-100',
      desc: 'Suivi des biens et historique des interventions.' 
    },
    [UserRole.PRESTATAIRE]: { 
      icon: Briefcase, 
      color: 'text-green-600', 
      bg: 'bg-green-100',
      desc: 'Planning des missions et rapports d\'intervention.' 
    }
  };

  const ActiveIcon = roleConfig[selectedRole].icon;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <div className="p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {mode === 'login' ? 'Connexion' : 'Créer un compte'}
            </h1>
            <p className="text-gray-500">
              {mode === 'login' ? 'Accédez à votre espace CleanManager' : 'Rejoignez la plateforme de gestion'}
            </p>
          </div>

          {/* Sélecteur de Rôle */}
          <div className="flex p-1 bg-gray-100 rounded-xl mb-6">
            {(Object.keys(roleConfig) as UserRole[]).map((role) => (
              <button
                key={role}
                onClick={() => setSelectedRole(role)}
                type="button"
                className={`flex-1 py-2 text-xs md:text-sm font-medium rounded-lg transition-all duration-200 ${
                  selectedRole === role 
                    ? 'bg-white text-gray-900 shadow-sm' 
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {role.charAt(0).toUpperCase() + role.slice(1)}
              </button>
            ))}
          </div>

          {/* Info bulle rôle */}
          <div className={`flex items-start gap-4 p-4 rounded-lg mb-6 ${roleConfig[selectedRole].bg} transition-colors duration-300`}>
            <ActiveIcon className={`w-6 h-6 mt-1 ${roleConfig[selectedRole].color}`} />
            <div>
              <h3 className={`font-semibold ${roleConfig[selectedRole].color}`}>
                {mode === 'login' ? `Espace ${selectedRole}` : `Inscription ${selectedRole}`}
              </h3>
              <p className="text-xs text-gray-600 mt-1">{roleConfig[selectedRole].desc}</p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm flex items-center gap-2">
              <ArrowRight className="w-4 h-4 flex-shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {mode === 'register' && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom Complet</label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={mode === 'register'}
                    placeholder="Jean Dupont"
                    className="w-full px-4 py-3 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                  />
                  <User className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <div className="relative">
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="exemple@email.com"
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
              <div className="relative">
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="w-full px-4 py-3 pl-10 bg-gray-50 border border-gray-200 rounded-lg text-gray-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
                />
                <Key className="w-5 h-5 text-gray-400 absolute left-3 top-3.5" />
              </div>
              {mode === 'register' && (
                <p className="text-xs text-gray-500 mt-1">6 caractères minimum</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                mode === 'login' ? 'Se connecter' : 'Créer mon compte'
              )}
            </button>
          </form>

          <div className="mt-6 text-center pt-4 border-t border-gray-100">
            <p className="text-sm text-gray-600">
              {mode === 'login' ? "Pas encore de compte ?" : "Déjà inscrit ?"}
              <button 
                onClick={() => {
                  setMode(mode === 'login' ? 'register' : 'login');
                  setError(null);
                  setSuccessMessage(null);
                }}
                className="ml-2 font-semibold text-blue-600 hover:text-blue-700 hover:underline focus:outline-none"
              >
                {mode === 'login' ? "S'inscrire" : "Se connecter"}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;