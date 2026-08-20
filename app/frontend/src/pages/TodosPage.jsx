import { useEffect, useState } from 'react';
import { api } from '../api';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { useProjects } from '../hooks/useProjects';
import { Pagination } from '../components/Pagination';
import { DateRangeFilter } from '../components/DateRangeFilter';
import { ProjectManager } from '../components/ProjectManager';
import { TodoMetaFields } from '../components/TodoMetaFields';
import { TodoRow } from '../components/TodoRow';
import { TodoEditRow } from '../components/TodoEditRow';
import { useConfirm } from '../hooks/useConfirm';

const PAGE_SIZE = 10;
const PRIORITIES = ['critical', 'high', 'medium', 'low'];

function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes()
  )}`;
}

export function TodosPage() {
  const [todos, setTodos] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [projectFilter, setProjectFilter] = useState('');

  const [title, setTitle] = useState('');
  const [tagsInput, setTagsInput] = useState('');
  const [priority, setPriority] = useState('medium');
  const [recurrence, setRecurrence] = useState('none');
  const [projectId, setProjectId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [adding, setAdding] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editTagsInput, setEditTagsInput] = useState('');
  const [editPriority, setEditPriority] = useState('medium');
  const [editRecurrence, setEditRecurrence] = useState('none');
  const [editProjectId, setEditProjectId] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const { confirm, dialog } = useConfirm();
  const { projects, createProject, deleteProject } = useProjects();

  const load = async (targetPage, searchTerm) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: targetPage, limit: PAGE_SIZE });
      if (searchTerm) params.set('search', searchTerm);
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);
      if (priorityFilter) params.set('priority', priorityFilter);
      if (projectFilter) params.set('projectId', projectFilter);
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
  }, [debouncedSearch, dateFrom, dateTo, priorityFilter, projectFilter]);

  useEffect(() => {
    load(page, debouncedSearch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch, dateFrom, dateTo, priorityFilter, projectFilter]);

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
      const body = { title, tags, priority, recurrence };
      if (projectId) body.projectId = projectId;
      if (dueDate) body.dueDate = new Date(dueDate).toISOString();
      await api.post('/todos', body);
      setTitle('');
      setTagsInput('');
      setPriority('medium');
      setRecurrence('none');
      setProjectId('');
      setDueDate('');
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
      await api.patch(`/todos/${todo._id}`, { done });
      await load(page, debouncedSearch);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending((prev) => ({ ...prev, [todo._id]: null }));
    }
  };

  const handleTogglePin = async (todo) => {
    setPending((prev) => ({ ...prev, [todo._id]: 'pin' }));
    try {
      await api.patch(`/todos/${todo._id}`, { pinned: !todo.pinned });
      await load(page, debouncedSearch);
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
    setEditPriority(todo.priority || 'medium');
    setEditRecurrence(todo.recurrence || 'none');
    setEditProjectId(todo.projectId || '');
    setEditDueDate(toDatetimeLocalValue(todo.dueDate));
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
      const updated = await api.patch(`/todos/${todo._id}`, {
        title: editTitle,
        tags,
        priority: editPriority,
        recurrence: editRecurrence,
        projectId: editProjectId || null,
        dueDate: editDueDate ? new Date(editDueDate).toISOString() : null,
      });
      setTodos((prev) => prev.map((t) => (t._id === todo._id ? updated : t)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPending((prev) => ({ ...prev, [todo._id]: null }));
    }
  };

  const projectName = (id) => projects.find((p) => p._id === id)?.name;

  const emptyMessage =
    total === 0 && !debouncedSearch && !dateFrom && !dateTo && !priorityFilter && !projectFilter
      ? 'No todos yet — add one above.'
      : 'No matches.';

  let listContent;
  if (loading) {
    listContent = <p className="muted">Loading…</p>;
  } else if (todos.length === 0) {
    listContent = <p className="muted">{emptyMessage}</p>;
  } else {
    listContent = (
      <ul className="todo-list">
        {todos.map((todo) =>
          editingId === todo._id ? (
            <TodoEditRow
              key={todo._id}
              todo={todo}
              busy={pending[todo._id]}
              editTitle={editTitle}
              setEditTitle={setEditTitle}
              editTagsInput={editTagsInput}
              setEditTagsInput={setEditTagsInput}
              editPriority={editPriority}
              setEditPriority={setEditPriority}
              editRecurrence={editRecurrence}
              setEditRecurrence={setEditRecurrence}
              editProjectId={editProjectId}
              setEditProjectId={setEditProjectId}
              editDueDate={editDueDate}
              setEditDueDate={setEditDueDate}
              projects={projects}
              onSave={handleSaveEdit}
              onCancel={cancelEdit}
            />
          ) : (
            <TodoRow
              key={todo._id}
              todo={todo}
              busy={pending[todo._id]}
              projectName={projectName}
              onToggleDone={handleToggleDone}
              onTogglePin={handleTogglePin}
              onEdit={startEdit}
              onDelete={handleDelete}
            />
          )
        )}
      </ul>
    );
  }

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
          <TodoMetaFields
            priority={priority}
            onPriority={setPriority}
            recurrence={recurrence}
            onRecurrence={setRecurrence}
            projectId={projectId}
            onProjectId={setProjectId}
            dueDate={dueDate}
            onDueDate={setDueDate}
            projects={projects}
            disabled={adding}
          />
        </form>

        <ProjectManager
          projects={projects}
          onCreate={createProject}
          onDelete={deleteProject}
          confirm={confirm}
        />

        <input
          type="search"
          className="search-input"
          placeholder="Search your todos…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="todo-meta-form">
          <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p[0].toUpperCase() + p.slice(1)}
              </option>
            ))}
          </select>
          <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p._id} value={p._id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <DateRangeFilter
          from={dateFrom}
          to={dateTo}
          onFromChange={setDateFrom}
          onToChange={setDateTo}
        />

        {listContent}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </div>
      {dialog}
    </div>
  );
}
