import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { InterventionStatus } from '../../types';

const ProviderPlanning = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [missions, setMissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startingDayIndex = firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1;

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  useEffect(() => {
    let isMounted = true;

    const fetchMissions = async () => {
      if (!user?.id) return;

      try {
        if (isMounted) setLoading(true);
        const startDate = new Date(year, month, 1).toISOString().split('T')[0];
        const endDate = new Date(year, month + 1, 0).toISOString().split('T')[0];

        // 1. Interventions
        const { data: interventions, error: intError } = await supabase
          .from('interventions')
          .select('id, date, status, type, logement_id')
          .eq('prestataire_id', user.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (intError) throw intError;
        
        let enrichedData = interventions || [];

        // 2. Logements
        if (enrichedData.length > 0) {
            const logementIds = [...new Set(enrichedData.map((i: any) => i.logement_id))].filter(Boolean);
            
            if (logementIds.length > 0) {
              const { data: logements, error: logError } = await supabase
                  .from('logements')
                  .select('id, name, city, address')
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
        console.error("Erreur chargement planning:", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchMissions();

    return () => { isMounted = false; };
  }, [user?.id, year, month]);

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const getMissionsForDay = (day: number) => {
    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
    return missions.filter(m => m.date === dateStr);
  };

  const handleDayClick = (day: number) => {
    const paddedMonth = String(month + 1).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const dateStr = `${year}-${paddedMonth}-${paddedDay}`;
    navigate(`/prestataire/missions?date=${dateStr}`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case InterventionStatus.ACCEPTEE: return 'bg-blue-100 text-blue-700 border-blue-200';
      case InterventionStatus.EN_COURS: return 'bg-amber-100 text-amber-700 border-amber-200';
      case InterventionStatus.TERMINEE: return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-4 h-[calc(100vh-140px)] flex flex-col">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-blue-600" />
            Mon Agenda
          </h2>
        </div>
        <button 
          onClick={goToToday}
          className="text-sm font-medium text-blue-600 hover:bg-blue-50 px-3 py-1 rounded-lg transition-colors"
        >
          Aujourd'hui
        </button>
      </div>

      <div className="flex items-center bg-white p-1 rounded-lg shadow-sm border border-gray-200 justify-between">
        <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div className="font-bold text-lg text-gray-800">
          {monthNames[month]} {year}
        </div>
        <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded-md transition-colors">
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex flex-1 bg-white rounded-xl shadow-sm border border-gray-200 flex-col overflow-hidden">
        <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
          {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map(day => (
            <div key={day} className="py-2 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex-1 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        ) : (
          <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-gray-200 gap-px border-b border-gray-200 overflow-y-auto">
            {Array.from({ length: startingDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="bg-gray-50/50 min-h-[80px]" />
            ))}

            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dayMissions = getMissionsForDay(day);
              const isToday = 
                new Date().getDate() === day && 
                new Date().getMonth() === month && 
                new Date().getFullYear() === year;

              return (
                <div 
                    key={day} 
                    onClick={() => handleDayClick(day)}
                    className={`bg-white p-1 min-h-[80px] relative group transition-colors hover:bg-blue-50/30 cursor-pointer`}
                >
                  <div className="flex justify-center mb-1">
                    <span className={`
                        text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                        ${isToday ? 'bg-blue-600 text-white shadow-md' : 'text-gray-700'}
                    `}>
                        {day}
                    </span>
                  </div>
                  
                  <div className="space-y-1 max-h-[80px] overflow-y-auto custom-scrollbar">
                    {dayMissions.map(m => (
                      <div
                        key={m.id}
                        className={`w-full text-left text-[9px] p-1 rounded border truncate ${getStatusColor(m.status)}`}
                      >
                        {m.logement?.city}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {Array.from({ length: 42 - (daysInMonth + startingDayIndex) }).map((_, i) => (
              <div key={`end-empty-${i}`} className="bg-gray-50/50 min-h-[80px]" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderPlanning;