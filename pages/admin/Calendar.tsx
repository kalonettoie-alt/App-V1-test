
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon, Filter, Home, User, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { InterventionStatus } from '../../types';

const AdminCalendar = () => {
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [interventions, setInterventions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // États pour les filtres
  const [prestataires, setPrestataires] = useState<any[]>([]);
  const [logements, setLogements] = useState<any[]>([]);
  const [selectedPrestataire, setSelectedPrestataire] = useState('');
  const [selectedLogement, setSelectedLogement] = useState('');

  // Calcul des dates pour l'affichage
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 = Dimanche, 1 = Lundi...
  
  // Ajustement pour commencer la semaine le Lundi (standard français)
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  // Charger les options de filtres (Logements et Prestataires)
  useEffect(() => {
    const fetchFilters = async () => {
      const { data: prests } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'prestataire')
        .order('full_name');
      
      const { data: logs } = await supabase
        .from('logements')
        .select('id, name')
        .order('name');

      setPrestataires(prests || []);
      setLogements(logs || []);
    };
    fetchFilters();
  }, []);

  const fetchInterventions = async () => {
    setLoading(true);
    try {
      // Calculer la plage de dates (début du mois à fin du mois)
      const startDate = new Date(year, month, 1).toISOString().split('T')[0];
      const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('interventions')
        .select(`
          id,
          date,
          status,
          type,
          logement_id,
          prestataire_id,
          logement:logements(name, city),
          prestataire:profiles!interventions_prestataire_id_fkey(full_name)
        `)
        .gte('date', startDate)
        .lte('date', endDate);

      if (error) throw error;
      setInterventions(data || []);
    } catch (error) {
      console.error("Erreur chargement calendrier:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInterventions();
  }, [currentDate]);

  // Navigation Mois
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Filtrage des interventions
  const filteredInterventions = interventions.filter(i => {
    const matchPrestataire = selectedPrestataire ? i.prestataire_id === selectedPrestataire : true;
    const matchLogement = selectedLogement ? i.logement_id === selectedLogement : true;
    return matchPrestataire && matchLogement;
  });

  // Helpers
  const getInterventionsForDay = (day: number) => {
    // Format YYYY-MM-DD correct en tenant compte des mois 0-indexés
    // Astuce: on utilise le string directement pour éviter les soucis de timezone
    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
    
    return filteredInterventions.filter(i => i.date === dateStr);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case InterventionStatus.A_ATTRIBUER: return 'bg-red-100 text-red-700 border-red-200';
      case InterventionStatus.ACCEPTEE: return 'bg-blue-100 text-blue-700 border-blue-200';
      case InterventionStatus.EN_COURS: return 'bg-amber-100 text-amber-700 border-amber-200';
      case InterventionStatus.TERMINEE: return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const resetFilters = () => {
    setSelectedLogement('');
    setSelectedPrestataire('');
  };

  // Navigation vers la liste filtrée par date lors du clic sur une case
  const handleDayClick = (day: number) => {
    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
    
    navigate(`/admin/interventions?date=${dateStr}`);
  };

  return (
    <div className="space-y-4 md:space-y-6 h-[calc(100vh-140px)] flex flex-col">
      {/* Header du Calendrier */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
            Calendrier
          </h2>
          <p className="text-xs md:text-sm text-gray-500">Planification globale</p>
        </div>

        {/* Contrôles de navigation Mois */}
        <div className="flex items-center bg-white p-1 rounded-lg shadow-sm border border-gray-200 self-center lg:self-auto w-full md:w-auto justify-between md:justify-start order-last lg:order-none">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="px-4 font-bold text-base md:text-lg md:w-40 text-center whitespace-nowrap">
            {monthNames[month]} {year}
          </div>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
        
        <button 
          onClick={goToToday}
          className="text-sm font-medium text-blue-600 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors hidden md:block"
        >
          Aujourd'hui
        </button>
      </div>

      {/* Barre de Filtres */}
      <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-3 items-center">
        <div className="flex items-center gap-2 text-gray-500 text-sm font-medium md:mr-2 w-full md:w-auto">
            <Filter className="w-4 h-4" />
            <span className="md:hidden">Filtres</span>
        </div>

        <div className="relative w-full md:w-64">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select 
                value={selectedPrestataire}
                onChange={(e) => setSelectedPrestataire(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Tous les prestataires</option>
                <option value="null">Non attribué</option>
                {prestataires.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                ))}
            </select>
        </div>

        <div className="relative w-full md:w-64">
            <Home className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select 
                value={selectedLogement}
                onChange={(e) => setSelectedLogement(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
                <option value="">Tous les logements</option>
                {logements.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                ))}
            </select>
        </div>

        {(selectedLogement || selectedPrestataire) && (
            <button 
                onClick={resetFilters}
                className="text-sm text-red-600 hover:text-red-700 flex items-center gap-1 px-3 py-2 hover:bg-red-50 rounded-lg transition-colors ml-auto md:ml-0"
            >
                <X className="w-4 h-4" />
                Effacer
            </button>
        )}
      </div>

      {/* VUE GRILLE (UNIFIÉE MOBILE & DESKTOP) */}
      <div className="flex flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex-col overflow-hidden">
        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="py-2 md:py-3 text-center text-[10px] md:text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {day.slice(0, 1)}<span className="hidden md:inline">{day.slice(1)}</span>
            </div>
          ))}
        </div>

        {/* Jours du mois */}
        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px border-b border-gray-200 overflow-y-auto">
            {/* Cellules vides avant le 1er du mois */}
            {Array.from({ length: startingDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-white min-h-[80px] md:min-h-[100px] bg-gray-50/50" />
            ))}

            {/* Cellules des jours */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayInterventions = getInterventionsForDay(day);
              const isToday = 
                new Date().getDate() === day && 
                new Date().getMonth() === month && 
                new Date().getFullYear() === year;

              return (
                <div 
                    key={day} 
                    onClick={() => handleDayClick(day)}
                    className={`bg-white p-1 md:p-2 min-h-[80px] md:min-h-[100px] relative group transition-colors hover:bg-blue-50/30 cursor-pointer`}
                    title="Cliquez pour voir le détail de la journée"
                >
                  <span className={`
                    text-[10px] md:text-sm font-medium w-5 h-5 md:w-7 md:h-7 flex items-center justify-center rounded-full mb-1
                    ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}
                  `}>
                    {day}
                  </span>
                  
                  <div className="space-y-1 max-h-[70px] md:max-h-[100px] overflow-y-auto custom-scrollbar">
                    {dayInterventions.map(int => (
                      <div
                        key={int.id}
                        className={`w-full text-left text-[9px] md:text-xs p-1 md:p-1.5 rounded border truncate flex items-center gap-1 ${getStatusColor(int.status)}`}
                        title={`${int.logement?.name} - ${int.prestataire?.full_name || 'Non attribué'}`}
                      >
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          int.status === InterventionStatus.A_ATTRIBUER ? 'bg-red-500' :
                          int.status === InterventionStatus.ACCEPTEE ? 'bg-blue-500' :
                          int.status === InterventionStatus.EN_COURS ? 'bg-amber-500' : 'bg-green-500'
                        }`} />
                        <span className="truncate font-medium leading-tight">{int.logement?.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {/* Cellules vides après la fin du mois */}
            {Array.from({ length: 42 - (daysInMonth + startingDayIndex) }).map((_, i) => (
              <div key={`end-empty-${i}`} className="bg-gray-50/50 min-h-[80px] md:min-h-[100px]" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCalendar;
