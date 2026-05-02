import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useHotel } from './HotelContext';

const ThemeContext = createContext(null);

// Injecte un <link> Google Fonts si pas déjà présent
function loadGoogleFont(fontName) {
  if (!fontName) return;
  const id = `gfont-${fontName.replace(/\s+/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id   = id;
  link.rel  = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@400;600;700&display=swap`;
  document.head.appendChild(link);
}

// Injecte un @font-face pour la police custom uploadée
function injectCustomFont(url) {
  const id = 'hotel-custom-font-face';
  if (document.getElementById(id)) {
    // Mettre à jour si l'URL a changé
    const existing = document.getElementById(id);
    if (existing.dataset.url === url) return;
    existing.remove();
  }
  const style = document.createElement('style');
  style.id = id;
  style.dataset.url = url;
  style.textContent = `@font-face { font-family: 'HotelCustomFont'; src: url('${url}'); font-display: swap; }`;
  document.head.appendChild(style);
}

function isNightTime() {
  const h = new Date().getHours();
  return h >= 20 || h < 7;
}

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
  banner_image_url:    null,
  idle_timeout_ms:     '30000',
};

// Convertit hotel_settings en format config utilisé par le thème
function settingsToConfig(settings) {
  if (!settings) return null;
  const colors = settings.theme_colors || {};
  return {
    hotel_name:          settings.nom            || DEFAULT_THEME.hotel_name,
    color_primary:       colors.color_primary    || DEFAULT_THEME.color_primary,
    color_primary_dark:  colors.color_primary_dark || DEFAULT_THEME.color_primary_dark,
    color_secondary:     colors.color_secondary  || DEFAULT_THEME.color_secondary,
    color_bg_dark:       colors.color_bg_dark    || DEFAULT_THEME.color_bg_dark,
    color_bg_light:      colors.color_bg_light   || DEFAULT_THEME.color_bg_light,
    color_surface_dark:  colors.color_surface_dark  || DEFAULT_THEME.color_surface_dark,
    color_surface_light: colors.color_surface_light || DEFAULT_THEME.color_surface_light,
    color_text_dark:     colors.color_text_dark  || DEFAULT_THEME.color_text_dark,
    color_text_light:    colors.color_text_light || DEFAULT_THEME.color_text_light,
    color_accent:        colors.color_accent     || DEFAULT_THEME.color_accent,
    font_primary:        settings.font_primary   || DEFAULT_THEME.font_primary,
    font_secondary:      settings.font_secondary || DEFAULT_THEME.font_secondary,
    font_file_url:       settings.font_file_url  || null,
    logo_url:            settings.logo_url       || DEFAULT_THEME.logo_url,
    logo_url_dark:       settings.logo_url_dark  || DEFAULT_THEME.logo_url_dark,
    banner_image_url:    settings.background_url || DEFAULT_THEME.banner_image_url,
    idle_timeout_ms:     String(settings.idle_timeout_ms ?? DEFAULT_THEME.idle_timeout_ms),
    fullscreen_password: settings.fullscreen_password || 'fs1234',
    wifi_name:           settings.wifi_name           || null,
    wifi_password:       settings.wifi_password       || null,
    checkin_time:        settings.checkin_time        || null,
    checkout_time:       settings.checkout_time       || null,
    welcome_messages: ['fr','en','de','es','pt','ar','zh','ja','ru'].reduce((acc, l) => {
      const v = settings[`welcome_message_${l}`];
      if (v) acc[l] = v;
      return acc;
    }, {}),
  };
}

export function ThemeProvider({ children }) {
  const { settings, loading: hotelLoading } = useHotel();

  const [config,    setConfig]    = useState(DEFAULT_THEME);
  const [darkMode,  setDarkMode]  = useState(isNightTime());
  const [autoNight, setAutoNight] = useState(true);

  // Mode nuit automatique
  useEffect(() => {
    if (!autoNight) return;
    const check = () => setDarkMode(isNightTime());
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [autoNight]);

  // Quand les settings de l'hôtel arrivent, mettre à jour le thème
  useEffect(() => {
    if (!hotelLoading) {
      const derived = settingsToConfig(settings);
      setConfig(derived || DEFAULT_THEME);
    }
  }, [settings, hotelLoading]);

  // Application des CSS custom properties
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
    // Chargement Google Fonts pour les polices curatives
    loadGoogleFont(config.font_primary);
    loadGoogleFont(config.font_secondary);

    // Police custom uploadée : @font-face injecté dynamiquement
    if (config.font_file_url) {
      injectCustomFont(config.font_file_url);
      root.style.setProperty('--font-body', `'HotelCustomFont', '${config.font_primary}', sans-serif`);
    } else {
      root.style.setProperty('--font-body', `'${config.font_primary}', sans-serif`);
    }
    root.style.setProperty('--font-display', `'${config.font_secondary}', serif`);
  }, [config, darkMode]);

  const toggleDarkMode = useCallback(() => {
    setAutoNight(false);
    setDarkMode(d => !d);
  }, []);

  const loading = hotelLoading;

  return (
    <ThemeContext.Provider value={{ config, darkMode, autoNight, toggleDarkMode, loading }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme doit être utilisé dans ThemeProvider');
  return ctx;
};
