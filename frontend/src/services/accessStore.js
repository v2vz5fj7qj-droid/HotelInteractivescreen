// Singleton module — porte le jeton d'accès au contenu, quel que soit le porteur :
// borne inscrite (device_token), client authentifié par son code de séjour
// (guest_token) ou transfert mobile éphémère (qr_token).
//
// Même motif que hotelStore : l'intercepteur Axios a besoin du jeton sans créer
// de dépendance circulaire avec les contextes React.
//
// Le backend distingue les trois formats tout seul ; `kind` ne sert qu'au
// diagnostic et aux décisions d'affichage côté client.
let _token = null;
let _kind  = null;   // 'kiosk' | 'guest' | 'qr'
let _scope = 'anon';

// Empreinte courte et non réversible du jeton (djb2). Elle ne sert qu'à
// cloisonner le cache hors ligne : deux séjours successifs sur le même
// téléphone ne doivent pas lire les données l'un de l'autre.
function shortHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function setAccessToken(token, kind = null) {
  _token = token || null;
  _kind  = token ? kind : null;
  _scope = token ? `${kind || 'tok'}-${shortHash(token)}` : 'anon';
  if (_token) pruneForeignScopes();
}

// Élague les entrées de cache hors ligne qui n'appartiennent pas au porteur
// courant. Trois cas réels, tous consommateurs de quota localStorage sur une borne :
//   • les clés de l'ancien format `offline:/chemin`, antérieures au cloisonnement ;
//   • celles d'un jeton de borne remplacé après une réinscription ;
//   • celles du séjour précédent sur un téléphone partagé.
// Une borne ne voyant jamais qu'un seul jeton, l'appel ne supprime rien en régime
// normal — il ne coûte qu'un parcours des clés au démarrage.
function pruneForeignScopes() {
  try {
    const prefix = `offline:${_scope}:`;
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('offline:') && !key.startsWith(prefix)) doomed.push(key);
    }
    doomed.forEach(k => localStorage.removeItem(k));
  } catch { /* stockage indisponible — rien à élaguer */ }
}

export function getAccessToken() { return _token; }
export function getAccessKind()  { return _kind; }
export function getAccessScope() { return _scope; }

export function clearAccessToken() {
  _token = null;
  _kind  = null;
  _scope = 'anon';
}

// Vide le cache hors ligne de toutes les sessions. Appelé à l'échange d'un code
// et à l'expiration d'un séjour : les données du client précédent ne doivent pas
// rester lisibles sur un appareil partagé.
export function clearOfflineCache() {
  try {
    const doomed = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('offline:')) doomed.push(key);
    }
    doomed.forEach(k => localStorage.removeItem(k));
  } catch { /* stockage indisponible — rien à purger */ }
}
