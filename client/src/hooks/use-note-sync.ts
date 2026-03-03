import { useRef, useState, useCallback, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';
import { supabase } from '@/lib/supabase';

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
  serverUpdatedAt: string | null;
}

type FlushTrigger =
  | 'debounce'
  | 'blur'
  | 'manual'
  | 'unmount'
  | 'beforeunload'
  | 'route-change'
  | 'recovery';

const DEBOUNCE_MS = 800;
const MIN_INTERVAL_MS = 3000;
const MAX_RETRY_DELAY_MS = 30_000;
const STORAGE_KEY = (id: string) => `note_sync_pending_${id}`;

function log(trigger: FlushTrigger | string, msg: string, extra?: object) {
  console.debug(
    `[NoteSync][${trigger}] ${msg}`,
    { ts: new Date().toISOString(), ...extra }
  );
}

function extractPlainText(content: any): string {
  if (!content) return '';
  const getText = (node: any): string => {
    if (node.type === 'text') return node.text || '';
    if (node.content && Array.isArray(node.content)) return node.content.map(getText).join(' ');
    return '';
  };
  return getText(content);
}

function persistToStorage(id: string, data: NoteUpdateData) {
  try { localStorage.setItem(STORAGE_KEY(id), JSON.stringify(data)); } catch {}
}

function clearStorage(id: string) {
  try { localStorage.removeItem(STORAGE_KEY(id)); } catch {}
}

export function useNoteSync(noteId: string | undefined) {
  const pendingRef = useRef<NoteUpdateData | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFlushingRef = useRef(false);
  const retryCountRef = useRef(0);
  const noteIdRef = useRef(noteId);
  const lastFlushAtRef = useRef<number>(0);
  const cachedTokenRef = useRef<string | null>(null);

  useEffect(() => { noteIdRef.current = noteId; }, [noteId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      cachedTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      cachedTokenRef.current = session?.access_token ?? null;
    });
    return () => subscription.unsubscribe();
  }, []);

  const [syncState, setSyncState] = useState<SyncState>({
    isSyncing: false,
    hasPending: false,
    lastSynced: null,
    error: null,
    serverUpdatedAt: null,
  });

  const flush = useCallback(async (trigger: FlushTrigger = 'debounce') => {
    const id = noteIdRef.current;
    if (!id || !pendingRef.current) {
      log(trigger, 'flush skipped — no id or no pending data');
      return;
    }
    if (isFlushingRef.current) {
      log(trigger, 'flush skipped — already in-flight, data safe in localStorage');
      if (id && pendingRef.current) persistToStorage(id, pendingRef.current);
      return;
    }

    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    if (retryRef.current) { clearTimeout(retryRef.current); retryRef.current = null; }

    const updateToSend = { ...pendingRef.current };
    if (updateToSend.content && !updateToSend.plainText) {
      updateToSend.plainText = extractPlainText(updateToSend.content);
    }

    log(trigger, 'flush start', {
      queueKeys: Object.keys(updateToSend),
      retryCount: retryCountRef.current,
      msSinceLast: Date.now() - lastFlushAtRef.current,
    });

    isFlushingRef.current = true;
    lastFlushAtRef.current = Date.now();
    setSyncState(prev => ({ ...prev, isSyncing: true }));

    try {
      const res = await apiRequest(
        `/api/notes/${id}?source=autosave`,
        'PATCH',
        updateToSend
      );

      const result = await res.json();

      log(trigger, 'flush success', {
        serverUpdatedAt: result.updatedAt,
        noteId: result.id,
      });

      pendingRef.current = null;
      clearStorage(id);
      retryCountRef.current = 0;

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        hasPending: false,
        lastSynced: new Date(),
        error: null,
        serverUpdatedAt: result.updatedAt ?? prev.serverUpdatedAt,
      }));
    } catch (err) {
      const delay = Math.min(1000 * Math.pow(2, retryCountRef.current), MAX_RETRY_DELAY_MS);
      retryCountRef.current++;

      log(trigger, `flush error — retry in ${delay}ms`, {
        error: err instanceof Error ? err.message : String(err),
        retryCount: retryCountRef.current,
      });

      if (id && pendingRef.current) persistToStorage(id, pendingRef.current);

      setSyncState(prev => ({
        ...prev,
        isSyncing: false,
        error: err instanceof Error ? err : new Error('Sync failed'),
      }));

      retryRef.current = setTimeout(() => flush('debounce'), delay);
    } finally {
      isFlushingRef.current = false;
    }
  }, []);

  const queueUpdate = useCallback((data: NoteUpdateData) => {
    const merged = { ...(pendingRef.current ?? {}), ...data };
    pendingRef.current = merged;

    const id = noteIdRef.current;
    if (id) persistToStorage(id, merged);

    setSyncState(prev => ({ ...prev, hasPending: true, error: null }));

    if (debounceRef.current) clearTimeout(debounceRef.current);

    const timeSinceLast = Date.now() - lastFlushAtRef.current;
    const delay = timeSinceLast >= MIN_INTERVAL_MS
      ? DEBOUNCE_MS
      : Math.max(DEBOUNCE_MS, MIN_INTERVAL_MS - timeSinceLast);

    log('debounce', 'queueUpdate', {
      keys: Object.keys(data),
      scheduledInMs: delay,
      timeSinceLast,
    });

    debounceRef.current = setTimeout(() => flush('debounce'), delay);
  }, [flush]);

  const flushImmediate = useCallback((trigger: FlushTrigger = 'blur') => {
    if (!pendingRef.current) return;
    if (debounceRef.current) { clearTimeout(debounceRef.current); debounceRef.current = null; }
    flush(trigger);
  }, [flush]);

  const keepAliveFlush = useCallback(() => {
    const id = noteIdRef.current;
    const pending = pendingRef.current;
    if (!id || !pending) return;

    if (pending.content && !pending.plainText) {
      pending.plainText = extractPlainText(pending.content);
    }

    persistToStorage(id, pending);

    const token = cachedTokenRef.current;
    if (!token) {
      log('beforeunload', 'no cached token — data persisted to localStorage for recovery');
      return;
    }

    const url = `/api/notes/${id}?source=autosave`;
    log('beforeunload', 'firing keepalive fetch', { noteId: id, queueKeys: Object.keys(pending) });

    fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(pending),
      keepalive: true,
    }).then(() => {
      clearStorage(id);
    }).catch(() => {
    });
  }, []);

  useEffect(() => {
    if (!noteId) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY(noteId));
      if (saved) {
        const pending = JSON.parse(saved) as NoteUpdateData;
        pendingRef.current = pending;
        setSyncState(prev => ({ ...prev, hasPending: true }));
        log('recovery', 'found unsynced data in localStorage, scheduling flush', {
          noteId,
          keys: Object.keys(pending),
        });
        setTimeout(() => flush('recovery'), 800);
      }
    } catch {}
  }, [noteId, flush]);

  useEffect(() => {
    window.addEventListener('beforeunload', keepAliveFlush);
    return () => window.removeEventListener('beforeunload', keepAliveFlush);
  }, [keepAliveFlush]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      const id = noteIdRef.current;
      const pending = pendingRef.current;
      if (pending && id) {
        persistToStorage(id, pending);
        log('unmount', 'component unmounting with pending data, flushing', {
          noteId: id,
          keys: Object.keys(pending),
        });
        flush('unmount');
      }
    };
  }, [flush]);

  return { queueUpdate, flushImmediate, syncState };
}
