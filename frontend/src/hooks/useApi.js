import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

/**
 * Hook générique pour les appels API avec cache, état offline et retry.
 *
 * @param {string}  url      — ex: '/weather/current'
 * @param {object}  params   — query params axios
 * @param {object}  options  — { enabled, deps, cacheTtlMs }
 */
export function useApi(url, params = {}, options = {}) {
  const { enabled = true, deps = [], cacheTtlMs = 10 * 60_000 } = options;

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error,   setError]   = useState(null);
  const [offline, setOffline] = useState(false);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!enabled) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setError(null);
    setOffline(false);

    api.get(url, { params, signal: abortRef.current.signal })
      .then(res => {
        setData(res.data);
        if (res.data?._offline || res.data?._mock) setOffline(true);
      })
      .catch(err => {
        if (err.name !== 'CanceledError') setError(err);
      })
      .finally(() => setLoading(false));

    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled, ...deps]);

  return { data, loading, error, offline };
}
