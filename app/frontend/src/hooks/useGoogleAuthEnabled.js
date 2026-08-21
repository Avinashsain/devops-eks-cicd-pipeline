import { useEffect, useState } from 'react';
import { api } from '../api';

export function useGoogleAuthEnabled() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get('/auth/providers')
      .then((res) => {
        if (!cancelled) setEnabled(!!res.google);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return enabled;
}
