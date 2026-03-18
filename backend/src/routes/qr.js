const express = require('express');
const QRCode  = require('qrcode');
const router  = express.Router();

const PUBLIC_URL = process.env.KIOSK_PUBLIC_URL || 'http://localhost:3000';

// GET /api/qr?section=weather&locale=fr
// Retourne une image PNG base64 du QR code pointant vers la section mobile
router.get('/', async (req, res) => {
  const section = req.query.section || '';
  const locale  = req.query.locale  || 'fr';
  const url     = `${PUBLIC_URL}/mobile/${section}?lang=${locale}`;

  try {
    const dataUrl = await QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      margin: 2,
      width: 300,
      color: {
        dark:  '#C2782A', // Couleur primaire ConnectBé
        light: '#FDF6EC',
      },
    });
    res.json({ url, qr: dataUrl });
  } catch (err) {
    res.status(500).json({ error: 'Erreur génération QR' });
  }
});

module.exports = router;
