import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const CATEGORIES = ['proprete', 'accueil', 'chambre', 'restauration', 'services'];
const CAT_LABELS  = ['Propreté', 'Accueil', 'Chambre', 'Restauration', 'Services'];

// Mappe une police curative vers le nom jsPDF le plus proche
const FONT_MAP = {
  'Playfair Display':   'times',
  'Merriweather':       'times',
  'Cormorant Garamond': 'times',
};
function jsPDFFont(fontName) {
  return FONT_MAP[fontName] || 'helvetica';
}

// Hex (#RRGGBB) → [r, g, b]
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [194, 120, 42];
}

// Fetch une image distante et retourne un dataURL base64
async function fetchImageAsDataURL(url) {
  try {
    const res  = await fetch(url);
    const blob = await res.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror  = reject;
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

// Fetch un fichier de police et retourne la base64 brute (sans préfixe dataURL)
async function fetchFontAsBase64(url) {
  try {
    const res    = await fetch(url);
    const buffer = await res.arrayBuffer();
    const bytes  = new Uint8Array(buffer);
    let binary   = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  } catch { return null; }
}

/**
 * Génère et télécharge le PDF d'évaluations.
 *
 * @param {object} opts
 *   rows        — tableau complet des avis (sans pagination)
 *   stats       — objet stats (moyenne_globale, moy_*, total)
 *   hotelName   — string
 *   logoUrl     — string|null
 *   primaryColor — hex string
 *   fontPrimary  — string (nom police curative ou 'HotelCustomFont')
 *   fontFileUrl  — string|null (URL .ttf custom)
 *   filters      — { from, to, minNote }
 *   filename     — string (sans extension)
 */
export async function exportFeedbackPDF({
  rows, stats, hotelName, logoUrl, primaryColor,
  fontPrimary, fontFileUrl, filters, filename,
}) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const W   = doc.internal.pageSize.getWidth();   // 297
  const H   = doc.internal.pageSize.getHeight();  // 210
  const M   = 14;  // marge
  const [pr, pg, pb] = hexToRgb(primaryColor || '#C2782A');

  // ── Enregistrement police custom ──────────────────────────────
  let pdfFont = jsPDFFont(fontPrimary);
  if (fontFileUrl) {
    const b64 = await fetchFontAsBase64(fontFileUrl);
    if (b64) {
      doc.addFileToVFS('HotelCustomFont.ttf', b64);
      doc.addFont('HotelCustomFont.ttf', 'HotelCustomFont', 'normal');
      pdfFont = 'HotelCustomFont';
    }
  }
  doc.setFont(pdfFont);

  // ── Bande d'en-tête colorée ───────────────────────────────────
  doc.setFillColor(pr, pg, pb);
  doc.rect(0, 0, W, 22, 'F');

  // Logo
  let logoH = 0;
  if (logoUrl) {
    const dataURL = await fetchImageAsDataURL(logoUrl);
    if (dataURL) {
      try {
        doc.addImage(dataURL, M, 3, 0, 16); // hauteur 16mm, largeur auto
        logoH = 18;
      } catch {}
    }
  }

  // Nom de l'hôtel
  const textX = logoH > 0 ? M + 36 : M;
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont(pdfFont, 'bold');
  doc.text(hotelName || 'Hôtel', textX, 10);
  doc.setFontSize(9);
  doc.setFont(pdfFont, 'normal');
  doc.text('Rapport d\'évaluations clients', textX, 16);

  // Date d'export (droite)
  const now        = new Date();
  const exportDate = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const exportTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(8);
  doc.text(`Exporté le ${exportDate} à ${exportTime}`, W - M, 10, { align: 'right' });

  // Période filtrée
  const periodParts = [];
  if (filters?.from) periodParts.push(`Du ${filters.from}`);
  if (filters?.to)   periodParts.push(`au ${filters.to}`);
  if (filters?.minNote) periodParts.push(`note ≥ ${filters.minNote}`);
  if (periodParts.length) {
    doc.text(`Période : ${periodParts.join(' ')}`, W - M, 16, { align: 'right' });
  }

  // ── Bloc statistiques ─────────────────────────────────────────
  let y = 28;
  doc.setTextColor(40, 40, 40);
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(10);
  doc.text('Statistiques', M, y);
  y += 5;

  if (stats) {
    // Note globale (gauche)
    doc.setFillColor(pr, pg, pb);
    doc.roundedRect(M, y, 40, 22, 3, 3, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont(pdfFont, 'bold');
    const avg = stats.moyenne_globale ? parseFloat(stats.moyenne_globale).toFixed(2) : '—';
    doc.text(avg, M + 20, y + 11, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont(pdfFont, 'normal');
    doc.text(`sur ${stats.total || 0} avis`, M + 20, y + 17, { align: 'center' });

    // Barres par catégorie (droite de la note globale)
    const barX    = M + 46;
    const barW    = 90;
    const barH    = 3;
    const barGap  = 4.2;
    doc.setTextColor(40, 40, 40);
    CATEGORIES.forEach((cat, i) => {
      const val = stats[`moy_${cat}`] ? parseFloat(stats[`moy_${cat}`]) : 0;
      const pct = val / 5;
      const by  = y + 1 + i * barGap;

      doc.setFontSize(6.5);
      doc.setFont(pdfFont, 'normal');
      doc.setTextColor(80, 80, 80);
      doc.text(CAT_LABELS[i], barX, by + barH - 0.5);

      const labelW = 22;
      // Rail gris
      doc.setFillColor(220, 220, 220);
      doc.roundedRect(barX + labelW, by, barW, barH, 1, 1, 'F');
      // Barre colorée
      doc.setFillColor(pr, pg, pb);
      if (pct > 0) doc.roundedRect(barX + labelW, by, barW * pct, barH, 1, 1, 'F');
      // Valeur
      doc.setTextColor(80, 80, 80);
      doc.text(val ? val.toFixed(1) : '—', barX + labelW + barW + 2, by + barH - 0.5);
    });
  }

  y += 28;

  // ── Tableau des avis ──────────────────────────────────────────
  doc.setFont(pdfFont, 'bold');
  doc.setFontSize(10);
  doc.setTextColor(40, 40, 40);
  doc.text(`Liste des avis (${rows.length})`, M, y);
  y += 4;

  const tableRows = rows.map(r => {
    const cats = typeof r.categories === 'string' ? JSON.parse(r.categories) : (r.categories || {});
    const date = new Date(r.created_at).toLocaleDateString('fr-FR', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit',
    });
    return [
      date,
      r.note_globale ? parseFloat(r.note_globale).toFixed(1) : '—',
      ...CATEGORIES.map(c => cats[c] != null ? String(cats[c]) : '—'),
      r.commentaire ? (r.commentaire.length > 60 ? r.commentaire.slice(0, 60) + '…' : r.commentaire) : '',
      (r.locale || '').toUpperCase(),
    ];
  });

  autoTable(doc, {
    startY:   y,
    margin:   { left: M, right: M },
    head: [[
      'Date', 'Note', 'Propreté', 'Accueil', 'Chambre', 'Restau.', 'Services', 'Commentaire', 'Langue',
    ]],
    body: tableRows,
    styles: {
      font:      pdfFont,
      fontSize:  7.5,
      cellPadding: 2.5,
      overflow:  'linebreak',
    },
    headStyles: {
      fillColor:  [pr, pg, pb],
      textColor:  [255, 255, 255],
      fontStyle:  'bold',
      halign:     'center',
    },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    columnStyles: {
      0: { cellWidth: 22, halign: 'center' },
      1: { cellWidth: 12, halign: 'center', fontStyle: 'bold' },
      2: { cellWidth: 16, halign: 'center' },
      3: { cellWidth: 16, halign: 'center' },
      4: { cellWidth: 16, halign: 'center' },
      5: { cellWidth: 16, halign: 'center' },
      6: { cellWidth: 16, halign: 'center' },
      7: { cellWidth: 'auto' },
      8: { cellWidth: 13, halign: 'center' },
    },
    didDrawPage: (data) => {
      // Pied de page numéroté
      const pageCount = doc.internal.getNumberOfPages();
      doc.setFont(pdfFont, 'normal');
      doc.setFontSize(7);
      doc.setTextColor(160, 160, 160);
      doc.text(
        `${hotelName} — Page ${data.pageNumber} / ${pageCount}`,
        W / 2, H - 6, { align: 'center' },
      );
      // Ligne de pied
      doc.setDrawColor(pr, pg, pb);
      doc.setLineWidth(0.3);
      doc.line(M, H - 9, W - M, H - 9);
    },
  });

  doc.save(`${filename}.pdf`);
}
