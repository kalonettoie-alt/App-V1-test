import { useEffect, useState } from 'react';
import { TrendingUp, Users, Home, Loader2, Plus, X, Calendar, MapPin, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { InterventionStatus, InterventionType } from '../../types';
import { supabase } from '../../services/supabase';
import { toast } from 'sonner';

// Mapping des couleurs statiques pour éviter les bugs de purge CSS Tailwind
const STAT_THEMES: Record<string, { bg: string, icon: string }> = {
  blue: { bg: 'bg-blue-50', icon: 'text-blue-600' },
  purple: { bg: 'bg-purple-50', icon: 'text-purple-600' },
  green: { bg: 'bg-green-50', icon: 'text-green-600' },
  orange: { bg: 'bg-orange-50', icon: 'text-orange-600' },
};

const StatCard = ({ title, value, change, icon: Icon, color }: any) => {
  const theme = STAT_THEMES[color] || STAT_THEMES.blue;
  
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-between h-full">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
        </div>
        <div className={`p-2 rounded-lg ${theme.bg}`}>
          <Icon className={`w-6 h-6 ${theme.icon}`} />
        </div>
      </div>
      <div className="mt-4 flex items-center text-sm">
        <span className={`${change >= 0 ? 'text-green-600' : 'text-red-600'} font-medium flex items-center`}>
          <TrendingUp className={`w-4 h-4 mr-1 ${change < 0 ? 'rotate-180' : ''}`} /> 
          {change > 0 ? '+' : ''}{change}%
        </span>
        <span className="text-gray-400 ml-2">vs mois dernier</span>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [recentInterventions, setRecentInterventions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // États des Statistiques
  const [stats, setStats] = useState({
    revenue: { value: 0, change: 0 },
    interventions: { value: 0, change: 0 },
    clients: { value: 0, change: 0 },
    logements: { value: 0, change: 0 }
  });
  
  // États pour la Modal et le Formulaire
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formOptions, setFormOptions] = useState<{ logements: any[], prestataires: any[] }>({ logements: [], prestataires: [] });
  
  const [formData, setFormData] = useState({
    logement_id: '',
    prestataire_id: '',
    date: new Date().toISOString().split('T')[0], // Date d'aujourd'hui par défaut
    type: InterventionType.STANDARD,
    nb_voyageurs: 2,
    special_instructions: ''
  });

  // Chargement initial des données du tableau de bord
  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // 1. Récupérer les 10 dernières interventions pour le tableau
      const { data: recentData, error: recentError } = await supabase
        .from('interventions')
        .select(`
          *,
          logement:logements(name),
          client:profiles!interventions_client_id_fkey(full_name),
          prestataire:profiles!interventions_prestataire_id_fkey(full_name)
        `)
        .order('date', { ascending: false })
        .limit(10);

      if (recentError) throw recentError;
      setRecentInterventions(recentData || []);

      // 2. Calcul des Statistiques
      const now = new Date();
      const currentMonth = now.getMonth();
      const currentYear = now.getFullYear();
      
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonth = lastMonthDate.getMonth();
      const lastMonthYear = lastMonthDate.getFullYear();

      // Helpers pour filtrer
      const isCurrentMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      };
      const isLastMonth = (dateStr: string) => {
        const d = new Date(dateStr);
        return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear;
      };

      // --- REVENUS & INTERVENTIONS ---
      const { data: allInterventions } = await supabase
        .from('interventions')
        .select('date, status, prix_client_ttc');
      
      const interventionsData = allInterventions || [];
      
      const currentRevenue = interventionsData
        .filter(i => i.status === InterventionStatus.TERMINEE && isCurrentMonth(i.date))
        .reduce((sum, i) => sum + (i.prix_client_ttc || 0), 0);
        
      const lastRevenue = interventionsData
        .filter(i => i.status === InterventionStatus.TERMINEE && isLastMonth(i.date))
        .reduce((sum, i) => sum + (i.prix_client_ttc || 0), 0);

      const currentInterventionsCount = interventionsData.filter(i => isCurrentMonth(i.date)).length;
      const lastInterventionsCount = interventionsData.filter(i => isLastMonth(i.date)).length;

      // --- CLIENTS ---
      const { data: allClients } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('role', 'client');
      
      const clientsData = allClients || [];
      const currentClientsCount = clientsData.filter(c => isCurrentMonth(c.created_at)).length;
      const lastClientsCount = clientsData.filter(c => isLastMonth(c.created_at)).length;

      // --- LOGEMENTS (NOUVEAU) ---
      const { data: allLogements } = await supabase
        .from('logements')
        .select('created_at');
      
      const logementsData = allLogements || [];
      const currentLogementsCount = logementsData.filter(l => isCurrentMonth(l.created_at)).length;
      const lastLogementsCount = logementsData.filter(l => isLastMonth(l.created_at)).length;

      // Helper calcul % changement
      const calcChange = (curr: number, prev: number) => {
        if (prev === 0) return curr > 0 ? 100 : 0;
        return Math.round(((curr - prev) / prev) * 100);
      };

      setStats({
        revenue: { 
          value: currentRevenue, 
          change: calcChange(currentRevenue, lastRevenue) 
        },
        interventions: { 
          value: currentInterventionsCount, 
          change: calcChange(currentInterventionsCount, lastInterventionsCount) 
        },
        clients: { 
          value: currentClientsCount, 
          change: calcChange(currentClientsCount, lastClientsCount) 
        },
        logements: {
          value: currentLogementsCount,
          change: calcChange(currentLogementsCount, lastLogementsCount)
        }
      });

    } catch (error) {
      console.error('Erreur chargement dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Chargement des options pour le formulaire (Logements et Prestataires)
  const fetchFormOptions = async () => {
    try {
      // 1. Logements (avec client_id car on en a besoin pour la création)
      const { data: logements } = await supabase
        .from('logements')
        .select('id, name, client_id, city')
        .order('name');

      // 2. Prestataires
      const { data: prestataires } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'prestataire')
        .order('full_name');

      setFormOptions({
        logements: logements || [],
        prestataires: prestataires || []
      });
    } catch (error) {
      console.error("Erreur chargement options:", error);
    }
  };

  // Ouvrir la modale et charger les options
  const handleOpenModal = () => {
    setIsModalOpen(true);
    fetchFormOptions();
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.logement_id || !formData.date) {
      toast.error("Veuillez remplir les champs obligatoires.");
      return;
    }

    setSubmitting(true);
    try {
      // Retrouver le client_id associé au logement sélectionné
      const selectedLogement = formOptions.logements.find(l => l.id === formData.logement_id);
      if (!selectedLogement) throw new Error("Logement invalide");

      const payload = {
        logement_id: formData.logement_id,
        client_id: selectedLogement.client_id, // OBLIGATOIRE selon le schéma
        prestataire_id: formData.prestataire_id || null,
        date: formData.date,
        type: formData.type,
        nb_voyageurs: formData.nb_voyageurs,
        special_instructions: formData.special_instructions,
        status: formData.prestataire_id ? InterventionStatus.ACCEPTEE : InterventionStatus.A_ATTRIBUER
      };

      const { error } = await supabase.from('interventions').insert([payload]);

      if (error) throw error;

      // Succès
      setIsModalOpen(false);
      setFormData({
        logement_id: '',
        prestataire_id: '',
        date: new Date().toISOString().split('T')[0],
        type: InterventionType.STANDARD,
        nb_voyageurs: 2,
        special_instructions: ''
      });
      
      // Rafraîchir le tableau
      await fetchDashboardData();
      toast.success('Intervention créée avec succès');

    } catch (error: any) {
      console.error("Erreur création intervention:", error);
      toast.error("Erreur : " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header avec boutons alignés */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Tableau de Bord</h2>
          <p className="text-gray-500">Vue d'ensemble de l'activité ce mois-ci</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleOpenModal}
            className="bg-blue-600 hover:bg-blue-700 text-white h-11 px-4 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2"
          >
            <Plus size={20} />
            <span className="hidden md:inline">Nouvelle Intervention</span>
            <span className="md:hidden">Intervention</span>
          </button>
        </div>
      </div>

      {/* Stats Grid - Mise à jour pour 4 colonnes */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="CA encaissé (Mois)" 
          value={`${stats.revenue.value.toLocaleString('fr-FR')} €`} 
          change={stats.revenue.change} 
          icon={TrendingUp} 
          color="blue" 
        />
        <StatCard 
          title="Interventions (Mois)" 
          value={stats.interventions.value.toString()} 
          change={stats.interventions.change} 
          icon={Home} 
          color="purple" 
        />
        <StatCard 
          title="Nouveaux Clients" 
          value={stats.clients.value.toString()} 
          change={stats.clients.change} 
          icon={Users} 
          color="green" 
        />
        <StatCard 
          title="Nouveaux Logements" 
          value={stats.logements.value.toString()} 
          change={stats.logements.change} 
          icon={MapPin} 
          color="orange" 
        />
      </div>

      {/* Recent Activity Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="font-bold text-gray-900">Interventions Récentes</h3>
          <button 
            onClick={() => navigate('/admin/interventions')}
            className="text-sm text-blue-600 font-medium hover:text-blue-700 transition-colors"
          >
            Tout voir
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Logement</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Prestataire</th>
                <th className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentInterventions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Aucune intervention trouvée. Créez-en une avec le bouton ci-dessus.
                  </td>
                </tr>
              ) : (
                recentInterventions.map((i) => (
                  <tr 
                    key={i.id} 
                    onClick={() => navigate(`/admin/interventions/${i.id}`)}
                    className="hover:bg-gray-50 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 align-middle">
                      {i.logement?.name || 'Inconnu'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 align-middle">
                      {i.client?.full_name || 'Inconnu'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-500 align-middle">
                      {new Date(i.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        i.type === InterventionType.STANDARD ? 'bg-indigo-100 text-indigo-800' : 'bg-orange-100 text-orange-800'
                      }`}>
                        {i.type === 'standard' ? 'Ménage' : 'Intendance'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 align-middle">
                      {i.prestataire?.full_name ? (
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">{i.prestataire.full_name}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic flex items-center gap-1">
                          <span className="w-2 h-2 bg-red-400 rounded-full"></span>
                          Pas encore attribué
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                      <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        i.status === InterventionStatus.A_ATTRIBUER ? 'bg-red-100 text-red-800' : 
                        i.status === InterventionStatus.ACCEPTEE ? 'bg-blue-100 text-blue-800' :
                        i.status === InterventionStatus.TERMINEE ? 'bg-green-100 text-green-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {i.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE CRÉATION INTERVENTION */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Nouvelle Intervention
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Sélection Logement */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logement (Lieu)</label>
                <div className="relative">
                  <Home className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                  <select 
                    required
                    value={formData.logement_id}
                    onChange={e => setFormData({...formData, logement_id: e.target.value})}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none"
                  >
                    <option value="">Choisir un logement...</option>
                    {formOptions.logements.map(l => (
                      <option key={l.id} value={l.id}>{l.name} ({l.city})</option>
                    ))}
                  </select>
                </div>
                {formOptions.logements.length === 0 && (
                   <p className="text-xs text-red-500 mt-1">Aucun logement disponible. Créez d'abord un logement.</p>
                )}
              </div>

              {/* Date et Type */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input 
                    type="date" 
                    required
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select 
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value as InterventionType})}
                    className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value={InterventionType.STANDARD}>Standard (Ménage)</option>
                    <option value={InterventionType.INTENDANCE}>Intendance</option>
                  </select>
                </div>
              </div>

              {/* Prestataire (Optionnel) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Attribution Prestataire (Optionnel)</label>
                <div className="relative">
                  <User className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                  <select 
                    value={formData.prestataire_id}
                    onChange={e => setFormData({...formData, prestataire_id: e.target.value})}
                    className="w-full pl-9 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none"
                  >
                    <option value="">Laisser à attribuer</option>
                    {formOptions.prestataires.map(p => (
                      <option key={p.id} value={p.id}>{p.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Nombre de voyageurs */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Voyageurs prévus</label>
                <input 
                  type="number" 
                  min="1"
                  value={formData.nb_voyageurs}
                  onChange={e => setFormData({...formData, nb_voyageurs: parseInt(e.target.value)})}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Instructions Spéciales */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions Spéciales</label>
                <textarea 
                  rows={3}
                  placeholder="Besoin particulier pour ce ménage ?"
                  value={formData.special_instructions}
                  onChange={e => setFormData({...formData, special_instructions: e.target.value})}
                  className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              {/* Actions */}
              <div className="pt-4 flex gap-3 border-t border-gray-100 mt-2">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Création...
                    </>
                  ) : (
                    'Créer l\'intervention'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;