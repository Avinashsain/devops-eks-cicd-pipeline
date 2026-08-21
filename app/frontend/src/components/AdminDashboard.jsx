import { useEffect, useState } from 'react';
import { api } from '../api';
import { StatCard } from './StatCard';

export function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/admin/stats')
      .then((res) => {
        if (!cancelled) setStats(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="card">
        <p className="muted">Loading dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p className="error">{error}</p>
      </div>
    );
  }

  const { users, todos, projects, topUsers } = stats;

  return (
    <>
      <div className="card">
        <h2>
          <i className="bi bi-speedometer2" /> Overview
        </h2>
        <div className="stats-grid">
          <StatCard icon="bi-people-fill" label="Total users" value={users.total} />
          <StatCard icon="bi-check-circle-fill" label="Active" value={users.active} tone="green" />
          <StatCard icon="bi-x-circle-fill" label="Deactivated" value={users.inactive} tone="red" />
          <StatCard icon="bi-shield-fill-check" label="Admins" value={users.admins} tone="blue" />
          <StatCard icon="bi-person-fill" label="Regular users" value={users.regular} />
        </div>
        <div className="stats-grid">
          <StatCard icon="bi-card-checklist" label="Total todos" value={todos.total} />
          <StatCard icon="bi-check2-square" label="Completed" value={todos.done} tone="green" />
          <StatCard icon="bi-hourglass-split" label="Pending" value={todos.pending} tone="amber" />
          <StatCard icon="bi-exclamation-triangle-fill" label="Overdue" value={todos.overdue} tone="red" />
          <StatCard icon="bi-kanban-fill" label="Projects" value={projects.total} tone="blue" />
        </div>
        <div className="stats-grid">
          <StatCard
            icon="bi-flag-fill"
            label="Critical priority"
            value={todos.byPriority.critical}
            tone="red"
          />
          <StatCard icon="bi-flag-fill" label="High priority" value={todos.byPriority.high} tone="amber" />
          <StatCard icon="bi-flag-fill" label="Medium priority" value={todos.byPriority.medium} tone="blue" />
          <StatCard icon="bi-flag-fill" label="Low priority" value={todos.byPriority.low} />
        </div>
      </div>

      <div className="card">
        <h2>
          <i className="bi bi-trophy-fill" /> Most Active Users
        </h2>
        {topUsers.length === 0 ? (
          <p className="muted">No todos created yet.</p>
        ) : (
          <ol className="leaderboard">
            {topUsers.map((u, i) => (
              <li key={u.id}>
                <span className="rank">#{i + 1}</span>
                <span className="user-name">{u.fullName}</span>
                <span className="muted">{u.email}</span>
                <span className="badge badge-admin">{u.todoCount} todos</span>
                <span className="badge badge-active">{u.doneCount} done</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
