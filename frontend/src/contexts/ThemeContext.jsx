import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const ThemeContext = createContext(null);

// Retourne true si l'heure actuelle est en période nocturne (20h–7h)
function isNightTime() {
  const h = new Date().getHours();
  return h >= 20 || h < 7;
}

// Thème par défaut — sera écrasé par les données de l'API /theme
const DEFAULT_THEME = {
  hotel_name:          'ConnectBé',
  color_primary:       '#C2782A',
  color_primary_dark:  '#8B4F12',
  color_secondary:     '#D4A843',
  color_bg_dark:       '#1A1208',
  color_bg_light:      '#FDF6EC',
  color_surface_dark:  '#2C1E0A',
  color_surface_light: '#FFFFFF',
  color_text_dark:     '#F5E6C8',
  color_text_light:    '#2C1A06',
  color_accent:        '#E8521A',
  font_primary:        'Poppins',
  font_secondary:      'Playfair Display',
  logo_url:            '/images/logo.png',
  logo_url_dark:       '/images/logo-dark.png',
  banner_image_url:    'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=1400&q=80',
  idle_timeout_ms:     '60000',
};

export function ThemeProvider({ children }) {
  const [config,    setConfig]    = useState(DEFAULT_THEME);
  const [darkMode,  setDarkMode]  = useState(isNightTime()); // Auto selon heure
  const [autoNight, setAutoNight] = useState(true);          // Mode auto activé
  const [loading,   setLoading]   = useState(true);

  // ── Mode nuit automatique : vérification toutes les minutes ──
  useEffect(() => {
    if (!autoNight) return;
    const check = () => setDarkMode(isNightTime());
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [autoNight]);

  // ── Chargement config thème depuis l'API ─────────────
  useEffect(() => {
    api.get('/theme')
      .then(res => {
        if (res.data?.config) setConfig({ ...DEFAULT_THEME, ...res.data.config });
      })
      .catch(() => { /* Mode offline — thème par défaut */ })
      .finally(() => setLoading(false));
  }, []);

  // ── Application des CSS custom properties ────────────
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', darkMode ? 'dark' : 'light');

    root.style.setProperty('--c-primary',       config.color_primary);
    root.style.setProperty('--c-primary-dark',  config.color_primary_dark);
    root.style.setProperty('--c-secondary',     config.color_secondary);
    root.style.setProperty('--c-accent',        config.color_accent);
    root.style.setProperty('--c-bg',            darkMode ? config.color_bg_dark    : config.color_bg_light);
    root.style.setProperty('--c-surface',       darkMode ? config.color_surface_dark : config.color_surface_light);
    root.style.setProperty('--c-text',          darkMode ? config.color_text_dark   : config.color_text_light);
    root.style.setProperty('--font-body',       `'${config.font_primary}', sans-serif`);
    root.style.setProperty('--font-display',    `'${config.font_secondary}', serif`);
  }, [config, darkMode]);

  // Bascule manuelle : désactive le mode auto jusqu'au prochain rechargement
  const toggleDarkMode = useCallback(() => {
    setAutoNight(false);
    setDarkMode(d => !d);
  }, []);

  // Mise à jour d'une valeur de thème (appel API + local)
  const updateTheme = useCallback(async (updates) => {
    try {
      await api.put('/theme', { updates });
      setConfig(prev => ({ ...prev, ...updates }));
    } catch (err) {
      console.error('[Theme update]', err.message);
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ config, darkMode, autoNight, toggleDarkMode, updateTheme, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans ThemeProvider');
  return ctx;
};
