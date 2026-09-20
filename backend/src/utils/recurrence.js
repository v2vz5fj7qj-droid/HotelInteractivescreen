// Sous-ensemble RRULE (format iCal) pour les événements récurrents sans date fixe.
// Formats supportés dans events.recurrence_rule :
//   FREQ=DAILY
//   FREQ=WEEKLY;BYDAY=MO,WE,FR
//   FREQ=MONTHLY;BYDAY=1TH        (1er jeudi — ordinal: 1..4 ou -1 pour "dernier")
//   FREQ=MONTHLY;BYMONTHDAY=15
//   FREQ=YEARLY;BYMONTH=1;BYMONTHDAY=1  (ou BYDAY pour un jour ordinal annuel)

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
const DAY_LABELS_FR = { SU: 'dimanche', MO: 'lundi', TU: 'mardi', WE: 'mercredi', TH: 'jeudi', FR: 'vendredi', SA: 'samedi' };
const DAY_LABELS_EN = { SU: 'Sunday', MO: 'Monday', TU: 'Tuesday', WE: 'Wednesday', TH: 'Thursday', FR: 'Friday', SA: 'Saturday' };
const ORDINAL_FR = { 1: 'premier', 2: 'deuxième', 3: 'troisième', 4: 'quatrième', '-1': 'dernier' };
const ORDINAL_EN = { 1: 'first', 2: 'second', 3: 'third', 4: 'fourth', '-1': 'last' };

function parseRule(rule) {
  if (!rule) return null;
  const parts = Object.fromEntries(rule.split(';').map(p => p.split('=')));
  const out = { freq: parts.FREQ || null };
  if (parts.BYDAY) {
    out.byday = parts.BYDAY.split(',').map(token => {
      const m = token.match(/^(-?\d)?([A-Z]{2})$/);
      return m ? { ordinal: m[1] ? parseInt(m[1], 10) : null, day: m[2] } : null;
    }).filter(Boolean);
  }
  if (parts.BYMONTHDAY) out.bymonthday = parseInt(parts.BYMONTHDAY, 10);
  if (parts.BYMONTH)    out.bymonth    = parseInt(parts.BYMONTH, 10);
  return out;
}

// month: 0-11. ordinal > 0 = n-ième occurrence, ordinal = -1 = dernière occurrence du mois.
function nthWeekdayOfMonth(year, month, dayCode, ordinal) {
  const targetDow = DAY_CODES.indexOf(dayCode);
  if (targetDow === -1) return null;
  if (ordinal > 0) {
    const first  = new Date(year, month, 1);
    const offset = (targetDow - first.getDay() + 7) % 7;
    const day    = 1 + offset + (ordinal - 1) * 7;
    const d      = new Date(year, month, day);
    return d.getMonth() === month ? d : null;
  }
  const last   = new Date(year, month + 1, 0);
  const offset = (last.getDay() - targetDow + 7) % 7;
  return new Date(year, month, last.getDate() - offset);
}

// Calcule la prochaine occurrence à partir d'une date de référence (aujourd'hui par défaut).
function getNextOccurrence(rule, from = new Date()) {
  const r = parseRule(rule);
  if (!r) return null;
  const today = new Date(from.getFullYear(), from.getMonth(), from.getDate());

  if (r.freq === 'DAILY') return today;

  if (r.freq === 'WEEKLY' && r.byday?.length) {
    const targetDows = r.byday.map(b => DAY_CODES.indexOf(b.day));
    for (let i = 0; i < 8; i++) {
      const d = new Date(today); d.setDate(d.getDate() + i);
      if (targetDows.includes(d.getDay())) return d;
    }
    return null;
  }

  if (r.freq === 'MONTHLY') {
    for (let add = 0; add < 13; add++) {
      const y = today.getFullYear();
      const m = today.getMonth() + add;
      let candidate = null;
      if (r.byday?.length) {
        const b = r.byday[0];
        candidate = nthWeekdayOfMonth(y, m, b.day, b.ordinal ?? 1);
      } else if (r.bymonthday) {
        candidate = new Date(y, m, r.bymonthday);
      }
      if (candidate && candidate >= today) return candidate;
    }
    return null;
  }

  if (r.freq === 'YEARLY') {
    for (let addYear = 0; addYear < 2; addYear++) {
      const y = today.getFullYear() + addYear;
      const m = (r.bymonth || 1) - 1;
      const candidate = r.bymonthday
        ? new Date(y, m, r.bymonthday)
        : (r.byday?.length ? nthWeekdayOfMonth(y, m, r.byday[0].day, r.byday[0].ordinal ?? 1) : null);
      if (candidate && candidate >= today) return candidate;
    }
    return null;
  }

  return null;
}

// Libellé lisible pour l'affichage kiosque (fr/en — autres locales retombent sur le fr).
function describeRecurrence(rule, locale = 'fr') {
  const r = parseRule(rule);
  if (!r) return '';
  const isFr        = locale !== 'en';
  const dayLabels    = isFr ? DAY_LABELS_FR : DAY_LABELS_EN;
  const ordinalLabels = isFr ? ORDINAL_FR : ORDINAL_EN;

  if (r.freq === 'DAILY') return isFr ? 'Tous les jours' : 'Every day';

  if (r.freq === 'WEEKLY' && r.byday?.length) {
    const days = r.byday.map(b => dayLabels[b.day]).join(', ');
    return isFr ? `Chaque semaine — ${days}` : `Every week — ${days}`;
  }

  if (r.freq === 'MONTHLY' && r.byday?.length) {
    const b   = r.byday[0];
    const ord = ordinalLabels[b.ordinal ?? 1] || ordinalLabels[1];
    const day = dayLabels[b.day];
    return isFr ? `Le ${ord} ${day} de chaque mois` : `The ${ord} ${day} of every month`;
  }

  if (r.freq === 'MONTHLY' && r.bymonthday) {
    return isFr ? `Le ${r.bymonthday} de chaque mois` : `On day ${r.bymonthday} of every month`;
  }

  if (r.freq === 'YEARLY') return isFr ? 'Chaque année' : 'Every year';

  return isFr ? 'Événement récurrent' : 'Recurring event';
}

module.exports = { parseRule, getNextOccurrence, describeRecurrence, nthWeekdayOfMonth, DAY_CODES };
