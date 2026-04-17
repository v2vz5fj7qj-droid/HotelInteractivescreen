import { useState } from 'react';

/**
 * Hook toast — retourne [message, showToast]
 * showToast(msg, duration?) affiche le message pendant `duration` ms (défaut 3000).
 */
export function useToast(duration = 3000) {
  const [toast, setToast] = useState('');
  const showToast = (msg, ms = duration) => {
    setToast(msg);
    setTimeout(() => setToast(''), ms);
  };
  return [toast, showToast];
}
