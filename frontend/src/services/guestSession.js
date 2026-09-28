// guestSession — persistance locale de la session visiteur (code de séjour).
//
// Le jeton est conservé par hôtel : un client peut avoir un séjour en cours dans
// deux établissements du groupe sans que l'un chasse l'autre.
//
// Toutes les lectures/écritures sont protégées : en navigation privée ou avec le
// stockage bloqué, l'accès reste possible pour la durée de la page, le client
// devant simplement ressaisir son code s'il la recharge.
import { setAccessToken, clearAccessToken, clearOfflineCache } from './accessStore';

const PREFIX = 'connectbe_guest_';

function key(slug) { return `${PREFIX}${slug}`; }

// Empreinte d'appareil réutilisée depuis l'inscription des bornes : un même
// téléphone qui recharge la page ne consomme pas un second slot du quota.
export function getFingerprint() {
  try {
    const stored = localStorage.getItem('connectbe_fingerprint');
    if (stored) return stored;
    const uuid = crypto.randomUUID
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now();
    localStorage.setItem('connectbe_fingerprint', uuid);
    return uuid;
  } catch {
    // Sans stockage, l'empreinte change à chaque chargement : le serveur créera
    // une nouvelle session, ce que le plafond d'appareils absorbe.
    return null;
  }
}

// Enregistre la session issue de /api/guest/redeem et l'active immédiatement.
export function saveSession(slug, { guest_token, expires_at, stay }) {
  // Le cache hors ligne du client précédent est purgé à l'échange du code.
  clearOfflineCache();
  const session = { token: guest_token, expiresAt: expires_at, stay };
  try {
    localStorage.setItem(key(slug), JSON.stringify(session));
  } catch { /* stockage indisponible — session valable le temps de la page */ }
  setAccessToken(guest_token, 'guest');
  return session;
}

// Relit une session encore valide et la réactive. Retourne null si absente ou
// périmée — la vérification de date évite un aller-retour serveur inutile, le
// serveur restant seul juge en dernier ressort (révocation possible entre-temps).
export function loadSession(slug) {
  try {
    const raw = localStorage.getItem(key(slug));
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token) return null;
    if (session.expiresAt && new Date(session.expiresAt) <= new Date()) {
      clearSession(slug);
      return null;
    }
    setAccessToken(session.token, 'guest');
    return session;
  } catch {
    return null;
  }
}

export function clearSession(slug) {
  try { localStorage.removeItem(key(slug)); } catch { /* rien à retirer */ }
  clearAccessToken();
  clearOfflineCache();
}
