// Charge .env depuis backend/ en priorité, sinon remonte à la racine du projet
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), override: true });

const express  = require('express');
const cors     = require('cors');
const helmet   = require('helmet');
const rateLimit = require('express-rate-limit');

const adminAuth  = require('./middleware/adminAuth');
const hotelCtx   = require('./middleware/hotelContext');
const requireRole = require('./middleware/requireRole');

// ── Routes publiques (borne kiosque) ─────────────────────────────
const weatherRoutes      = require('./routes/weather');
const eventsRoutes       = require('./routes/events');
const flightRoutes       = require('./routes/flights');
const wellnessRoutes     = require('./routes/wellness');
const poiRoutes          = require('./routes/poi');
const infoRoutes         = require('./routes/info');
const analyticsRoutes    = require('./routes/analytics');
const qrRoutes           = require('./routes/qr');
const themeRoutes        = require('./routes/theme');
const notificationsRoutes = require('./routes/notifications');
const translateRoutes    = require('./routes/translate');

// ── Routes admin (ancien monolithe — rétrocompatibilité) ──────────
const adminRoutesLegacy  = require('./routes/admin');

// ── Routes admin v2 multi-hôtels ─────────────────────────────────
const authRoutes         = require('./routes/admin/auth');

// Super-admin
const superHotelsRoutes     = require('./routes/admin/super/hotels');
const superUsersRoutes      = require('./routes/admin/super/users');
const superAirportsRoutes   = require('./routes/admin/super/airports');
const superPlacesRoutes     = require('./routes/admin/super/places');
const superEventsRoutes     = require('./routes/admin/super/events');
const superInfoRoutes       = require('./routes/admin/super/info');
const superCategoriesRoutes = require('./routes/admin/super/serviceCategories');
const superWeatherRoutes    = require('./routes/admin/super/weather');
const superTokensRoutes     = require('./routes/admin/super/tokens');

// Hotel-admin
const hotelSettingsRoutes       = require('./routes/admin/hotel/settings');
const hotelServicesRoutes       = require('./routes/admin/hotel/services');
const hotelTipsRoutes           = require('./routes/admin/hotel/tips');
const hotelEventsRoutes         = require('./routes/admin/hotel/events');
const hotelNotificationsRoutes  = require('./routes/admin/hotel/notifications');

// Contributeur
const contribPlacesRoutes = require('./routes/admin/contributor/places');
const contribEventsRoutes = require('./routes/admin/contributor/events');
const contribInfoRoutes   = require('./routes/admin/contributor/info');

// ── Services ─────────────────────────────────────────────────────
const { startWeatherScheduler }  = require('./services/weatherRefresh');
const { startFlightScheduler }   = require('./services/flightRefresh');
const { startArchiveScheduler }  = require('./services/archiveService');

const app  = express();
const PORT = process.env.PORT || 4000;

// ── Sécurité ─────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: '*' }));   // Restreindre en production
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// ── Routes publiques ─────────────────────────────────────────────
app.use('/api/weather',       weatherRoutes);
app.use('/api/events',        eventsRoutes);
app.use('/api/flights',       flightRoutes);
app.use('/api/wellness',      wellnessRoutes);
app.use('/api/poi',           poiRoutes);
app.use('/api/info',          infoRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/qr',            qrRoutes);
app.use('/api/theme',         themeRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/translate',     translateRoutes);

// ── Auth (public — pas de middleware auth) ────────────────────────
app.use('/api/admin', authRoutes);

// ── Routes admin v2 (protégées — auth + contexte hôtel) ──────────
const adminV2 = express.Router();
adminV2.use(adminAuth, hotelCtx);

// Super-admin
adminV2.use('/super/hotels',            requireRole('super_admin'), superHotelsRoutes);
adminV2.use('/super/users',             requireRole('super_admin'), superUsersRoutes);
adminV2.use('/super/airports',          requireRole('super_admin'), superAirportsRoutes);
adminV2.use('/super/places',            requireRole('super_admin'), superPlacesRoutes);
adminV2.use('/super/events',            requireRole('super_admin'), superEventsRoutes);
adminV2.use('/super/info',              requireRole('super_admin'), superInfoRoutes);
adminV2.use('/super/service-categories',requireRole('super_admin'), superCategoriesRoutes);
adminV2.use('/super/weather',           requireRole('super_admin'), superWeatherRoutes);
adminV2.use('/super/tokens',            requireRole('super_admin'), superTokensRoutes);

// Hotel-admin (+ super-admin peut tout faire)
adminV2.use('/hotel/settings',          requireRole('super_admin','hotel_admin'), hotelSettingsRoutes);
adminV2.use('/hotel/services',          requireRole('super_admin','hotel_admin'), hotelServicesRoutes);
adminV2.use('/hotel/tips',              requireRole('super_admin','hotel_admin'), hotelTipsRoutes);
adminV2.use('/hotel/events',            requireRole('super_admin','hotel_admin','hotel_staff'), hotelEventsRoutes);
adminV2.use('/hotel/notifications',     requireRole('super_admin','hotel_admin'), hotelNotificationsRoutes);

// Contributeur
adminV2.use('/contributor/places', requireRole('contributor'), contribPlacesRoutes);
adminV2.use('/contributor/events', requireRole('contributor'), contribEventsRoutes);
adminV2.use('/contributor/info',   requireRole('contributor'), contribInfoRoutes);

app.use('/api/admin', adminV2);

// ── Routes admin legacy (rétrocompatibilité — ancien backoffice mono-hôtel) ──
app.use('/api/admin', adminRoutesLegacy);

// ── Uploads ──────────────────────────────────────────────────────
app.use('/uploads', express.static(path.resolve(__dirname, '../../uploads')));

// ── Health check ─────────────────────────────────────────────────
app.get('/api/health', (_, res) => res.json({ status: 'ok', ts: Date.now() }));

// ── 404 ──────────────────────────────────────────────────────────
app.use((_, res) => res.status(404).json({ error: 'Route not found' }));

// ── Erreur globale ────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Démarrage ─────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ ConnectBé API démarrée sur le port ${PORT}`);
  startWeatherScheduler();
  startFlightScheduler().catch(e => console.error('[Flights Scheduler]', e.message));
  startArchiveScheduler();
});
