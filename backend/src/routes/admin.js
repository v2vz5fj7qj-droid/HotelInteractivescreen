const express   = require('express');
const jwt       = require('jsonwebtoken');
const multer    = require('multer');
const path      = require('path');
const fs        = require('fs');
const db        = require('../services/db');
const cache     = require('../services/cacheService');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();
const SECRET = process.env.JWT_SECRET || 'connectbe_dev_secret';

// ── Upload logo ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: path.resolve(__dirname, '../../../uploads'),
  filename:    (_, file, cb) => cb(null, `logo_${Date.now()}${path.extname(file.originalname)}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 Mo max
  fileFilter: (_, file, cb) => {
    const ok = /image\/(png|jpeg|svg\+xml|webp)/.test(file.mimetype);
    cb(ok ? null : new Error('Format non supporté'), ok);
  },
});

// ── Upload images POI ─────────────────────────────────
const poiImgDir     = path.resolve(__dirname, '../../../uploads/poi');
const poiImgStorage = multer.diskStorage({
  destination: (req, file, cb) => { fs.mkdirSync(poiImgDir, { recursive: true }); cb(null, poiImgDir); },
  filename:    (_, file, cb) => cb(null, `poi_${Date.now()}${path.extname(file.originalname)}`),
});
const uploadPoiImg = multer({
  storage:    poiImgStorage,
  limits:     { fileSize: 3 * 1024 * 1024 },
  fileFilter: (_, file, cb) => {
    const ok = /image\/(png|jpeg|webp)/.test(file.mimetype);
    cb(ok ? null : new Error('Format non supporté'), ok);
  },
});

// ════════════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════════════

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const validUser = process.env.ADMIN_USERNAME || 'admin';
  const validPass = process.env.ADMIN_PASSWORD || 'connectbe2026';
if (username !== validUser || password !== validPass) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }

  const token = jwt.sign({ username, role: 'admin' }, SECRET, { expiresIn: '8h' });
  res.json({ token, expiresIn: 28800 });
});

// POST /api/admin/logout (révocation côté client — token non invalidé côté serveur)
router.post('/logout', adminAuth, (req, res) => res.json({ ok: true }));

// ════════════════════════════════════════════════════════
//  BIEN-ÊTRE
// ════════════════════════════════════════════════════════

// GET /api/admin/wellness
router.get('/wellness', adminAuth, async (req, res) => {
  try {
    const [services] = await db.query(`
      SELECT s.*,
        JSON_OBJECTAGG(t.locale, JSON_OBJECT('name', t.name, 'description', t.description)) AS translations
      FROM wellness_services s
      LEFT JOIN wellness_service_translations t ON t.service_id = s.id
      GROUP BY s.id ORDER BY s.id
    `);
    res.json(services.map(s => ({
      ...s,
      translations: typeof s.translations === 'string' ? JSON.parse(s.translations) : s.translations,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/admin/wellness
router.post('/wellness', adminAuth, async (req, res) => {
  const { slug, duration_min, price_fcfa, available_hours, available_days, image_url, video_url, translations } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO wellness_services (slug, duration_min, price_fcfa, available_hours, available_days, image_url, video_url) VALUES (?,?,?,?,?,?,?)`,
      [slug, duration_min, price_fcfa, available_hours || null, available_days || null, image_url || null, video_url || null]
    );
    const id = result.insertId;
    for (const [locale, tr] of Object.entries(translations || {})) {
      await conn.query(
        `INSERT INTO wellness_service_translations (service_id, locale, name, description) VALUES (?,?,?,?)`,
        [id, locale, tr.name, tr.description || null]
      );
    }
    await conn.commit();
    await cache.delPattern('wellness:*');
    res.status(201).json({ id });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// PUT /api/admin/wellness/:id
router.put('/wellness/:id', adminAuth, async (req, res) => {
  const { duration_min, price_fcfa, available_hours, available_days, image_url, video_url, is_active, translations } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE wellness_services SET duration_min=?, price_fcfa=?, available_hours=?, available_days=?, image_url=?, video_url=?, is_active=? WHERE id=?`,
      [duration_min, price_fcfa, available_hours || null, available_days || null, image_url || null, video_url || null, is_active ?? 1, req.params.id]
    );
    for (const [locale, tr] of Object.entries(translations || {})) {
      await conn.query(
        `INSERT INTO wellness_service_translations (service_id, locale, name, description) VALUES (?,?,?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description)`,
        [req.params.id, locale, tr.name, tr.description || null]
      );
    }
    await conn.commit();
    await cache.delPattern('wellness:*');
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// DELETE /api/admin/wellness/:id
router.delete('/wellness/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM wellness_services WHERE id=?', [req.params.id]);
    await cache.delPattern('wellness:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  AGENDA
// ════════════════════════════════════════════════════════

// GET /api/admin/events
router.get('/events', adminAuth, async (req, res) => {
  try {
    const [events] = await db.query(`
      SELECT e.*,
        JSON_OBJECTAGG(t.locale, JSON_OBJECT('title', t.title, 'description', t.description, 'tags', t.tags)) AS translations
      FROM events e
      LEFT JOIN event_translations t ON t.event_id = e.id
      GROUP BY e.id ORDER BY e.start_date DESC
    `);
    res.json(events.map(e => ({
      ...e,
      translations: typeof e.translations === 'string' ? JSON.parse(e.translations) : e.translations,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/events
router.post('/events', adminAuth, async (req, res) => {
  const { slug, category, start_date, end_date, start_time, end_time, location, lat, lng, price_fcfa, image_url, is_featured, display_order, translations } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      `INSERT INTO events (slug, category, start_date, end_date, start_time, end_time, location, lat, lng, price_fcfa, image_url, is_featured, display_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [slug, category, start_date, end_date || null, start_time || null, end_time || null, location || null, lat || null, lng || null, price_fcfa || 0, image_url || null, is_featured ? 1 : 0, display_order || 0]
    );
    const id = result.insertId;
    for (const [locale, tr] of Object.entries(translations || {})) {
      await conn.query(
        `INSERT INTO event_translations (event_id, locale, title, description, tags) VALUES (?,?,?,?,?)`,
        [id, locale, tr.title, tr.description || null, tr.tags || null]
      );
    }
    await conn.commit();
    await cache.delPattern('events:*');
    res.status(201).json({ id });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// PUT /api/admin/events/:id
router.put('/events/:id', adminAuth, async (req, res) => {
  const { category, start_date, end_date, start_time, end_time, location, lat, lng, price_fcfa, image_url, is_featured, is_active, display_order, translations } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      `UPDATE events SET category=?, start_date=?, end_date=?, start_time=?, end_time=?, location=?, lat=?, lng=?, price_fcfa=?, image_url=?, is_featured=?, is_active=?, display_order=? WHERE id=?`,
      [category, start_date, end_date || null, start_time || null, end_time || null, location || null, lat || null, lng || null, price_fcfa || 0, image_url || null, is_featured ? 1 : 0, is_active ?? 1, display_order || 0, req.params.id]
    );
    for (const [locale, tr] of Object.entries(translations || {})) {
      await conn.query(
        `INSERT INTO event_translations (event_id, locale, title, description, tags) VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE title=VALUES(title), description=VALUES(description), tags=VALUES(tags)`,
        [req.params.id, locale, tr.title, tr.description || null, tr.tags || null]
      );
    }
    await conn.commit();
    await cache.delPattern('events:*');
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// DELETE /api/admin/events/:id
router.delete('/events/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM events WHERE id=?', [req.params.id]);
    await cache.delPattern('events:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  NOTIFICATIONS (Bon à savoir)
// ════════════════════════════════════════════════════════

router.get('/notifications', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM notifications ORDER BY display_order, id');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/notifications', adminAuth, async (req, res) => {
  const { message_fr, message_en, display_order } = req.body;
  try {
    const [r] = await db.query(
      'INSERT INTO notifications (message_fr, message_en, display_order) VALUES (?,?,?)',
      [message_fr, message_en || message_fr, display_order || 0]
    );
    await cache.delPattern('notifications:*');
    res.status(201).json({ id: r.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/notifications/:id', adminAuth, async (req, res) => {
  const { message_fr, message_en, is_active, display_order } = req.body;
  try {
    await db.query(
      'UPDATE notifications SET message_fr=?, message_en=?, is_active=?, display_order=? WHERE id=?',
      [message_fr, message_en || message_fr, is_active ?? 1, display_order || 0, req.params.id]
    );
    await cache.delPattern('notifications:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/notifications/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE id=?', [req.params.id]);
    await cache.delPattern('notifications:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  CARTE / POI
// ════════════════════════════════════════════════════════

router.get('/poi', adminAuth, async (req, res) => {
  try {
    const [pois] = await db.query(`
      SELECT p.*,
        JSON_OBJECTAGG(t.locale, JSON_OBJECT('name', t.name, 'address', t.address, 'description', t.description)) AS translations
      FROM points_of_interest p
      LEFT JOIN poi_translations t ON t.poi_id = p.id
      GROUP BY p.id ORDER BY p.category, p.id
    `);
    const ids = pois.map(p => p.id);
    let images = [];
    try {
      if (ids.length) {
        [images] = await db.query(
          'SELECT id, poi_id, url, display_order FROM poi_images WHERE poi_id IN (?) ORDER BY poi_id, display_order',
          [ids]
        );
      }
    } catch (_) { /* table poi_images absente — migration requise */ }
    const imgMap = {};
    for (const img of images) {
      if (!imgMap[img.poi_id]) imgMap[img.poi_id] = [];
      imgMap[img.poi_id].push(img);
    }
    res.json(pois.map(p => ({
      ...p,
      translations: typeof p.translations === 'string' ? JSON.parse(p.translations) : p.translations,
      images: imgMap[p.id] || [],
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/poi', adminAuth, async (req, res) => {
  const { category, lat, lng, phone, website, translations } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO points_of_interest (category, lat, lng, phone, website) VALUES (?,?,?,?,?)',
      [category, lat, lng, phone || null, website || null]
    );
    const id = result.insertId;
    for (const [locale, tr] of Object.entries(translations || {})) {
      await conn.query(
        'INSERT INTO poi_translations (poi_id, locale, name, address, description) VALUES (?,?,?,?,?)',
        [id, locale, tr.name, tr.address || null, tr.description || null]
      );
    }
    await conn.commit();
    await cache.delPattern('poi:*');
    res.status(201).json({ id });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

router.put('/poi/:id', adminAuth, async (req, res) => {
  const { category, lat, lng, phone, website, is_active, translations } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE points_of_interest SET category=?, lat=?, lng=?, phone=?, website=?, is_active=? WHERE id=?',
      [category, lat, lng, phone || null, website || null, is_active ?? 1, req.params.id]
    );
    for (const [locale, tr] of Object.entries(translations || {})) {
      await conn.query(
        `INSERT INTO poi_translations (poi_id, locale, name, address, description) VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), address=VALUES(address), description=VALUES(description)`,
        [req.params.id, locale, tr.name, tr.address || null, tr.description || null]
      );
    }
    await conn.commit();
    await cache.delPattern('poi:*');
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

// POST /api/admin/poi/:id/images — upload (max 3 par POI)
router.post('/poi/:id/images', adminAuth, uploadPoiImg.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  const poiId = req.params.id;
  try {
    const [[{ count }]] = await db.query('SELECT COUNT(*) AS count FROM poi_images WHERE poi_id=?', [poiId]);
    if (count >= 3) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Maximum 3 images par point d\'intérêt' });
    }
    const url = `/uploads/poi/${req.file.filename}`;
    const [r] = await db.query(
      'INSERT INTO poi_images (poi_id, url, display_order) VALUES (?,?,?)',
      [poiId, url, count]
    );
    await cache.delPattern('poi:*');
    res.status(201).json({ id: r.insertId, url });
  } catch (err) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/admin/poi/images/:imageId
router.delete('/poi/images/:imageId', adminAuth, async (req, res) => {
  try {
    const [[img]] = await db.query('SELECT * FROM poi_images WHERE id=?', [req.params.imageId]);
    if (!img) return res.status(404).json({ error: 'Image non trouvée' });
    const filePath = path.resolve(__dirname, '../../../', img.url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await db.query('DELETE FROM poi_images WHERE id=?', [req.params.imageId]);
    await cache.delPattern('poi:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/poi/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM points_of_interest WHERE id=?', [req.params.id]);
    await cache.delPattern('poi:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  CONTACTS UTILES (Infos utiles)
// ════════════════════════════════════════════════════════

router.get('/info', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.*,
        JSON_OBJECTAGG(t.locale, JSON_OBJECT('name', t.name, 'description', t.description, 'address', t.address)) AS translations
      FROM useful_contacts c
      LEFT JOIN useful_contact_translations t ON t.contact_id = c.id
      GROUP BY c.id ORDER BY c.display_order, c.id
    `);
    res.json(rows.map(r => ({
      ...r,
      translations: typeof r.translations === 'string' ? JSON.parse(r.translations) : r.translations,
    })));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/info', adminAuth, async (req, res) => {
  const { category, phone, whatsapp, website, available_24h, display_order, translations } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.query(
      'INSERT INTO useful_contacts (category, phone, whatsapp, website, available_24h, display_order) VALUES (?,?,?,?,?,?)',
      [category, phone || null, whatsapp || null, website || null, available_24h ? 1 : 0, display_order || 0]
    );
    const id = result.insertId;
    for (const [locale, tr] of Object.entries(translations || {})) {
      await conn.query(
        'INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES (?,?,?,?,?)',
        [id, locale, tr.name, tr.description || null, tr.address || null]
      );
    }
    await conn.commit();
    await cache.delPattern('info:*');
    res.status(201).json({ id });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

router.put('/info/:id', adminAuth, async (req, res) => {
  const { category, phone, whatsapp, website, available_24h, is_active, display_order, translations } = req.body;
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'UPDATE useful_contacts SET category=?, phone=?, whatsapp=?, website=?, available_24h=?, is_active=?, display_order=? WHERE id=?',
      [category, phone || null, whatsapp || null, website || null, available_24h ? 1 : 0, is_active ?? 1, display_order || 0, req.params.id]
    );
    for (const [locale, tr] of Object.entries(translations || {})) {
      await conn.query(
        `INSERT INTO useful_contact_translations (contact_id, locale, name, description, address) VALUES (?,?,?,?,?)
         ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), address=VALUES(address)`,
        [req.params.id, locale, tr.name, tr.description || null, tr.address || null]
      );
    }
    await conn.commit();
    await cache.delPattern('info:*');
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally { conn.release(); }
});

router.delete('/info/:id', adminAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM useful_contacts WHERE id=?', [req.params.id]);
    await cache.delPattern('info:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  LOCALITÉS
// ════════════════════════════════════════════════════════

router.get('/localities', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM localities ORDER BY display_order, name');
    res.json(rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/localities', adminAuth, async (req, res) => {
  const { name, country, owm_city_id, lat, lng, timezone, is_active, is_default, display_order } = req.body;
  try {
    if (is_default) await db.query('UPDATE localities SET is_default = 0');
    const [r] = await db.query(
      'INSERT INTO localities (name, country, owm_city_id, lat, lng, timezone, is_active, is_default, display_order) VALUES (?,?,?,?,?,?,?,?,?)',
      [name, country || 'Burkina Faso', owm_city_id || null, lat || null, lng || null,
       timezone || 'Africa/Ouagadougou', is_active ?? 1, is_default ? 1 : 0, display_order || 0]
    );
    await cache.delPattern('weather:*');
    res.status(201).json({ id: r.insertId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/localities/:id', adminAuth, async (req, res) => {
  const { name, country, owm_city_id, lat, lng, timezone, is_active, is_default, display_order } = req.body;
  try {
    if (is_default) await db.query('UPDATE localities SET is_default = 0 WHERE id != ?', [req.params.id]);
    await db.query(
      'UPDATE localities SET name=?, country=?, owm_city_id=?, lat=?, lng=?, timezone=?, is_active=?, is_default=?, display_order=? WHERE id=?',
      [name, country, owm_city_id || null, lat || null, lng || null,
       timezone, is_active ?? 1, is_default ? 1 : 0, display_order || 0, req.params.id]
    );
    await cache.delPattern('weather:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/localities/:id', adminAuth, async (req, res) => {
  try {
    const [[loc]] = await db.query('SELECT is_default FROM localities WHERE id=?', [req.params.id]);
    if (loc?.is_default) return res.status(400).json({ error: 'Impossible de supprimer la localité par défaut' });
    await db.query('DELETE FROM localities WHERE id=?', [req.params.id]);
    await cache.delPattern('weather:*');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  MÉTÉO — RAFRAÎCHISSEMENT MANUEL
// ════════════════════════════════════════════════════════

const { refreshAllLocalities } = require('../services/weatherRefresh');

// POST /api/admin/weather/refresh
router.post('/weather/refresh', adminAuth, async (req, res) => {
  try {
    const result = await refreshAllLocalities();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════
//  VOLS — CONFIGURATION & RAFRAÎCHISSEMENT
// ════════════════════════════════════════════════════════

const { getFlightConfig, refreshFlights, startFlightScheduler } = require('../services/flightRefresh');
const { getCreditsStats, resetCredits } = require('../services/creditTracker');

// GET /api/admin/flights/config
router.get('/flights/config', adminAuth, async (req, res) => {
  try {
    res.json(await getFlightConfig());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// PUT /api/admin/flights/config
router.put('/flights/config', adminAuth, async (req, res) => {
  const { airport_iata, refresh_interval, auto_refresh, credits_limit, refresh_mode, schedule_times, timezone } = req.body;
  try {
    const validTimes = (Array.isArray(schedule_times) ? schedule_times : [])
      .map(Number)
      .filter(n => !isNaN(n) && n >= 0 && n <= 23);

    const updates = {
      flight_airport_iata:     (airport_iata || 'OUA').toUpperCase().trim(),
      flight_refresh_interval: String(Math.min(1440, Math.max(1, parseInt(refresh_interval || '5', 10)))),
      flight_auto_refresh:     auto_refresh ? '1' : '0',
      flight_refresh_mode:     refresh_mode === 'schedule' ? 'schedule' : 'interval',
      flight_schedule_times:   validTimes.join(','),
      flight_timezone:         timezone || 'Africa/Ouagadougou',
      ...(credits_limit !== undefined && {
        flight_credits_limit: String(Math.max(1, parseInt(credits_limit, 10))),
      }),
    };
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        `INSERT INTO theme_config (config_key, config_value) VALUES (?,?)
         ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)`,
        [key, value]
      );
    }
    await cache.delPattern('flights:*');
    await startFlightScheduler(); // applique le nouvel intervalle
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/flights/refresh
router.post('/flights/refresh', adminAuth, async (req, res) => {
  try {
    const result = await refreshFlights();
    res.json({ ok: true, ...result });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/admin/flights/debug — vérifie la clé et retourne la réponse brute FlightAPI
router.get('/flights/debug', adminAuth, async (req, res) => {
  const FLIGHT_KEY = process.env.FLIGHTAPI_KEY;
  if (!FLIGHT_KEY) return res.json({ error: 'FLIGHTAPI_KEY absente de process.env' });

  const config = await getFlightConfig().catch(() => ({ airport_iata: 'OUA' }));
  const airport = config.airport_iata;

  try {
    const response = await require('axios').get(`https://api.flightapi.io/compschedule/${FLIGHT_KEY}`, {
      params: { mode: 'arrivals', iata: airport, day: 0 },
      timeout: 10000,
    });
    res.json({
      key_present: true,
      airport,
      status: response.status,
      flights_count: response.data?.[0]?.airport?.pluginData?.schedule?.arrivals?.data?.length ?? 0,
      raw_sample: response.data?.[0]?.airport?.pluginData?.schedule?.arrivals?.data?.[0] ?? null,
    });
  } catch (err) {
    res.json({
      key_present: true,
      airport,
      error: err.message,
      response_data: err.response?.data,
      status: err.response?.status,
    });
  }
});

// GET /api/admin/flights/credits
router.get('/flights/credits', adminAuth, async (req, res) => {
  try {
    res.json(await getCreditsStats());
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/flights/credits/reset
router.post('/flights/credits/reset', adminAuth, async (req, res) => {
  try {
    await resetCredits();
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  ANALYTICS (résumé protégé pour le backoffice)
// ════════════════════════════════════════════════════════

router.get('/analytics', adminAuth, async (req, res) => {
  const days = parseInt(req.query.days || '7', 10);
  try {
    const [bySection] = await db.query(`
      SELECT section, COUNT(*) AS total, COUNT(DISTINCT session_id) AS unique_sessions
      FROM analytics_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY section ORDER BY total DESC
    `, [days]);

    const [byDay] = await db.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS day, COUNT(*) AS total
      FROM analytics_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY day ORDER BY day ASC
    `, [days]);

    const [totals] = await db.query(`
      SELECT COUNT(*) AS total_events, COUNT(DISTINCT session_id) AS total_sessions
      FROM analytics_events
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days]);

    res.json({ bySection, byDay, ...totals[0], days });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ════════════════════════════════════════════════════════
//  THÈME
// ════════════════════════════════════════════════════════

router.get('/theme', adminAuth, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT config_key, config_value FROM theme_config');
    const config = Object.fromEntries(rows.map(r => [r.config_key, r.config_value]));
    res.json({ config });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/theme', adminAuth, async (req, res) => {
  const { updates } = req.body;
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'updates requis' });
  }
  try {
    for (const [key, value] of Object.entries(updates)) {
      await db.query(
        `INSERT INTO theme_config (config_key, config_value) VALUES (?,?)
         ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)`,
        [key, value]
      );
    }
    await cache.del('theme:config');
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/theme/logo — upload d'image
router.post('/theme/logo', adminAuth, upload.single('logo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  const publicPath = `/uploads/${req.file.filename}`;
  try {
    await db.query(
      `INSERT INTO theme_config (config_key, config_value) VALUES ('logo_url', ?)
       ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)`,
      [publicPath]
    );
    await cache.del('theme:config');
    res.json({ url: publicPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/admin/theme/banner — upload image de fond bannière
router.post('/theme/banner', adminAuth, upload.single('banner'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier manquant' });
  const publicPath = `/uploads/${req.file.filename}`;
  try {
    await db.query(
      `INSERT INTO theme_config (config_key, config_value) VALUES ('banner_image_url', ?)
       ON DUPLICATE KEY UPDATE config_value=VALUES(config_value)`,
      [publicPath]
    );
    await cache.del('theme:config');
    res.json({ url: publicPath });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
