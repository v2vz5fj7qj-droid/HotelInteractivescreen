import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import styles from './LinkModal.module.css';

const LOAD_TIMEOUT = 10000;

function hostnameOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function LinkModal({ url, onClose }) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setTimedOut(false);
    timerRef.current = setTimeout(() => setTimedOut(true), LOAD_TIMEOUT);
    return () => clearTimeout(timerRef.current);
  }, [url]);

  function handleLoad() {
    clearTimeout(timerRef.current);
    setLoading(false);
  }

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className={styles.overlay}
      role="dialog"
      aria-modal="true"
      aria-label={hostnameOf(url)}
      onClick={onClose}
    >
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.hostname}>{hostnameOf(url)}</span>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={onClose}
            aria-label={t('common.close')}
          >
            ✕
          </button>
        </div>

        <div className={styles.body}>
          {loading && !timedOut && (
            <div className={styles.status}>
              <div className="spinner" aria-hidden="true" />
              <p>{t('common.link_loading')}</p>
            </div>
          )}

          {timedOut && loading && (
            <div className={styles.status}>
              <p>{t('common.link_unavailable')}</p>
            </div>
          )}

          <iframe
            key={url}
            src={url}
            title={hostnameOf(url)}
            className={styles.iframe}
            onLoad={handleLoad}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </div>
  );
}
