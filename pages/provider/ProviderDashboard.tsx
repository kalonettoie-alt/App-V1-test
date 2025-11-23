
import React, { useEffect, useState, useCallback } from 'react';
import { Calendar, MapPin, Clock, CheckCircle, Loader2, AlertCircle, Camera, Upload, X, Image as ImageIcon, Eye, Home, Key } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { InterventionStatus } from '../../types';

const ProviderDashboard = () => {
  const { user } = useAuth();
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ revenue: 0, count: 0 });

  // États pour le rapport de fin de mission
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedMission, setSelectedMission] = useState<any>(null);
  const [reportData, setReportData] = useState<{
    degats_signales: boolean;
    degats_description: string;
    photos: File[]; 
    degats_photos: File[]; 
  }>({
    degats_signales: false,
    degats_description: '',
    photos: [],
    degats_photos: []
  });
  const [submittingReport, setSubmittingReport] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Fonction de chargement des données
  const fetchMissions = useCallback(async () => {
    if (!user?.id) return;

    try {
      // 1. Récupérer les interventions
      const { data: interventions, error: intError } = await supabase
        .from('interventions')
        .select('id, date, status, type, logement_id, prix_prestataire_ht, special_instructions')
        .eq('prestataire_id', user.id)
        .order('date', { ascending: true });

      if (intError) throw intError;
      
      let enrichedData = interventions || [];

      // 2. Récupérer les logements associés
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

      setMissions(enrichedData);

      // Calcul des stats
      const revenue = enrichedData
        .filter(m => m.status === InterventionStatus.TERMINEE)
        .reduce((acc, curr) => acc + (curr.prix_prestataire_ht || 0), 0);
      
      setStats({
        revenue,
        count: enrichedData.length
      });

    } catch (error) {
      console.error('Erreur chargement missions:', error);
    }
  }, [user?.id]);

  // Effet principal avec gestion de montage/démontage
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isMounted) setLoading(true);
      await fetchMissions();
      if (isMounted) setLoading(false);
    };

    loadData();

    return () => { isMounted = false; };
  }, [fetchMissions]);


  // Filtrer pour n'avoir que les missions DU JOUR
  const today = new Date().toISOString().split('T')[0];
  const todaysMissions = missions.filter(m => m.date === today);

  const handleStatusChange = async (e: React.MouseEvent, id: string, newStatus: InterventionStatus) => {
    e.stopPropagation();
    if (newStatus === InterventionStatus.TERMINEE) {
      const mission = missions.find(m => m.id === id);
      if (mission) {
        setSelectedMission(mission);
        setReportData({ 
          degats_signales: false, 
          degats_description: '', 
          photos: [],
          degats_photos: []
        });
        setIsReportModalOpen(true);
      }
      return;
    }

    try {
      const { error } = await supabase
        .from('interventions')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;
      // Rafraîchir les données sans remettre le loading global
      await fetchMissions();
    } catch (error) {
      console.error('Erreur mise à jour statut:', error);
      alert("Impossible de mettre à jour le statut.");
    }
  };

  const openDetailModal = (mission: any) => {
    setSelectedMission(mission);
    setDetailModalOpen(true);
  };

  // Gestion des fichiers photos
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'general' | 'degats') => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files);
      setReportData(prev => ({
        ...prev,
        [type === 'general' ? 'photos' : 'degats_photos']: [
          ...(type === 'general' ? prev.photos : prev.degats_photos),
          ...newFiles
        ]
      }));
    }
  };

  const removePhoto = (index: number, type: 'general' | 'degats') => {
    setReportData(prev => ({
      ...prev,
      [type === 'general' ? 'photos' : 'degats_photos']: (type === 'general' ? prev.photos : prev.degats_photos).filter((_, i) => i !== index)
    }));
  };

  // Soumission du rapport
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (reportData.photos.length === 0) {
      alert("Veuillez ajouter au moins une photo prouvant la fin de la mission.");
      return;
    }

    if (reportData.degats_signales) {
      if (!reportData.degats_description.trim()) {
        alert("Veuillez décrire les dégâts signalés.");
        return;
      }
      if (reportData.degats_photos.length === 0) {
        alert("Veuillez ajouter au moins une photo des dégâts signalés.");
        return;
      }
    }

    setSubmittingReport(true);

    try {
      const photoUrls: string[] = [];
      const degatsPhotoUrls: string[] = [];

      const uploadFiles = async (files: File[], targetArray: string[]) => {
        for (const file of files) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${selectedMission.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          
          const { error: uploadError } = await supabase.storage
            .from('rapports')
            .upload(fileName, file);

          if (uploadError) {
             if (uploadError.message.includes("violates row-level security")) {
                 throw new Error("Erreur de permission : Vous n'avez pas le droit d'envoyer des photos.");
             }
             throw uploadError;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('rapports')
            .getPublicUrl(fileName);
          
          targetArray.push(publicUrl);
        }
      };

      await uploadFiles(reportData.photos, photoUrls);

      if (reportData.degats_signales && reportData.degats_photos.length > 0) {
        await uploadFiles(reportData.degats_photos, degatsPhotoUrls);
      }

      const { error: reportError } = await supabase
        .from('rapports')
        .insert([{
          intervention_id: selectedMission.id,
          photos_intervention: photoUrls,
          degats_signales: reportData.degats_signales,
          degats_description: reportData.degats_description,
          degats_photos: degatsPhotoUrls
        }]);

      if (reportError) throw reportError;

      const { error: updateError } = await supabase
        .from('interventions')
        .update({ 
          status: InterventionStatus.TERMINEE,
          completed_at: new Date().toISOString()
        })
        .eq('id', selectedMission.id);

      if (updateError) throw updateError;

      setIsReportModalOpen(false);
      await fetchMissions();

    } catch (error: any) {
      console.error("Erreur rapport:", error);
      alert("Une erreur est survenue lors de l'envoi du rapport : " + error.message);
    } finally {
      setSubmittingReport(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">Mes Performances</h2>
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold text-green-600">{stats.revenue.toFixed(2)}€</span>
          <span className="text-sm text-gray-500">générés (terminé)</span>
        </div>
        <p className="text-sm text-gray-500 mt-1">{stats.count} missions au total (historique)</p>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Missions du jour
            <span className="text-sm font-normal text-gray-500 ml-2">({new Date().toLocaleDateString('fr-FR')})</span>
        </h3>
      </div>
      
      <div className="space-y-4">
        {todaysMissions.length === 0 ? (
          <div className="bg-white p-10 text-center rounded-xl border border-gray-200 border-dashed">
            <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="text-gray-900 font-medium">Aucune mission aujourd'hui</h4>
            <p className="text-gray-500 text-sm mt-1">Consultez votre planning pour voir les prochaines dates.</p>
          </div>
        ) : (
          todaysMissions.map((mission) => (
            <div 
                key={mission.id} 
                onClick={() => openDetailModal(mission)}
                className={`bg-white rounded-xl p-5 shadow-sm border-l-4 border-y border-r border-gray-100 relative cursor-pointer hover:shadow-md transition-all ${
                mission.status === InterventionStatus.EN_COURS ? 'border-l-amber-500' : 
                mission.status === InterventionStatus.TERMINEE ? 'border-l-green-500' : 'border-l-blue-500'
                }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                     <span className="bg-gray-100 text-gray-800 text-xs font-bold px-2 py-1 rounded uppercase">
                      Aujourd'hui
                     </span>
                     {mission.status === InterventionStatus.EN_COURS && (
                       <span className="flex items-center gap-1 text-xs font-bold text-amber-600 animate-pulse">
                         <span className="w-2 h-2 bg-amber-500 rounded-full"></span> En cours
                       </span>
                     )}
                     {mission.status === InterventionStatus.TERMINEE && (
                       <span className="flex items-center gap-1 text-xs font-bold text-green-600">
                         <CheckCircle className="w-3 h-3" /> Terminée
                       </span>
                     )}
                  </div>
                  <h4 className="font-bold text-gray-900 text-lg">{mission.type === 'standard' ? 'Ménage Standard' : 'Intendance'}</h4>
                  <p className="text-sm text-gray-500 font-medium">{mission.logement?.name}</p>
                </div>
                <span className="font-bold text-gray-900 bg-gray-50 px-3 py-1 rounded-lg border border-gray-200">
                  {mission.prix_prestataire_ht}€
                </span>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  {mission.logement?.address}, {mission.logement?.postal_code} {mission.logement?.city}
                </div>
              </div>
              
              {mission.special_instructions && (
                <div className="bg-yellow-50 p-3 rounded-lg text-xs text-yellow-800 mb-4 border border-yellow-100 flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{mission.special_instructions}</span>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-gray-50">
                {mission.status === InterventionStatus.ACCEPTEE && (
                  <button 
                    onClick={(e) => handleStatusChange(e, mission.id, InterventionStatus.EN_COURS)}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-colors"
                  >
                    Commencer la mission
                  </button>
                )}
                
                {mission.status === InterventionStatus.EN_COURS && (
                  <button 
                    onClick={(e) => handleStatusChange(e, mission.id, InterventionStatus.TERMINEE)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-lg font-medium transition-colors flex justify-center items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Terminer
                  </button>
                )}

                {mission.status === InterventionStatus.TERMINEE && (
                  <button disabled className="flex-1 bg-gray-100 text-gray-400 py-2.5 rounded-lg font-medium cursor-not-allowed">
                    Mission clôturée
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL DETAILS LOGEMENT */}
      {detailModalOpen && selectedMission && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="bg-blue-600 p-6 text-white relative shrink-0">
                    <button 
                        onClick={() => setDetailModalOpen(false)}
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
                                    <p className="font-bold text-gray-900">{selectedMission.logement?.name}</p>
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
                        onClick={() => setDetailModalOpen(false)}
                        className="w-full bg-gray-100 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Fermer
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* MODAL DE RAPPORT D'INTERVENTION */}
      {isReportModalOpen && selectedMission && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-xl">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                Rapport de fin de mission
              </h3>
              <button onClick={() => setIsReportModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>

            <form onSubmit={handleSubmitReport} className="p-6 space-y-6">
              
              <div className="bg-blue-50 p-3 rounded-lg text-sm text-blue-800 border border-blue-100">
                Pour valider la mission chez <strong>{selectedMission.logement?.name}</strong>, veuillez remplir ce rapport rapide.
              </div>

              {/* 1. Dégâts */}
              <div className="space-y-4">
                <label className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input 
                    type="checkbox" 
                    checked={reportData.degats_signales}
                    onChange={e => setReportData({...reportData, degats_signales: e.target.checked})}
                    className="w-5 h-5 text-red-600 rounded focus:ring-red-500 border-gray-300"
                  />
                  <div className="flex-1">
                    <span className="font-medium text-gray-900">Signaler un problème / dégât</span>
                    <p className="text-xs text-gray-500">Cochez si quelque chose est cassé ou anormal.</p>
                  </div>
                </label>

                {reportData.degats_signales && (
                  <div className="pl-4 border-l-2 border-red-100 space-y-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Description du problème <span className="text-red-500">*</span></label>
                      <textarea 
                        required
                        rows={3}
                        placeholder="Décrivez ce qui est cassé ou le problème rencontré..."
                        value={reportData.degats_description}
                        onChange={e => setReportData({...reportData, degats_description: e.target.value})}
                        className="w-full px-3 py-2 bg-gray-50 border border-red-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:outline-none"
                      />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Photos des dégâts <span className="text-red-500">*</span></label>
                        <div className="grid grid-cols-3 gap-3 mb-3">
                        {reportData.degats_photos.map((file, index) => (
                            <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-red-200 group">
                            <img 
                                src={URL.createObjectURL(file)} 
                                alt="Degat Preview" 
                                className="w-full h-full object-cover"
                            />
                            <button 
                                type="button"
                                onClick={() => removePhoto(index, 'degats')}
                                className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                            >
                                <X size={12} />
                            </button>
                            </div>
                        ))}
                        
                        <label className="aspect-square rounded-lg border-2 border-dashed border-red-200 flex flex-col items-center justify-center cursor-pointer hover:border-red-500 hover:bg-red-50 transition-all text-red-400 hover:text-red-600">
                            <Upload className="w-6 h-6 mb-1" />
                            <span className="text-xs font-medium">Ajouter</span>
                            <input 
                            type="file" 
                            accept="image/*"
                            multiple
                            onChange={(e) => handleFileChange(e, 'degats')}
                            className="hidden"
                            id="degats-upload"
                            />
                        </label>
                        </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-gray-100">
                <label className="block text-sm font-medium text-gray-700 mb-2">Preuves de fin de mission (Ménage) <span className="text-blue-500">*</span></label>
                
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {reportData.photos.map((file, index) => (
                    <div key={index} className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group">
                      <img 
                        src={URL.createObjectURL(file)} 
                        alt="Mission Preview" 
                        className="w-full h-full object-cover"
                      />
                      <button 
                        type="button"
                        onClick={() => removePhoto(index, 'general')}
                        className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full hover:bg-red-500 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  
                  <label className="aspect-square rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all text-gray-400 hover:text-blue-600">
                    <Upload className="w-6 h-6 mb-1" />
                    <span className="text-xs font-medium">Ajouter</span>
                    <input 
                      type="file" 
                      accept="image/*"
                      multiple
                      onChange={(e) => handleFileChange(e, 'general')}
                      className="hidden"
                      id="general-upload"
                    />
                  </label>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setIsReportModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={submittingReport}
                  className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex justify-center items-center gap-2 disabled:opacity-50"
                >
                  {submittingReport ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Envoi...
                    </>
                  ) : (
                    'Envoyer & Terminer'
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

export default ProviderDashboard;
