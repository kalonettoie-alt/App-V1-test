
import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserRole } from './types';
import Login from './pages/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminLogements from './pages/admin/Logements';
import AdminInterventions from './pages/admin/Interventions';
import AdminInterventionDetail from './pages/admin/InterventionDetail';
import AdminCalendar from './pages/admin/Calendar';
import AdminClients from './pages/admin/Clients';
import AdminPrestataires from './pages/admin/Prestataires';
import ClientDashboard from './pages/client/ClientDashboard';
import ProviderDashboard from './pages/provider/ProviderDashboard';
import ProviderMissions from './pages/provider/Missions';
import ProviderPlanning from './pages/provider/Planning';
import { Layout } from './components/Layout';

// Guard Component to protect routes based on roles
const ProtectedRoute = ({ children, allowedRoles }: { children?: React.ReactNode, allowedRoles: UserRole[] }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="h-screen flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard if role doesn't match
    if (user.role === UserRole.ADMIN) return <Navigate to="/admin" />;
    if (user.role === UserRole.CLIENT) return <Navigate to="/client" />;
    if (user.role === UserRole.PRESTATAIRE) return <Navigate to="/prestataire" />;
  }

  return <Layout>{children}</Layout>;
};

const AppRoutes = () => {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/" element={
        user ? (
          user.role === UserRole.ADMIN ? <Navigate to="/admin" /> :
          user.role === UserRole.CLIENT ? <Navigate to="/client" /> :
          <Navigate to="/prestataire" />
        ) : (
          <Login />
        )
      } />

      {/* Admin Routes */}
      <Route path="/admin/*" element={
        <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/clients" element={<AdminClients />} />
            <Route path="/prestataires" element={<AdminPrestataires />} />
            <Route path="/logements" element={<AdminLogements />} />
            <Route path="/interventions" element={<AdminInterventions />} />
            <Route path="/interventions/:id" element={<AdminInterventionDetail />} />
            <Route path="/calendar" element={<AdminCalendar />} />
          </Routes>
        </ProtectedRoute>
      } />

      {/* Client Routes */}
      <Route path="/client/*" element={
        <ProtectedRoute allowedRoles={[UserRole.CLIENT]}>
          <Routes>
            <Route path="/" element={<ClientDashboard />} />
            <Route path="/logements" element={<ClientDashboard />} />
            <Route path="/reservations" element={<div>Mes Réservations (À faire)</div>} />
          </Routes>
        </ProtectedRoute>
      } />

      {/* Provider Routes */}
      <Route path="/prestataire/*" element={
        <ProtectedRoute allowedRoles={[UserRole.PRESTATAIRE]}>
          <Routes>
            <Route path="/" element={<ProviderDashboard />} />
            <Route path="/missions" element={<ProviderMissions />} />
            <Route path="/planning" element={<ProviderPlanning />} />
          </Routes>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
};

export default App;
