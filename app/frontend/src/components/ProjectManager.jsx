import { useState } from 'react';

export function ProjectManager({ projects, onCreate, onDelete, confirm }) {
  const [name, setName] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setAdding(true);
    setError('');
    try {
      await onCreate(name);
      setName('');
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (project) => {
    const ok = await confirm(
      `Delete project "${project.name}"? Its todos will be unassigned, not deleted.`,
      { confirmLabel: 'Delete' }
    );
    if (!ok) return;
    try {
      await onDelete(project._id);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="project-manager">
      {error && <p className="error">{error}</p>}
      <form className="inline-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="New project…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={adding}
        />
        <button type="submit" disabled={adding}>
          <i className={`bi ${adding ? 'bi-arrow-repeat spin' : 'bi-plus-lg'}`} /> Add project
        </button>
      </form>
      {projects.length > 0 && (
        <div className="project-chips">
          {projects.map((p) => (
            <span key={p._id} className="badge project-chip">
              {p.name}
              <button
                type="button"
                className="chip-remove"
                onClick={() => handleDelete(p)}
                aria-label={`Delete project ${p.name}`}
              >
                <i className="bi bi-x" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
