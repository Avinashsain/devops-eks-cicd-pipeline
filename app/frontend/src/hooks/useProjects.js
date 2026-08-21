import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';

export function useProjects() {
  const [projects, setProjects] = useState([]);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await api.get('/projects');
      setProjects(res);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const createProject = useCallback(async (name) => {
    const project = await api.post('/projects', { name });
    setProjects((prev) => [...prev, project].sort((a, b) => a.name.localeCompare(b.name)));
    return project;
  }, []);

  const deleteProject = useCallback(async (id) => {
    await api.del(`/projects/${id}`);
    setProjects((prev) => prev.filter((p) => p._id !== id));
  }, []);

  return { projects, error, createProject, deleteProject, reload: load };
}
