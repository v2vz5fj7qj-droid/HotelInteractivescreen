import { useEffect, useCallback, useRef } from 'react';

// scroll utilise capture:true pour intercepter le défilement dans les conteneurs
// enfants (overflow:auto/scroll) — l'événement scroll ne remonte pas à window
// sans la phase de capture, ce qui empêchait la réinitialisation du timer.
const EVENTS = [
  { type: 'touchstart',  capture: false },
  { type: 'touchmove',   capture: false },
  { type: 'mousemove',   capture: false },
  { type: 'keydown',     capture: false },
  { type: 'scroll',      capture: true  },
  { type: 'click',       capture: false },
  { type: 'pointerdown', capture: false },
];

export function useIdle(timeoutMs, onIdle) {
  const timerRef    = useRef(null);
  const onIdleRef   = useRef(onIdle);
  onIdleRef.current = onIdle;

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onIdleRef.current?.(), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    EVENTS.forEach(({ type, capture }) =>
      window.addEventListener(type, reset, { passive: true, capture })
    );
    reset();
    return () => {
      EVENTS.forEach(({ type, capture }) =>
        window.removeEventListener(type, reset, { capture })
      );
      clearTimeout(timerRef.current);
    };
  }, [reset]);
}
