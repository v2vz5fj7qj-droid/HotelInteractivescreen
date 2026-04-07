import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { ThemeProvider }    from './contexts/ThemeContext';
import IdleTimer            from './components/IdleTimer/IdleTimer';
import KioskLayout          from './components/KioskLayout';

// ── Borne ─────────────────────────────────────────────
const RadialMenu     = lazy(() => import('./components/RadialMenu/RadialMenu'));
const Weather        = lazy(() => import('./components/sections/Weather/Weather'));
const Flights        = lazy(() => import('./components/sections/Flights/Flights'));
const Wellness       = lazy(() => import('./components/sections/Wellness/Wellness'));
const MobileTransfer = lazy(() => import('./components/sections/MobileTransfer/MobileTransfer'));
const MobileGate     = lazy(() => import('./components/MobileGate/MobileGate'));
const Events         = lazy(() => import('./components/sections/Events/Events'));
const MapSection     = lazy(() => import('./components/sections/Map/MapSection'));
const UsefulInfo     = lazy(() => import('./components/sections/UsefulInfo/UsefulInfo'));

// ── Backoffice Admin (chargé séparément) ──────────────
const AdminApp = lazy(() => import('./admin/AdminApp'));

export default function App() {
  return (
    <LanguageProvider>
      <ThemeProvider>
        <BrowserRouter>
          <Suspense fallback={<FullscreenLoader />}>
            <Routes>
              {/* ── Routes borne (avec IdleTimer + KioskLayout) ── */}
              <Route
                path="/*"
                element={
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
                    </Routes>
                  </>
                }
              />

              {/* ── Route mobile QR (sans IdleTimer ni KioskLayout) ── */}
              <Route path="/mobile/:section" element={<MobileGate />} />

              {/* ── Backoffice admin (sans IdleTimer ni KioskLayout) ── */}
              <Route path="/admin/*" element={<AdminApp />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ThemeProvider>
    </LanguageProvider>
  );
}

function FullscreenLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100vw', height: '100vh', background: 'var(--c-bg)',
    }}>
      <div className="spinner" aria-label="Chargement…" />
    </div>
  );
}
