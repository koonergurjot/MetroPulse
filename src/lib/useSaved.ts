import { useCallback, useEffect, useState } from 'react';
import { loadJson, saveJson } from './storage';

export interface SavedEntry {
  savedAt: number;
  note: string;
}

const KEY = 'mp.saved.v1';

/** Saved homes and private notes. Stays in this browser; nothing is sent to a server. */
export function useSaved() {
  const [items, setItems] = useState<Record<string, SavedEntry>>(() => loadJson(KEY, {}));
  useEffect(() => saveJson(KEY, items), [items]);

  const toggle = useCallback((id: string) => {
    setItems((cur) => {
      if (cur[id]) {
        const { [id]: _removed, ...rest } = cur;
        return rest;
      }
      return { ...cur, [id]: { savedAt: Date.now(), note: '' } };
    });
  }, []);
  const setNote = useCallback((id: string, note: string) => {
    setItems((cur) => (cur[id] ? { ...cur, [id]: { ...cur[id], note: note.slice(0, 500) } } : cur));
  }, []);
  return { items, ids: Object.keys(items).sort((a, b) => items[b].savedAt - items[a].savedAt), toggle, setNote };
}
