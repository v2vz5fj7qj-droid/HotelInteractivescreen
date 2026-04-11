import React, { useEffect, useState, useCallback } from 'react';
import api from '../../useAdminApi';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import styles from '../../Admin.module.css';

const STATUS_STYLE = {
  pending:   { bg: '#FEF3C7', color: '#92400E', label: 'En attente' },
  published: { bg: '#D1FAE5', color: '#065F46', label: 'Publié' },
  rejected:  { bg: '#FEE2E2', color: '#991B1B', label: 'Rejeté' },
};

const FILTERS = ['all', 'pending', 'published', 'rejected'];
const PER_PAGE = 25;

function DetailModal({ detail, onClose, onPublish, onReject, onDelete }) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason,     setReason]     = useState('');
  const [acting,     setActing]     = useState(false);

  if (!detail) return null;

  const st = STATUS_STYLE[detail.status] || STATUS_STYLE.pending;
  const canValidate = detail.status === 'pending';

  const handlePublish = async () => {
    setActing(true);
    await onPublish(detail.id);
    setActing(false);
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    setActing(true);
    await onReject(detail.id, reason.trim());
    setActing(false);
  };

  const handleDelete = async () => {
    setActing(true);
    await onDelete(detail.id);
    setActing(false);
  };

  const trans = detail.translations?.find(t => t.locale === 'fr') || {};

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} style={{ maxWidth: 560 }} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Détail — {trans.name || detail.name}</span>
          <button className={styles.modalClose} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Statut + contributeur */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: '#F9FAFB', borderRadius: 8, padding: '10px 14px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>Soumis par</div>
              <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{detail.created_by_email || '—'}</div>
              {detail.created_at && (
                <div style={{ fontSize: '0.78rem', color: '#9CA3AF', marginTop: 2 }}>
                  {new Date(detail.created_at).toLocaleString('fr-FR')}
                </div>
              )}
            </div>
            <span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span>
          </div>

          {/* Nom + Description */}
          {(trans.name || detail.name) && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>Nom / Raison sociale</div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{trans.name || detail.name}</div>
            </div>
          )}
          {(trans.description || detail.description) && (
            <div>
              <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>Description</div>
              <div style={{ fontSize: '0.88rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                {trans.description || detail.description}
              </div>
            </div>
          )}

          {/* Champs de contact */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label="Catégorie" value={detail.category} />
            <Field label="Téléphone" value={detail.phone} />
            <Field label="WhatsApp" value={detail.whatsapp} />
            <Field label="Site web" value={detail.website} link />
          </div>

          {/* Motif de rejet existant */}
          {detail.rejection_reason && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
              padding: '10px 14px', fontSize: '0.85rem', color: '#991B1B' }}>
              Motif de rejet : {detail.rejection_reason}
            </div>
          )}

          {/* Zone de rejet inline */}
          {rejectMode && (
            <div>
              <label className={styles.label} style={{ marginBottom: 4 }}>Motif du rejet *</label>
              <textarea
                className={styles.textarea}
                value={reason}
                onChange={e => setReason(e.target.value)}
                placeholder="Expliquer le motif au contributeur…"
                rows={3}
                autoFocus
              />
            </div>
          )}
        </div>

        <div className={styles.modalFooter} style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnDanger} style={{ padding: '6px 14px', fontSize: '0.82rem' }}
              onClick={handleDelete} disabled={acting}>
              Supprimer
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={styles.btnSecondary}
              onClick={rejectMode ? () => setRejectMode(false) : onClose} disabled={acting}>
              {rejectMode ? 'Annuler' : 'Fermer'}
            </button>
            {canValidate && !rejectMode && (
              <button className={styles.btnSecondary} style={{ color: '#991B1B', borderColor: '#FECACA' }}
                onClick={() => { setRejectMode(true); setReason(''); }} disabled={acting}>
                Rejeter
              </button>
            )}
            {rejectMode && (
              <button className={styles.btnDanger}
                onClick={handleReject} disabled={acting || !reason.trim()}>
                {acting ? '…' : 'Confirmer le rejet'}
              </button>
            )}
            {canValidate && !rejectMode && (
              <button className={styles.btnPrimary} onClick={handlePublish} disabled={acting}>
                {acting ? '…' : 'Publier'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, link }) {
  if (!value) return null;
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#6B7280', marginBottom: 2 }}>{label}</div>
      {link
        ? <a href={value} target="_blank" rel="noreferrer"
            style={{ fontSize: '0.88rem', color: '#C2782A', textDecoration: 'underline', wordBreak: 'break-all' }}>
            {value}
          </a>
        : <div style={{ fontSize: '0.88rem', fontWeight: 500 }}>{value}</div>
      }
    </div>
  );
}

export default function InfoManager() {
  const [items,   setItems]   = useState([]);
  const [total,   setTotal]   = useState(0);
  const [page,    setPage]    = useState(1);
  const [filter,  setFilter]  = useState('all');
  const [search,  setSearch]  = useState('');
  const [loading, setLoading] = useState(true);
  const [toast,   setToast]   = useState('');
  const [confirm, setConfirm] = useState(null); // { id, mode, name }
  const [detail,  setDetail]  = useState(null);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: PER_PAGE };
      if (filter !== 'all') params.status = filter;
      if (search) params.search = search;
      const { data } = await api.get('/super/info', { params });
      setItems(data.data || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [filter, search]);

  useEffect(() => { load(1); }, [load]);

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const totalPages = Math.ceil(total / PER_PAGE);

  const openDetail = async (id) => {
    setDetail({ loading: true });
    try {
      const { data } = await api.get(`/super/info/${id}`);
      setDetail(data);
    } catch {
      setDetail(null);
    }
  };

  const publish = async (id) => {
    try {
      await api.post(`/super/info/${id}/publish`, {});
      showToast('Info publiée');
      setDetail(null);
      load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const rejectInfo = async (id, reason) => {
    try {
      await api.post(`/super/info/${id}/reject`, { reason });
      showToast('Info rejetée');
      setDetail(null);
      load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const deleteInfo = async (id) => {
    try {
      await api.delete(`/super/info/${id}`);
      showToast('Info supprimée');
      setDetail(null);
      load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  // Actions rapides depuis la liste
  const publishQuick = async (id) => {
    try {
      await api.post(`/super/info/${id}/publish`, {});
      showToast('Info publiée'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
  };

  const handleReject = async (reason) => {
    try {
      await api.post(`/super/info/${confirm.id}/reject`, { reason });
      showToast('Info rejetée'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/super/info/${confirm.id}`);
      showToast('Info supprimée'); load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Infos utiles</h1>
          <p className={styles.managerSub}>Validation et gestion des contacts utiles ({total} total)</p>
        </div>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        {FILTERS.map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid',
              borderColor: filter === f ? '#C2782A' : '#E5E7EB',
              background: filter === f ? '#C2782A' : '#fff',
              color: filter === f ? '#fff' : '#6B7280',
              fontFamily: 'Poppins, sans-serif', fontSize: '0.82rem', fontWeight: 600, cursor: 'pointer' }}>
            {f === 'all' ? 'Tous' : STATUS_STYLE[f]?.label || f}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && load(1)}
          placeholder="Rechercher par nom ou catégorie…"
          className={styles.input}
          style={{ maxWidth: 320 }}
        />
        <button className={styles.btnSecondary} onClick={() => load(1)}>Rechercher</button>
        {search && <button className={styles.btnSecondary} onClick={() => setSearch('')}>✕</button>}
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom</th><th>Catégorie</th><th>Téléphone</th><th>Soumis par</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Chargement…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>📞</div><div className={styles.emptyText}>Aucune info utile</div></div></td></tr>
            ) : items.map(it => {
              const st = STATUS_STYLE[it.status] || STATUS_STYLE.pending;
              return (
                <tr key={it.id}>
                  <td style={{ fontWeight: 600 }}>{it.name || '—'}</td>
                  <td style={{ color: '#6B7280' }}>{it.category || '—'}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{it.phone || it.whatsapp || '—'}</td>
                  <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{it.created_by_email || '—'}</td>
                  <td><span className={styles.badge} style={{ background: st.bg, color: st.color }}>{st.label}</span></td>
                  <td>
                    <div className={styles.tdActions}>
                      <button className={styles.btnSecondary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => openDetail(it.id)}>Voir</button>
                      {it.status === 'pending' && (
                        <>
                          <button className={styles.btnPrimary} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => publishQuick(it.id)}>Publier</button>
                          <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                            onClick={() => setConfirm({ id: it.id, mode: 'reject', name: it.name })}>
                            Rejeter
                          </button>
                        </>
                      )}
                      <button className={styles.btnDanger} style={{ padding: '5px 10px', fontSize: '0.78rem' }}
                        onClick={() => setConfirm({ id: it.id, mode: 'delete', name: it.name })}>
                        Supprimer
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={p => load(p)} />

      {/* Modal détail */}
      {detail && !detail.loading && (
        <DetailModal
          detail={detail}
          onClose={() => setDetail(null)}
          onPublish={publish}
          onReject={rejectInfo}
          onDelete={deleteInfo}
        />
      )}
      {detail?.loading && (
        <div className={styles.modalOverlay}>
          <div style={{ color: '#fff', fontSize: '1rem' }}>Chargement…</div>
        </div>
      )}

      <ConfirmModal
        open={confirm?.mode === 'reject'}
        title="Rejeter cette info"
        message={`Info : ${confirm?.name}`}
        mode="reason"
        danger
        onConfirm={handleReject}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmModal
        open={confirm?.mode === 'delete'}
        title="Supprimer cette info ?"
        message={`Cette action est irréversible. Info : "${confirm?.name}"`}
        danger
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
