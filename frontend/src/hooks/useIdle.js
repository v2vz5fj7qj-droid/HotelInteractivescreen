import { useEffect, useCallback, useRef } from 'react';

// scroll/touchmove/wheel utilisent capture:true — ces événements ne remontent pas
// à window depuis les conteneurs overflow:scroll sans la phase de capture.
// Sur écran tactile avec touch-action:pan-y, le browser gère le défilement
// nativement : touchmove peut ne pas propager, seul scroll/wheel est fiable.
const EVENTS = [
  { type: 'touchstart',  capture: false },
  { type: 'touchmove',   capture: true  },
  { type: 'wheel',       capture: true  },
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
