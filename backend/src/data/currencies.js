// Catalogue des devises — SOURCE UNIQUE DE VÉRITÉ
//
// currencies.json est le seul endroit où une devise s'ajoute ou se modifie.
// Il alimente :
//   • la validation du back-office        (routes/admin/hotel/devise.js)
//   • la liste de sélection du back-office (GET /api/admin/hotel/devise/currencies)
//   • l'affichage du kiosque               (GET /api/currency/catalog)
// Le frontend ne code aucune liste en dur : il consomme ces deux endpoints.
//
// Avant d'ajouter une devise, vérifier que le fournisseur de taux la couvre :
//   curl -s https://open.er-api.com/v6/latest/XOF | jq '.rates | keys'
const CURRENCIES = require('./currencies.json');

const CURRENCY_CODES = CURRENCIES.map(c => c.code);
const BY_CODE        = new Map(CURRENCIES.map(c => [c.code, c]));

function isValidCurrency(code) {
  return BY_CODE.has(code);
}

module.exports = { CURRENCIES, CURRENCY_CODES, isValidCurrency };
