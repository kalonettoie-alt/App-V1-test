import React, { useEffect, useState } from 'react';
import { MapPin, Plus, Loader2, Home } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { Logement } from '../../types';

const ClientDashboard = () => {
  const { user } = useAuth();
  const [logements, setLogements] = useState<Logement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogements = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('logements')
          .select('*')
          .eq('client_id', user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;
        setLogements(data || []);
      } catch (error) {
        console.error('Erreur chargement logements:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogements();
  }, [user]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Mes Biens</h2>
          <p className="text-gray-500">Gérez vos logements et demandes</p>
        </div>
        <button className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full md:px-4 md:py-2 md:rounded-lg flex items-center shadow-lg md:shadow-sm transition-colors">
          <Plus className="w-6 h-6 md:w-5 md:h-5 md:mr-2" />
          <span className="hidden md:inline">Ajouter</span>
        </button>
      </div>

      {logements.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Home className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">Aucun logement</h3>
          <p className="text-gray-500 mt-1 mb-6">Commencez par ajouter votre premier bien immobilier.</p>
          <button className="text-blue-600 font-medium hover:text-blue-700">
            + Ajouter un logement manuellement
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {logements.map((logement) => (
            <div key={logement.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-shadow">
              <div className="h-48 overflow-hidden relative bg-gray-100 flex items-center justify-center">
                {logement.photos && logement.photos.length > 0 ? (
                  <img 
                    src={logement.photos[0]} 
                    alt={logement.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <Home className="w-12 h-12 text-gray-300" />
                )}
              </div>
              <div className="p-5">
                <h3 className="font-bold text-gray-900 text-lg mb-1">{logement.name}</h3>
                <div className="flex items-start text-gray-500 text-sm mb-4">
                  <MapPin className="w-4 h-4 mr-1 mt-0.5 flex-shrink-0" />
                  {logement.address}, {logement.postal_code} {logement.city}
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium transition-colors border border-gray-200">
                    Détails
                  </button>
                  <button className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 rounded-lg text-sm font-medium transition-colors border border-blue-100">
                    Réserver
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientDashboard;