
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Calendar, MapPin, Clock, CheckCircle, Loader2, AlertCircle, Eye, X, Home, Key } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { InterventionStatus } from '../../types';

const ProviderMissions = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const dateFilter = searchParams.get('date');

  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'history'>('upcoming');
  
  const [selectedMission, setSelectedMission] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchMissions = async () => {
      if (!user?.id) return;
      
      try {
        if (isMounted) setLoading(true);
        // 1. Interventions
        const { data: interventions, error: intError } = await supabase
          .from('interventions')
          .select('id, date, status, type, logement_id, prix_prestataire_ht, special_instructions')
          .eq('prestataire_id', user.id)
          .order('date', { ascending: false });

        if (intError) throw intError;
        
        let enrichedData = interventions || [];

        // 2. Logements
        if (enrichedData.length > 0) {
            const logementIds = [...new Set(enrichedData.map((i: any) => i.logement_id))].filter(Boolean);
            
            if (logementIds.length > 0) {
                const { data: logements, error: logError } = await supabase
                    .from('logements')
                    .select('id, name, address, city, postal_code, access_code, instructions')
                    .in('id', logementIds);
                
                if (!logError && logements) {
                    const logMap = new Map(logements.map((l: any) => [l.id, l]));
                    enrichedData = enrichedData.map((i: any) => ({
                        ...i,
                        logement: logMap.get(i.logement_id)
                    }));
                }
            }
        }

        if (isMounted) setMissions(enrichedData);
      } catch (error) {
        console.error('Erreur chargement missions:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMissions();

    return () => { isMounted = false; };
  }, [user?.id]);


  // Si une date est fournie dans l'URL, on filtre sur cette date
  const displayedMissions = missions.filter(m => {
    if (dateFilter) {
      return m.date === dateFilter;
    }
    
    if (activeTab === 'upcoming') {
      return [InterventionStatus.ACCEPTEE, InterventionStatus.EN_COURS].includes(m.status);
    } else {
      return m.status === InterventionStatus.TERMINEE;
    }
  });

  displayedMissions.sort((a, b) => {
    if (activeTab === 'upcoming' && !dateFilter) {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    }
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });

  const clearDateFilter = () => {
    setSearchParams({});
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case InterventionStatus.ACCEPTEE:
        return <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-blue-200">À venir</span>;
      case InterventionStatus.EN_COURS:
        return <span className="bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-amber-200 animate-pulse">En cours</span>;
      case InterventionStatus.TERMINEE:
        return <span className="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full border border-green-200">Terminée</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl font-bold text-gray-900">Mes Missions</h2>
        
        {dateFilter ? (
          <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg border border-blue-100">
            <div className="flex items-center gap-2 text-blue-800 font-medium">
              <Calendar className="w-5 h-5" />
              Missions du {new Date(dateFilter).toLocaleDateString('fr-FR')}
            </div>
            <button 
              onClick={clearDateFilter}
              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              Voir tout
            </button>
          </div>
        ) : (
          <div className="flex p-1 bg-gray-100 rounded-lg">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'upcoming' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              À venir / En cours
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === 'history' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Historique
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4">
        {displayedMissions.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
            <p className="text-gray-500">Aucune mission trouvée.</p>
            {dateFilter && (
                <button onClick={clearDateFilter} className="mt-2 text-blue-600 text-sm font-medium">
                    Retour aux missions
                </button>
            )}
          </div>
        ) : (
          displayedMissions.map((mission) => (
            <div 
                key={mission.id} 
                onClick={() => setSelectedMission(mission)}
                className="bg-white rounded-xl p-5 shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all active:scale-[0.99]"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="font-bold text-gray-900 text-lg mb-1">{mission.logement?.name || 'Logement inconnu'}</h4>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar className="w-4 h-4" />
                    {new Date(mission.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                </div>
                {getStatusBadge(mission.status)}
              </div>

              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {mission.logement?.address || 'Adresse non disponible'}
                  {mission.logement?.city && `, ${mission.logement.city}`}
                </div>
                <div className="flex items-center gap-2 text-xs bg-gray-50 p-2 rounded w-fit">
                    <Clock className="w-3 h-3 text-gray-400" />
                    {mission.type === 'standard' ? 'Ménage Standard' : 'Intendance'}
                    <span className="text-gray-300">|</span>
                    <span className="font-medium text-gray-900">{mission.prix_prestataire_ht}€</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-gray-50 flex justify-end">
                <button className="text-blue-600 text-sm font-medium flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    Voir détails & accès
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODALE DETAILS */}
      {selectedMission && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="bg-blue-600 p-6 text-white relative shrink-0">
                    <button 
                        onClick={() => setSelectedMission(null)}
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <h2 className="text-xl font-bold">Détails Intervention</h2>
                    <p className="text-blue-100 text-sm flex items-center gap-1 mt-1">
                        <Calendar size={14} />
                        {new Date(selectedMission.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Logement */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Lieu de mission</h3>
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                            <div className="flex items-start gap-3 mb-3">
                                <Home className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <p className="font-bold text-gray-900">{selectedMission.logement?.name || 'Nom indisponible'}</p>
                                    <p className="text-sm text-gray-600">{selectedMission.logement?.address}</p>
                                    <p className="text-sm text-gray-600">{selectedMission.logement?.postal_code} {selectedMission.logement?.city}</p>
                                </div>
                            </div>
                            
                            <div className="pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                                    <Key size={12} /> Codes d'accès
                                </p>
                                <div className="bg-white p-2 rounded border border-blue-100 text-blue-800 font-mono font-medium text-center tracking-widest">
                                    {selectedMission.logement?.access_code || 'Aucun code renseigné'}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Instructions */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Instructions</h3>
                        <div className="space-y-3">
                             {selectedMission.logement?.instructions && (
                                <div className="p-3 bg-white border border-gray-200 rounded-lg text-sm">
                                    <p className="font-medium text-gray-900 mb-1">Logement :</p>
                                    <p className="text-gray-600">{selectedMission.logement.instructions}</p>
                                </div>
                             )}
                             {selectedMission.special_instructions ? (
                                <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg text-sm text-yellow-800">
                                    <p className="font-medium flex items-center gap-2 mb-1">
                                        <AlertCircle size={14} /> Spécifique pour cette date :
                                    </p>
                                    <p>{selectedMission.special_instructions}</p>
                                </div>
                             ) : (
                                <p className="text-sm text-gray-400 italic">Pas d'instruction spécifique pour cette intervention.</p>
                             )}
                        </div>
                    </div>

                    <button 
                        onClick={() => setSelectedMission(null)}
                        className="w-full bg-gray-100 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default ProviderMissions;
