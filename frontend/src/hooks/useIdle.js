import { useEffect, useCallback, useRef } from 'react';

const EVENTS = ['touchstart', 'touchmove', 'mousemove', 'keydown', 'scroll', 'click', 'pointerdown'];

export function useIdle(timeoutMs, onIdle) {
  const timerRef    = useRef(null);
  const onIdleRef   = useRef(onIdle);
  onIdleRef.current = onIdle;

  const reset = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onIdleRef.current?.(), timeoutMs);
  }, [timeoutMs]);

  useEffect(() => {
    EVENTS.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      EVENTS.forEach(e => window.removeEventListener(e, reset));
      clearTimeout(timerRef.current);
    };
  }, [reset]);
}
