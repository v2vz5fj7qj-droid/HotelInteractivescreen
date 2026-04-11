import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CloudSun }     from 'lucide-react';
import api              from '../../services/api';
import styles           from './WeatherBadge.module.css';

// Correspondance icône OWM (ex: "01d") → emoji léger
const weatherIcon = (icon) => {
  if (!icon) return '🌡️';
  const base = icon.replace(/[dn]$/, ''); // retire le suffixe jour/nuit
  if (base === '01') return '☀️';
  if (base === '02') return '🌤️';
  if (base === '03') return '⛅';
  if (base === '04') return '☁️';
  if (base === '09') return '🌧️';
  if (base === '10') return '🌦️';
  if (base === '11') return '⛈️';
  if (base === '13') return '❄️';
  if (base === '50') return '🌫️';
  return '🌡️';
};

const CACHE_TTL = 10 * 60 * 1000; // 10 min

export default function WeatherBadge() {
  const navigate      = useNavigate();
  const { hotelSlug } = useParams();
  const [weather, setWeather] = useState(() => {
    try {
      const raw = sessionStorage.getItem('weather_badge');
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL) return data;
    } catch {}
    return null;
  });

  useEffect(() => {
    // Si déjà en cache session, pas besoin de refetch
    if (weather) return;
    api.get('/weather/current')
      .then(r => {
        const data = r.data?.current ?? null;
        if (!data) return;
        setWeather(data);
        sessionStorage.setItem('weather_badge', JSON.stringify({ data, ts: Date.now() }));
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!weather) return null;

  const temp = Math.round(weather.temp ?? weather.temperature ?? 0);
  const icon = weatherIcon(weather.icon ?? null);

  return (
    <button
      className={styles.badge}
      onClick={() => navigate(`/${hotelSlug}/weather`)}
      aria-label={`Météo Ouagadougou : ${temp}°C`}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.temp}>{temp}°C</span>
    </button>
  );
}
