import api from './api';

// Endpoints sans dépendance de locale — un seul appel suffit
const LOCALE_FREE = [
  '/weather/localities',
  '/weather/current',
  '/flights',
  '/currency/rates',
  '/currency/config',
  '/events/categories',
  '/info/categories',
  '/poi/categories',
];

// Endpoints dont le contenu varie par locale
const LOCALE_DEPS = [
  '/events',
  '/info',
  '/poi',
  '/services',
  '/tips',
];

/**
 * Précharge en arrière-plan tous les endpoints kiosque pour alimenter
 * le cache offline localStorage avant toute interaction utilisateur.
 *
 * Le hotel_id est injecté automatiquement par l'intercepteur de api.js.
 * Toutes les erreurs sont ignorées — le warmup est best-effort.
 *
 * @param {string[]} locales  Liste des locales à précharger (ex: ['fr','en',...])
 */
export async function warmupCache(locales = ['fr']) {
  // Batch 1 : données sans locale — lancer en parallèle immédiatement
  await Promise.allSettled(
    LOCALE_FREE.map(url => api.get(url))
  );

  // Batch 2 : données par locale — séquentielles par locale, légère pause entre chaque
  // pour ne pas saturer le serveur avec 9×5 = 45 requêtes simultanées
  for (const locale of locales) {
    await Promise.allSettled(
      LOCALE_DEPS.map(url => api.get(url, { params: { locale } }))
    );
    // Pause de 300ms entre chaque locale pour laisser respirer le serveur
    await new Promise(r => setTimeout(r, 300));
  }
}
