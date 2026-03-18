require('dotenv').config();
const express     = require('express');
const cors        = require('cors');
const helmet      = require('helmet');
const rateLimit   = require('express-rate-limit');

const weatherRoutes   = require('./routes/weather');
const eventsRoutes    = require('./routes/events');
const flightRoutes    = require('./routes/flights');
const wellnessRoutes  = require('./routes/wellness');
const poiRoutes       = require('./routes/poi');
const infoRoutes      = require('./routes/info');
const analyticsRoutes = require('./routes/analytics');
const qrRoutes        = require('./routes/qr');
const themeRoutes     = require('./routes/theme');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Sécurité ─────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));           // Ajuster en production
app.use(express.json());

// Rate limiting global
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// ── Routes ────────────────────────────────────────────
app.use('/api/weather',   weatherRoutes);
app.use('/api/events',    eventsRoutes);
app.use('/api/flights',   flightRoutes);
app.use('/api/wellness',  wellnessRoutes);
app.use('/api/poi',       poiRoutes);
app.use('/api/info',      infoRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/qr',        qrRoutes);
app.use('/api/theme',     themeRoutes);

// ── Health check ─────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── Erreur 404 ────────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: 'Route not found' }));

// ── Erreur globale ────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ ConnectBé API démarrée sur le port ${PORT}`);
});
