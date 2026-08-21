export function StatCard({ icon, label, value, tone = 'default' }) {
  return (
    <div className={`stat-card stat-${tone}`}>
      <i className={`bi ${icon}`} />
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
