import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

import AdminLogin  from './AdminLogin';
import AdminLayout from './AdminLayout';

// Pages super-admin
import SuperDashboard          from './pages/super/Dashboard';
import HotelsManager           from './pages/super/HotelsManager';
import UsersManager            from './pages/super/UsersManager';
import AirportsManager         from './pages/super/AirportsManager';
import SuperPlacesManager      from './pages/super/PlacesManager';
import SuperEventsManager      from './pages/super/EventsManager';
import SuperInfoManager        from './pages/super/InfoManager';
import ServiceCategoriesManager  from './pages/super/ServiceCategoriesManager';
import PoiCategoriesManager      from './pages/super/PoiCategoriesManager';
import EventCategoriesManager    from './pages/super/EventCategoriesManager';
import InfoCategoriesManager     from './pages/super/InfoCategoriesManager';
import WeatherManager            from './pages/super/WeatherManager';
import TokensManager           from './pages/super/TokensManager';
import AuditLog               from './pages/super/AuditLog';
import HotelConfig            from './pages/super/HotelConfig';

// Pages hotel-admin
import HotelDashboard       from './pages/hotel/Dashboard';
import HotelSettings        from './pages/hotel/HotelSettings';
import ServicesManager      from './pages/hotel/ServicesManager';
import TipsManager          from './pages/hotel/TipsManager';
import HotelEventsManager   from './pages/hotel/EventsManager';
import HotelNotifications   from './pages/hotel/NotificationsManager';
import FeedbackManager      from './pages/hotel/FeedbackManager';

// Pages contributeur
import ContribDashboard from './pages/contributor/Dashboard';
import MyPlaces         from './pages/contributor/MyPlaces';
import MyEvents         from './pages/contributor/MyEvents';
import MyInfo           from './pages/contributor/MyInfo';

// ── Guards ──────────────────────────────────────────────────────

function RequireAuth({ children }) {
  const { user, hydrated } = useAuth();
  const location           = useLocation();
  if (!hydrated) return null;
  if (!user) return <Navigate to="/admin/login" state={{ from: location }} replace />;
  return children;
}

function RequireRole({ roles, children }) {
  const { user, hydrated } = useAuth();
  if (!hydrated) return null;
  if (!user || !roles.includes(user.role)) return <Navigate to="/admin/login" replace />;
  return children;
}

// ── Root redirect selon le rôle ─────────────────────────────────

function AdminRoot() {
  const { user, hydrated } = useAuth();
  if (!hydrated) return null;
  if (!user) return <Navigate to="/admin/login" replace />;
  if (user.role === 'super_admin')  return <Navigate to="/admin/super"       replace />;
  if (user.role === 'hotel_admin' ||
      user.role === 'hotel_staff')  return <Navigate to="/admin/hotel"       replace />;
  if (user.role === 'contributor')  return <Navigate to="/admin/contributor" replace />;
  return <Navigate to="/admin/login" replace />;
}

// ── App ──────────────────────────────────────────────────────────

export default function AdminApp() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="login" element={<AdminLogin />} />

        {/* Root → redirect selon rôle */}
        <Route index element={<RequireAuth><AdminRoot /></RequireAuth>} />

        {/* ── Super-admin ── */}
        <Route
          path="super"
          element={
            <RequireRole roles={['super_admin']}>
              <AdminLayout section="super" />
            </RequireRole>
          }
        >
          <Route index                  element={<SuperDashboard />} />
          <Route path="hotels"              element={<HotelsManager />} />
          <Route path="hotels/:id/config" element={<HotelConfig />} />
          <Route path="users"           element={<UsersManager />} />
          <Route path="airports"        element={<AirportsManager />} />
          <Route path="places"          element={<SuperPlacesManager />} />
          <Route path="events"          element={<SuperEventsManager />} />
          <Route path="info"            element={<SuperInfoManager />} />
          <Route path="service-categories"  element={<ServiceCategoriesManager />} />
          <Route path="poi-categories"     element={<PoiCategoriesManager />} />
          <Route path="event-categories"   element={<EventCategoriesManager />} />
          <Route path="info-categories"    element={<InfoCategoriesManager />} />
          <Route path="weather"            element={<WeatherManager />} />
          <Route path="tokens"          element={<TokensManager />} />
          <Route path="audit-log"       element={<AuditLog />} />
          <Route path="*"               element={<Navigate to="/admin/super" replace />} />
        </Route>

        {/* ── Hotel-admin + staff ── */}
        <Route
          path="hotel"
          element={
            <RequireRole roles={['super_admin', 'hotel_admin', 'hotel_staff']}>
              <AdminLayout section="hotel" />
            </RequireRole>
          }
        >
          <Route index                  element={<HotelDashboard />} />
          <Route path="settings"        element={<HotelSettings />} />
          <Route path="services"        element={<ServicesManager />} />
          <Route path="tips"            element={<TipsManager />} />
          <Route path="events"          element={<HotelEventsManager />} />
          <Route path="notifications"   element={<HotelNotifications />} />
          <Route path="feedbacks"       element={<FeedbackManager />} />
          <Route path="*"               element={<Navigate to="/admin/hotel" replace />} />
        </Route>

        {/* ── Contributeur ── */}
        <Route
          path="contributor"
          element={
            <RequireRole roles={['contributor']}>
              <AdminLayout section="contributor" />
            </RequireRole>
          }
        >
          <Route index           element={<ContribDashboard />} />
          <Route path="places"   element={<MyPlaces />} />
          <Route path="events"   element={<MyEvents />} />
          <Route path="info"     element={<MyInfo />} />
          <Route path="*"        element={<Navigate to="/admin/contributor" replace />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>
    </AuthProvider>
  );
}
