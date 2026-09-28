import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../useAdminApi';
import ConfirmModal from '../components/ConfirmModal';
import styles from '../Admin.module.css';

/**
 * BackupManager — Sauvegarde et restauration de la configuration.
 *
 * Une seule page pour deux espaces :
 *   variant="hotel" → /admin/hotel/backup   : l'établissement courant
 *   variant="super" → /admin/super/backup   : tous les périmètres
 *
 * Un import ne s'applique jamais directement : le fichier est d'abord analysé
 * côté serveur (essai à blanc) et l'utilisateur voit ce qui va changer avant de
 * confirmer. Le serveur met de côté un instantané de sécurité juste avant
 * d'écrire, listé plus bas pour permettre un retour en arrière.
 */

const MODES = [
  {
    value: 'merge', label: '🔀 Fusionner',
    desc: "Le contenu de l'archive écrase les fiches correspondantes. Ce que vous avez ajouté depuis reste en place.",
  },
  {
    value: 'replace', label: '♻️ Remplacer',
    desc: "Vide le périmètre restauré avant d'insérer. Tout ce qui ne figure pas dans l'archive disparaît.",
  },
];

const fmtSize = b =>
  b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`;

const fmtDate = iso => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

export default function BackupManager({ variant = 'hotel' }) {
  const isSuper = variant === 'super';
  const base    = isSuper ? '/super/backup' : '/hotel/backup';

  const [meta,      setMeta]      = useState(null);
  const [scope,     setScope]     = useState('hotel');
  const [hotelId,   setHotelId]   = useState('');
  const [busy,      setBusy]      = useState('');
  const [toast,     setToast]     = useState(null);

  const [snapshots, setSnapshots] = useState([]);
  const [preview,   setPreview]   = useState(null);   // essai à blanc
  const [file,      setFile]      = useState(null);   // fichier choisi
  const [source,    setSource]    = useState(null);   // { kind:'file' } | { kind:'snapshot', id }
  const [mode,      setMode]      = useState('merge');
  const [target,    setTarget]    = useState('');
  const [createHotels, setCreateHotels] = useState(false);
  const [report,    setReport]    = useState(null);
  const [confirm,   setConfirm]   = useState(null);

  const fileInput = useRef(null);

  const showToast = (message, ok = true) => {
    setToast({ message, ok });
    setTimeout(() => setToast(null), 5000);
  };
  const errorOf = (err, fallback) => err?.response?.data?.error || err?.message || fallback;

  const loadSnapshots = useCallback(async () => {
    try {
      const { data } = await api.get(`${base}/snapshots`);
      setSnapshots(data);
    } catch (err) { showToast(errorOf(err, 'Instantanés illisibles'), false); }
  }, [base]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`${base}/scopes`);
        setMeta(data);
        if (data.hotels.length === 1) { setHotelId(String(data.hotels[0].id)); setTarget(String(data.hotels[0].id)); }
      } catch (err) { showToast(errorOf(err, 'Chargement impossible'), false); }
      loadSnapshots();
    })();
  }, [base, loadSnapshots]);

  // Les téléchargements passent par axios pour bénéficier du cookie de session :
  // une balise <a href> vers l'API ouvrirait la page de login dans un onglet.
  const download = async (url, fallbackName) => {
    const res = await api.get(url, { responseType: 'blob' });
    const disposition = res.headers['content-disposition'] || '';
    const named = /filename="?([^"]+)"?/.exec(disposition);
    const href = URL.createObjectURL(res.data);
    const a = document.createElement('a');
    a.href = href;
    a.download = named ? named[1] : fallbackName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(href);
  };

  const tryDownload = async (url, name) => {
    try { await download(url, name); }
    catch (err) { showToast(errorOf(err, 'Téléchargement impossible'), false); }
  };

  const needsHotel = scope === 'hotel';
  const canExport  = meta && (!needsHotel || hotelId);

  const doExport = async () => {
    setBusy('export');
    try {
      const params = new URLSearchParams({ scope });
      if (needsHotel) params.set('hotel_id', hotelId);
      await download(`${base}/export?${params}`, 'connectbe.zip');
      showToast('Archive téléchargée');
    } catch (err) { showToast(errorOf(err, "Échec de l'export"), false); }
    finally { setBusy(''); }
  };

  const doSnapshot = async () => {
    setBusy('snapshot');
    try {
      const body = { scope };
      if (needsHotel) body.hotel_id = hotelId;
      await api.post(`${base}/snapshots`, body);
      showToast('Instantané enregistré sur le serveur');
      loadSnapshots();
    } catch (err) { showToast(errorOf(err, "Échec de l'instantané"), false); }
    finally { setBusy(''); }
  };

  // ── Essai à blanc ────────────────────────────────────────────────────────
  const resetImport = () => {
    setPreview(null); setReport(null); setFile(null); setSource(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  // Présélectionner la destination la plus probable : l'hôtel de même slug.
  const applyPreviewDefaults = data => {
    if (data.manifest.scope !== 'hotel') return;
    const known = data.hotels.find(h => h.existing);
    if (known) setTarget(String(known.existing.id));
    else if (meta?.hotels.length === 1) setTarget(String(meta.hotels[0].id));
  };

  const inspectFile = async selected => {
    if (!selected) return;
    setBusy('inspect'); setReport(null); setPreview(null);
    try {
      const form = new FormData();
      form.append('archive', selected);
      const { data } = await api.post(`${base}/inspect`, form);
      setPreview(data);
      setFile(selected);
      setSource({ kind: 'file' });
      applyPreviewDefaults(data);
    } catch (err) {
      showToast(errorOf(err, 'Archive illisible'), false);
      resetImport();
    } finally { setBusy(''); }
  };

  const inspectSnapshot = async id => {
    setBusy('inspect'); setReport(null); setPreview(null);
    try {
      const { data } = await api.post(`${base}/snapshots/${encodeURIComponent(id)}/inspect`);
      setPreview(data);
      setFile(null);
      setSource({ kind: 'snapshot', id });
      applyPreviewDefaults(data);
      document.getElementById('zone-import')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) { showToast(errorOf(err, 'Instantané illisible'), false); }
    finally { setBusy(''); }
  };

  const importScope   = preview?.manifest.scope;
  const needsTarget   = importScope === 'hotel';
  const missingHotels = (preview?.hotels || []).filter(h => !h.existing);
  const canImport     = preview && (!needsTarget || target) && !busy;

  const askImport = () => {
    const where = needsTarget
      ? `l'établissement « ${meta?.hotels.find(h => String(h.id) === String(target))?.nom || target} »`
      : importScope === 'full' ? "l'ensemble de l'instance" : 'le catalogue partagé';
    setConfirm({
      title: mode === 'replace' ? 'Remplacer la configuration ?' : 'Fusionner la configuration ?',
      danger: mode === 'replace',
      message: mode === 'replace'
        ? `Tout ce qui n'est pas dans l'archive sera supprimé de ${where}. Un instantané de sécurité est créé juste avant, vous pourrez revenir en arrière.`
        : `Les ${preview.total_rows} lignes de l'archive vont écraser les fiches correspondantes de ${where}. Un instantané de sécurité est créé juste avant.`,
      run: doImport,
    });
  };

  const doImport = async () => {
    setConfirm(null);
    setBusy('import');
    try {
      let data;
      if (source.kind === 'file') {
        const form = new FormData();
        form.append('archive', file);
        form.append('mode', mode);
        if (needsTarget) form.append('target_hotel_id', target);
        if (isSuper) form.append('create_missing_hotels', String(createHotels));
        ({ data } = await api.post(`${base}/import`, form));
      } else {
        ({ data } = await api.post(`${base}/snapshots/${encodeURIComponent(source.id)}/restore`, {
          mode,
          ...(needsTarget ? { target_hotel_id: target } : {}),
          ...(isSuper ? { create_missing_hotels: String(createHotels) } : {}),
        }));
      }
      setReport(data);
      setPreview(null); setFile(null); setSource(null);
      if (fileInput.current) fileInput.current.value = '';
      showToast('Configuration restaurée');
      loadSnapshots();
    } catch (err) { showToast(errorOf(err, "Échec de l'import"), false); }
    finally { setBusy(''); }
  };

  const doDelete = snap => setConfirm({
    title: "Supprimer l'instantané ?",
    danger: true,
    message: `L'instantané du ${fmtDate(snap.created_at)} sera définitivement supprimé du serveur.`,
    run: async () => {
      setConfirm(null);
      try {
        await api.delete(`${base}/snapshots/${encodeURIComponent(snap.id)}`);
        showToast('Instantané supprimé');
        loadSnapshots();
      } catch (err) { showToast(errorOf(err, 'Suppression impossible'), false); }
    },
  });

  if (!meta) return <div style={{ padding: '2rem', color: '#9CA3AF' }}>Chargement…</div>;

  return (
    <div>
      <div className={styles.managerHeader}>
        <div>
          <h1 className={styles.managerTitle}>Sauvegarde &amp; restauration</h1>
          <p className={styles.managerSub}>
            Exportez la configuration et le contenu dans un fichier, réimportez-le ici ou sur une autre installation
          </p>
        </div>
      </div>

      {toast && (
        <div className={`${styles.toast} ${toast.ok === false ? styles.toastError : ''}`}>{toast.message}</div>
      )}

      {/* ── Export ───────────────────────────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>📦 Exporter</h2>

        {isSuper && (
          <div className={styles.radioGroup} style={{ marginBottom: 16 }}>
            {meta.scopes.map(s => (
              <label key={s.value} className={`${styles.radioCard} ${scope === s.value ? styles.radioCardActive : ''}`}>
                <input
                  type="radio" name="scope" value={s.value}
                  checked={scope === s.value}
                  onChange={() => setScope(s.value)}
                  className={styles.radioInput}
                />
                <div>
                  <strong>
                    {s.value === 'hotel' ? '🏨 Un établissement'
                      : s.value === 'global' ? '🌍 Catalogue partagé'
                      : '🗄️ Instance complète'}
                  </strong>
                  <p className={styles.radioDesc}>{s.label}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {needsHotel && (
          <div className={styles.field} style={{ maxWidth: 380 }}>
            <label className={styles.label}>Établissement</label>
            <select
              className={styles.input} value={hotelId}
              onChange={e => setHotelId(e.target.value)}
              disabled={meta.hotels.length <= 1}
            >
              <option value="">— choisir —</option>
              {meta.hotels.map(h => <option key={h.id} value={h.id}>{h.nom}</option>)}
            </select>
          </div>
        )}

        <p className={styles.fieldHint} style={{ marginTop: 12 }}>
          L'archive contient les réglages, le contenu, les traductions et les médias associés.
          Les comptes utilisateurs, les jetons de bornes, les clés d'API et les évaluations clients n'y figurent pas.
        </p>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button className={styles.btnPrimary} onClick={doExport} disabled={!canExport || !!busy}>
            {busy === 'export' ? '⏳ Préparation…' : '⬇️ Télécharger l\'archive'}
          </button>
          <button className={styles.btnSecondary} onClick={doSnapshot} disabled={!canExport || !!busy}>
            {busy === 'snapshot' ? '⏳ Enregistrement…' : '🕑 Enregistrer un instantané sur le serveur'}
          </button>
        </div>
      </section>

      {/* ── Import ───────────────────────────────────────────────────── */}
      <section className={styles.card} id="zone-import">
        <h2 className={styles.cardTitle}>📥 Importer</h2>

        <div className={styles.field} style={{ maxWidth: 480 }}>
          <label className={styles.label}>Fichier d'archive (.zip)</label>
          <input
            ref={fileInput} type="file" accept=".zip,application/zip"
            className={styles.input}
            onChange={e => inspectFile(e.target.files?.[0])}
            disabled={!!busy}
          />
          <p className={styles.fieldHint}>
            Le fichier est analysé avant toute écriture — rien n'est modifié tant que vous n'avez pas confirmé.
            Taille maximale {fmtSize(meta.max_archive_bytes)}.
          </p>
        </div>

        {busy === 'inspect' && <p style={{ color: '#9CA3AF' }}>⏳ Analyse de l'archive…</p>}

        {preview && (
          <>
            <div className={styles.infoBox} style={{ marginTop: 8 }}>
              <strong>{preview.scope_label}</strong><br />
              Exportée le {fmtDate(preview.manifest.created_at)}
              {preview.manifest.generated_by ? ` par ${preview.manifest.generated_by}` : ''} —{' '}
              {preview.total_rows} ligne(s), {preview.uploads.files} média(s) ({fmtSize(preview.uploads.bytes)}).
              {preview.same_instance
                ? ' Archive issue de cette installation.'
                : ' Archive issue d\'une autre installation.'}
            </div>

            {preview.hotels.length > 0 && (
              <p style={{ fontSize: '0.88rem', color: '#374151', margin: '12px 0 0' }}>
                Établissement(s) dans l'archive :{' '}
                {preview.hotels.map(h => (
                  <span key={h.slug} style={{ marginRight: 10 }}>
                    <strong>{h.nom}</strong>{' '}
                    <span className={`${styles.badge} ${h.existing ? styles.badgeActive : styles.badgeInactive}`}>
                      {h.existing ? `reconnu : ${h.existing.nom}` : 'inconnu ici'}
                    </span>
                  </span>
                ))}
              </p>
            )}

            {preview.warnings.length > 0 && (
              <ul style={{ margin: '12px 0 0', paddingLeft: 20, fontSize: '0.85rem', color: '#92400E' }}>
                {preview.warnings.map((w, i) => <li key={i} style={{ marginBottom: 4 }}>{w}</li>)}
              </ul>
            )}

            <div className={styles.tableWrap} style={{ marginTop: 16 }}>
              <table className={styles.table}>
                <thead><tr><th>Contenu</th><th style={{ textAlign: 'right' }}>Lignes</th><th>Remarque</th></tr></thead>
                <tbody>
                  {preview.tables.map(t => (
                    <tr key={t.table}>
                      <td>{t.label}</td>
                      <td style={{ textAlign: 'right' }}>{t.rows}</td>
                      <td style={{ fontSize: '0.8rem', color: '#92400E' }}>
                        {t.skipped ? 'ignoré — table absente' : ''}
                        {t.unknownColumns?.length ? `champs ignorés : ${t.unknownColumns.join(', ')}` : ''}
                        {t.missingColumns?.length ? ` champs manquants : ${t.missingColumns.join(', ')}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={styles.radioGroup} style={{ marginTop: 20 }}>
              {MODES.map(m => (
                <label key={m.value} className={`${styles.radioCard} ${mode === m.value ? styles.radioCardActive : ''}`}>
                  <input
                    type="radio" name="mode" value={m.value}
                    checked={mode === m.value}
                    onChange={() => setMode(m.value)}
                    className={styles.radioInput}
                  />
                  <div>
                    <strong>{m.label}</strong>
                    <p className={styles.radioDesc}>{m.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {needsTarget && (
              <div className={styles.field} style={{ maxWidth: 380, marginTop: 16 }}>
                <label className={styles.label}>Restaurer dans l'établissement</label>
                <select
                  className={styles.input} value={target}
                  onChange={e => setTarget(e.target.value)}
                  disabled={meta.hotels.length <= 1}
                >
                  <option value="">— choisir —</option>
                  {meta.hotels.map(h => <option key={h.id} value={h.id}>{h.nom}</option>)}
                </select>
                <p className={styles.fieldHint}>
                  Choisir un autre établissement que celui d'origine duplique la configuration vers celui-ci.
                </p>
              </div>
            )}

            {isSuper && !needsTarget && missingHotels.length > 0 && (
              <label className={styles.toggleRow} style={{ marginTop: 16 }}>
                <input type="checkbox" checked={createHotels} onChange={e => setCreateHotels(e.target.checked)} />
                <span className={styles.toggleLabel}>
                  Créer les {missingHotels.length} établissement(s) absent(s) de cette installation
                  ({missingHotels.map(h => h.nom).join(', ')})
                </span>
              </label>
            )}

            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button
                className={mode === 'replace' ? styles.btnDanger : styles.btnPrimary}
                onClick={askImport} disabled={!canImport}
              >
                {busy === 'import' ? '⏳ Restauration…' : mode === 'replace' ? '♻️ Remplacer' : '🔀 Fusionner'}
              </button>
              <button className={styles.btnSecondary} onClick={resetImport} disabled={!!busy}>Annuler</button>
            </div>
          </>
        )}

        {report && (
          <div className={styles.infoBox} style={{ marginTop: 16 }}>
            <strong>Restauration terminée</strong><br />
            {report.totals.inserted} ligne(s) ajoutée(s), {report.totals.updated} mise(s) à jour,{' '}
            {report.totals.purged} supprimée(s), {report.totals.skipped} ignorée(s).{' '}
            {report.uploads.written} média(s) rétabli(s)
            {report.uploads.relocated ? ' dans un dossier dédié' : ''}.
            {report.uploads.refused?.length > 0 &&
              ` ${report.uploads.refused.length} fichier(s) refusé(s) pour chemin invalide.`}
            {report.safety_snapshot && (
              <><br />Instantané de sécurité avant import : <code>{report.safety_snapshot}</code></>
            )}
            {report.warnings?.length > 0 && (
              <ul style={{ margin: '8px 0 0', paddingLeft: 20 }}>
                {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* ── Instantanés serveur ──────────────────────────────────────── */}
      <section className={styles.card}>
        <h2 className={styles.cardTitle}>🕑 Instantanés sur le serveur</h2>
        <p className={styles.fieldHint} style={{ marginBottom: 12 }}>
          Un instantané est créé automatiquement avant chaque import. Les plus anciens sont supprimés
          au-delà des 20 derniers.
        </p>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr><th>Date</th><th>Périmètre</th><th>Établissement(s)</th><th style={{ textAlign: 'right' }}>Lignes</th><th style={{ textAlign: 'right' }}>Taille</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {snapshots.length === 0 ? (
                <tr><td colSpan={6}>
                  <div className={styles.empty}>
                    <div className={styles.emptyIcon}>🕑</div>
                    <div className={styles.emptyText}>Aucun instantané pour le moment</div>
                  </div>
                </td></tr>
              ) : snapshots.map(s => (
                <tr key={s.id}>
                  <td>{fmtDate(s.created_at)}</td>
                  <td>
                    {s.readable
                      ? <span className={styles.badge}>{s.scope === 'hotel' ? 'Établissement' : s.scope === 'global' ? 'Catalogue' : 'Instance'}</span>
                      : <span className={`${styles.badge} ${styles.badgeInactive}`}>illisible</span>}
                  </td>
                  <td>{s.hotels.map(h => h.nom).join(', ') || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{s.rows ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>{fmtSize(s.size)}</td>
                  <td className={styles.tdActions}>
                    <button className={styles.btnEdit} onClick={() => inspectSnapshot(s.id)} disabled={!s.readable || !!busy}>
                      Restaurer…
                    </button>
                    <button className={styles.btnLink} onClick={() => tryDownload(`${base}/snapshots/${encodeURIComponent(s.id)}/download`, s.id)}>
                      Télécharger
                    </button>
                    <button className={styles.btnDelete} onClick={() => doDelete(s)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmModal
        open={!!confirm}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
        onConfirm={() => confirm?.run()}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
