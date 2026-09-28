import axios from 'axios';
import { getHotelId } from './hotelStore';
import { getAccessToken, getAccessScope, getAccessKind } from './accessStore';

const api = axios.create({
  baseURL: '/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Injecter hotel_id automatiquement sur toutes les requêtes GET ──
api.interceptors.request.use(config => {
  const hotelId = getHotelId();
  if (hotelId && config.method === 'get') {
    config.params = { hotel_id: hotelId, ...config.params };
  }

  // ── Jeton d'accès au contenu (borne, visiteur ou QR mobile) ──
  // Les routes de contenu sont protégées côté serveur par contentAuth : sans cet
  // en-tête, la borne elle-même se verrait refuser ses données une fois
  // CONTENT_AUTH_ENFORCE activé.
  const token = getAccessToken();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

// ── Offline : injecter les données en cache si réseau indisponible ──
api.interceptors.response.use(
  (response) => {
    // Mettre en cache toutes les réponses GET réussies
    if (response.config.method === 'get') {
      const key = `offline:${getAccessScope()}:${response.config.url}${response.config.params
        ? '?' + new URLSearchParams(response.config.params).toString()
        : ''}`;
      try {
        localStorage.setItem(key, JSON.stringify({
          data: response.data,
          ts:   Date.now(),
        }));
      } catch { /* Quota dépassé — ignorer */ }
    }
    return response;
  },
  (error) => {
    // ── Séjour terminé ou révoqué pendant la navigation ──
    // GuestApp écoute cet événement pour sortir proprement du mode visiteur au
    // lieu de laisser une section vide à l'écran.
    if (error.response?.status === 401 && getAccessKind() === 'guest') {
      window.dispatchEvent(new CustomEvent('connectbe:guest-expired'));
      return Promise.reject(error);
    }

    // Si réseau KO → chercher en cache localStorage
    if (!navigator.onLine || error.code === 'ECONNABORTED') {
      const config = error.config;
      if (config?.method === 'get') {
        const key = `offline:${getAccessScope()}:${config.url}${config.params
          ? '?' + new URLSearchParams(config.params).toString()
          : ''}`;
        const raw = localStorage.getItem(key);
        if (raw) {
          try {
            const { data } = JSON.parse(raw);
            return Promise.resolve({ data: { ...data, _offline: true }, status: 200 });
          } catch {}
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
