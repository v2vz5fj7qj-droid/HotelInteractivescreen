// Suit l'état de connectivité réseau du navigateur.
// Retourne true si en ligne, false si hors-ligne.
// Utilisé par KioskLayout pour afficher la bannière "mode hors-ligne"
// et par api.js pour basculer sur le cache localStorage.
import { useState, useEffect } from 'react';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const on  = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener('online',  on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online',  on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return isOnline;
}
