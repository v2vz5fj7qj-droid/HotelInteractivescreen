import React, { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import api from '../../useAdminApi';
import { useAuth } from '../../contexts/AuthContext';
import { useSuperHotelId, useHotelSlug } from '../../components/SuperHotelSelector';
import styles from '../../styles/Manager.module.css';
import own    from './GuestCodes.module.css';

const STATUS = {
  active:   { text: 'Actif',         color: '#22c55e' },
  upcoming: { text: 'À venir',       color: '#3b82f6' },
  grace:    { text: 'Courtoisie',    color: '#f59e0b' },
  expired:  { text: 'Expiré',        color: '#6b7280' },
  revoked:  { text: 'Révoqué',       color: '#ef4444' },
};

function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.expired;
  return (
    <span className={own.badge} style={{ color: s.color, background: `${s.color}18` }}>
      <span className={own.dot} style={{ background: s.color }} />
      {s.text}
    </span>
  );
}

function fmtDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function fmtDateTime(value) {
  if (!value) return 'Jamais';
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? 'Jamais'
    : d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
}

// Valeur pour un <input type="date"> : l'API renvoie un DATETIME complet.
function toDateInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function todayInput() {
  return toDateInput(new Date());
}

const EMPTY_FORM = {
  room_number: '', guest_name: '', occupants: 2,
  valid_from: todayInput(), valid_until: '',
};

// Plancher côté serveur (guestAccess.MIN_DEVICES) : téléphone + tablette pour un
// client seul. L'afficher évite un écart silencieux entre saisie et valeur retenue.
const MIN_DEVICES = 2;

// Ajoute des jours à une valeur d'<input type="date">. Un départ déjà passé est
// prolongé à partir d'aujourd'hui, pas à partir de la date morte.
function addDays(dateInput, days) {
  const base = dateInput ? new Date(`${dateInput}T12:00:00`) : new Date();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const from = base < today ? today : base;
  from.setDate(from.getDate() + days);
  return toDateInput(from);
}

function hasStarted(row) {
  const from = new Date(row.valid_from);
  return !Number.isNaN(from.getTime()) && from <= new Date();
}

/**
 * Codes d'accès client — un code par séjour, remis au client à l'enregistrement.
 *
 * Accessible à la réception (hotel_staff), à l'administrateur de l'hôtel et au
 * super-admin. Le super-admin doit préciser l'hôtel courant, comme sur les
 * autres écrans de cet espace.
 *
 * hotelId / slug : fournis quand le composant est embarqué dans un onglet
 * (HotelConfig.jsx, où l'hôtel vient de l'URL) ; sinon on retombe sur l'hôtel
 * du jeton, ou sur celui que le super-admin a choisi dans le sélecteur.
 */
export default function GuestCodes({ hotelId: hotelIdProp, slug: slugProp } = {}) {
  // Même convention que les autres écrans de l'espace hôtel : le super-admin
  // travaille sur l'hôtel qu'il a sélectionné, transmis en ?hotel_id=X.
  const { user }        = useAuth();
  const sessionHotelId  = useSuperHotelId(user);
  const sessionSlug     = useHotelSlug(user);
  const hotelId         = hotelIdProp ?? sessionHotelId;
  const slug            = slugProp    ?? sessionSlug;
  const scope           = hotelId ? { hotel_id: hotelId } : {};

  const [codes,   setCodes]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [filter,  setFilter]  = useState('');
  const [search,  setSearch]  = useState('');
  // Valeur retardée : sans elle, chaque frappe déclenchait une requête LIKE en base.
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [form,     setForm]     = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);

  // Code dont on affiche la fiche (QR + code en clair) pour la remettre au client
  const [sheet, setSheet] = useState(null);
  // Code en cours de modification (chambre, appareils, dates du séjour)
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { ...scope };
      if (filter) params.status = filter;
      if (debouncedSearch) params.q = debouncedSearch;
      const { data } = await api.get('/hotel/guest-codes', { params });
      setCodes(data || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Chargement impossible');
    } finally {
      setLoading(false);
    }
  }, [filter, debouncedSearch, hotelId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const { data } = await api.post('/hotel/guest-codes', form, { params: scope });
      setForm({ ...EMPTY_FORM, valid_from: form.valid_from });
      // La fiche s'ouvre aussitôt : à l'enregistrement, la réception a besoin du
      // code et de son QR immédiatement, pas après un aller-retour dans la liste.
      setSheet(data);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Création impossible');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(row) {
    if (!window.confirm(
      `Révoquer le code ${row.code_formatted} ?\n\n` +
      `L'accès est coupé immédiatement sur tous les appareils du client.`
    )) return;
    try {
      await api.put(`/hotel/guest-codes/${row.id}/revoke`, null, { params: scope });
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Révocation impossible');
    }
  }

  async function handleSave(row, payload) {
    await api.put(`/hotel/guest-codes/${row.id}`, payload, { params: scope });
    setEditing(null);
    load();
  }

  const counts = {
    active:   codes.filter(c => c.status === 'active').length,
    upcoming: codes.filter(c => c.status === 'upcoming').length,
    devices:  codes.reduce((n, c) => n + Number(c.devices_used || 0), 0),
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Codes d'accès client</h1>
      </div>

      {error && <p className={styles.empty} style={{ color: '#ef4444' }}>{error}</p>}

      {/* ── Résumé ── */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{codes.length}</span>
          <span className={styles.statLabel}>Codes</span>
        </div>
        <div className={styles.statCard} style={{ borderColor: '#22c55e33' }}>
          <span className={styles.statValue} style={{ color: '#22c55e' }}>{counts.active}</span>
          <span className={styles.statLabel}>Séjours en cours</span>
        </div>
        <div className={styles.statCard} style={{ borderColor: '#3b82f633' }}>
          <span className={styles.statValue} style={{ color: '#3b82f6' }}>{counts.upcoming}</span>
          <span className={styles.statLabel}>Arrivées à venir</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{counts.devices}</span>
          <span className={styles.statLabel}>Appareils connectés</span>
        </div>
      </div>

      {/* ── Création ── */}
      <div className={styles.card}>
        <h2 className={styles.sectionTitle}>Nouveau code de séjour</h2>
        <form
          onSubmit={handleCreate}
          style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end' }}
        >
          <label className={styles.formGroup}>
            <span>Chambre</span>
            <input
              className={styles.input} style={{ width: 110 }}
              value={form.room_number}
              onChange={e => setForm(f => ({ ...f, room_number: e.target.value }))}
              placeholder="204"
            />
          </label>
          <label className={styles.formGroup}>
            <span>Client</span>
            <input
              className={styles.input} style={{ width: 200 }}
              value={form.guest_name}
              onChange={e => setForm(f => ({ ...f, guest_name: e.target.value }))}
              placeholder="M. Ouédraogo"
            />
          </label>
          <label className={styles.formGroup}>
            <span>Occupants</span>
            <input
              type="number" min={1} max={20}
              className={styles.input} style={{ width: 90 }}
              value={form.occupants}
              onChange={e => setForm(f => ({ ...f, occupants: e.target.value }))}
            />
          </label>
          <label className={styles.formGroup}>
            <span>Arrivée</span>
            {/* min : un séjour ne commence pas dans le passé. Le serveur refuse
                de toute façon, autant que le calendrier l'interdise. */}
            <input
              type="date" required
              min={todayInput()}
              className={styles.input}
              value={form.valid_from}
              onChange={e => setForm(f => ({
                ...f,
                valid_from: e.target.value,
                // Départ devenu antérieur à l'arrivée : on le repousse d'un jour.
                valid_until: f.valid_until && f.valid_until <= e.target.value
                  ? addDays(e.target.value, 1)
                  : f.valid_until,
              }))}
            />
          </label>
          <label className={styles.formGroup}>
            <span>Départ</span>
            <input
              type="date" required
              min={form.valid_from ? addDays(form.valid_from, 1) : addDays(todayInput(), 1)}
              className={styles.input}
              value={form.valid_until}
              onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))}
            />
          </label>
          <button type="submit" className={styles.btnPrimary} disabled={creating}>
            {creating ? 'Création…' : 'Générer le code'}
          </button>
        </form>
        <p className={own.muted} style={{ marginTop: '0.75rem' }}>
          Le code reste valable 24 h après la date de départ (marge de courtoisie) — sauf
          pour un séjour d'une seule journée, qui expire le soir même. Le nombre d'appareils
          est celui des occupants, avec un minimum de deux. Les deux valeurs s'ajustent
          ensuite depuis « Modifier ».
        </p>
      </div>

      {/* ── Filtres ── */}
      <div style={{ display: 'flex', gap: '0.75rem', margin: '1.5rem 0', flexWrap: 'wrap' }}>
        <input
          className={styles.input}
          placeholder="Chambre, nom ou code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className={styles.select} value={filter} onChange={e => setFilter(e.target.value)}>
          <option value="">Tous les statuts</option>
          {Object.entries(STATUS).map(([k, v]) => (
            <option key={k} value={k}>{v.text}</option>
          ))}
        </select>
      </div>

      {/* ── Liste ── */}
      {loading ? (
        <p className={styles.empty}>Chargement…</p>
      ) : codes.length === 0 ? (
        <p className={styles.empty}>Aucun code pour ces critères.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Code</th>
                <th>Chambre</th>
                <th>Client</th>
                <th>Séjour</th>
                <th>Statut</th>
                <th>Appareils</th>
                <th>Dernière utilisation</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {codes.map(row => (
                <tr key={row.id}>
                  <td><span className={own.code}>{row.code_formatted}</span></td>
                  <td>{row.room_number || '—'}</td>
                  <td>{row.guest_name || <em className={own.muted}>—</em>}</td>
                  <td className={own.muted}>
                    {fmtDate(row.valid_from)} → {fmtDate(row.valid_until)}
                    {/* La courtoisie prolonge l'accès au-delà du départ : l'afficher
                        évite de la découvrir en constatant qu'un code marche encore. */}
                    {Number(row.grace_hours) > 0 && (
                      <span className={own.graceNote}>
                        accès jusqu'au {fmtDateTime(row.access_until)}
                      </span>
                    )}
                  </td>
                  <td><StatusBadge status={row.status} /></td>
                  <td>{row.devices_used}/{row.max_devices}</td>
                  <td className={own.muted}>{fmtDateTime(row.last_used_at)}</td>
                  <td>
                    <div className={own.actions}>
                      <button className={styles.btnSmall} onClick={() => setSheet(row)}>
                        Fiche
                      </button>
                      <button className={styles.btnSmallGhost} onClick={() => setEditing(row)}>
                        Modifier
                      </button>
                      {!row.revoked_at && (
                        <button className={styles.btnDanger} onClick={() => handleRevoke(row)}>
                          Révoquer
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sheet && <GuestSheet row={sheet} slug={slug} onClose={() => setSheet(null)} />}

      {editing && (
        <EditStayModal
          row={editing}
          onClose={() => setEditing(null)}
          onSave={payload => handleSave(editing, payload)}
        />
      )}
    </div>
  );
}

/**
 * Modification d'un séjour en cours ou à venir.
 *
 * Deux situations, un seul écran :
 *   • séjour à venir  → l'arrivée et le départ s'ajustent librement (client annoncé
 *     plus tôt, plus tard, ou changement de réservation) ;
 *   • séjour commencé → l'arrivée est un fait acquis, seul le départ bouge. C'est
 *     la prolongation, avec des raccourcis pour les cas courants.
 * Dans les deux cas la chambre, le nombre d'occupants et le nombre d'appareils
 * restent modifiables : un client change de chambre, ou arrive avec un appareil
 * de plus que prévu.
 */
function EditStayModal({ row, onClose, onSave }) {
  const started = hasStarted(row);
  const revoked = !!row.revoked_at;
  const today   = todayInput();

  const [form, setForm] = useState({
    room_number: row.room_number || '',
    guest_name:  row.guest_name  || '',
    occupants:   row.occupants   ?? 1,
    max_devices: row.max_devices ?? MIN_DEVICES,
    valid_from:  toDateInput(row.valid_from),
    valid_until: toDateInput(row.valid_until),
    grace_hours: row.grace_hours ?? 24,
    reactivate:  false,
  });
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // Échap ferme le modal : à la réception on garde une main sur le clavier.
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  // Le départ ne peut ni précéder l'arrivée, ni tomber dans le passé.
  const minUntil = started
    ? today
    : (form.valid_from ? addDays(form.valid_from, 1) : addDays(today, 1));

  const devicesUsed = Number(row.devices_used || 0);

  async function submit(e) {
    e.preventDefault();
    setError('');

    if (!form.valid_until) return setError('La date de départ est requise.');
    if (form.valid_until < minUntil) {
      return setError(started
        ? 'La date de départ doit être aujourd\'hui ou plus tard.'
        : 'La date de départ doit suivre la date d\'arrivée.');
    }
    if (!started && form.valid_from < today) {
      return setError('La date d\'arrivée ne peut pas être antérieure à aujourd\'hui.');
    }

    setSaving(true);
    try {
      await onSave({
        room_number: form.room_number.trim() || null,
        guest_name:  form.guest_name.trim()  || null,
        occupants:   Number(form.occupants),
        max_devices: Number(form.max_devices),
        // Séjour commencé : on n'envoie pas l'arrivée, le serveur la refuserait
        // si elle différait — et elle n'a aucune raison de changer.
        ...(started ? {} : { valid_from: form.valid_from }),
        valid_until: form.valid_until,
        grace_hours: Number(form.grace_hours),
        reactivate:  form.reactivate,
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Enregistrement impossible');
      setSaving(false);
    }
  }

  return (
    <div className={own.overlay} onClick={onClose}>
      <form
        className={own.dialog}
        onClick={e => e.stopPropagation()}
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-stay-title"
      >
        <header className={own.dialogHead}>
          <div>
            <p className={own.dialogEyebrow}>Modifier le séjour</p>
            <h2 id="edit-stay-title" className={own.dialogTitle}>
              <span className={own.code}>{row.code_formatted}</span>
              <StatusBadge status={row.status} />
            </h2>
          </div>
          <button type="button" className={own.dialogClose} onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </header>

        <div className={own.dialogBody}>
          {/* ── Client ── */}
          <fieldset className={own.fieldset}>
            <legend className={own.legend}>Client</legend>
            <div className={own.grid2}>
              <label className={styles.formGroup}>
                <span>Chambre</span>
                <input
                  className={styles.input}
                  value={form.room_number}
                  onChange={e => set('room_number', e.target.value)}
                  placeholder="204"
                  autoFocus
                />
              </label>
              <label className={styles.formGroup}>
                <span>Nom</span>
                <input
                  className={styles.input}
                  value={form.guest_name}
                  onChange={e => set('guest_name', e.target.value)}
                  placeholder="M. Ouédraogo"
                />
              </label>
            </div>
            <p className={own.hint}>
              Un changement de chambre se corrige ici : le code du client reste le même,
              il n'a rien à rescanner.
            </p>
          </fieldset>

          {/* ── Dates ── */}
          <fieldset className={own.fieldset}>
            <legend className={own.legend}>Dates du séjour</legend>
            <div className={own.grid2}>
              <label className={styles.formGroup}>
                <span>Arrivée</span>
                <input
                  type="date"
                  className={styles.input}
                  value={form.valid_from}
                  min={today}
                  disabled={started}
                  onChange={e => set('valid_from', e.target.value)}
                />
              </label>
              <label className={styles.formGroup}>
                <span>Départ</span>
                <input
                  type="date" required
                  className={styles.input}
                  value={form.valid_until}
                  min={minUntil}
                  onChange={e => set('valid_until', e.target.value)}
                />
              </label>
            </div>

            {started ? (
              <p className={own.locked}>
                Le séjour a commencé : la date d'arrivée n'est plus modifiable. Le départ,
                lui, se prolonge autant que nécessaire.
              </p>
            ) : (
              <p className={own.hint}>
                Séjour à venir : avancez ou repoussez l'arrivée selon la prévision du client.
                Le code reste le même.
              </p>
            )}

            <div className={own.quickRow}>
              <span className={own.quickLabel}>Repousser le départ :</span>
              {[1, 3, 7].map(days => (
                <button
                  key={days}
                  type="button"
                  className={styles.btnSmallGhost}
                  onClick={() => set('valid_until', addDays(form.valid_until, days))}
                >
                  +{days} {days === 1 ? 'jour' : 'jours'}
                </button>
              ))}
            </div>
          </fieldset>

          {/* ── Accès ── */}
          <fieldset className={own.fieldset}>
            <legend className={own.legend}>Accès</legend>
            <div className={own.grid3}>
              <label className={styles.formGroup}>
                <span>Occupants</span>
                <input
                  type="number" min={1} max={99}
                  className={styles.input}
                  value={form.occupants}
                  onChange={e => set('occupants', e.target.value)}
                />
              </label>
              <label className={styles.formGroup}>
                <span>Appareils autorisés</span>
                <input
                  type="number" min={MIN_DEVICES} max={99}
                  className={styles.input}
                  value={form.max_devices}
                  onChange={e => set('max_devices', e.target.value)}
                />
              </label>
              <label className={styles.formGroup}>
                <span>Courtoisie (h)</span>
                <input
                  type="number" min={0} max={8760}
                  className={styles.input}
                  value={form.grace_hours}
                  onChange={e => set('grace_hours', e.target.value)}
                />
              </label>
            </div>
            <p className={own.hint}>
              {devicesUsed} appareil{devicesUsed > 1 ? 's' : ''} déjà connecté{devicesUsed > 1 ? 's' : ''}
              {' '}— augmenter la limite suffit pour en ajouter un en cours de séjour, minimum {MIN_DEVICES}.
              La courtoisie prolonge l'accès après la date de départ.
            </p>
          </fieldset>

          {revoked && (
            <label className={own.reactivate}>
              <input
                type="checkbox"
                checked={form.reactivate}
                onChange={e => set('reactivate', e.target.checked)}
              />
              <span>
                <strong>Réactiver ce code révoqué.</strong> Cochez pour rendre l'accès au client.
                Sinon les modifications sont enregistrées, mais son accès reste coupé.
              </span>
            </label>
          )}
        </div>

        <footer className={own.dialogFoot}>
          {error && <p className={own.dialogError} role="alert">{error}</p>}
          <div className={own.dialogActions}>
            <button type="button" className={styles.btnSmallGhost} onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className={styles.btnPrimary} disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

/**
 * Fiche à remettre au client : QR, code en clair et URL de secours.
 * Affichable à l'écran pour un scan au comptoir, ou imprimable en A5 —
 * c'est l'objet qui finira posé sur le lit.
 */
function GuestSheet({ row, slug, onClose }) {
  // Deux adresses, deux usages :
  //  • deepLink : encodée dans le QR, elle porte le code et ouvre l'accès d'un scan.
  //  • entryUrl : celle que le client TAPE, sans le code, pour arriver sur l'écran
  //    de saisie. C'est la seule utile depuis un ordinateur, où le QR ne sert à rien.
  // Le lien profond n'est pas imprimé : trop long à recopier, et redondant avec le QR.
  const deepLink = `${window.location.origin}/${slug || ''}/visiteur?c=${row.code}`;
  const entryUrl = `${window.location.host}/${slug || ''}/visiteur`;

  return (
    <div className={own.overlay} role="dialog" aria-modal="true" onClick={onClose}>
      {/* stopPropagation : un clic dans la fiche ne doit pas la refermer */}
      <div className={own.sheet} onClick={e => e.stopPropagation()}>
        <p className={own.sheetHotel}>Accès à votre séjour</p>
        <h2 className={own.sheetTitle}>
          {row.guest_name || (row.room_number ? `Chambre ${row.room_number}` : 'Votre séjour')}
        </h2>

        <QRCodeSVG value={deepLink} size={220} level="M" includeMargin={false} />

        {/* Juste sous le QR : l'adresse à saisir au clavier, pour le client qui
            consultera depuis son ordinateur. Sans slug résolu, mieux vaut ne rien
            imprimer qu'une adresse malformée sur une fiche remise à un client. */}
        {slug && (
          <div className={own.sheetEntry}>
            <span className={own.sheetEntryLabel}>Ou, depuis un ordinateur, ouvrez</span>
            <span className={own.sheetEntryUrl}>{entryUrl}</span>
          </div>
        )}

        <span className={own.sheetCode}>{row.code_formatted}</span>
        <p className={own.sheetNote}>
          Scannez le QR code, ou saisissez ce code à l'adresse ci-dessus.
          Valable jusqu'au {fmtDate(row.valid_until)} inclus.
        </p>

        <div className={own.sheetActions}>
          <button className={styles.btnPrimary} onClick={() => window.print()}>
            Imprimer
          </button>
          <button className={styles.btnSmallGhost} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
