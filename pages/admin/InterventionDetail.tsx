
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, MapPin, User, CreditCard, Clock, AlertCircle, Save, Loader2, CheckCircle, FileText, Image as ImageIcon, XCircle } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { InterventionStatus } from '../../types';

const AdminInterventionDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [intervention, setIntervention] = useState<any>(null);
  const [rapport, setRapport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [prestataires, setPrestataires] = useState<any[]>([]);
  
  // État pour l'édition
  const [status, setStatus] = useState<InterventionStatus | ''>('');
  const [prestataireId, setPrestataireId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Charger l'intervention avec toutes les relations
        const { data, error } = await supabase
          .from('interventions')
          .select(`
            *,
            logement:logements(*),
            client:profiles!interventions_client_id_fkey(*),
            prestataire:profiles!interventions_prestataire_id_fkey(*)
          `)
          .eq('id', id)
          .single();

        if (error) throw error;

        setIntervention(data);
        setStatus(data.status);
        setPrestataireId(data.prestataire_id);

        // 2. Charger le rapport associé s'il existe
        const { data: rapportData } = await supabase
          .from('rapports')
          .select('*')
          .eq('intervention_id', id)
          .maybeSingle();
        
        setRapport(rapportData);

        // 3. Charger la liste des prestataires pour le menu déroulant
        const { data: prestData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .eq('role', 'prestataire');
          
        setPrestataires(prestData || []);

      } catch (error) {
        console.error("Erreur:", error);
        navigate('/admin'); // Redirection si non trouvé
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, navigate]);

  const handleSave = async () => {
    setSaving(true);
    setSuccessMessage(null);
    try {
      const updates: any = {
        status: status,
        prestataire_id: prestataireId === 'null' ? null : prestataireId
      };

      // Si on assigne un prestataire alors que c'était "à attribuer", on passe automatiquement en "acceptée" si le statut n'a pas été changé manuellement
      if (updates.prestataire_id && status === InterventionStatus.A_ATTRIBUER) {
        updates.status = InterventionStatus.ACCEPTEE;
        setStatus(InterventionStatus.ACCEPTEE);
      }

      // Si on retire le prestataire, on repasse en "à attribuer"
      if (!updates.prestataire_id) {
        updates.status = InterventionStatus.A_ATTRIBUER;
        setStatus(InterventionStatus.A_ATTRIBUER);
      }

      const { error } = await supabase
        .from('interventions')
        .update(updates)
        .eq('id', id);

      if (error) throw error;
      
      // Recharger les données locales pour afficher les noms corrects (prestataire)
      const { data } = await supabase
          .from('interventions')
          .select(`*, prestataire:profiles!interventions_prestataire_id_fkey(*)`)
          .eq('id', id)
          .single();
          
      setIntervention(prev => ({...prev, ...data}));
      
      // Message de succès avec auto-hide
      setSuccessMessage("Modifications enregistrées avec succès !");
      setTimeout(() => setSuccessMessage(null), 3000);

    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      alert("Erreur lors de la sauvegarde.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 text-blue-600 animate-spin" /></div>;
  if (!intervention) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-10">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={24} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Détail Intervention</h1>
          <p className="text-gray-500 text-sm">ID: {intervention.id}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Colonne Gauche : Infos Principales */}
        <div className="md:col-span-2 space-y-6">
          
          {/* Carte Status & Dates */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-blue-600" />
              État de la mission
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value as InterventionStatus)}
                  className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <option value={InterventionStatus.A_ATTRIBUER}>À attribuer</option>
                  <option value={InterventionStatus.ACCEPTEE}>Acceptée / Planifiée</option>
                  <option value={InterventionStatus.EN_COURS}>En cours</option>
                  <option value={InterventionStatus.TERMINEE}>Terminée</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date prévue</label>
                <div className="flex items-center gap-2 p-2 bg-gray-50 border border-gray-200 rounded-lg text-gray-700">
                  <Calendar size={18} />
                  {new Date(intervention.date).toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100">
              <label className="block text-sm font-medium text-gray-700 mb-1">Prestataire assigné</label>
              <div className="flex gap-2">
                <select 
                  value={prestataireId || 'null'}
                  onChange={(e) => setPrestataireId(e.target.value === 'null' ? null : e.target.value)}
                  className="flex-1 p-2 bg-gray-50 border border-gray-200 rounded-lg"
                >
                  <option value="null">-- Non attribué --</option>
                  {prestataires.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex flex-col items-end gap-2">
              {successMessage && (
                <div className="text-green-600 text-sm font-medium flex items-center gap-1 animate-in fade-in slide-in-from-bottom-2">
                  <CheckCircle className="w-4 h-4" />
                  {successMessage}
                </div>
              )}
              <button 
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Enregistrer les modifications
              </button>
            </div>
          </div>

           {/* RAPPORT D'INTERVENTION (NOUVEAU) */}
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-orange-600" />
              Rapport de mission
            </h3>

            {rapport ? (
              <div className="space-y-4 animate-in fade-in">
                {/* Statut Dégâts */}
                <div className={`p-4 rounded-lg border flex items-start gap-3 ${
                  rapport.degats_signales 
                    ? 'bg-red-50 border-red-100 text-red-800' 
                    : 'bg-green-50 border-green-100 text-green-800'
                }`}>
                  {rapport.degats_signales ? (
                    <XCircle className="w-6 h-6 shrink-0" />
                  ) : (
                    <CheckCircle className="w-6 h-6 shrink-0" />
                  )}
                  <div>
                    <h4 className="font-bold">
                      {rapport.degats_signales ? "Dégâts ou problèmes signalés" : "Aucun dégât signalé"}
                    </h4>
                    {rapport.degats_signales && (
                      <p className="text-sm mt-1 text-red-700">{rapport.degats_description}</p>
                    )}
                    {!rapport.degats_signales && (
                       <p className="text-sm mt-1 text-green-700">Le logement a été rendu en bon état.</p>
                    )}
                  </div>
                </div>

                {/* Photos */}
                <div>
                  <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Photos de fin de mission ({rapport.photos_intervention?.length || 0})
                  </h4>
                  
                  {rapport.photos_intervention && rapport.photos_intervention.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {rapport.photos_intervention.map((photo: string, idx: number) => (
                        <a 
                          key={idx} 
                          href={photo} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block aspect-square rounded-lg overflow-hidden border border-gray-200 hover:opacity-90 transition-opacity"
                        >
                          <img 
                            src={photo} 
                            alt={`Preuve ${idx + 1}`} 
                            className="w-full h-full object-cover"
                          />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 italic bg-gray-50 p-3 rounded">
                      Aucune photo fournie.
                    </p>
                  )}
                </div>
                
                <p className="text-xs text-gray-400 pt-2 border-t border-gray-50 text-right">
                  Rapport soumis le {new Date(rapport.created_at).toLocaleString('fr-FR')}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center bg-gray-50 rounded-lg border border-dashed border-gray-200">
                <FileText className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-gray-500 font-medium">Pas encore de rapport</p>
                <p className="text-sm text-gray-400">Le prestataire remplira ce rapport à la fin de la mission.</p>
              </div>
            )}
          </div>

          {/* Carte Logement & Client */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-purple-600" />
              Lieu & Client
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="bg-white p-2 rounded shadow-sm">
                  <MapPin className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{intervention.logement?.name}</p>
                  <p className="text-sm text-gray-600">{intervention.logement?.address}</p>
                  <p className="text-sm text-gray-600">{intervention.logement?.postal_code} {intervention.logement?.city}</p>
                  {intervention.logement?.access_code && (
                    <p className="text-xs font-mono mt-1 text-blue-600 bg-blue-50 inline-block px-2 py-0.5 rounded">
                      Code: {intervention.logement.access_code}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="bg-white p-2 rounded shadow-sm">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Propriétaire</p>
                  <p className="font-medium text-gray-900">{intervention.client?.full_name}</p>
                  <p className="text-xs text-gray-500">{intervention.client?.email}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-2">Instructions Spéciales</h3>
            <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm border border-yellow-100">
              {intervention.special_instructions || "Aucune instruction particulière pour cette intervention."}
            </div>
          </div>

        </div>

        {/* Colonne Droite : Finances & Infos */}
        <div className="space-y-6">
           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-green-600" />
              Détails Financiers
            </h3>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Prix Client (TTC)</span>
                <span className="font-bold text-lg text-gray-900">{intervention.prix_client_ttc} €</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <span className="text-sm text-gray-600">Prix Prestataire (HT)</span>
                <span className="font-bold text-gray-700">{intervention.prix_prestataire_ht} €</span>
              </div>
              
              <div className="pt-4 border-t border-gray-100 text-xs text-gray-500 text-center">
                Prix fixés lors de la création de l'intervention.
              </div>
            </div>
           </div>

           <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">Détails techniques</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex justify-between">
                <span className="text-gray-500">Type</span>
                <span className="font-medium capitalize">{intervention.type}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-500">Voyageurs</span>
                <span className="font-medium">{intervention.nb_voyageurs}</span>
              </li>
              <li className="flex justify-between">
                <span className="text-gray-500">Créé le</span>
                <span className="font-medium">{new Date(intervention.created_at).toLocaleDateString()}</span>
              </li>
            </ul>
           </div>
        </div>

      </div>
    </div>
  );
};

export default AdminInterventionDetail;
