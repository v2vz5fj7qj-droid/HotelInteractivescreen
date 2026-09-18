const express = require('express');
const rateLimit = require('express-rate-limit');
const xss = require('xss');
const Feedback = require('../models/feedback');

const router = express.Router();

const CATEGORIES = ['proprete', 'accueil', 'chambre', 'restauration', 'services'];

// Options xss : aucun tag HTML autorisé dans les commentaires
const XSS_OPTIONS = { whiteList: {}, stripIgnoreTag: true, stripIgnoreTagBody: ['script', 'style'] };

// Retourne l'IP réelle du client (req.ip est déjà normalisé si TRUST_PROXY est défini dans app.js)
const getClientIp = (req) => req.ip || req.connection?.remoteAddress || 'unknown';

// Burst : max 5 soumissions par IP par 15 min
const burstLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: getClientIp,
  handler: (_, res) => res.status(429).json({ error: 'too_many_requests' }),
  skipFailedRequests: true,
});

// Journalier : max 300 soumissions par IP par 24h (borne publique partagée)
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 300,
  keyGenerator: getClientIp,
  handler: (_, res) => res.status(429).json({ error: 'too_many_requests' }),
  skipFailedRequests: true,
});

// POST /api/feedback
router.post('/', burstLimiter, dailyLimiter, async (req, res) => {
  const { hotel_id, categories, commentaire, locale } = req.body;

  if (!hotel_id || !categories || typeof categories !== 'object') {
    return res.status(400).json({ error: 'Données invalides' });
  }

  // Validation des notes (1-5 par catégorie)
  for (const cat of CATEGORIES) {
    const v = categories[cat];
    if (v !== undefined && (typeof v !== 'number' || v < 1 || v > 5)) {
      return res.status(400).json({ error: `Note invalide pour "${cat}"` });
    }
  }

  // Commentaire : sanitisation complète XSS + limite 500 chars
  const comment = commentaire
    ? xss(String(commentaire).trim(), XSS_OPTIONS).slice(0, 500)
    : null;

  // Calcul note globale (moyenne des catégories fournies)
  const noted = CATEGORIES.filter(c => typeof categories[c] === 'number');
  if (noted.length === 0) return res.status(400).json({ error: 'Aucune note fournie' });
  const note_globale = noted.reduce((s, c) => s + categories[c], 0) / noted.length;

  const id = await Feedback.create({
    hotel_id,
    categories,
    commentaire: comment,
    note_globale: Math.round(note_globale * 100) / 100,
    locale: locale || 'fr',
    ip: getClientIp(req),
  });

  res.status(201).json({ id, note_globale: Math.round(note_globale * 100) / 100 });
});

module.exports = router;
