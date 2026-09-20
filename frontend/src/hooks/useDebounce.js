import { useState, useEffect } from 'react';

// Retarde la propagation d'une valeur qui change vite (ex: saisie clavier)
// pour éviter de déclencher une requête à chaque frappe.
export function useDebounce(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
