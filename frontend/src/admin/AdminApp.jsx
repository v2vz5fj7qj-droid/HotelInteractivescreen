import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import AdminLogin           from './AdminLogin';
import AdminLayout          from './AdminLayout';
import Dashboard            from './pages/Dashboard';
import WellnessManager      from './pages/WellnessManager';
import EventsManager        from './pages/EventsManager';
import NotificationsManager from './pages/NotificationsManager';
import POIManager           from './pages/POIManager';
import ThemeManager         from './pages/ThemeManager';
import InfosManager         from './pages/InfosManager';
import LocalitiesManager    from './pages/LocalitiesManager';
import FlightsManager       from './pages/FlightsManager';
import CategoriesManager    from './pages/CategoriesManager';

/* ── Guard : redirige vers /admin/login si non authentifié ── */
function RequireAuth({ children }) {
  const token    = sessionStorage.getItem('admin_token');
  const location = useLocation();
  if (!token) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  return children;
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login" element={<AdminLogin />} />

      {/* Toutes les routes protégées partagent AdminLayout */}
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index              element={<Dashboard />} />
        <Route path="wellness"      element={<WellnessManager />} />
        <Route path="events"        element={<EventsManager />} />
        <Route path="notifications" element={<NotificationsManager />} />
        <Route path="map"           element={<POIManager />} />
        <Route path="info"          element={<InfosManager />} />
        <Route path="localities"    element={<LocalitiesManager />} />
        <Route path="flights"       element={<FlightsManager />} />
        <Route path="categories"    element={<CategoriesManager />} />
        <Route path="theme"         element={<ThemeManager />} />
        <Route path="*"             element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
