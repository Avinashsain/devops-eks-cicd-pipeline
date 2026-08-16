function roleIconFor(user, busy) {
  if (busy === 'role') return 'bi-arrow-repeat spin';
  return user.role === 'admin' ? 'bi-person-fill' : 'bi-shield-lock-fill';
}

function activeIconFor(user, busy) {
  if (busy === 'active') return 'bi-arrow-repeat spin';
  return user.active ? 'bi-pause-circle' : 'bi-play-circle';
}

export function UserRow({ user, isSelf, busy, onToggleRole, onToggleActive, onDelete }) {
  const disabled = isSelf || !!busy;

  return (
    <li>
      <div className="user-info">
        <span className="user-name">{user.fullName}</span>
        <span className="muted">{user.email}</span>
        <span className={`badge ${user.role === 'admin' ? 'badge-admin' : ''}`}>
          <i
            className={`bi ${user.role === 'admin' ? 'bi-shield-fill-check' : 'bi-person-fill'}`}
          />{' '}
          {user.role}
        </span>
        <span className={`badge ${user.active ? 'badge-active' : 'badge-inactive'}`}>
          <i className={`bi ${user.active ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`} />{' '}
          {user.active ? 'active' : 'deactivated'}
        </span>
      </div>
      <div className="actions">
        <button type="button" onClick={() => onToggleRole(user)} disabled={disabled}>
          <i className={`bi ${roleIconFor(user, busy)}`} />{' '}
          Make {user.role === 'admin' ? 'user' : 'admin'}
        </button>
        <button type="button" onClick={() => onToggleActive(user)} disabled={disabled}>
          <i className={`bi ${activeIconFor(user, busy)}`} />{' '}
          {user.active ? 'Deactivate' : 'Activate'}
        </button>
        <button
          type="button"
          className="danger"
          onClick={() => onDelete(user)}
          disabled={disabled}
        >
          <i className={`bi ${busy === 'delete' ? 'bi-arrow-repeat spin' : 'bi-trash'}`} />{' '}
          Delete
        </button>
      </div>
    </li>
  );
}
