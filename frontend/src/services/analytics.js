import api from './api';

// Session unique par démarrage de borne
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
