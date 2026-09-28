import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';

// ── Borne kiosque (chargé par hôtel) ──────────────────────────
const KioskApp   = lazy(() => import('./KioskApp'));

// ── Page d'accueil projet ──────────────────────────────────────
const Home       = lazy(() => import('./pages/Home'));

// ── Backoffice Admin ──────────────────────────────────────────
const AdminApp   = lazy(() => import('./admin/AdminApp'));

// ── Mobile QR ─────────────────────────────────────────────────
const MobileGate = lazy(() => import('./components/MobileGate/MobileGate'));

// ── Espace visiteur (accès client par code de séjour) ─────────
const GuestApp   = lazy(() => import('./GuestApp'));

export default function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <Suspense fallback={<FullscreenLoader />}>
          <Routes>
            {/* ── Page d'accueil projet ── */}
            <Route path="/" element={<Home />} />

            {/* ── Mobile QR (sans kiosque) ── */}
            <Route path="/mobile/:section" element={<MobileGate />} />

            {/* ── Backoffice admin ── */}
            <Route path="/admin/*" element={<AdminApp />} />

            {/* ── Espace visiteur par hôtel ──
                Déclaré AVANT la route kiosque : sans quoi /visiteur serait
                avalé par KioskApp, donc soumis à l'inscription de borne. */}
            <Route path="/:hotelSlug/visiteur/*" element={<GuestApp />} />

            {/* ── Kiosque par hôtel ── */}
            <Route path="/:hotelSlug/*" element={<KioskApp />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </LanguageProvider>
  );
}

function FullscreenLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      width: '100vw', height: '100vh', background: '#1A1208',
    }}>
      <div className="spinner" aria-label="Chargement…" />
    </div>
  );
}
