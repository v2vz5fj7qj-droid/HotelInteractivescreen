import React, { useEffect, useState } from 'react';
import axios from 'axios';
import styles from './Home.module.css';

const FEATURES = [
  { icon: '🌍', title: '9 langues',          desc: 'FR, EN, DE, ES, PT, AR, ZH, JA, RU' },
  { icon: '📅', title: 'Événements',          desc: 'Agenda hôtel & culturel en temps réel' },
  { icon: '🌤', title: 'Météo live',           desc: 'Prévisions 5 jours par localité' },
  { icon: '✈️', title: 'Vols & transferts',   desc: 'Départs & arrivées + QR mobile' },
  { icon: '🗺', title: 'Carte interactive',   desc: 'POI, restaurants, lieux culturels' },
  { icon: '🔔', title: 'Notifications',        desc: 'Messages rotatifs programmables' },
  { icon: '💆', title: 'Services & bien-être', desc: 'Spa, soins, activités hôtel' },
  { icon: '📞', title: 'Infos utiles',         desc: 'Contacts, horaires, urgences' },
  { icon: '✨', title: 'Et bien d\'autres…',   desc: 'Nouvelles fonctionnalités à venir' },
];

export default function Home() {
  const [hotels,  setHotels]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/hotels/public')
      .then(res => setHotels(res.data || []))
      .catch(() => setHotels([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.page}>

      {/* ── Navbar ── */}
      <nav className={styles.nav}>
        <a href="/" className={styles.navBrand}>
          <img src="/images/logo.png" alt="ConnectBé" onError={e => { e.target.style.display = 'none'; }} />
          ConnectBé
        </a>
      </nav>

      {/* ── Contenu principal — 2 colonnes ── */}
      <div className={styles.content}>

        {/* Colonne gauche — Hero */}
        <section className={styles.hero}>
          <p className={styles.heroEyebrow}>Borne interactive hôtelière</p>
          <h1 className={styles.heroTitle}>
            La borne tactile au service<br />
            de <span>l'expérience client</span>
          </h1>
          <p className={styles.heroSub}>
            Multilingue, multi-hôtel, tout-en-un.<br />
            Informez vos clients en temps réel depuis un seul backoffice.
          </p>
          <a href="/connectbe" className={styles.btnPrimary}>Voir la démo →</a>
        </section>

        {/* Colonne droite — Fonctionnalités + Bornes */}
        <aside className={styles.aside}>

          {/* Fonctionnalités */}
          <div className={styles.asideBlock}>
            <p className={styles.blockLabel}>Fonctionnalités</p>
            <div className={styles.featuresGrid}>
              {FEATURES.map(f => (
                <div key={f.title} className={styles.featureCard}>
                  <span className={styles.featureIcon}>{f.icon}</span>
                  <div className={styles.featureText}>
                    <span className={styles.featureTitle}>{f.title}</span>
                    <span className={styles.featureDesc}>{f.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.divider} />

          {/* Bornes actives */}
          <div className={styles.asideBlock}>
            <p className={styles.blockLabel}>Bornes actives</p>
            {loading ? (
              <p className={styles.hotelsLoading}>Chargement…</p>
            ) : hotels.length === 0 ? (
              <p className={styles.hotelsEmpty}>Aucune borne disponible.</p>
            ) : (
              <div className={styles.hotelsGrid}>
                {hotels.map(h => (
                  <a key={h.id} href={`/${h.slug}`} className={styles.hotelChip}>
                    {h.logo_url
                      ? <img src={h.logo_url} alt={h.nom} className={styles.hotelChipLogo} onError={e => { e.target.style.display = 'none'; }} />
                      : <span className={styles.hotelChipEmoji}>🏨</span>
                    }
                    <span className={styles.hotelChipName}>{h.nom}</span>
                    <span className={styles.hotelChipArrow}>→</span>
                  </a>
                ))}
              </div>
            )}
          </div>

        </aside>
      </div>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <span>© {new Date().getFullYear()} ConnectBé — Borne interactive hôtelière</span>
      </footer>

    </div>
  );
}
