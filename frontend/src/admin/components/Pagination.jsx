import React from 'react';

/**
 * Pagination — barre de navigation entre pages
 *
 * Props:
 *   page         {number}  — page courante (1-indexed)
 *   totalPages   {number}  — nombre total de pages
 *   onPage       {fn}      — appelé avec le numéro de page cible
 */
export default function Pagination({ page, totalPages, onPage }) {
  if (!totalPages || totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  const left  = Math.max(2, page - delta);
  const right = Math.min(totalPages - 1, page + delta);

  pages.push(1);
  if (left > 2) pages.push('…');
  for (let i = left; i <= right; i++) pages.push(i);
  if (right < totalPages - 1) pages.push('…');
  if (totalPages > 1) pages.push(totalPages);

  const btn = (label, target, active = false, disabled = false) => (
    <button
      key={`${label}-${target}`}
      onClick={() => !disabled && typeof target === 'number' && onPage(target)}
      disabled={disabled || typeof target !== 'number'}
      style={{
        padding: '5px 10px', minWidth: 34, border: '1px solid',
        borderColor: active ? '#C2782A' : '#E5E7EB',
        background: active ? '#C2782A' : disabled ? '#F9FAFB' : '#fff',
        color: active ? '#fff' : disabled ? '#D1D5DB' : '#374151',
        borderRadius: 7, cursor: disabled ? 'default' : 'pointer',
        fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', fontWeight: active ? 700 : 400,
        transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'center', marginTop: 20 }}>
      {btn('‹ Préc.', page - 1, false, page <= 1)}
      {pages.map((p, i) =>
        p === '…'
          ? <span key={`dots-${i}`} style={{ padding: '5px 4px', color: '#9CA3AF', fontSize: '0.82rem' }}>…</span>
          : btn(p, p, p === page)
      )}
      {btn('Suiv. ›', page + 1, false, page >= totalPages)}
    </div>
  );
}
