import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { HotelProvider, useHotel } from './contexts/HotelContext';
import { ThemeProvider }     from './contexts/ThemeContext';
import { LinkModalProvider } from './contexts/LinkModalContext';
import GuestGate from './components/Guest/GuestGate';
import GuestHome from './components/Guest/GuestHome';
import api from './services/api';
import { loadSession, saveSession, clearSession, getFingerprint } from './services/guestSession';
import styles from './components/Guest/Guest.module.css';

const Weather           = lazy(() => import('./components/sections/Weather/Weather'));
const Flights           = lazy(() => import('./components/sections/Flights/Flights'));
const MapSection        = lazy(() => import('./components/sections/Map/MapSection'));
const Events            = lazy(() => import('./components/sections/Events/Events'));
const Wellness          = lazy(() => import('./components/sections/Wellness/Wellness'));
const UsefulInfo        = lazy(() => import('./components/sections/UsefulInfo/UsefulInfo'));
const CurrencyConverter = lazy(() => import('./components/sections/Currency/CurrencyConverter'));
const Feedback          = lazy(() => import('./components/sections/Feedback/Feedback'));

// Causes d'échec connues du serveur. Une valeur inattendue retombe sur
// 'invalid' : mieux vaut « code incorrect » qu'une clé de traduction affichée brute.
const KNOWN_REASONS = [
  'invalid', 'upcoming', 'expired', 'revoked',
  'device_limit', 'rate_limited', 'network',
];

function Spinner() {
  return (
    <div className={styles.fullscreenCenter}>
      <div className="spinner" aria-label="Chargement…" />
    </div>
  );
}

/**
 * Espace visiteur — monté sur /:hotelSlug/visiteur/*
 *
 * Volontairement distinct de KioskApp : pas d'inscription d'appareil, pas de
 * minuteur d'inactivité, pas d'écran d'attraction. Les composants de section
 * sont en revanche les mêmes, pour qu'une correction métier profite aux deux.
 */
export default function GuestApp() {
  const { hotelSlug }    = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate         = useNavigate();

  // Code porté par le QR : /:hotelSlug/visiteur?c=K7F2QM
  const codeFromUrl = searchParams.get('c');

  const [status,  setStatus]  = useState('checking'); // checking | gate | ready | ended
  const [reason,  setReason]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [stay,    setStay]    = useState(null);
  const [settings, setSettings] = useState(null);

  // Échange un code contre une session. Le fingerprint évite qu'un rechargement
  // de page ne consomme un second appareil du quota.
  const redeem = useCallback(async (code) => {
    setLoading(true);
    setReason(null);
    try {
      const { data } = await api.post('/guest/redeem', {
        hotel_slug:  hotelSlug,
        code,
        fingerprint: getFingerprint(),
      });
      saveSession(hotelSlug, data);
      setStay(data.stay);
      setStatus('ready');
      return true;
    } catch (err) {
      const raw = err.response?.data?.reason;
      const cause = KNOWN_REASONS.includes(raw) ? raw : (err.response ? 'invalid' : 'network');
      // Un séjour terminé n'est pas une faute de frappe : on remercie le client
      // au lieu de l'inviter à réessayer indéfiniment.
      if (cause === 'expired' || cause === 'revoked') {
        setStatus('ended');
      } else {
        setStatus('gate');
        setReason(cause);
      }
      return false;
    } finally {
      setLoading(false);
    }
  }, [hotelSlug]);

  // Au montage : code d'URL prioritaire, sinon session déjà en place.
  useEffect(() => {
    if (codeFromUrl) {
      // Le code ne reste pas dans la barre d'adresse : il n'a pas à finir dans
      // l'historique du navigateur ni dans un lien partagé par inadvertance.
      // On ne retire QUE ce paramètre : vider la chaîne entière emporterait les
      // autres (langue, suivi de campagne…) que le QR pourrait transporter.
      const rest = new URLSearchParams(searchParams);
      rest.delete('c');
      setSearchParams(rest, { replace: true });
      redeem(codeFromUrl);
      return;
    }

    const session = loadSession(hotelSlug);
    if (session) {
      // Les infos de séjour mémorisées à l'échange s'affichent tout de suite :
      // hors ligne, /guest/me échoue et la carte « Mon séjour » resterait vide.
      if (session.stay) setStay(session.stay);
      setStatus('ready');
    } else {
      setStatus('gate');
    }
  }, [hotelSlug]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charge la carte « Mon séjour » dès qu'une session est active.
  useEffect(() => {
    if (status !== 'ready') return;
    api.get('/guest/me')
      .then(({ data }) => {
        setStay(data.stay);
        setSettings(data.settings);
      })
      .catch((err) => {
        // 401 ici = séjour révoqué ou terminé côté serveur, alors que le jeton
        // local paraissait encore valide.
        if (err.response?.status === 401) {
          clearSession(hotelSlug);
          setStatus('ended');
        }
      });
  }, [status, hotelSlug]);

  // Un refus d'accès survenu pendant la navigation dans une section doit sortir
  // proprement du mode visiteur, sans laisser une page vide.
  useEffect(() => {
    function handleExpired() {
      clearSession(hotelSlug);
      setStatus('ended');
      navigate(`/${hotelSlug}/visiteur`, { replace: true });
    }
    window.addEventListener('connectbe:guest-expired', handleExpired);
    return () => window.removeEventListener('connectbe:guest-expired', handleExpired);
  }, [hotelSlug, navigate]);

  function handleLogout() {
    clearSession(hotelSlug);
    setStay(null);
    setSettings(null);
    setStatus('gate');
    navigate(`/${hotelSlug}/visiteur`, { replace: true });
  }

  function handleRestart() {
    setReason(null);
    setStatus('gate');
  }

  if (status === 'checking') return <Spinner />;

  if (status === 'gate' || status === 'ended') {
    // HotelProvider est monté même avant l'authentification : la saisie du code
    // s'affiche avec le thème et le nom de l'établissement.
    return (
      <HotelProvider slug={hotelSlug}>
        <ThemeProvider>
          <GateWithHotel
            ended={status === 'ended'}
            reason={reason}
            loading={loading}
            onSubmit={redeem}
            onRestart={handleRestart}
          />
        </ThemeProvider>
      </HotelProvider>
    );
  }

  return (
    <HotelProvider slug={hotelSlug}>
      <ThemeProvider>
        <LinkModalProvider>
          <div className={styles.guestRoot}>
            <Suspense fallback={<Spinner />}>
              <Routes>
                <Route path="/" element={
                  <GuestHome stay={stay} settings={settings} onLogout={handleLogout} />
                } />
                <Route path="/weather"  element={<GuestSection name="weather"><Weather /></GuestSection>} />
                <Route path="/flights"  element={<GuestSection name="flights"><Flights /></GuestSection>} />
                <Route path="/map"      element={<GuestSection name="map"><MapSection /></GuestSection>} />
                <Route path="/events"   element={<GuestSection name="events"><Events /></GuestSection>} />
                <Route path="/wellness" element={<GuestSection name="wellness"><Wellness /></GuestSection>} />
                <Route path="/info"     element={<GuestSection name="info"><UsefulInfo /></GuestSection>} />
                <Route path="/currency" element={<GuestSection name="currency"><CurrencyConverter /></GuestSection>} />
                <Route path="/feedback" element={<GuestSection name="feedback"><Feedback /></GuestSection>} />
                <Route path="*" element={
                  <GuestHome stay={stay} settings={settings} onLogout={handleLogout} />
                } />
              </Routes>
            </Suspense>
          </div>
        </LinkModalProvider>
      </ThemeProvider>
    </HotelProvider>
  );
}

// Une section désactivée dans les paramètres de l'hôtel n'est pas seulement absente
// du menu : son URL devinée renvoie aussi au menu, comme le kiosque le fait déjà.
function GuestSection({ name, children }) {
  const { hotelSlug } = useParams();
  const { isSectionEnabled } = useHotel();
  // Chemin absolu et non '..' : la résolution relative dépend de la route splat
  // parente, ce qui la rend fragile au moindre changement de routage.
  if (!isSectionEnabled(name)) return <Navigate to={`/${hotelSlug}/visiteur`} replace />;
  return children;
}

// Le nom de l'hôtel vient de HotelProvider : il faut donc être à l'intérieur.
function GateWithHotel(props) {
  const { hotel, settings, loading } = useHotel();
  if (loading) return <Spinner />;
  return <GuestGate {...props} hotelName={hotel?.nom || settings?.nom} />;
}
