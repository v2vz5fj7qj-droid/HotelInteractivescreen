const express = require('express');
const rateLimit = require('express-rate-limit');
const Feedback = require('../models/feedback');

const router = express.Router();

const CATEGORIES = ['proprete', 'accueil', 'chambre', 'restauration', 'services'];

// Burst : max 5 soumissions par IP+hôtel par 15 min (anti-spam réseau)
const burstLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: req => req.ip + ':' + (req.body?.hotel_id || ''),
  handler: (_, res) => res.status(429).json({ error: 'too_many_requests' }),
  skipFailedRequests: true,
});

// Journalier : max 300 soumissions par IP+hôtel par 24h (borne publique)
const dailyLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 300,
  keyGenerator: req => req.ip + ':' + (req.body?.hotel_id || ''),
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

  // Commentaire : max 500 chars, strip HTML basique
  const comment = commentaire
    ? String(commentaire).replace(/<[^>]*>/g, '').trim().slice(0, 500)
    : null;

  // Calcul note globale (moyenne des catégories fournies)
  const noted = CATEGORIES.filter(c => typeof categories[c] === 'number');
  if (noted.length === 0) return res.status(400).json({ error: 'Aucune note fournie' });
  const note_globale = noted.reduce((s, c) => s + categories[c], 0) / noted.length;

  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip;

  const id = await Feedback.create({
    hotel_id,
    categories,
    commentaire: comment,
    note_globale: Math.round(note_globale * 100) / 100,
    locale: locale || 'fr',
    ip,
  });

  res.status(201).json({ id, note_globale: Math.round(note_globale * 100) / 100 });
});

module.exports = router;
