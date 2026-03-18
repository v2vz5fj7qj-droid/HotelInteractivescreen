import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App';

// ── Mode kiosque : bloquer les touches de sortie ────────
document.addEventListener('keydown', (e) => {
  const blocked = ['F1','F2','F3','F4','F5','F11','F12','Escape'];
  if (
    blocked.includes(e.key) ||
    (e.altKey  && e.key === 'F4') ||
    (e.ctrlKey && ['w','t','n','r'].includes(e.key.toLowerCase()))
  ) {
    e.preventDefault();
    e.stopPropagation();
  }
}, { capture: true });

// ── Enregistrement Service Worker (offline) ─────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch(err => console.warn('[SW] Enregistrement échoué:', err));
  });
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
