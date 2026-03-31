import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useLanguage }  from '../../../contexts/LanguageContext';
import { useApi }       from '../../../hooks/useApi';
import { trackEvent }   from '../../../services/analytics';
import BackButton       from '../../BackButton/BackButton';
import LanguageSwitcher from '../../LanguageSwitcher/LanguageSwitcher';
import ThemeToggle      from '../../ThemeToggle/ThemeToggle';
import styles           from './MapSection.module.css';

const HOTEL_LAT  = parseFloat(import.meta.env.VITE_HOTEL_LAT  || '12.3641');
const HOTEL_LNG  = parseFloat(import.meta.env.VITE_HOTEL_LNG  || '-1.5332');
const HOTEL_NAME = import.meta.env.VITE_HOTEL_NAME || 'ConnectBé';

const CATEGORIES = [
  { key: 'all',        labelFr: 'Tout',        labelEn: 'All',         icon: '📍', color: '#C2782A' },
  { key: 'restaurant', labelFr: 'Restaurants', labelEn: 'Restaurants', icon: '🍽️', color: '#E8521A' },
  { key: 'museum',     labelFr: 'Musées',      labelEn: 'Museums',     icon: '🏛️', color: '#D4A843' },
  { key: 'attraction', labelFr: 'Attractions', labelEn: 'Attractions', icon: '🎯', color: '#8B4F12' },
  { key: 'pharmacy',   labelFr: 'Pharmacies',  labelEn: 'Pharmacies',  icon: '💊', color: '#27ae60' },
  { key: 'hospital',   labelFr: 'Hôpitaux',    labelEn: 'Hospitals',   icon: '🏥', color: '#e74c3c' },
  { key: 'taxi',       labelFr: 'Taxis',       labelEn: 'Taxis',       icon: '🚖', color: '#f39c12' },
  { key: 'market',     labelFr: 'Marchés',     labelEn: 'Markets',     icon: '🛍️', color: '#9b59b6' },
];
const CAT_META = Object.fromEntries(CATEGORIES.map(c => [c.key, c]));

const BUBBLE_W  = 300; // largeur fixe pour le calcul de positionnement
const ARROW_H   = 14;  // hauteur de la queue triangulaire
const MARKER_H  = 32;  // hauteur du pin marqueur

function makePinIcon(emoji, color) {
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${color};border:2px solid #fff;border-radius:50% 50% 50% 0;
      transform:rotate(-45deg);width:${MARKER_H}px;height:${MARKER_H}px;
      display:flex;align-items:center;justify-content:center;
      box-shadow:0 2px 8px rgba(0,0,0,.5);
    "><span style="transform:rotate(45deg);font-size:15px;line-height:1;">${emoji}</span></div>`,
    iconSize:   [MARKER_H, MARKER_H],
    iconAnchor: [MARKER_H / 2, MARKER_H],
    popupAnchor:[0, -MARKER_H - 4],
  });
}

const HOTEL_ICON = L.divIcon({
  className: '',
  html: `<div style="
    background:#C2782A;border:3px solid #D4A843;border-radius:50%;
    width:40px;height:40px;
    display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 0 6px rgba(194,120,42,.25);font-size:20px;
  ">🏨</div>`,
  iconSize:   [40, 40],
  iconAnchor: [20, 40],
  popupAnchor:[0, -44],
});

export default function MapSection() {
  const { t, locale }  = useLanguage();
  const mapRef         = useRef(null);
  const leafletRef     = useRef(null);
  const markersRef     = useRef([]);
  const selectedRef    = useRef(null); // ref pour éviter les stale closures dans les listeners Leaflet

  const [activeCategory, setActiveCategory] = useState('all');
  const [selected,  setSelected]  = useState(null);  // POI object
  const [bubblePos, setBubblePos] = useState(null);  // { x, y } pixels dans le container carte
  const [lightbox,  setLightbox]  = useState(null);

  const { data: allPoi, loading, offline } = useApi('/poi', { locale });

  const poi = activeCategory === 'all'
    ? (allPoi || [])
    : (allPoi || []).filter(p => p.category === activeCategory);

  // Maintient la ref en sync avec l'état
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  useEffect(() => { trackEvent('map', 'open'); }, []);

  // ── Init carte ──────────────────────────────────────────
  useEffect(() => {
    if (leafletRef.current || !mapRef.current) return;

    const map = L.map(mapRef.current, {
      center: [HOTEL_LAT, HOTEL_LNG], zoom: 15,
      zoomControl: false, attributionControl: true,
    });
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    map.attributionControl.setPrefix('');
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    // Marqueur hôtel
    L.marker([HOTEL_LAT, HOTEL_LNG], { icon: HOTEL_ICON })
      .addTo(map)
      .bindPopup(
        `<strong>${HOTEL_NAME}</strong><br><small>${locale === 'fr' ? 'Vous êtes ici' : 'You are here'}</small>`,
        { className: 'leaflet-popup-connectbe' }
      );

    // Reposition la bulle quand la carte bouge / zoom
    map.on('move zoom', () => {
      const poi = selectedRef.current;
      if (!poi) return;
      const pt = map.latLngToContainerPoint([poi.lat, poi.lng]);
      setBubblePos({ x: pt.x, y: pt.y });
    });

    // Clic sur le fond de carte → ferme la bulle
    map.on('click', () => { setSelected(null); setBubblePos(null); setLightbox(null); });

    leafletRef.current = map;
    return () => { map.remove(); leafletRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Marqueurs POI ───────────────────────────────────────
  useEffect(() => {
    const map = leafletRef.current;
    if (!map) return;

    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (!poi.length) return;

    poi.forEach(p => {
      const meta   = CAT_META[p.category] || CAT_META.all;
      const marker = L.marker([p.lat, p.lng], { icon: makePinIcon(meta.icon, meta.color) }).addTo(map);
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e); // empêche le clic de fermer la bulle
        const pt = map.latLngToContainerPoint([p.lat, p.lng]);
        setSelected(p);
        setBubblePos({ x: pt.x, y: pt.y });
        setLightbox(null);
      });
      markersRef.current.push(marker);
    });
  }, [poi]);

  // ── Calcul position de la bulle ─────────────────────────
  let bubbleStyle   = null;
  let arrowAbove    = true; // true = bulle au-dessus du marqueur, queue en bas

  if (selected && bubblePos && mapRef.current) {
    const mapW = mapRef.current.offsetWidth;
    const mapH = mapRef.current.offsetHeight;

    // Espace disponible au-dessus du marqueur (on réserve 220px min pour la bulle)
    arrowAbove = bubblePos.y > 240;

    const rawLeft = bubblePos.x - BUBBLE_W / 2;
    const left    = Math.max(8, Math.min(rawLeft, mapW - BUBBLE_W - 8));
    const arrowLeft = bubblePos.x - left; // pointe exactement sur le marqueur

    const top = arrowAbove
      ? bubblePos.y - MARKER_H - ARROW_H          // bulle au-dessus : sa base touche le pin
      : bubblePos.y + ARROW_H;                     // bulle en-dessous : son sommet part du pin

    // Garde la bulle dans les limites verticales de la carte
    const clampedTop = Math.max(8, Math.min(top, mapH - 8));

    bubbleStyle = {
      left:             `${left}px`,
      top:              `${clampedTop}px`,
      transform:        arrowAbove ? 'translateY(-100%)' : 'none',
      '--arrow-left':   `${arrowLeft}px`,
    };
  }

  const catLabel   = (cat) => locale === 'fr' ? cat.labelFr : cat.labelEn;
  const closeBubble = () => { setSelected(null); setBubblePos(null); setLightbox(null); };

  return (
    <div className={styles.page}>
      <BackButton />
      <LanguageSwitcher />
      <ThemeToggle />

      {offline && (
        <div className={styles.offlineTag} role="status">⚡ {t('common.offline_banner')}</div>
      )}

      {/* Filtres */}
      <div className={styles.categories} role="toolbar" aria-label="Filtres">
        {CATEGORIES.map(cat => (
          <button
            key={cat.key}
            className={`${styles.catBtn} ${activeCategory === cat.key ? styles.catBtnActive : ''}`}
            style={activeCategory === cat.key ? { '--cat-color': cat.color } : {}}
            onClick={() => setActiveCategory(cat.key)}
          >
            <span>{cat.icon}</span>
            <span>{catLabel(cat)}</span>
          </button>
        ))}
      </div>

      {/* Carte + bulle positionnée dans le même conteneur relatif */}
      <div className={styles.mapWrapper}>
        {loading && <div className={styles.mapOverlay}><div className="spinner" /></div>}
        <div ref={mapRef} className={styles.map} />

        {/* ── Bulle détail POI ── */}
        {selected && bubbleStyle && (
          <aside
            className={`${styles.bubble} ${arrowAbove ? styles.arrowBottom : styles.arrowTop}`}
            style={bubbleStyle}
            role="complementary"
            aria-label={selected.name}
            onClick={e => e.stopPropagation()}
          >
            <button className={styles.bubbleClose} onClick={closeBubble} aria-label="Fermer">✕</button>

            {/* En-tête */}
            <div className={styles.bubbleHeader}>
              <span className={styles.bubbleIcon}>{CAT_META[selected.category]?.icon ?? '📍'}</span>
              <div className={styles.bubbleTitles}>
                <h3 className={styles.bubbleName}>{selected.name}</h3>
                {selected.address && <p className={styles.bubbleAddr}>📍 {selected.address}</p>}
              </div>
            </div>

            {/* Méta */}
            {(selected.phone || selected.rating || selected.website) && (
              <div className={styles.bubbleMeta}>
                {selected.phone   && <span>📞 {selected.phone}</span>}
                {selected.rating  && <span>{'⭐'.repeat(Math.round(selected.rating))} {selected.rating}</span>}
                {selected.website && <span>🌐 {selected.website}</span>}
              </div>
            )}

            {/* Description */}
            {selected.description && (
              <p className={styles.bubbleDesc}>{selected.description}</p>
            )}

            {/* Galerie */}
            {selected.images?.length > 0 && (
              <div className={styles.gallery}>
                {selected.images.map((url, i) => (
                  <button
                    key={i}
                    className={styles.galleryThumb}
                    onClick={() => setLightbox(i)}
                    aria-label={`Image ${i + 1}`}
                  >
                    <img src={url} alt={`${selected.name} — photo ${i + 1}`} loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Compteur */}
      {!loading && (
        <div className={styles.legend}>
          {poi.length} {locale === 'fr' ? 'lieu(x) trouvé(s)' : 'place(s) found'}
        </div>
      )}

      {/* ── Lightbox ── */}
      {selected && lightbox !== null && (
        <div className={styles.lightbox} role="dialog" aria-modal="true" onClick={() => setLightbox(null)}>
          <button className={styles.lightboxClose} aria-label="Fermer">✕</button>
          <img
            src={selected.images[lightbox]}
            alt={`${selected.name} — photo ${lightbox + 1}`}
            className={styles.lightboxImg}
            onClick={e => e.stopPropagation()}
          />
          {selected.images.length > 1 && (
            <div className={styles.lightboxNav} onClick={e => e.stopPropagation()}>
              {selected.images.map((_, i) => (
                <button
                  key={i}
                  className={`${styles.lightboxDot} ${i === lightbox ? styles.lightboxDotActive : ''}`}
                  onClick={() => setLightbox(i)}
                  aria-label={`Photo ${i + 1}`}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
