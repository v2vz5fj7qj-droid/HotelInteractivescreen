import React, { Suspense, lazy, useEffect, useState, useRef, useCallback } from 'react';
import { Routes, Route, useParams, useSearchParams } from 'react-router-dom';
import { HotelProvider, useHotel } from './contexts/HotelContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LinkModalProvider } from './contexts/LinkModalContext';
import { SUPPORTED_LOCALES } from './contexts/LanguageContext';
import IdleTimer          from './components/IdleTimer/IdleTimer';
import KioskLayout        from './components/KioskLayout';
import KioskRegistration  from './components/KioskRegistration/KioskRegistration';
import { warmupCache }    from './services/cacheWarmup';
import { setAccessToken } from './services/accessStore';

const RadialMenu        = lazy(() => import('./components/RadialMenu/RadialMenu'));
const Weather           = lazy(() => import('./components/sections/Weather/Weather'));
const Flights           = lazy(() => import('./components/sections/Flights/Flights'));
const Wellness          = lazy(() => import('./components/sections/Wellness/Wellness'));
const MobileTransfer    = lazy(() => import('./components/sections/MobileTransfer/MobileTransfer'));
const Events            = lazy(() => import('./components/sections/Events/Events'));
const MapSection        = lazy(() => import('./components/sections/Map/MapSection'));
const UsefulInfo        = lazy(() => import('./components/sections/UsefulInfo/UsefulInfo'));
const KioskNotFound     = lazy(() => import('./pages/KioskNotFound'));
const Feedback          = lazy(() => import('./components/sections/Feedback/Feedback'));
const CurrencyConverter = lazy(() => import('./components/sections/Currency/CurrencyConverter'));

const HEARTBEAT_INTERVAL  = 5 * 60 * 1000; // 5 minutes

function tokenKey(slug) {
  return `connectbe_device_token_${slug}`;
}

// ── Écran borne désactivée ─────────────────────────────────────────
function KioskDisabled() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', width: '100vw', height: '100vh',
      background: '#1A1208', color: '#b89970', gap: '1rem',
    }}>
      <div style={{ fontSize: '3rem' }}>⛔</div>
      <h2 style={{ color: '#f5e6cc', margin: 0 }}>Borne désactivée</h2>
      <p style={{ margin: 0, fontSize: '1rem' }}>Contactez l'administrateur.</p>
    </div>
  );
}

// ── Garde de section ───────────────────────────────────────────────
// Une section désactivée pour l'hôtel ne doit pas rester atteignable par URL
// directe : la masquer dans le menu ne suffit pas.
function SectionRoute({ section, children }) {
  const { isSectionEnabled } = useHotel();
  if (!isSectionEnabled(section)) return <KioskNotFound />;
  return children;
}

// ── Routes kiosque (affiché une fois auth OK) ──────────────────────
function KioskRoutes() {
  const { loading, notFound, hotel } = useHotel();

  useEffect(() => {
    if (!hotel) return;
    const timer = setTimeout(() => warmupCache(SUPPORTED_LOCALES), 2000);
    return () => clearTimeout(timer);
  }, [hotel?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        <Route path="/weather"  element={<SectionRoute section="weather"><KioskLayout><Weather /></KioskLayout></SectionRoute>} />
        <Route path="/flights"  element={<SectionRoute section="flights"><KioskLayout><Flights /></KioskLayout></SectionRoute>} />
        <Route path="/map"      element={<SectionRoute section="map"><KioskLayout><MapSection /></KioskLayout></SectionRoute>} />
        <Route path="/events"   element={<SectionRoute section="events"><KioskLayout><Events /></KioskLayout></SectionRoute>} />
        <Route path="/wellness" element={<SectionRoute section="wellness"><KioskLayout><Wellness /></KioskLayout></SectionRoute>} />
        <Route path="/info"     element={<SectionRoute section="info"><KioskLayout><UsefulInfo /></KioskLayout></SectionRoute>} />
        <Route path="/mobile"   element={<SectionRoute section="mobile"><KioskLayout><MobileTransfer /></KioskLayout></SectionRoute>} />
        <Route path="/feedback" element={<SectionRoute section="feedback"><KioskLayout><Feedback /></KioskLayout></SectionRoute>} />
        <Route path="/currency" element={<SectionRoute section="currency"><KioskLayout><CurrencyConverter /></KioskLayout></SectionRoute>} />
        <Route path="*"         element={<KioskNotFound />} />
      </Routes>
    </>
  );
}

// ── Gate d'authentification borne ──────────────────────────────────
// États : checking | registration | disabled | ready
function KioskDeviceGate({ children }) {
  const { hotelSlug }            = useParams();
  const [searchParams]           = useSearchParams();
  const bypassMode               = searchParams.get('bypass') === '1';

  const [authState, setAuthState] = useState('checking'); // checking | registration | disabled | ready
  const heartbeatRef             = useRef(null);

  const startHeartbeat = useCallback((token) => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);

    async function beat() {
      try {
        const res  = await fetch('/api/kiosk-device/heartbeat', {
          method:  'PUT',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const { enabled } = await res.json();
        if (!enabled) setAuthState('disabled');
      } catch {
        // Pas d'action si la borne est offline — elle continue d'afficher
      }
    }

    heartbeatRef.current = setInterval(beat, HEARTBEAT_INTERVAL);
  }, []);

  useEffect(() => {
    // Mode bypass (test) : pas de vérification de token
    if (bypassMode) {
      setAuthState('ready');
      return;
    }

    const token = localStorage.getItem(tokenKey(hotelSlug));

    if (!token) {
      setAuthState('registration');
      return;
    }

    // Authentification silencieuse au démarrage
    fetch('/api/kiosk-device/auth', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ device_token: token }),
    })
      .then(res => {
        if (res.status === 401) {
          // Token révoqué ou invalide : retour à l'inscription
          localStorage.removeItem(tokenKey(hotelSlug));
          setAuthState('registration');
          return null;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        if (!data.enabled) {
          setAuthState('disabled');
          return;
        }
        // La borne porte désormais son jeton sur les appels de contenu :
        // contentAuth le réclame côté serveur.
        setAccessToken(token, 'kiosk');
        setAuthState('ready');
        startHeartbeat(token);
      })
      .catch(() => {
        // Serveur injoignable au démarrage : on laisse passer (mode offline).
        // Le jeton local est tout de même armé, pour les appels qui aboutiront
        // au retour du réseau.
        setAccessToken(token, 'kiosk');
        setAuthState('ready');
      });

    return () => {
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRegistered({ deviceToken }) {
    setAccessToken(deviceToken, 'kiosk');
    startHeartbeat(deviceToken);
    setAuthState('ready');
  }

  if (authState === 'checking') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: '100vw', height: '100vh', background: '#1A1208',
      }}>
        <div className="spinner" aria-label="Chargement…" />
      </div>
    );
  }

  if (authState === 'registration') {
    return <KioskRegistration onRegistered={handleRegistered} hotelSlug={hotelSlug} />;
  }

  if (authState === 'disabled') {
    return <KioskDisabled />;
  }

  // authState === 'ready' — affichage normal
  return children;
}

// ── App principale kiosque ─────────────────────────────────────────
export default function KioskApp() {
  // Mode kiosque : bloquer le menu contextuel (clic droit / appui long)
  useEffect(() => {
    const blockContextMenu = (e) => e.preventDefault();
    document.addEventListener('contextmenu', blockContextMenu);
    return () => document.removeEventListener('contextmenu', blockContextMenu);
  }, []);

  return (
    <KioskDeviceGate>
      <HotelProvider>
        <ThemeProvider>
          <LinkModalProvider>
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
          </LinkModalProvider>
        </ThemeProvider>
      </HotelProvider>
    </KioskDeviceGate>
  );
}
