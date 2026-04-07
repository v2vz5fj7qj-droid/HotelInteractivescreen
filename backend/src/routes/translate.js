const express   = require('express');
const axios     = require('axios');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
const LT_URL = process.env.LIBRETRANSLATE_URL || 'http://libretranslate:5000';

const SUPPORTED = new Set(['fr', 'en', 'de', 'es', 'pt', 'ar', 'zh', 'ja', 'ru']);

// POST /api/translate
// Body: { text: string, source: string, targets: string[] }
// Réponse: { translations: { [locale]: string } }
router.post('/', adminAuth, async (req, res) => {
  const { text, source, targets } = req.body;

  if (!text?.trim() || !source || !Array.isArray(targets) || targets.length === 0) {
    return res.status(400).json({ error: 'text, source et targets sont requis' });
  }
  if (!SUPPORTED.has(source)) {
    return res.status(400).json({ error: `Langue source non supportée : ${source}` });
  }

  const validTargets = targets.filter(t => SUPPORTED.has(t) && t !== source);
  if (validTargets.length === 0) {
    return res.json({ translations: {} });
  }

  const results = {};

  await Promise.all(validTargets.map(async (target) => {
    try {
      // Tentative LibreTranslate (hébergé en local)
      const { data } = await axios.post(`${LT_URL}/translate`, {
        q:      text,
        source,
        target,
        format: 'text',
      }, { timeout: 10000 });
      results[target] = data.translatedText ?? '';
    } catch {
      // Fallback : MyMemory (gratuit, sans clé, 1000 req/jour)
      try {
        const { data } = await axios.get('https://api.mymemory.translated.net/get', {
          params:  { q: text, langpair: `${source}|${target}` },
          timeout: 6000,
        });
        results[target] = data.responseData?.translatedText ?? '';
      } catch {
        results[target] = ''; // champ vide — l'admin saisit manuellement
      }
    }
  }));

  res.json({ translations: results });
});

module.exports = router;
