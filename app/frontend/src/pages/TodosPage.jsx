import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Pagination } from '../components/Pagination';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { formatDate } from '../utils/formatDate';
import { useConfirm } from '../hooks/useConfirm';

const PAGE_SIZE = 10;

export function TodosPage() {
  const [todos, setTodos] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const { confirm, dialog } = useConfirm();

  const load = async (targetPage, searchTerm) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: targetPage, limit: PAGE_SIZE });
      if (searchTerm) params.set('search', searchTerm);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      const res = await api.get(`/todos?${params.toString()}`);
      setTodos(res.items);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, dateFrom, dateTo]);

  useEffect(() => {
    load(page, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, dateFrom, dateTo]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    setError('');
    setAdding(true);
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);
      await api.post('/todos', { title, tags });
      setTitle('');
      setTagsInput('');
      await load(page, debouncedSearch);
    } catch (err) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleToggleDone = async (todo, done) => {
    if (done) {
      const ok = await confirm(`Mark "${todo.title}" as done?`, {
        confirmLabel: 'Mark done',
        danger: false,
      });
      if (!ok) return;
    }
    setPending((prev) => ({ ...prev, [todo._id]: done ? 'done' : 'undo' }));
    try {
      const updated = await api.patch(`/todos/${todo._id}`, { done });
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? updated : t)));
    } catch (err) {
      setError(err.message);
    } finally {
      setPending((prev) => ({ ...prev, [todo._id]: null }));
    }
  };

  const handleDelete = async (todo) => {
    const ok = await confirm(`Delete "${todo.title}"? This cannot be undone.`, {
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setPending((prev) => ({ ...prev, [todo._id]: 'delete' }));
    try {
      await api.del(`/todos/${todo._id}`);
      await load(page, debouncedSearch);
    } catch (err) {
      setError(err.message);
      setPending((prev) => ({ ...prev, [todo._id]: null }));
    }
  };

  const startEdit = (todo) => {
    setEditingId(todo._id);
    setEditTitle(todo.title);
    setEditTagsInput((todo.tags || []).join(', '));
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSaveEdit = async (e, todo) => {
    e.preventDefault();
    if (!editTitle.trim()) return;
    const tags = editTagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    setPending((prev) => ({ ...prev, [todo._id]: 'edit' }));
    try {
      const updated = await api.patch(`/todos/${todo._id}`, { title: editTitle, tags });
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? updated : t)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending((prev) => ({ ...prev, [todo._id]: null }));
    }
  };

  const emptyMessage =
    total === 0 && !debouncedSearch && !dateFrom && !dateTo
      ? 'No todos yet — add one above.'
      : 'No matches.';

  return (
    <div className="page">
      <div className="card">
        <h1>
          <i className="bi bi-list-check" /> My Todos
          {total > 0 && <span className="count-badge">{total}</span>}
        </h1>
        {error && <p className="error">{error}</p>}
        <form onSubmit={handleAdd}>
          <div className="inline-form">
            <input
              type="text"
              placeholder="Add a todo…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={adding}
            />
            <button type="submit" disabled={adding}>
              <i className={`bi ${adding ? 'bi-arrow-repeat spin' : 'bi-plus-lg'}`} />
              {' '}
              Add
            </button>
          </div>
          <input
            type="text"
            className="tags-input"
            placeholder="Tags (comma separated, optional)"
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            disabled={adding}
          />
        </form>

        <input
          type="search"
          className="search-input"
          placeholder="Search your todos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />

        {loading ? (
          <p className="muted">Loading…</p>
        ) : todos.length === 0 ? (
          <p className="muted">{emptyMessage}</p>
        ) : (
          <ul className="todo-list">
            {todos.map((todo) => {
              const busy = pending[todo._id];

              if (editingId === todo._id) {
                return (
                  <li key={todo._id} className="editing">
                    <form className="todo-edit-form" onSubmit={(e) => handleSaveEdit(e, todo)}>
                      <input
                        type="text"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        autoFocus
                      />
                      <input
                        type="text"
                        className="tags-input"
                        placeholder="Tags (comma separated, optional)"
                        value={editTagsInput}
                        onChange={(e) => setEditTagsInput(e.target.value)}
                      />
                      <span className="actions">
                        <button type="submit" disabled={busy === 'edit'}>
                          <i
                            className={`bi ${busy === 'edit' ? 'bi-arrow-repeat spin' : 'bi-check-lg'}`}
                          />{' '}
                          Save
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={busy === 'edit'}>
                          <i className="bi bi-x-lg" /> Cancel
                        </button>
                      </span>
                    </form>
                  </li>
                );
              }

              return (
                <li key={todo._id} className={todo.done ? 'done' : ''}>
                  <span>
                    <i
                      className={`bi status-icon ${
                        todo.done ? 'bi-check-circle-fill done' : 'bi-circle pending'
                      }`}
                    />{' '}
                    {todo.title} <span className="muted">— {formatDate(todo.createdAt)}</span>
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
                    {todo.done ? (
                      <button
                        type="button"
                        onClick={() => handleToggleDone(todo, false)}
                        disabled={!!busy}
                      >
                        <i
                          className={`bi ${busy === 'undo' ? 'bi-arrow-repeat spin' : 'bi-arrow-counterclockwise'}`}
                        />{' '}
                        Undo
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleToggleDone(todo, true)}
                        disabled={!!busy}
                      >
                        <i
                          className={`bi ${busy === 'done' ? 'bi-arrow-repeat spin' : 'bi-check-lg'}`}
                        />{' '}
                        Done
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEdit(todo)}
                      disabled={!!busy}
                    >
                      <i className="bi bi-pencil" /> Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={() => handleDelete(todo)}
                      disabled={!!busy}
                    >
                      <i
                        className={`bi ${busy === 'delete' ? 'bi-arrow-repeat spin' : 'bi-trash'}`}
                      />{' '}
                      Delete
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
      {dialog}
    </div>
  );
}
