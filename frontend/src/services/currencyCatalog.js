// Catalogue des devises côté kiosque
//
// Aucune liste de devises n'est codée en dur dans le frontend : la source unique
// est backend/src/data/currencies.json, exposée par GET /api/currency/catalog.
// Ajouter une devise = une ligne dans ce JSON, rien à toucher ici.
//
// Le catalogue est chargé une seule fois par session (mémoire du module) et
// l'intercepteur offline de api.js en garde une copie en localStorage, donc un
// kiosque hors ligne continue d'afficher drapeaux et libellés.
import api from './api';

let byCode  = null;   // { XOF: { code, flag, name, shortName, zeroDecimals }, … }
let pending = null;   // promesse en cours — évite les appels concurrents

const FALLBACK = { flag: '💱', name: null };

export async function loadCurrencyCatalog() {
  if (byCode) return byCode;
  if (!pending) {
    pending = api.get('/currency/catalog')
      .then(({ data }) => {
        byCode = Object.fromEntries((data?.currencies || []).map(c => [c.code, c]));
        return byCode;
      })
      .catch(() => {
        // Catalogue indisponible : on n'empêche pas l'écran de s'afficher,
        // les devises seront libellées par leur code ISO (voir currencyMeta).
        byCode = {};
        return byCode;
      })
      .finally(() => { pending = null; });
  }
  return pending;
}

/** Drapeau + libellé d'une devise. `short` = libellé compact (tableau des taux). */
export function currencyMeta(code, { short = false } = {}) {
  const c = byCode?.[code];
  if (!c) return { flag: FALLBACK.flag, name: code };
  return { flag: c.flag, name: (short ? c.shortName : c.name) || code };
}

/** true pour les devises sans sous-unité usuelle (XOF, GNF, JPY…) : pas de décimales. */
export function isZeroDecimal(code) {
  return byCode?.[code]?.zeroDecimals === true;
}
