import { useEffect, useState } from 'react';
import { Plus, MapPin, Search, Trash2, Home, User, X, Loader2, Pencil } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Profile } from '../../types';
import { toast } from 'sonner';

// Type étendu pour l'affichage
interface LogementWithClient {
  id: string;
  name: string;
  address: string;
  city: string;
  postal_code: string;
  access_code: string;
  instructions: string;
  client_id: string;
  client: { full_name: string } | null;
}

const AdminLogements = () => {
  const [logements, setLogements] = useState<LogementWithClient[]>([]);
  const [clients, setClients] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // État pour l'édition
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // État pour la recherche
  const [searchTerm, setSearchTerm] = useState('');

  // Form State
  const initialFormState = {
    name: '',
    address: '',
    city: '',
    postal_code: '',
    access_code: '',
    instructions: '',
    client_id: ''
  };
  const [formData, setFormData] = useState(initialFormState);

  // Charger les données
  const fetchData = async () => {
    try {
      setLoading(true);
      
      // 1. Récupérer les logements avec le nom du client
      const { data: logementsData, error: logError } = await supabase
        .from('logements')
        .select('*, client:profiles(full_name)')
        .order('created_at', { ascending: false });

      if (logError) throw logError;

      // 2. Récupérer la liste des clients pour le formulaire d'ajout
      const { data: clientsData, error: cliError } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('full_name');

      if (cliError) throw cliError;

      setLogements(logementsData || []);
      setClients(clientsData || []);
    } catch (error) {
      console.error('Erreur chargement:', error);
      toast.error('Erreur chargement des données');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtrage des logements en fonction de la recherche
  const filteredLogements = logements.filter(logement => {
    const term = searchTerm.toLowerCase();
    const logementName = logement.name.toLowerCase();
    const clientName = logement.client?.full_name.toLowerCase() || '';
    const city = logement.city.toLowerCase();
    
    return logementName.includes(term) || clientName.includes(term) || city.includes(term);
  });

  // Préparer l'édition
  const handleEdit = (logement: LogementWithClient) => {
    setEditingId(logement.id);
    setFormData({
      name: logement.name,
      address: logement.address,
      city: logement.city,
      postal_code: logement.postal_code,
      access_code: logement.access_code || '',
      instructions: logement.instructions || '',
      client_id: logement.client_id
    });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(initialFormState);
  };

  // Gestion Soumission (Ajout ou Modification)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error("Veuillez sélectionner un client propriétaire.");
      return;
    }
    
    setSubmitting(true);
    try {
      if (editingId) {
        // MODE MODIFICATION
        const { error } = await supabase
          .from('logements')
          .update(formData)
          .eq('id', editingId);
        
        if (error) throw error;
        toast.success("Logement modifié avec succès");
      } else {
        // MODE CRÉATION
        const { error } = await supabase
          .from('logements')
          .insert([formData]);

        if (error) throw error;
        toast.success("Logement créé avec succès");
      }

      // Reset et rechargement
      handleCloseModal();
      await fetchData();
    } catch (error: any) {
      console.error("Erreur sauvegarde:", error);
      toast.error("Erreur lors de la sauvegarde: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  // Gestion Suppression
  const handleDelete = async (id: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer ce logement ? Toutes les interventions liées seront supprimées.")) return;

    try {
      const { error } = await supabase.from('logements').delete().eq('id', id);
      if (error) throw error;
      setLogements(prev => prev.filter(l => l.id !== id));
      toast.success("Logement supprimé");
    } catch (error) {
      console.error("Erreur suppression:", error);
      toast.error("Impossible de supprimer le logement");
    }
  };

  if (loading) return <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" /></div>;

  return (
    <div className="space-y-6">
      {/* En-tête et Barre d'action */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Logements</h2>
          <p className="text-gray-500">{filteredLogements.length} biens trouvés</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          {/* Barre de recherche */}
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Rechercher (nom, client, ville)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 h-10 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Bouton Ajout */}
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 h-10 rounded-lg font-medium flex items-center justify-center gap-2 transition-colors shadow-sm whitespace-nowrap"
          >
            <Plus size={20} />
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste des logements */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLogements.map((logement) => (
          <div key={logement.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow relative group">
            <div className="p-5">
              <div className="flex justify-between items-start mb-3">
                <div className="bg-blue-50 p-2 rounded-lg">
                  <Home className="w-6 h-6 text-blue-600" />
                </div>
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleEdit(logement)}
                    className="text-gray-400 hover:text-blue-600 p-1 transition-colors"
                    title="Modifier"
                  >
                    <Pencil size={18} />
                  </button>
                  <button 
                    onClick={() => handleDelete(logement.id)}
                    className="text-gray-400 hover:text-red-600 p-1 transition-colors"
                    title="Supprimer"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              <h3 className="font-bold text-gray-900 text-lg mb-1">{logement.name}</h3>
              
              <div className="space-y-2 text-sm text-gray-600 mt-4">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-gray-400 shrink-0" />
                  <span>{logement.address}<br/>{logement.postal_code} {logement.city}</span>
                </div>
                <div className="flex items-center gap-2 pt-2 border-t border-gray-50 mt-3">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-900 font-medium">{logement.client?.full_name || 'Sans propriétaire'}</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-5 py-3 border-t border-gray-100 flex justify-between items-center text-xs text-gray-500">
              <span>Code: {logement.access_code || 'Non défini'}</span>
            </div>
          </div>
        ))}
      </div>

      {filteredLogements.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
          {searchTerm ? (
            <>
               <Search className="w-12 h-12 text-gray-300 mx-auto mb-3" />
               <h3 className="text-gray-900 font-medium">Aucun résultat</h3>
               <p className="text-gray-500 text-sm">Essayez une autre recherche.</p>
            </>
          ) : (
            <>
              <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-gray-900 font-medium">Aucun logement</h3>
              <p className="text-gray-500 text-sm">Ajoutez le premier bien pour commencer.</p>
            </>
          )}
        </div>
      )}

      {/* Modal d'ajout / Modification */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-gray-900">
                {editingId ? 'Modifier Logement' : 'Nouveau Logement'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                <X size={24} />
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Sélection Client */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Propriétaire (Client)</label>
                <select 
                  required
                  value={formData.client_id}
                  onChange={e => setFormData({...formData, client_id: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Sélectionner un client...</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.full_name} ({client.email})</option>
                  ))}
                </select>
                {clients.length === 0 && (
                  <p className="text-xs text-orange-600 mt-1">Aucun client trouvé. Créez d'abord un compte client.</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom du logement</label>
                <input 
                  type="text" 
                  required
                  placeholder="ex: Appartement Montmartre"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adresse</label>
                <input 
                  type="text" 
                  required
                  placeholder="12 rue de la Paix"
                  value={formData.address}
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Code Postal</label>
                  <input 
                    type="text" 
                    required
                    placeholder="75000"
                    value={formData.postal_code}
                    onChange={e => setFormData({...formData, postal_code: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ville</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Paris"
                    value={formData.city}
                    onChange={e => setFormData({...formData, city: e.target.value})}
                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Codes d'accès</label>
                <input 
                  type="text" 
                  placeholder="Digicode, Boîte à clé..."
                  value={formData.access_code}
                  onChange={e => setFormData({...formData, access_code: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instructions spéciales</label>
                <textarea 
                  rows={3}
                  placeholder="Instructions pour le ménage..."
                  value={formData.instructions}
                  onChange={e => setFormData({...formData, instructions: e.target.value})}
                  className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={handleCloseModal}
                  className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Annuler
                </button>
                <button 
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {submitting 
                    ? 'Sauvegarde...' 
                    : editingId ? 'Modifier' : 'Créer le logement'
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogements;