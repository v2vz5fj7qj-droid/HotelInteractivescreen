import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { useLanguage } from '../../contexts/LanguageContext';
import api from '../../services/api';
import styles from './Guest.module.css';

const CODE_LENGTH = 6;

/**
 * Saisie du code de séjour sur la borne → QR code à scanner.
 *
 * Le client tape le code reçu à la réception et repart avec le menu complet sur
 * son téléphone. La borne n'entame PAS le quota d'appareils du séjour : elle
 * appelle /api/guest/qr, qui valide le code sans créer de session.
 *
 * Aucune donnée nominative n'est affichée ici — l'écran est visible de tout le
 * hall, et un inconnu qui essaierait des codes au hasard ne doit rien apprendre
 * sur les clients. Seule la date de fin de validité s'affiche.
 *
 * `headingId` laisse la section qui l'accueille référencer son titre avec
 * aria-labelledby, sans dupliquer un second titre par-dessus.
 */
/**
 * Adresse à saisir au clavier. Destinée au client qui préfère consulter depuis
 * son ordinateur : un QR code ne lui est d'aucune utilité devant un écran de PC.
 * Affichée sans le protocole — plus courte à lire et à taper, les navigateurs
 * complètent d'eux-mêmes.
 */
function TypeableUrl({ hotelSlug, t }) {
  return (
    <div className={styles.kioskUrl}>
      <span className={styles.kioskUrlLabel}>{t('guest.url_desktop')}</span>
      <span className={styles.kioskUrlValue}>
        {window.location.host}/{hotelSlug}/visiteur
      </span>
    </div>
  );
}

export default function GuestCodeQr({ headingId }) {
  const { t }         = useLanguage();
  const { hotelSlug } = useParams();

  const [code,    setCode]    = useState('');
  const [result,  setResult]  = useState(null);  // { path, valid_until }
  const [reason,  setReason]  = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    // Le bouton n'est jamais désactivé : sur une borne, un bouton grisé
    // n'explique rien. Un code incomplet affiche donc un message, pas un
    // bouton inerte.
    if (code.length !== CODE_LENGTH) {
      setReason('incomplete');
      return;
    }

    setLoading(true);
    setReason(null);
    try {
      const { data } = await api.post('/guest/qr', { hotel_slug: hotelSlug, code });
      setResult(data);
    } catch (err) {
      const raw = err.response?.data?.reason;
      setReason(err.response ? (raw || 'invalid') : 'network');
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setResult(null);
    setCode('');
    setReason(null);
  }

  if (result) {
    const url = `${window.location.origin}${result.path}`;
    return (
      <div className={styles.kioskBox}>
        <div className={styles.kioskQr}>
          <QRCodeSVG value={url} size={320} level="M" includeMargin={false} />
          <p className={styles.kioskQrCaption}>{t('guest.kiosk_scan')}</p>
        </div>
        <p className={styles.gateText}>
          {t('guest.kiosk_valid_until')}{' '}
          {new Date(result.valid_until).toLocaleDateString()}
        </p>
        <TypeableUrl hotelSlug={hotelSlug} t={t} />
        <button type="button" className={styles.primaryBtn} onClick={reset}>
          {t('guest.kiosk_reset')}
        </button>
      </div>
    );
  }

  return (
    <form className={styles.kioskBox} onSubmit={handleSubmit}>
      <h2 id={headingId} className={styles.gateTitle}>{t('guest.kiosk_title')}</h2>
      <p className={styles.gateText}>{t('guest.kiosk_intro')}</p>

      <label className={styles.kioskLabel} htmlFor="guest-code-kiosk">
        {t('guest.code_label')}
      </label>
      <input
        id="guest-code-kiosk"
        className={styles.kioskInput}
        value={code}
        onChange={e => {
          setReason(null);
          setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH));
        }}
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck="false"
        placeholder="••••••"
        aria-invalid={reason ? 'true' : undefined}
        aria-describedby={reason ? 'guest-code-kiosk-msg' : 'guest-code-kiosk-hint'}
      />

      {reason
        ? <p id="guest-code-kiosk-msg" className={styles.gateError} role="alert">
            {t(`guest.error_${reason}`)}
          </p>
        : <p id="guest-code-kiosk-hint" className={styles.kioskHint}>
            {t('guest.code_hint')}
          </p>}

      <button type="submit" className={styles.primaryBtn} disabled={loading}>
        {loading ? t('guest.checking') : t('guest.kiosk_submit')}
      </button>

      <TypeableUrl hotelSlug={hotelSlug} t={t} />
    </form>
  );
}
