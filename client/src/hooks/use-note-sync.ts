import { useRef, useState, useCallback, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface NoteUpdateData {
  title?: string;
  content?: any;
  plainText?: string;
  status?: string;
  visibility?: string;
}

export interface SyncState {
  isSyncing: boolean;
  hasPending: boolean;
  lastSynced: Date | null;
  error: Error | null;
  version: number | null;
}

const DEBOUNCE_MS = 400;
const MAX_RETRY_DELAY_MS = 30_000;
const STORAGE_KEY = (id: string) => `note_sync_pending_${id}`;

function extractPlainText(content: any): string {
  if (!content) return '';
  const getText = (node: any): string => {
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) return node.content.map(getText).join(' ');
    return '';
  };
  return getText(content);
}

export function useNoteSync(noteId: string | undefined) {
  const pendingRef = useRef<NoteUpdateData | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);
  const retryCountRef = useRef(0);
  const noteIdRef = useRef(noteId);

  useEffect(() => { noteIdRef.current = noteId; }, [noteId]);

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    hasPending: false,
    lastSynced: null,
    error: null,
    version: null,
  });

  const flush = useCallback(async () => {
    const id = noteIdRef.current;
    if (!id || !pendingRef.current || isFlushingRef.current) return;

    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }

    isFlushingRef.current = true;
    const updateToSend = { ...pendingRef.current };

    if (updateToSend.content && !updateToSend.plainText) {
      updateToSend.plainText = extractPlainText(updateToSend.content);
    }

    setSyncState(prev => ({ ...prev, isSyncing: true }));

    try {
      const res = await apiRequest(`/api/notes/${id}`, 'PATCH', updateToSend);
      const result = await res.json();

      pendingRef.current = null;
      try { localStorage.removeItem(STORAGE_KEY(id)); } catch {}

      retryCountRef.current = 0;
      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        hasPending: false,
        lastSynced: new Date(),
        error: null,
        version: result.updatedAt ? new Date(result.updatedAt).getTime() : prev.version,
      }));
    } catch (err) {
      isFlushingRef.current = false;
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY_MS);
      retryCountRef.current++;

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        error: err instanceof Error ? err : new Error('Sync failed'),
      }));

      retryRef.current = setTimeout(() => flush(), delay);
      return;
    }

    isFlushingRef.current = false;
  }, []);

  const queueUpdate = useCallback((data: NoteUpdateData) => {
    pendingRef.current = { ...(pendingRef.current ?? {}), ...data };

    const id = noteIdRef.current;
    if (id) {
      try { localStorage.setItem(STORAGE_KEY(id), JSON.stringify(pendingRef.current)); } catch {}
    }

    setSyncState(prev => ({ ...prev, hasPending: true, error: null }));

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => flush(), DEBOUNCE_MS);
  }, [flush]);

  const flushImmediate = useCallback(() => {
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    flush();
  }, [flush]);

  useEffect(() => {
    if (!noteId) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY(noteId));
      if (saved) {
        const pending = JSON.parse(saved) as NoteUpdateData;
        pendingRef.current = pending;
        setSyncState(prev => ({ ...prev, hasPending: true }));
        setTimeout(() => flush(), 600);
      }
    } catch {}
  }, [noteId, flush]);

  useEffect(() => {
    const handler = () => {
      const id = noteIdRef.current;
      if (pendingRef.current && id) {
        try { localStorage.setItem(STORAGE_KEY(id), JSON.stringify(pendingRef.current)); } catch {}
        flush();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [flush]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      const id = noteIdRef.current;
      if (pendingRef.current && id) {
        try { localStorage.setItem(STORAGE_KEY(id), JSON.stringify(pendingRef.current)); } catch {}
        flush();
      }
    };
  }, [flush]);

  return { queueUpdate, flushImmediate, syncState };
}
