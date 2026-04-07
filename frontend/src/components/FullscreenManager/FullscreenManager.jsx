import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './FullscreenManager.module.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function FullscreenManager() {
  const [isFullscreen, setIsFullscreen] = useState(!!document.fullscreenElement);
  const [showModal,    setShowModal]    = useState(false);
  const [password,     setPassword]     = useState('');
  const [error,        setError]        = useState('');
  const [checking,     setChecking]     = useState(false);
  const inputRef = useRef(null);

  const enterFullscreen = useCallback(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      // Exiting fullscreen → demander mot de passe
      if (!isFull) {
        setShowModal(true);
        setPassword('');
        setError('');
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Focus sur le champ dès l'ouverture du modal
  useEffect(() => {
    if (showModal) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [showModal]);

  const handleVerify = useCallback(async () => {
    if (!password) return;
    setChecking(true);
    setError('');
    try {
      const res  = await fetch(`${API_BASE}/theme/fullscreen-verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ password }),
      });
      const data = await res.json();
      if (data.ok) {
        // Mot de passe correct → autoriser la sortie
        setShowModal(false);
        setPassword('');
      } else {
        setError('Mot de passe incorrect');
        setPassword('');
        // Revenir en plein écran
        enterFullscreen();
        setTimeout(() => inputRef.current?.focus(), 80);
      }
    } catch {
      setError('Erreur réseau, réessayez');
      enterFullscreen();
    } finally {
      setChecking(false);
    }
  }, [password, enterFullscreen]);

  const handleCancel = useCallback(() => {
    setShowModal(false);
    setPassword('');
    setError('');
    enterFullscreen();
  }, [enterFullscreen]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter')  { handleVerify(); }
    if (e.key === 'Escape') { e.preventDefault(); handleCancel(); }
  }, [handleVerify, handleCancel]);

  return (
    <>
      {/* Bouton d'entrée plein écran (discret, visible uniquement hors FS) */}
      {!isFullscreen && !showModal && (
        <button
          className={styles.fsBtn}
          onClick={enterFullscreen}
          title="Mode plein écran"
          aria-label="Activer le plein écran"
        >
          ⛶
        </button>
      )}

      {/* Modal de protection à la sortie du plein écran */}
      {showModal && (
        <div className={styles.overlay} role="dialog" aria-modal="true">
          <div className={styles.modal}>
            <span className={styles.icon}>🔒</span>
            <h3 className={styles.title}>Quitter le plein écran ?</h3>
            <p className={styles.sub}>
              Entrez le mot de passe administrateur pour désactiver le mode plein écran.
            </p>
            <input
              ref={inputRef}
              className={styles.input}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="••••••••"
              autoComplete="off"
            />
            {error && <p className={styles.error}>{error}</p>}
            <div className={styles.actions}>
              <button className={styles.cancelBtn} onClick={handleCancel}>
                Annuler
              </button>
              <button
                className={styles.confirmBtn}
                onClick={handleVerify}
                disabled={checking || !password}
              >
                {checking ? '…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
