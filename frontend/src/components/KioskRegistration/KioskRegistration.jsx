import React, { useState } from 'react';
import styles from './KioskRegistration.module.css';

const API = '/api/kiosk-device';

// Récupère le Device ID Fully Kiosk si disponible, sinon génère un UUID stable
function getFingerprint() {
  // Fully Kiosk Browser expose window.fully avec getDeviceId()
  if (window.fully && typeof window.fully.getDeviceId === 'function') {
    return window.fully.getDeviceId();
  }
  // Fallback : UUID persisté en localStorage
  const stored = localStorage.getItem('connectbe_fingerprint');
  if (stored) return stored;
  const uuid = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now();
  localStorage.setItem('connectbe_fingerprint', uuid);
  return uuid;
}

export default function KioskRegistration({ onRegistered, hotelSlug }) {
  const [key, setKey]       = useState('');
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const trimmed = key.trim().toUpperCase();
    if (!trimmed) return;

    setLoading(true);
    try {
      const res  = await fetch(`${API}/register`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: trimmed, fingerprint: getFingerprint(), hotel_slug: hotelSlug }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Clé invalide');
        return;
      }

      localStorage.setItem(`connectbe_device_token_${hotelSlug}`, data.device_token);
      onRegistered({ deviceToken: data.device_token, hotelSlug: data.hotel_slug });
    } catch {
      setError('Impossible de joindre le serveur. Vérifiez la connexion.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <div className={styles.logo}>ConnectBé</div>
        <h1 className={styles.title}>Activation de la borne</h1>
        <p className={styles.subtitle}>
          Saisissez la clé d'inscription fournie par l'administrateur.
        </p>

        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            className={styles.input}
            type="text"
            value={key}
            onChange={e => setKey(e.target.value)}
            placeholder="XXXXXX-XXXXXX-XXXXXX"
            autoComplete="off"
            autoFocus
            maxLength={20}
            disabled={loading}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btn} type="submit" disabled={loading || !key.trim()}>
            {loading ? 'Vérification…' : 'Activer la borne'}
          </button>
        </form>
      </div>
    </div>
  );
}
