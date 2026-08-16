import { useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Pagination } from '../components/Pagination';
import { UserRow } from '../components/UserRow';
import { AdminDashboard } from '../components/AdminDashboard';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { formatDate } from '../utils/formatDate';
import { useConfirm } from '../hooks/useConfirm';

const PAGE_SIZE = 10;

export function AdminPage() {
  const { user: currentUser } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { confirm, dialog } = useConfirm();
  const [pendingUser, setPendingUser] = useState({});
  const [pendingTodo, setPendingTodo] = useState({});

  const [users, setUsers] = useState([]);
  const [userTotal, setUserTotal] = useState(0);
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const debouncedUserSearch = useDebouncedValue(userSearch);
  const [userDateFrom, setUserDateFrom] = useState('');
  const [userDateTo, setUserDateTo] = useState('');

  const [todos, setTodos] = useState([]);
  const [todoTotal, setTodoTotal] = useState(0);
  const [todoPage, setTodoPage] = useState(1);
  const [todoTotalPages, setTodoTotalPages] = useState(1);
  const [todoSearch, setTodoSearch] = useState('');
  const debouncedTodoSearch = useDebouncedValue(todoSearch);
  const [todoDateFrom, setTodoDateFrom] = useState('');
  const [todoDateTo, setTodoDateTo] = useState('');

  const loadUsers = async (targetPage, searchTerm) => {
    const params = new URLSearchParams({ page: targetPage, limit: PAGE_SIZE });
    if (searchTerm) params.set('search', searchTerm);
    if (userDateFrom) params.set('dateFrom', userDateFrom);
    if (userDateTo) params.set('dateTo', userDateTo);
    const res = await api.get(`/admin/users?${params.toString()}`);
    setUsers(res.items);
    setUserTotal(res.total);
    setUserTotalPages(res.totalPages);
  };

  const loadTodos = async (targetPage, searchTerm) => {
    const params = new URLSearchParams({ page: targetPage, limit: PAGE_SIZE });
    if (searchTerm) params.set('search', searchTerm);
    if (todoDateFrom) params.set('dateFrom', todoDateFrom);
    if (todoDateTo) params.set('dateTo', todoDateTo);
    const res = await api.get(`/admin/todos?${params.toString()}`);
    setTodos(res.items);
    setTodoTotal(res.total);
    setTodoTotalPages(res.totalPages);
  };

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch, userDateFrom, userDateTo]);

  useEffect(() => {
    setTodoPage(1);
  }, [debouncedTodoSearch, todoDateFrom, todoDateTo]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadUsers(1, ''), loadTodos(1, '')])
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUsers(userPage, debouncedUserSearch).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userPage, debouncedUserSearch, userDateFrom, userDateTo]);

  useEffect(() => {
    loadTodos(todoPage, debouncedTodoSearch).catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todoPage, debouncedTodoSearch, todoDateFrom, todoDateTo]);

  const toggleRole = async (u) => {
    const makeAdmin = u.role !== 'admin';
    const label = makeAdmin ? 'Make admin' : 'Make user';
    const ok = await confirm(`${label} — apply to ${u.fullName}?`, {
      confirmLabel: label,
      danger: false,
    });
    if (!ok) return;
    setError('');
    setPendingUser((prev) => ({ ...prev, [u.id]: 'role' }));
    try {
      const updated = await api.patch(`/admin/users/${u.id}`, {
        role: makeAdmin ? 'admin' : 'user',
      });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingUser((prev) => ({ ...prev, [u.id]: null }));
    }
  };

  const toggleActive = async (u) => {
    const label = u.active ? 'Deactivate' : 'Activate';
    const ok = await confirm(`${label} ${u.fullName}?`, {
      confirmLabel: label,
      danger: u.active,
    });
    if (!ok) return;
    setError('');
    setPendingUser((prev) => ({ ...prev, [u.id]: 'active' }));
    try {
      const updated = await api.patch(`/admin/users/${u.id}`, { active: !u.active });
      setUsers((prev) => prev.map((x) => (x.id === u.id ? updated : x)));
    } catch (err) {
      setError(err.message);
    } finally {
      setPendingUser((prev) => ({ ...prev, [u.id]: null }));
    }
  };

  const deleteUser = async (u) => {
    const ok = await confirm(`Delete ${u.fullName}? This also deletes all their todos.`, {
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setError('');
    setPendingUser((prev) => ({ ...prev, [u.id]: 'delete' }));
    try {
      await api.del(`/admin/users/${u.id}`);
      await Promise.all([loadUsers(userPage, debouncedUserSearch), loadTodos(todoPage, debouncedTodoSearch)]);
    } catch (err) {
      setError(err.message);
      setPendingUser((prev) => ({ ...prev, [u.id]: null }));
    }
  };

  const deleteTodo = async (t) => {
    const ok = await confirm(`Delete "${t.title}"? This cannot be undone.`, {
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setError('');
    setPendingTodo((prev) => ({ ...prev, [t._id]: 'delete' }));
    try {
      await api.del(`/admin/todos/${t._id}`);
      await loadTodos(todoPage, debouncedTodoSearch);
    } catch (err) {
      setError(err.message);
      setPendingTodo((prev) => ({ ...prev, [t._id]: null }));
    }
  };

  if (loading) return <div className="page-center">Loading…</div>;

  const usersEmptyMessage =
    userTotal === 0 && !debouncedUserSearch && !userDateFrom && !userDateTo
      ? 'No users yet.'
      : 'No matching users.';
  const todosEmptyMessage =
    todoTotal === 0 && !debouncedTodoSearch && !todoDateFrom && !todoDateTo
      ? 'No todos across any account.'
      : 'No matching todos.';

  return (
    <div className="page">
      {error && <p className="error">{error}</p>}

      <div className="tabs">
        <button
          type="button"
          className={`tab${activeTab === 'dashboard' ? ' active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          type="button"
          className={`tab${activeTab === 'users' ? ' active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          Users
        </button>
        <button
          type="button"
          className={`tab${activeTab === 'todos' ? ' active' : ''}`}
          onClick={() => setActiveTab('todos')}
        >
          All Todos
        </button>
      </div>

      {activeTab === 'dashboard' && <AdminDashboard />}

      {activeTab === 'users' && (
        <div className="card">
          <h2>
            <i className="bi bi-people-fill" /> Users
            {userTotal > 0 && <span className="count-badge">{userTotal}</span>}
          </h2>
          <input
            type="search"
            className="search-input"
            placeholder="Search by name or email…"
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
          />

          <DateRangeFilter
            from={userDateFrom}
            to={userDateTo}
            onFromChange={setUserDateFrom}
            onToChange={setUserDateTo}
          />

          {users.length === 0 ? (
            <p className="muted">{usersEmptyMessage}</p>
          ) : (
            <ul className="user-list">
              {users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === currentUser.id}
                  busy={pendingUser[u.id]}
                  onToggleRole={toggleRole}
                  onToggleActive={toggleActive}
                  onDelete={deleteUser}
                />
              ))}
            </ul>
          )}
          <Pagination page={userPage} totalPages={userTotalPages} onChange={setUserPage} />
        </div>
      )}

      {activeTab === 'todos' && (
        <div className="card">
          <h2>
            <i className="bi bi-card-checklist" /> All Todos
            {todoTotal > 0 && <span className="count-badge">{todoTotal}</span>}
          </h2>
          <input
            type="search"
            className="search-input"
            placeholder="Search by title, tag, or name…"
            value={todoSearch}
            onChange={(e) => setTodoSearch(e.target.value)}
          />

          <DateRangeFilter
            from={todoDateFrom}
            to={todoDateTo}
            onFromChange={setTodoDateFrom}
            onToChange={setTodoDateTo}
          />

          {todos.length === 0 ? (
            <p className="muted">{todosEmptyMessage}</p>
          ) : (
            <ul className="todo-list">
              {todos.map((t) => {
                const busy = pendingTodo[t._id];
                return (
                  <li key={t._id} className={t.done ? 'done' : ''}>
                    <span>
                      <i
                        className={`bi status-icon ${
                          t.done ? 'bi-check-circle-fill done' : 'bi-circle pending'
                        }`}
                      />{' '}
                      {t.title}{' '}
                      <span className="muted">
                        — {t.user?.fullName ?? 'unknown user'} — {formatDate(t.createdAt)}
                      </span>
                      {t.tags?.length > 0 && (
                        <span className="tag-list">
                          {t.tags.map((tag) => (
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
                        className="danger"
                        onClick={() => deleteTodo(t)}
                        disabled={!!busy}
                      >
                        <i className={`bi ${busy === 'delete' ? 'bi-arrow-repeat spin' : 'bi-trash'}`} />{' '}
                        Delete
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <Pagination page={todoPage} totalPages={todoTotalPages} onChange={setTodoPage} />
        </div>
      )}
      {dialog}
    </div>
  );
}
