import { TodoMetaFields } from './TodoMetaFields';

export function TodoEditRow({
  todo,
  busy,
  editTitle,
  setEditTitle,
  editTagsInput,
  setEditTagsInput,
  editPriority,
  setEditPriority,
  editRecurrence,
  setEditRecurrence,
  editProjectId,
  setEditProjectId,
  editDueDate,
  setEditDueDate,
  projects,
  onSave,
  onCancel,
}) {
  const saving = busy === 'edit';

  return (
    <li className="editing">
      <form className="todo-edit-form" onSubmit={(e) => onSave(e, todo)}>
        <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} autoFocus />
        <input
          type="text"
          className="tags-input"
          placeholder="Tags (comma separated, optional)"
          value={editTagsInput}
          onChange={(e) => setEditTagsInput(e.target.value)}
        />
        <TodoMetaFields
          priority={editPriority}
          onPriority={setEditPriority}
          recurrence={editRecurrence}
          onRecurrence={setEditRecurrence}
          projectId={editProjectId}
          onProjectId={setEditProjectId}
          dueDate={editDueDate}
          onDueDate={setEditDueDate}
          projects={projects}
          disabled={saving}
        />
        <span className="actions">
          <button type="submit" disabled={saving}>
            <i className={`bi ${saving ? 'bi-arrow-repeat spin' : 'bi-check-lg'}`} /> Save
          </button>
          <button type="button" onClick={onCancel} disabled={saving}>
            <i className="bi bi-x-lg" /> Cancel
          </button>
        </span>
      </form>
    </li>
  );
}
