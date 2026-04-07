import { useState, useCallback } from 'react';
import axios from 'axios';

// Client dédié à la route /api/translate (hors du préfixe /api/admin)
const client = axios.create({ baseURL: '/api' });
client.interceptors.request.use(cfg => {
  const token = sessionStorage.getItem('admin_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

/**
 * Hook de traduction automatique via LibreTranslate (avec fallback MyMemory).
 *
 * translateFields(fields, sourceLang, sourceValues, allLocales)
 *   - fields       : tableau de clés à traduire, ex. ['name', 'description']
 *   - sourceLang   : locale source, ex. 'fr'
 *   - sourceValues : objet { name: '...', description: '...' } pour la locale source
 *   - allLocales   : toutes les locales du projet, ex. ['fr','en','de',...]
 *
 * Retourne { [locale]: { [field]: translatedText } } pour toutes les locales cibles.
 */
export function useTranslate() {
  const [translating, setTranslating] = useState(false);

  const translateFields = useCallback(async (fields, sourceLang, sourceValues, allLocales) => {
    const targets = allLocales.filter(l => l !== sourceLang);
    setTranslating(true);
    try {
      // Initialise le résultat avec des objets vides pour chaque locale cible
      const result = Object.fromEntries(targets.map(l => [l, {}]));

      // Un appel par champ non vide → chaque appel retourne toutes les locales cibles
      await Promise.all(
        fields
          .filter(f => sourceValues[f]?.trim())
          .map(async (field) => {
            try {
              const { data } = await client.post('/translate', {
                text:    sourceValues[field],
                source:  sourceLang,
                targets,
              });
              for (const [locale, text] of Object.entries(data.translations || {})) {
                result[locale][field] = text;
              }
            } catch {
              // Si un champ échoue, on continue avec les autres
            }
          })
      );

      return result;
    } finally {
      setTranslating(false);
    }
  }, []);

  return { translateFields, translating };
}
