
import React, { useEffect, useState } from 'react';
import { Users, Search, Loader2, Mail, Phone, MapPin, Edit, Save, X, TrendingUp, Home, Euro, Eye } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { InterventionStatus } from '../../types';

const AdminClients = () => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // État d'édition rapide
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({ full_name: '', phone: '' });
  const [saving, setSaving] = useState(false);

  // État pour la Modale de détail
  const [selectedClient, setSelectedClient] = useState<any | null>(null);

  const fetchClients = async () => {
    setLoading(true);
    try {
      // ÉTAPE 1 : Récupérer les profils Clients
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('full_name', { ascending: true });

      if (profilesError) throw profilesError;

      // ÉTAPE 2 : Récupérer tous les logements
      const { data: logementsData, error: logError } = await supabase
        .from('logements')
        .select('*');
        
      if (logError) throw logError;

      // ÉTAPE 3 : Récupérer les interventions (pour le financier)
      const { data: interventionsData, error: intError } = await supabase
        .from('interventions')
        .select('client_id, prix_client_ttc, status');

      if (intError) throw intError;

      const allLogements = logementsData || [];
      const allInterventions = interventionsData || [];

      // ÉTAPE 4 : Enrichissement des données
      const enrichedData = (profilesData || []).map(c => {
        // Logements du client
        const myLogements = allLogements.filter((l: any) => l.client_id === c.id);
        
        // Interventions du client
        const myInterventions = allInterventions.filter((i: any) => i.client_id === c.id);
        
        // Calcul Total Dépensé (Uniquement sur interventions terminées ou acceptées)
        const totalSpent = myInterventions
          .filter((i: any) => i.status !== InterventionStatus.A_ATTRIBUER)
          .reduce((sum: number, i: any) => sum + (i.prix_client_ttc || 0), 0);

        return {
          ...c,
          logements: myLogements,
          stats: {
            countLogements: myLogements.length,
            countInterventions: myInterventions.length,
            totalSpent
          }
        };
      });

      setClients(enrichedData);
    } catch (error) {
      console.error('Erreur chargement clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredClients = clients.filter(c => 
    c.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone?.includes(searchTerm)
  );

  // --- Gestion Edition Rapide ---
  const handleEdit = (e: React.MouseEvent, client: any) => {
    e.stopPropagation();
    setEditingId(client.id);
    setEditFormData({
      full_name: client.full_name,
      phone: client.phone || ''
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

      // Mise à jour locale
      setClients(clients.map(c => c.id === editingId ? { ...c, ...editFormData } : c));
      setEditingId(null);
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert("Erreur lors de la modification");
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
            <Users className="text-blue-600" />
            Gestion des Clients
          </h2>
          <p className="text-gray-500">{filteredClients.length} clients enregistrés</p>
        </div>

        <div className="relative w-full md:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Rechercher (nom, email)..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 h-10 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map(client => (
          <div 
            key={client.id} 
            onClick={() => !editingId && setSelectedClient(client)}
            className={`bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all border-l-4 border-l-blue-500 cursor-pointer group ${editingId === client.id ? 'ring-2 ring-blue-500' : ''}`}
          >
            {/* Header Carte */}
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3 w-full">
                <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xl shrink-0 group-hover:scale-110 transition-transform">
                  {client.full_name?.charAt(0).toUpperCase() || 'C'}
                </div>
                <div className="w-full min-w-0 pr-2">
                   {editingId === client.id ? (
                     <div className="space-y-1" onClick={e => e.stopPropagation()}>
                        <input 
                            type="text" 
                            value={editFormData.full_name}
                            onChange={e => setEditFormData({...editFormData, full_name: e.target.value})}
                            className="border rounded px-2 py-1 text-sm w-full font-bold"
                            autoFocus
                        />
                        <input 
                            type="text" 
                            value={editFormData.phone}
                            onChange={e => setEditFormData({...editFormData, phone: e.target.value})}
                            className="border rounded px-2 py-1 text-xs w-full"
                            placeholder="Téléphone"
                        />
                     </div>
                   ) : (
                     <>
                        <h3 className="font-bold text-gray-900 truncate group-hover:text-blue-600 transition-colors">{client.full_name}</h3>
                        <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                            <Home size={12} />
                            <span>{client.stats.countLogements} biens</span>
                        </div>
                     </>
                   )}
                </div>
              </div>
              
              <div className="shrink-0">
                {editingId === client.id ? (
                    <div className="flex gap-1 flex-col sm:flex-row">
                    <button onClick={handleSave} disabled={saving} className="p-1 text-green-600 hover:bg-green-50 rounded">
                        <Save size={18} />
                    </button>
                    <button onClick={handleCancel} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <X size={18} />
                    </button>
                    </div>
                ) : (
                    <button onClick={(e) => handleEdit(e, client)} className="p-1 text-gray-400 hover:text-blue-600 rounded hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Edit size={18} />
                    </button>
                )}
              </div>
            </div>

             {/* Stats Rapides */}
             <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="bg-gray-50 p-2 rounded-lg text-center">
                    <p className="text-xs text-gray-500 uppercase">Total Facturé</p>
                    <p className="font-bold text-gray-900">{client.stats.totalSpent}€</p>
                </div>
                <div className="bg-gray-50 p-2 rounded-lg text-center">
                    <p className="text-xs text-gray-500 uppercase">Interventions</p>
                    <p className="font-bold text-blue-600">{client.stats.countInterventions}</p>
                </div>
            </div>

            {/* Footer Carte */}
            <div className="flex justify-between items-center pt-2 border-t border-gray-50">
                <span className="text-xs text-gray-400 truncate max-w-[150px]">{client.email}</span>
                <button className="text-xs font-medium text-blue-600 flex items-center gap-1 hover:underline">
                    <Eye size={14} />
                    Voir détails
                </button>
            </div>
          </div>
        ))}
        
        {filteredClients.length === 0 && (
          <div className="col-span-full text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-200">
            <p className="text-gray-500">Aucun client trouvé.</p>
          </div>
        )}
      </div>

      {/* MODAL DÉTAIL CLIENT */}
      {selectedClient && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col">
                {/* Header Modal */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative shrink-0">
                    <button 
                        onClick={() => setSelectedClient(null)}
                        className="absolute top-4 right-4 text-white/80 hover:text-white p-1 hover:bg-white/20 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold text-3xl shadow-lg">
                            {selectedClient.full_name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold">{selectedClient.full_name}</h2>
                            <p className="text-blue-100 text-sm">Client depuis {new Date(selectedClient.created_at).toLocaleDateString()}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-6 overflow-y-auto">
                    {/* Section Statistiques */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Activités & Finances</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                                <Euro className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                                <div className="text-xl font-bold text-gray-900">{selectedClient.stats.totalSpent}€</div>
                                <div className="text-xs text-blue-600 font-medium">Total Payé</div>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 text-center">
                                <Home className="w-6 h-6 text-indigo-500 mx-auto mb-2" />
                                <div className="text-xl font-bold text-gray-900">{selectedClient.stats.countLogements}</div>
                                <div className="text-xs text-indigo-600 font-medium">Biens</div>
                            </div>
                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center">
                                <TrendingUp className="w-6 h-6 text-purple-500 mx-auto mb-2" />
                                <div className="text-xl font-bold text-gray-900">{selectedClient.stats.countInterventions}</div>
                                <div className="text-xs text-purple-600 font-medium">Interventions</div>
                            </div>
                        </div>
                    </div>

                    {/* Section Logements */}
                    <div>
                        <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-3">Biens Immobiliers ({selectedClient.logements.length})</h3>
                        {selectedClient.logements.length > 0 ? (
                            <div className="space-y-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                {selectedClient.logements.map((l: any) => (
                                    <div key={l.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                                        <MapPin className="w-4 h-4 text-gray-400 mt-1 shrink-0" />
                                        <div>
                                            <p className="text-sm font-bold text-gray-900">{l.name}</p>
                                            <p className="text-xs text-gray-500">{l.address}, {l.city}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">Aucun bien enregistré.</p>
                        )}
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
                                    <div className="min-w-0">
                                        <p className="text-xs text-gray-500">Email</p>
                                        <p className="font-medium text-gray-900 text-sm truncate max-w-[200px]">{selectedClient.email}</p>
                                    </div>
                                </div>
                                <a href={`mailto:${selectedClient.email}`} className="text-blue-600 hover:underline text-sm font-medium">
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
                                        <p className="font-medium text-gray-900 text-sm">{selectedClient.phone || 'Non renseigné'}</p>
                                    </div>
                                </div>
                                {selectedClient.phone && (
                                    <a href={`tel:${selectedClient.phone}`} className="text-blue-600 hover:underline text-sm font-medium">
                                        Appeler
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                    
                    <button 
                        onClick={() => setSelectedClient(null)}
                        className="w-full bg-gray-100 text-gray-700 font-medium py-3 rounded-xl hover:bg-gray-200 transition-colors mt-2"
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

export default AdminClients;
