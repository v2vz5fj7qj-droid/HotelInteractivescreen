// Catalogue des sections kiosque — SOURCE UNIQUE DE VÉRITÉ
//
// sections.json est le seul endroit où une section s'ajoute ou se renomme.
// Il alimente :
//   • la validation du back-office        (routes/admin/hotel/settings.js, super/hotels.js)
//   • la liste de cases à cocher du super-admin (GET /api/admin/super/hotels/sections/catalog)
//   • le filtrage du kiosque              (enabled_sections dans GET /api/kiosk/:slug/config)
//
// Ajouter une section ici ne suffit pas : il faut aussi sa route et son entrée
// de menu côté frontend (KioskApp.jsx, RadialMenu.jsx, AttractScreen.jsx).
const SECTIONS = require('./sections.json');

const SECTION_KEYS = SECTIONS.map(s => s.key);
const KEY_SET      = new Set(SECTION_KEYS);

function isValidSection(key) {
  return KEY_SET.has(key);
}

// NULL en base = hôtel antérieur à la migration enabled_sections : toutes les
// sections restent actives, pour ne rien retirer à un hôtel existant. Un tableau
// vide, lui, est une volonté explicite et doit être conservé tel quel.
function normalizeEnabledSections(raw) {
  if (raw === null || raw === undefined) return [...SECTION_KEYS];

  let value = raw;
  if (typeof value === 'string') {
    try { value = JSON.parse(value); } catch { return [...SECTION_KEYS]; }
  }
  if (!Array.isArray(value)) return [...SECTION_KEYS];

  // On réordonne selon le catalogue et on ignore les clés inconnues (section
  // supprimée du catalogue mais encore stockée en base).
  return SECTION_KEYS.filter(key => value.includes(key));
}

// Valide une valeur reçue du back-office. Retourne { ok, value } ou { ok:false, error }.
function parseEnabledSections(raw) {
  if (raw === null) return { ok: true, value: null }; // null = réinitialiser à "toutes"
  if (!Array.isArray(raw)) return { ok: false, error: 'enabled_sections doit être un tableau de clés de sections' };

  const invalid = raw.filter(key => !isValidSection(key));
  if (invalid.length) return { ok: false, error: `Sections inconnues : ${invalid.join(', ')}` };

  return { ok: true, value: SECTION_KEYS.filter(key => raw.includes(key)) };
}

module.exports = { SECTIONS, SECTION_KEYS, isValidSection, normalizeEnabledSections, parseEnabledSections };
