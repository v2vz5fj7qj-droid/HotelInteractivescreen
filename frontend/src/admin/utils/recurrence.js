// Construction / lecture des règles de récurrence (sous-ensemble RRULE), utilisées
// par les formulaires Agenda hôtel et super-admin. Doit rester cohérent avec le
// parseur backend (backend/src/utils/recurrence.js).

export const WEEKDAYS = [
  { code: 'MO', label: 'Lundi' },
  { code: 'TU', label: 'Mardi' },
  { code: 'WE', label: 'Mercredi' },
  { code: 'TH', label: 'Jeudi' },
  { code: 'FR', label: 'Vendredi' },
  { code: 'SA', label: 'Samedi' },
  { code: 'SU', label: 'Dimanche' },
];

export const ORDINALS = [
  { value: 1,  label: '1er' },
  { value: 2,  label: '2e' },
  { value: 3,  label: '3e' },
  { value: 4,  label: '4e' },
  { value: -1, label: 'Dernier' },
];

export const EMPTY_RECURRENCE = { freq: 'weekly', byday: ['MO'], ordinal: 1, monthday: 1, month: 1 };

export function buildRecurrenceRule(rec) {
  if (!rec) return null;
  switch (rec.freq) {
    case 'daily':            return 'FREQ=DAILY';
    case 'weekly':           return rec.byday?.length ? `FREQ=WEEKLY;BYDAY=${rec.byday.join(',')}` : null;
    case 'monthly_weekday':  return `FREQ=MONTHLY;BYDAY=${rec.ordinal}${rec.byday?.[0] || 'MO'}`;
    case 'monthly_day':      return `FREQ=MONTHLY;BYMONTHDAY=${rec.monthday}`;
    case 'yearly':           return `FREQ=YEARLY;BYMONTH=${rec.month};BYMONTHDAY=${rec.monthday}`;
    default:                 return null;
  }
}

export function parseRecurrenceRule(rule) {
  if (!rule) return EMPTY_RECURRENCE;
  const parts = Object.fromEntries(rule.split(';').map(p => p.split('=')));
  if (parts.FREQ === 'DAILY') return { ...EMPTY_RECURRENCE, freq: 'daily' };
  if (parts.FREQ === 'WEEKLY') {
    return { ...EMPTY_RECURRENCE, freq: 'weekly', byday: (parts.BYDAY || '').split(',').filter(Boolean) };
  }
  if (parts.FREQ === 'MONTHLY' && parts.BYDAY) {
    const m = parts.BYDAY.match(/^(-?\d)([A-Z]{2})$/);
    return { ...EMPTY_RECURRENCE, freq: 'monthly_weekday', ordinal: m ? parseInt(m[1], 10) : 1, byday: m ? [m[2]] : ['MO'] };
  }
  if (parts.FREQ === 'MONTHLY' && parts.BYMONTHDAY) {
    return { ...EMPTY_RECURRENCE, freq: 'monthly_day', monthday: parseInt(parts.BYMONTHDAY, 10) };
  }
  if (parts.FREQ === 'YEARLY') {
    return { ...EMPTY_RECURRENCE, freq: 'yearly', month: parseInt(parts.BYMONTH, 10) || 1, monthday: parseInt(parts.BYMONTHDAY, 10) || 1 };
  }
  return EMPTY_RECURRENCE;
}

export function describeRecurrenceRule(rule) {
  const rec = parseRecurrenceRule(rule);
  const dayLabel = code => WEEKDAYS.find(d => d.code === code)?.label.toLowerCase() || code;
  const ordLabel = v => ORDINALS.find(o => o.value === v)?.label || `${v}e`;
  switch (rec.freq) {
    case 'daily':           return 'Tous les jours';
    case 'weekly':          return `Chaque semaine — ${(rec.byday || []).map(dayLabel).join(', ')}`;
    case 'monthly_weekday': return `Le ${ordLabel(rec.ordinal)} ${dayLabel(rec.byday[0])} de chaque mois`;
    case 'monthly_day':     return `Le ${rec.monthday} de chaque mois`;
    case 'yearly':          return `Chaque année, le ${rec.monthday}/${rec.month}`;
    default:                return '';
  }
}
