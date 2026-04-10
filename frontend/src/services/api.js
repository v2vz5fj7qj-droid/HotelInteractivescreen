import axios from 'axios';
import { getHotelId } from './hotelStore';

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
  return config;
});

// ── Offline : injecter les données en cache si réseau indisponible ──
api.interceptors.response.use(
  (response) => {
    // Mettre en cache toutes les réponses GET réussies
    if (response.config.method === 'get') {
      const key = `offline:${response.config.url}${response.config.params
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
    // Si réseau KO → chercher en cache localStorage
    if (!navigator.onLine || error.code === 'ECONNABORTED') {
      const config = error.config;
      if (config?.method === 'get') {
        const key = `offline:${config.url}${config.params
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
