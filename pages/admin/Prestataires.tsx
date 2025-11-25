import { useEffect, useState } from 'react';
import { HardHat, Search, Loader2, Mail, Phone, Building, Edit, Save, X, TrendingUp, CheckCircle, Eye, Euro } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { InterventionStatus } from '../../types';

const AdminPrestataires = () => {
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // État d'édition rapide
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ full_name: '', phone: '', company_name: '' });
  const [saving, setSaving] = useState(false);

  // État pour la Modale de détail
  const [selectedPrestataire, setSelectedPrestataire] = useState<any | null>(null);

  const fetchPrestataires = async () => {
    setLoading(true);
    try {
      // ✅ UNE SEULE REQUÊTE avec jointure pour éviter le N+1
      const { data: prestData, error } = await supabase
        .from('profiles')
        .select(`
          *,
          interventions:interventions(
            id,
            status,
            prix_prestataire_ht
          )
        `)
        .eq('role', 'prestataire')
        .order('full_name', { ascending: true });

      if (error) throw error;

      const enrichedData = (prestData || []).map((p: any) => {
        const myInterventions = p.interventions || [];
        const totalMissions = myInterventions.length;
        const completedMissions = myInterventions.filter((i: any) => i.status === InterventionStatus.TERMINEE).length;
        
        const revenue = myInterventions
          .filter((i: any) => i.status === InterventionStatus.TERMINEE)
          .reduce((sum: number, i: any) => sum + (i.prix_prestataire_ht || 0), 0);

        return {
          ...p,
          stats: { totalMissions, completedMissions, revenue }
        };
      });

      setPrestataires(enrichedData);
    } catch (error: any) {
      console.error('Erreur chargement prestataires:', error.message || error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrestataires();
  }, []);

  const filteredPrestataires = prestataires.filter(p => 
    p.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.company_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- Gestion Edition Rapide ---
  const handleEdit = (e: React.MouseEvent, prestataire: any) => {
    e.stopPropagation(); // Empêcher l'ouverture de la modale
    setEditingId(prestataire.id);
    setEditFormData({
      full_name: prestataire.full_name,
      phone: prestataire.phone || '',
      company_name: prestataire.company_name || ''
    });
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!editingId) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(editFormData)
        .eq('id', editingId);

      if (error) throw error;

      // Mise à jour locale optimiste
      setPrestataires(prestataires.map(p => p.id === editingId ? { ...p, ...editFormData } : p));
      setEditingId(null);
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error.message || error);
      alert("Erreur lors de la modification : " + (error.message || "Erreur inconnue"));
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <HardHat className="text-orange-600" />
            Gestion des Prestataires
          </h2>
          <p className="text-gray-500">{filteredPrestataires.length} prestataires actifs</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher (nom, entreprise)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 h-10 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPrestataires.map(p => (
          <div 
            key={p.id} 
            onClick={() => !editingId && setSelectedPrestataire(p)}
            className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all border-l-4 border-l-orange-400 cursor-pointer group ${editingId === p.id ? 'ring-2 ring-blue-500' : ''}`}
          >
            {/* Header Carte */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3 w-full">
                <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center font-bold text-xl shrink-0 group-hover:scale-110 transition-transform">
                  {p.full_name?.charAt(0).toUpperCase() || 'P'}
                </div>
                <div className="w-full min-w-0 pr-2">
                   {editingId === p.id ? (
                     <div className="space-y-1" onClick={e => e.stopPropagation()}>
                        <input 
                            type="text" 
                            value={editFormData.full_name}
                            onChange={e => setEditFormData({...editFormData, full_name: e.target.value})}
                            className="border rounded px-2 py-1 text-sm w-full font-bold"
                            placeholder="Nom"
                            autoFocus
                        />
                        <input 
                            type="text" 
                            value={editFormData.company_name}
                            onChange={e => setEditFormData({...editFormData, company_name: e.target.value})}
                            className="border rounded px-2 py-1 text-xs w-full"
                            placeholder="Entreprise"
                        />
                     </div>
                   ) : (
                     <>
                        <h3 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{p.full_name}</h3>
                        {p.company_name && (
                            <div className="flex items-center gap-1 text-xs text-orange-600 font-medium">
                                <Building size={12} />
                                <span className="truncate">{p.company_name}</span>
                            </div>
                        )}
                     </>
                   )}
                </div>
              </div>
              
              <div className="shrink-0">
                {editingId === p.id ? (
                    <div className="flex gap-1 flex-col sm:flex-row">
                    <button onClick={handleSave} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Save size={18} />
                    </button>
                    <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <X size={18} />
                    </button>
                    </div>
                ) : (
                    <button onClick={(e) => handleEdit(e, p)} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit size={18} />
                    </button>
                )}
              </div>
            </div>

            {/* Stats Rapides */}
            <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 p-2 rounded-lg text-center">
                    <p className="text-xs text-gray-500 uppercase">Missions</p>
                    <p className="font-bold text-gray-900">{p.stats.totalMissions}</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg text-center">
                    <p className="text-xs text-gray-500 uppercase">CA Généré</p>
                    <p className="font-bold text-green-600">{p.stats.revenue}€</p>
                </div>
            </div>

            {/* Footer Carte */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                <span className="text-xs text-gray-400 truncate max-w-[150px]">{p.email}</span>
                <button className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline">
                    <Eye size={14} />
                    Voir fiche
                </button>
            </div>
          </div>
        ))}
        
        {filteredPrestataires.length === 0 && (
          <div className="col-span-full text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-gray-500">Aucun prestataire trouvé.</p>
          </div>
        )}
      </div>

      {/* MODAL DÉTAIL PRESTATAIRE */}
      {selectedPrestataire && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                {/* Header Modal */}
                <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 text-white relative">
                    <button 
                        onClick={() => setSelectedPrestataire(null)}
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white text-orange-600 rounded-full flex items-center justify-center font-bold text-3xl shadow-lg">
                            {selectedPrestataire.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{selectedPrestataire.full_name}</h2>
                            <div className="flex items-center gap-2 text-orange-100 text-sm">
                                <Building size={14} />
                                <span>{selectedPrestataire.company_name || 'Indépendant'}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6">
                    {/* Section Statistiques */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Performances</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 text-center">
                                <Euro className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-gray-900">{selectedPrestataire.stats.revenue}€</div>
                                <div className="text-xs text-orange-600 font-medium">Revenus HT</div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                                <TrendingUp className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-gray-900">{selectedPrestataire.stats.totalMissions}</div>
                                <div className="text-xs text-blue-600 font-medium">Missions Total</div>
                            </div>
                            <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                                <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2" />
                                <div className="text-2xl font-bold text-gray-900">{selectedPrestataire.stats.completedMissions}</div>
                                <div className="text-xs text-green-600 font-medium">Terminées</div>
                            </div>
                        </div>
                    </div>

                    {/* Section Contact */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Coordonnées</h3>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-full shadow-sm">
                                        <Mail className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Email</p>
                                        <p className="font-medium text-gray-900 text-sm">{selectedPrestataire.email}</p>
                                    </div>
                                </div>
                                <a href={`mailto:${selectedPrestataire.email}`} className="text-blue-600 hover:underline text-sm font-medium">
                                    Envoyer
                                </a>
                            </div>

                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <div className="flex items-center gap-3">
                                    <div className="bg-white p-2 rounded-full shadow-sm">
                                        <Phone className="w-5 h-5 text-gray-500" />
                                    </div>
                                    <div>
                                        <p className="text-xs text-gray-500">Téléphone</p>
                                        <p className="font-medium text-gray-900 text-sm">{selectedPrestataire.phone || 'Non renseigné'}</p>
                                    </div>
                                </div>
                                {selectedPrestataire.phone && (
                                    <a href={`tel:${selectedPrestataire.phone}`} className="text-blue-600 hover:underline text-sm font-medium">
                                        Appeler
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setSelectedPrestataire(null)}
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

export default AdminPrestataires;