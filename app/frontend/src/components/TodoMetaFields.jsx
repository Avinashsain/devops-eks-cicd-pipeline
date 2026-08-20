const PRIORITIES = ['critical', 'high', 'medium', 'low'];

export function TodoMetaFields({
  priority,
  onPriority,
  recurrence,
  onRecurrence,
  projectId,
  onProjectId,
  dueDate,
  onDueDate,
  projects,
  disabled,
}) {
  return (
    <div className="todo-meta-form">
      <select value={priority} onChange={(e) => onPriority(e.target.value)} disabled={disabled}>
        {PRIORITIES.map((p) => (
          <option key={p} value={p}>
            {p[0].toUpperCase() + p.slice(1)} priority
          </option>
        ))}
      </select>
      <select value={recurrence} onChange={(e) => onRecurrence(e.target.value)} disabled={disabled}>
        <option value="none">Does not repeat</option>
        <option value="daily">Repeats daily</option>
        <option value="weekly">Repeats weekly</option>
        <option value="monthly">Repeats monthly</option>
      </select>
      <select value={projectId} onChange={(e) => onProjectId(e.target.value)} disabled={disabled}>
        <option value="">No project</option>
        {projects.map((p) => (
          <option key={p._id} value={p._id}>
            {p.name}
          </option>
        ))}
      </select>
      <input
        type="datetime-local"
        value={dueDate}
        onChange={(e) => onDueDate(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}
