
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Calendar, Search, Filter, Eye, MapPin, Loader2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { InterventionStatus } from '../../types';

const AdminInterventions = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filtres
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showTodayOnly, setShowTodayOnly] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Synchronisation avec l'URL
  useEffect(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      setSelectedDate(dateParam);
      setShowTodayOnly(false); // Désactiver "Aujourd'hui" si une date spécifique est demandée
    } else {
      setSelectedDate(null);
    }
  }, [searchParams]);

  const fetchInterventions = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('interventions')
        .select(`
          *,
          logement:logements(name, city),
          client:profiles!interventions_client_id_fkey(full_name),
          prestataire:profiles!interventions_prestataire_id_fkey(full_name)
        `)
        .order('date', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInterventions(data || []);
    } catch (error) {
      console.error('Erreur chargement interventions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterventions();
  }, [statusFilter]);

  // Gestion du nettoyage du filtre date
  const clearDateFilter = () => {
    setSearchParams({});
    setSelectedDate(null);
  };

  // Gestion du toggle "Aujourd'hui"
  const toggleToday = () => {
    if (showTodayOnly) {
      setShowTodayOnly(false);
    } else {
      setShowTodayOnly(true);
      setSearchParams({}); // Enlève le paramètre URL date éventuel
      setSelectedDate(null);
    }
  };

  // Filtrage côté client
  const filteredInterventions = interventions.filter(i => {
    // 1. Filtre Recherche Textuelle
    const term = searchTerm.toLowerCase();
    const housing = i.logement?.name?.toLowerCase() || '';
    const client = i.client?.full_name?.toLowerCase() || '';
    const provider = i.prestataire?.full_name?.toLowerCase() || '';
    const matchesSearch = housing.includes(term) || client.includes(term) || provider.includes(term);

    // 2. Filtre Date
    let matchesDate = true;
    const interventionDateStr = new Date(i.date).toISOString().split('T')[0];

    if (selectedDate) {
      // Priorité au filtre URL (calendrier)
      matchesDate = interventionDateStr === selectedDate;
    } else if (showTodayOnly) {
      // Sinon filtre bouton "Aujourd'hui"
      const todayStr = new Date().toISOString().split('T')[0];
      matchesDate = todayStr === interventionDateStr;
    }
    
    return matchesSearch && matchesDate;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case InterventionStatus.A_ATTRIBUER:
        return <span className="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-red-200">À attribuer</span>;
      case InterventionStatus.ACCEPTEE:
        return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-200">Planifiée</span>;
      case InterventionStatus.EN_COURS:
        return <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">En cours</span>;
      case InterventionStatus.TERMINEE:
        return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-green-200">Terminée</span>;
      default:
        return <span className="bg-gray-100 text-gray-800 text-xs font-medium px-2.5 py-0.5 rounded-full">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Interventions</h2>
          <p className="text-gray-500">Gestion de l'historique et du planning</p>
        </div>
        
        {/* Zone de Filtres */}
        <div className="flex flex-col lg:flex-row gap-3 w-full lg:w-auto items-start lg:items-center">
            
            {/* Filtre Date Spécifique (via URL) */}
            {selectedDate && (
              <button
                onClick={clearDateFilter}
                className="flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
              >
                <Calendar className="w-4 h-4" />
                Date : {new Date(selectedDate).toLocaleDateString('fr-FR')}
                <X className="w-4 h-4 ml-1" />
              </button>
            )}

            {/* Bouton Aujourd'hui (caché si filtre date actif) */}
            {!selectedDate && (
              <button
                onClick={toggleToday}
                className={`flex items-center gap-2 px-4 h-10 rounded-lg text-sm font-medium transition-all border ${
                  showTodayOnly
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <Calendar className="w-4 h-4" />
                {showTodayOnly ? "Aujourd'hui (Actif)" : "Aujourd'hui"}
                {showTodayOnly && <CheckCircle2 className="w-4 h-4 ml-1" />}
              </button>
            )}

            <div className="h-8 w-px bg-gray-300 hidden lg:block mx-1"></div>

            {/* Filtre Statut */}
            <div className="relative w-full lg:w-auto">
                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <select 
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full lg:w-48 pl-9 pr-8 h-10 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none appearance-none cursor-pointer"
                >
                    <option value="all">Tous les statuts</option>
                    <option value={InterventionStatus.A_ATTRIBUER}>À attribuer</option>
                    <option value={InterventionStatus.ACCEPTEE}>Planifiées</option>
                    <option value={InterventionStatus.EN_COURS}>En cours</option>
                    <option value={InterventionStatus.TERMINEE}>Terminées</option>
                </select>
            </div>

            {/* Recherche */}
            <div className="relative flex-1 w-full lg:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                    type="text" 
                    placeholder="Rechercher..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 h-10 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
             <div className="flex justify-center items-center p-12">
                 <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
             </div>
        ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Lieu</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prestataire</th>
                <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredInterventions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                        <AlertCircle className="w-8 h-8 text-gray-300" />
                        <p>
                          {selectedDate 
                            ? `Aucune intervention le ${new Date(selectedDate).toLocaleDateString('fr-FR')}.` 
                            : showTodayOnly 
                                ? "Aucune intervention prévue aujourd'hui." 
                                : "Aucune intervention trouvée avec ces critères."}
                        </p>
                        {selectedDate && (
                            <button onClick={clearDateFilter} className="text-blue-600 text-sm hover:underline">
                                Voir toutes les interventions
                            </button>
                        )}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredInterventions.map((intervention) => (
                  <tr 
                    key={intervention.id} 
                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                    onClick={() => navigate(`/admin/interventions/${intervention.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2 text-sm font-medium text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {new Date(intervention.date).toLocaleDateString('fr-FR')}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(intervention.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                          <span className="text-sm font-medium text-gray-900">{intervention.logement?.name}</span>
                          <span className="text-xs text-gray-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {intervention.logement?.city}
                          </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {intervention.client?.full_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                         {intervention.prestataire ? (
                            <div className="flex items-center gap-2 text-sm text-gray-900">
                                <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
                                    {intervention.prestataire.full_name.charAt(0)}
                                </div>
                                {intervention.prestataire.full_name}
                            </div>
                         ) : (
                             <span className="text-xs text-gray-400 italic">Non attribué</span>
                         )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button className="text-gray-400 hover:text-blue-600 p-1">
                            <Eye size={18} />
                        </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        )}
        
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
            <span>Affichage de {filteredInterventions.length} résultats</span>
        </div>
      </div>
    </div>
  );
};

export default AdminInterventions;
