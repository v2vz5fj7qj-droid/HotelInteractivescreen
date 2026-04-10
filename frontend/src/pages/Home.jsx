import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import styles from './Home.module.css';

const FEATURES = [
  { icon: '🌍', title: '9 langues', desc: 'Français, anglais, allemand, espagnol, portugais, arabe, chinois, japonais, russe.' },
  { icon: '📅', title: 'Agenda & événements', desc: 'Événements hôtel et culturels, filtrés et mis à jour en temps réel.' },
  { icon: '🌤', title: 'Météo en direct', desc: 'Prévisions 5 jours depuis OpenWeatherMap, localisées par hôtel.' },
  { icon: '✈️', title: 'Vols & transferts', desc: 'Départs & arrivées en direct depuis FlightAPI, QR code de transfert mobile.' },
  { icon: '🗺', title: 'Carte interactive', desc: 'Points d\'intérêt, restaurants, lieux culturels sur OpenStreetMap.' },
  { icon: '🔔', title: 'Notifications borne', desc: 'Messages rotatifs multilingues, programmables par l\'hôtel.' },
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
        <a href="/admin" className={styles.navAdmin}>
          Administration →
        </a>
      </nav>

      {/* ── Hero ── */}
      <section className={styles.hero}>
        <p className={styles.heroEyebrow}>Borne interactive hôtelière</p>
        <h1 className={styles.heroTitle}>
          La borne tactile au service<br />de <span>l'expérience client</span>
        </h1>
        <p className={styles.heroSub}>
          Multilingue, multi-hôtel, tout-en-un. Informez vos clients en temps réel,
          sans effort, depuis un seul backoffice.
        </p>
        <div className={styles.heroActions}>
          <a href="/connectbe" className={styles.btnPrimary}>Voir la démo →</a>
          <a href="/admin" className={styles.btnSecondary}>Accéder à l'administration</a>
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── Fonctionnalités ── */}
      <section className={styles.section}>
        <p className={styles.sectionTitle}>Fonctionnalités</p>
        <h2 className={styles.sectionHeading}>Tout ce dont votre lobby a besoin</h2>
        <div className={styles.featuresGrid}>
          {FEATURES.map(f => (
            <div key={f.title} className={styles.featureCard}>
              <div className={styles.featureIcon}>{f.icon}</div>
              <div className={styles.featureTitle}>{f.title}</div>
              <div className={styles.featureDesc}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      <div className={styles.divider} />

      {/* ── Bornes actives ── */}
      <section className={`${styles.section} ${styles.hotelsSectionBg}`}>
        <p className={styles.sectionTitle}>Bornes actives</p>
        <h2 className={styles.sectionHeading}>Accéder directement à une borne</h2>

        {loading ? (
          <p className={styles.hotelsLoading}>Chargement…</p>
        ) : hotels.length === 0 ? (
          <p className={styles.hotelsEmpty}>Aucune borne disponible pour le moment.</p>
        ) : (
          <div className={styles.hotelsGrid}>
            {hotels.map(h => (
              <div key={h.id} className={styles.hotelCard}>
                <div className={styles.hotelCardHeader}>
                  {h.logo_url ? (
                    <img
                      src={h.logo_url}
                      alt={h.nom}
                      className={styles.hotelCardLogo}
                      onError={e => { e.target.style.display = 'none'; }}
                    />
                  ) : (
                    <div className={styles.hotelCardLogoPlaceholder}>🏨</div>
                  )}
                </div>
                <div className={styles.hotelCardBody}>
                  <div className={styles.hotelCardName}>{h.nom}</div>
                  {h.adresse && <div className={styles.hotelCardAddr}>{h.adresse}</div>}
                  <a href={`/${h.slug}`} className={styles.hotelCardLink}>
                    Accéder à la borne →
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Footer ── */}
      <footer className={styles.footer}>
        <span className={styles.footerCopy}>© {new Date().getFullYear()} ConnectBé — Borne interactive hôtelière</span>
        <a href="/admin" className={styles.footerAdminLink}>Administration</a>
      </footer>
    </div>
  );
}
