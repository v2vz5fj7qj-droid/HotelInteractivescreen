// Badge de statut workflow
// Usage : <WorkflowBadge status="pending" />
const LABELS = {
  pending:      { label: 'En attente',    color: '#F59E0B' },
  pre_approved: { label: 'Pré-validé',    color: '#3B82F6' },
  published:    { label: 'Publié',        color: '#10B981' },
  rejected:     { label: 'Rejeté',        color: '#EF4444' },
  archived:     { label: 'Archivé',       color: '#6B7280' },
};

export default function WorkflowBadge({ status }) {
  const cfg = LABELS[status] || { label: status, color: '#6B7280' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '999px',
      fontSize: '0.75rem',
      fontWeight: 600,
      background: cfg.color + '22',
      color: cfg.color,
      border: `1px solid ${cfg.color}55`,
    }}>
      {cfg.label}
    </span>
  );
}
