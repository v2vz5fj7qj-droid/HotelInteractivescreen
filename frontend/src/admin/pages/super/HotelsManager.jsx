import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../useAdminApi';
import ConfirmModal from '../../components/ConfirmModal';
import Pagination from '../../components/Pagination';
import styles from '../../Admin.module.css';

const EMPTY = { nom: '', slug: '' };
const PER_PAGE = 25;

export default function HotelsManager() {
  const navigate = useNavigate();
  const [hotels,   setHotels]   = useState([]);
  const [total,    setTotal]    = useState(0);
  const [page,     setPage]     = useState(1);
  const [search,   setSearch]   = useState('');
  const [loading,  setLoading]  = useState(true);
  const [modal,    setModal]    = useState(null);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);
  const [toast,    setToast]    = useState('');
  const [confirm,  setConfirm]  = useState(null); // { hotel, action:'toggle'|'delete' }

  const load = useCallback(async (p = 1, q = search) => {
    setLoading(true);
    try {
      const params = { page: p, per_page: PER_PAGE };
      if (q) params.search = q;
      const { data } = await api.get('/super/hotels', { params });
      setHotels(data.data || []);
      setTotal(data.total || 0);
      setPage(p);
    } finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, []); // eslint-disable-line

  const showToast = msg => { setToast(msg); setTimeout(() => setToast(''), 3000); };
  const totalPages = Math.ceil(total / PER_PAGE);

  const handleSearch = e => {
    e.preventDefault();
    load(1, search);
  };

  const openCreate = () => { setForm(EMPTY); setModal('create'); };
  const openEdit   = h => {
    setForm({ nom: h.nom, slug: h.slug });
    setModal(h);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (modal === 'create') {
        await api.post('/super/hotels', form);
        showToast('Hôtel créé');
      } else {
        await api.put(`/super/hotels/${modal.id}`, form);
        showToast('Hôtel mis à jour');
      }
      setModal(null);
      load(page);
    } catch (err) {
      alert(err.response?.data?.error || 'Erreur');
    } finally { setSaving(false); }
  };

  const handleToggle = async () => {
    const h = confirm.hotel;
    try {
      await api.put(`/super/hotels/${h.id}`, { is_active: h.is_active ? 0 : 1 });
      showToast(h.is_active ? 'Hôtel désactivé' : 'Hôtel activé');
      load(page);
    } catch (err) { alert(err.response?.data?.error || 'Erreur'); }
    setConfirm(null);
  };

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Hôtels</h1>
          <p className={styles.managerSub}>{total} hôtel{total !== 1 ? 's' : ''} enregistré{total !== 1 ? 's' : ''}</p>
        </div>
        <button className={styles.btnPrimary} onClick={openCreate}>+ Ajouter un hôtel</button>
      </div>

      {toast && <div className={styles.toast}>{toast}</div>}

      {/* Barre de recherche */}
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom ou slug…"
          className={styles.input}
          style={{ maxWidth: 320 }}
        />
        <button type="submit" className={styles.btnSecondary}>Rechercher</button>
        {search && (
          <button type="button" className={styles.btnSecondary}
            onClick={() => { setSearch(''); load(1, ''); }}>✕ Effacer</button>
        )}
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr><th>Nom</th><th>Slug</th><th>Adresse</th><th>Contact</th><th>Statut</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', color: '#9CA3AF', padding: 24 }}>Chargement…</td></tr>
            ) : hotels.length === 0 ? (
              <tr><td colSpan={6}><div className={styles.empty}><div className={styles.emptyIcon}>🏨</div><div className={styles.emptyText}>Aucun hôtel</div></div></td></tr>
            ) : hotels.map(h => (
              <tr key={h.id}>
                <td style={{ fontWeight: 700 }}>{h.nom}</td>
                <td style={{ fontFamily: 'monospace', color: '#6B7280', fontSize: '0.82rem' }}>{h.slug}</td>
                <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{h.adresse || '—'}</td>
                <td style={{ color: '#6B7280', fontSize: '0.82rem' }}>{h.email_contact || h.telephone || '—'}</td>
                <td><span className={`${styles.badge} ${h.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                  {h.is_active ? 'Actif' : 'Inactif'}
                </span></td>
                <td>
                  <div className={styles.tdActions}>
                    <button className={styles.btnPrimary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                      onClick={() => navigate(`/admin/super/hotels/${h.id}/config`)}>
                      Configurer
                    </button>
                    <a href={`/${h.slug}`} target="_blank" rel="noreferrer"
                      className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem', textDecoration: 'none' }}>
                      Aperçu
                    </a>
                    <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                      onClick={() => openEdit(h)}>Modifier</button>
                    <button className={styles.btnSecondary} style={{ padding: '5px 12px', fontSize: '0.78rem' }}
                      onClick={() => setConfirm({ hotel: h, action: 'toggle' })}>
                      {h.is_active ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onPage={p => load(p)} />

      {/* Modal création/édition */}
      {modal !== null && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>{modal === 'create' ? 'Nouvel hôtel' : `Modifier — ${modal.nom}`}</span>
              <button className={styles.modalClose} onClick={() => setModal(null)}>✕</button>
            </div>
            <div className={styles.modalBody}>
              <div className={styles.field}>
                <label className={styles.label}>Nom *</label>
                <input className={styles.input} value={form.nom}
                  onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} required />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Slug * <span style={{ color: '#9CA3AF', fontSize: '0.78rem' }}>(identifiant URL unique)</span></label>
                <input className={styles.input} value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  placeholder="ex: hotel-du-lac" required />
              </div>
            </div>
            <div className={styles.modalFooter}>
              <button className={styles.btnSecondary} onClick={() => setModal(null)}>Annuler</button>
              <button className={styles.btnPrimary} onClick={save}
                disabled={saving || !form.nom || !form.slug}>
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation toggle */}
      <ConfirmModal
        open={!!confirm}
        title={confirm?.hotel?.is_active ? 'Désactiver cet hôtel ?' : 'Activer cet hôtel ?'}
        message={confirm?.hotel?.is_active
          ? `L'hôtel "${confirm?.hotel?.nom}" sera désactivé et ne recevra plus de connexions.`
          : `L'hôtel "${confirm?.hotel?.nom}" sera réactivé.`}
        danger={confirm?.hotel?.is_active}
        onConfirm={handleToggle}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
