import { formatDate } from '../utils/formatDate';

function pinIconFor(todo, busy) {
  if (busy === 'pin') return 'bi-arrow-repeat spin';
  return todo.pinned ? 'bi-star-fill' : 'bi-star';
}

export function TodoRow({ todo, busy, projectName, onToggleDone, onTogglePin, onEdit, onDelete }) {
  const overdue = todo.dueDate && !todo.done && new Date(todo.dueDate) < new Date();
  const assignedProject = todo.projectId && projectName(todo.projectId);

  return (
    <li className={todo.done ? 'done' : ''}>
      <span>
        <i
          className={`bi status-icon ${todo.done ? 'bi-check-circle-fill done' : 'bi-circle pending'}`}
        />{' '}
        {todo.title}{' '}
        <span className={`badge priority-badge priority-${todo.priority}`}>{todo.priority}</span>{' '}
        {assignedProject && <span className="badge project-badge">{assignedProject}</span>}{' '}
        {todo.recurrence !== 'none' && (
          <i className="bi bi-arrow-repeat recurrence-icon" title={`Repeats ${todo.recurrence}`} />
        )}
        <span className="muted">— {formatDate(todo.createdAt)}</span>
        {todo.dueDate && (
          <span className={`due-date ${overdue ? 'overdue' : ''}`}>
            <i className="bi bi-calendar-event" /> Due {formatDate(todo.dueDate)}
            {overdue ? ' (overdue)' : ''}
          </span>
        )}
        {todo.tags?.length > 0 && (
          <span className="tag-list">
            {todo.tags.map((tag) => (
              <span key={tag} className="badge tag-badge">
                {tag}
              </span>
            ))}
          </span>
        )}
      </span>
      <span className="actions">
        <button
          type="button"
          className={`pin-toggle ${todo.pinned ? 'pinned' : ''}`}
          onClick={() => onTogglePin(todo)}
          disabled={!!busy}
          aria-label={todo.pinned ? 'Unpin' : 'Pin'}
        >
          <i className={`bi ${pinIconFor(todo, busy)}`} />
        </button>
        {todo.done ? (
          <button type="button" onClick={() => onToggleDone(todo, false)} disabled={!!busy}>
            <i
              className={`bi ${busy === 'undo' ? 'bi-arrow-repeat spin' : 'bi-arrow-counterclockwise'}`}
            />{' '}
            Undo
          </button>
        ) : (
          <button type="button" onClick={() => onToggleDone(todo, true)} disabled={!!busy}>
            <i className={`bi ${busy === 'done' ? 'bi-arrow-repeat spin' : 'bi-check-lg'}`} /> Done
          </button>
        )}
        <button type="button" onClick={() => onEdit(todo)} disabled={!!busy}>
          <i className="bi bi-pencil" /> Edit
        </button>
        <button type="button" className="danger" onClick={() => onDelete(todo)} disabled={!!busy}>
          <i className={`bi ${busy === 'delete' ? 'bi-arrow-repeat spin' : 'bi-trash'}`} /> Delete
        </button>
      </span>
    </li>
  );
}
