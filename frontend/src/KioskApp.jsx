import React, { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { HotelProvider, useHotel } from './contexts/HotelContext';
import { ThemeProvider } from './contexts/ThemeContext';
import IdleTimer     from './components/IdleTimer/IdleTimer';
import KioskLayout   from './components/KioskLayout';

const RadialMenu     = lazy(() => import('./components/RadialMenu/RadialMenu'));
const Weather        = lazy(() => import('./components/sections/Weather/Weather'));
const Flights        = lazy(() => import('./components/sections/Flights/Flights'));
const Wellness       = lazy(() => import('./components/sections/Wellness/Wellness'));
const MobileTransfer = lazy(() => import('./components/sections/MobileTransfer/MobileTransfer'));
const Events         = lazy(() => import('./components/sections/Events/Events'));
const MapSection     = lazy(() => import('./components/sections/Map/MapSection'));
const UsefulInfo     = lazy(() => import('./components/sections/UsefulInfo/UsefulInfo'));
const KioskNotFound  = lazy(() => import('./pages/KioskNotFound'));

// Composant interne — accède à HotelContext pour gérer loading/notFound
function KioskRoutes() {
  const { loading, notFound } = useHotel();

  if (loading) return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100vw', height: '100vh', background: 'var(--c-bg)',
    }}>
      <div className="spinner" aria-label="Chargement…" />
    </div>
  );

  if (notFound) return <KioskNotFound />;

  return (
    <>
      <IdleTimer />
      <Routes>
        <Route path="/"         element={<KioskLayout><RadialMenu /></KioskLayout>} />
        <Route path="/weather"  element={<KioskLayout><Weather /></KioskLayout>} />
        <Route path="/flights"  element={<KioskLayout><Flights /></KioskLayout>} />
        <Route path="/map"      element={<KioskLayout><MapSection /></KioskLayout>} />
        <Route path="/events"   element={<KioskLayout><Events /></KioskLayout>} />
        <Route path="/wellness" element={<KioskLayout><Wellness /></KioskLayout>} />
        <Route path="/info"     element={<KioskLayout><UsefulInfo /></KioskLayout>} />
        <Route path="/mobile"   element={<KioskLayout><MobileTransfer /></KioskLayout>} />
        <Route path="*"         element={<KioskNotFound />} />
      </Routes>
    </>
  );
}

export default function KioskApp() {
  return (
    <HotelProvider>
      <ThemeProvider>
        <Suspense fallback={
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100vw', height: '100vh', background: '#1A1208',
          }}>
            <div className="spinner" aria-label="Chargement…" />
          </div>
        }>
          <KioskRoutes />
        </Suspense>
      </ThemeProvider>
    </HotelProvider>
  );
}
