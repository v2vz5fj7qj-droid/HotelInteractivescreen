import React, { useState, useEffect } from 'react';
import styles from '../Admin.module.css';

/**
 * ConfirmModal — remplace window.confirm() et window.prompt()
 *
 * Props:
 *   open      {boolean}  — afficher ou non
 *   title     {string}   — titre de la modale
 *   message   {string}   — corps du texte
 *   mode      {string}   — 'confirm' (Oui/Non) | 'reason' (textarea requis + Confirmer)
 *   danger    {boolean}  — bouton OK en rouge
 *   onConfirm {fn}       — appelé avec (reason?) quand l'utilisateur confirme
 *   onCancel  {fn}       — appelé quand l'utilisateur annule
 */
export default function ConfirmModal({
  open,
  title    = 'Confirmation',
  message  = '',
  mode     = 'confirm',
  danger   = false,
  onConfirm,
  onCancel,
}) {
  const [reason, setReason] = useState('');

  // Réinitialiser le champ raison à chaque ouverture
  useEffect(() => { if (open) setReason(''); }, [open]);

  if (!open) return null;

  const handleConfirm = () => {
    if (mode === 'reason' && !reason.trim()) return;
    onConfirm(mode === 'reason' ? reason.trim() : undefined);
  };

  const handleKey = e => { if (e.key === 'Escape') onCancel(); };

  return (
    <div
      className={styles.modalOverlay}
      onClick={onCancel}
      onKeyDown={handleKey}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={styles.modal}
        style={{ maxWidth: 440 }}
        onClick={e => e.stopPropagation()}
      >
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>{title}</h3>
          <button className={styles.modalClose} onClick={onCancel}>✕</button>
        </div>

        {message && (
          <p style={{ margin: '0 0 16px', color: '#374151', lineHeight: 1.5 }}>{message}</p>
        )}

        {mode === 'reason' && (
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontWeight: 600, marginBottom: 6, fontSize: '0.88rem' }}>
              Motif <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea
              autoFocus
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={3}
              placeholder="Expliquez la raison…"
              style={{
                width: '100%', padding: '8px 12px', borderRadius: 8,
                border: '1px solid #D1D5DB', fontFamily: 'Poppins, sans-serif',
                fontSize: '0.88rem', resize: 'vertical', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className={styles.btnSecondary} onClick={onCancel}>Annuler</button>
          <button
            className={danger ? styles.btnDanger : styles.btnPrimary}
            onClick={handleConfirm}
            disabled={mode === 'reason' && !reason.trim()}
          >
            {mode === 'reason' ? 'Confirmer' : 'Oui, confirmer'}
          </button>
        </div>
      </div>
    </div>
  );
}
