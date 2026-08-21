import { useCallback, useState } from 'react';
import { ConfirmDialog } from '../components/ConfirmDialog';

export function useConfirm() {
  const [state, setState] = useState(null);

  const confirm = useCallback((message, { confirmLabel, danger = true } = {}) => {
    return new Promise((resolve) => {
      setState({ message, confirmLabel, danger, resolve });
    });
  }, []);

  if (!state) {
    return { confirm, dialog: null };
  }

  const dialog = (
    <ConfirmDialog
      message={state.message}
      confirmLabel={state.confirmLabel}
      danger={state.danger}
      onConfirm={() => {
        state.resolve(true);
        setState(null);
      }}
      onCancel={() => {
        state.resolve(false);
        setState(null);
      }}
    />
  );

  return { confirm, dialog };
}
