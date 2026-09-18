// Suivi des interactions kiosque — chaque navigation ou clic important appelle trackEvent().
// Les appels sont fire-and-forget : une erreur réseau est silencieusement ignorée.
// Le device_type est détecté par largeur d'écran (≥1200px = kiosk, sinon mobile).
import api from './api';

// SESSION_ID est unique par démarrage de borne — permet de regrouper les actions d'une session.
const SESSION_ID = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function trackEvent(section, action, meta = {}) {
  const locale      = localStorage.getItem('connectbe_locale') || 'fr';
  const device_type = window.matchMedia('(min-width: 1200px)').matches ? 'kiosk' : 'mobile';

  try {
    await api.post('/analytics', { section, action, meta, locale, device_type, session_id: SESSION_ID });
  } catch {
    // Analytics non bloquant
  }
}
