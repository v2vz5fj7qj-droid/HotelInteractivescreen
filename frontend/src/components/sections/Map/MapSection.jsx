import React, { useEffect, useRef, useState, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { QRCodeSVG } from 'qrcode.react';
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

const ORS_KEY = import.meta.env.VITE_ORS_API_KEY;

function haversine(lat, lng) {
  const R = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat - HOTEL_LAT);
  const dLng = toRad(lng - HOTEL_LNG);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(HOTEL_LAT)) * Math.cos(toRad(lat)) * Math.sin(dLng / 2) ** 2;
  const meters = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return { meters, label: formatDist(meters), mode: 'air' };
}

function formatDist(meters) {
  return meters < 1000
    ? `${Math.round(meters)} m`
    : `${(meters / 1000).toFixed(1)} km`;
}

async function fetchWalkingDistance(lat, lng) {
  if (!ORS_KEY) return null;
  const url = 'https://api.openrouteservice.org/v2/directions/foot-walking';
  const body = {
    coordinates: [
      [HOTEL_LNG, HOTEL_LAT],
      [lng, lat],
    ],
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': ORS_KEY,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  const data = await res.json();
  const meters = data?.routes?.[0]?.summary?.distance;
  if (!meters) return null;
  return { meters, label: formatDist(meters), mode: 'walk' };
}

const ALL_CAT = { key: 'all', labelFr: 'Tout', labelEn: 'All', icon: '📍', color: '#C2782A' };
const toCatShape = c => ({ key: c.key_name, labelFr: c.label_fr, labelEn: c.label_en, icon: c.icon, color: c.color });

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
  const [distance,  setDistance]  = useState(null);  // { label, mode } | null

  const { data: allPoi, loading, offline } = useApi('/poi', { locale }, { deps: [locale] });
  const { data: catsData } = useApi('/poi/categories');
  const categories = useMemo(() => [ALL_CAT, ...(catsData || []).map(toCatShape)], [catsData]);
  const catMeta    = useMemo(() => Object.fromEntries(categories.map(c => [c.key, c])), [categories]);

  const poi = activeCategory === 'all'
    ? (allPoi || [])
    : (allPoi || []).filter(p => p.category === activeCategory);

  // Maintient la ref en sync avec l'état
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  // Met à jour le POI sélectionné quand les données sont re-fetched (changement de locale)
  useEffect(() => {
    if (!selected || !allPoi) return;
    const fresh = allPoi.find(p => p.id === selected.id);
    if (fresh) setSelected(fresh);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allPoi]);

  // ── Calcul distance POI → hôtel ─────────────────
  useEffect(() => {
    if (!selected?.lat || !selected?.lng) { setDistance(null); return; }
    setDistance(null); // reset (affiche "…" pendant le chargement)
    let cancelled = false;
    (async () => {
      const fallback = haversine(selected.lat, selected.lng);
      const walking  = await fetchWalkingDistance(selected.lat, selected.lng);
      if (!cancelled) setDistance(walking ?? fallback);
    })();
    return () => { cancelled = true; };
  }, [selected]);

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
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png', {
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
      const meta   = catMeta[p.category] || catMeta.all;
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
  }, [poi, catMeta]);

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

      {/* ── Barre de navigation (hors canvas carte) ── */}
      <header className={styles.header}>
        <BackButton />
        <div className={styles.categories} role="toolbar" aria-label="Filtres catégories">
          {categories.map(cat => (
            <button
              key={cat.key}
              className={`${styles.catBtn} ${activeCategory === cat.key ? styles.catBtnActive : ''}`}
              style={activeCategory === cat.key ? { '--cat-color': cat.color } : {}}
              onClick={() => setActiveCategory(cat.key)}
            >
              <span aria-hidden="true">{cat.icon}</span>
              <span>{catLabel(cat)}</span>
            </button>
          ))}
        </div>
        <LanguageSwitcher />
      </header>

      <ThemeToggle />

      {/* Carte + bulle positionnée dans le même conteneur relatif */}
      <div className={styles.mapWrapper}>
        {offline && (
          <div className={styles.offlineTag} role="status">⚡ {t('common.offline_banner')}</div>
        )}
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
            {/* En-tête : icône + titres + bouton fermer sur la même ligne */}
            <div className={styles.bubbleHeader}>
              <span className={styles.bubbleIcon}>{catMeta[selected.category]?.icon ?? '📍'}</span>
              <div className={styles.bubbleTitles}>
                <h3 className={styles.bubbleName}>{selected.name}</h3>
                {selected.address && <p className={styles.bubbleAddr}>📍 {selected.address}</p>}
                {selected.lat && selected.lng && (
                  <p className={styles.bubbleDist}>
                    {distance === null
                      ? '⏳ …'
                      : `${distance.mode === 'walk' ? '🚶' : '📐'} ${distance.label} ${locale === 'fr' ? "de l'hôtel" : 'from hotel'}${distance.mode === 'air' ? (locale === 'fr' ? ' (vol d\'oiseau)' : ' (as the crow flies)') : ''}`
                    }
                  </p>
                )}
              </div>
              <button className={styles.bubbleClose} onClick={closeBubble} aria-label="Fermer">✕</button>
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

              {/* QR Google Maps */}
              {selected.lat && selected.lng && (
                <div className={styles.bubbleQr}>
                  <QRCodeSVG
                    value={`https://www.google.com/maps?q=${selected.lat},${selected.lng}`}
                    size={96}
                    level="M"
                    bgColor="transparent"
                    fgColor="#C2782A"
                  />
                  <span className={styles.bubbleQrLabel}>
                    {locale === 'fr' ? '📱 Scanner pour ouvrir dans Maps' : '📱 Scan to open in Maps'}
                  </span>
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
