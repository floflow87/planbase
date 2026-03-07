type PatchCommit = (patch: Record<string, any>) => Promise<any>;
type ActionFn = () => Promise<any>;
type RollbackFn = () => void;

export interface QueueState {
  isMutating: boolean;
  isQueued: boolean;
  hasLocalChanges: boolean;
  error: Error | null;
  lastAckAt: number | null;
  pendingCount: number;
  serverRevision: number | null;
  serverUpdatedAt: number | null;
}

interface PendingAction {
  label: string;
  fn: ActionFn;
  rollback?: RollbackFn;
}

class EntityQueue {
  readonly entityKey: string;
  private pendingPatch: Record<string, any> = {};
  private pendingCommitFn: PatchCommit | null = null;
  private patchTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private baseRollback: RollbackFn | null = null;
  private actionQueue: PendingAction[] = [];
  private isRunningAction = false;

  state: QueueState = {
    isMutating: false,
    isQueued: false,
    hasLocalChanges: false,
    error: null,
    lastAckAt: null,
    pendingCount: 0,
    serverRevision: null,
    serverUpdatedAt: null,
  };
  readonly listeners = new Set<() => void>();

  constructor(entityKey: string) {
    this.entityKey = entityKey;
  }

  queuePatch(
    patch: Record<string, any>,
    commitFn: PatchCommit,
    rollbackFn?: RollbackFn,
    debounceMs = 400,
  ) {
    this.pendingPatch = { ...this.pendingPatch, ...patch };
    this.pendingCommitFn = commitFn;

    if (rollbackFn && !this.baseRollback) {
      this.baseRollback = rollbackFn;
    }

    const count = Object.keys(this.pendingPatch).length;
    const isQueued = debounceMs > 0;
    this._emit({ pendingCount: count, hasLocalChanges: true, isQueued });

    console.debug(`[QueueSync] entity=${this.entityKey} queuePatch`, Object.keys(patch), `pending=${count}`);

    if (this.patchTimer) clearTimeout(this.patchTimer);
    if (!this.isFlushing) {
      if (debounceMs === 0) {
        this._flushPatch();
      } else {
        this.patchTimer = setTimeout(() => {
          this._emit({ isQueued: false });
          this._flushPatch();
        }, debounceMs);
      }
    }
  }

  queueAction(label: string, fn: ActionFn, rollback?: RollbackFn) {
    this.actionQueue.push({ label, fn, rollback });
    this._emit({ hasLocalChanges: true, isQueued: this.actionQueue.length > 1 });
    console.debug(`[QueueSync] entity=${this.entityKey} queueAction label="${label}" queued=${this.actionQueue.length}`);
    this._runNextAction();
  }

  hasPendingPatch(): boolean {
    return Object.keys(this.pendingPatch).length > 0;
  }

  setServerRevision(revision: number, updatedAt?: number) {
    this._emit({
      serverRevision: revision,
      serverUpdatedAt: updatedAt ?? Date.now(),
    });
  }

  async forceFlush(): Promise<void> {
    if (this.patchTimer) {
      clearTimeout(this.patchTimer);
      this.patchTimer = null;
    }
    return this._flushPatch();
  }

  private async _flushPatch(): Promise<void> {
    if (this.isFlushing) return;
    if (Object.keys(this.pendingPatch).length === 0 || !this.pendingCommitFn) return;

    const patch = { ...this.pendingPatch };
    const commitFn = this.pendingCommitFn;
    const rollback = this.baseRollback;

    this.pendingPatch = {};
    this.pendingCommitFn = null;
    this.baseRollback = null;
    this.isFlushing = true;

    this._emit({ isMutating: true, pendingCount: 0, isQueued: false, error: null });
    console.debug(`[QueueSync] entity=${this.entityKey} flush →`, Object.keys(patch));

    try {
      const result = await commitFn(patch);
      const rev = result?.revision ?? result?.serverRevision ?? null;
      const updAt = result?.updatedAt ? new Date(result.updatedAt).getTime() : (rev ? Date.now() : null);
      this._emit({
        isMutating: false,
        lastAckAt: Date.now(),
        hasLocalChanges: Object.keys(this.pendingPatch).length > 0 || this.actionQueue.length > 0,
        ...(rev !== null ? { serverRevision: rev, serverUpdatedAt: updAt } : {}),
      });
      console.debug(`[QueueSync] entity=${this.entityKey} ✓ ack${rev !== null ? ` rev=${rev}` : ''}`);
    } catch (e: any) {
      console.error(`[QueueSync] entity=${this.entityKey} ✗ error:`, e.message);
      rollback?.();
      this._emit({ isMutating: false, error: e, hasLocalChanges: false });
    } finally {
      this.isFlushing = false;
      if (Object.keys(this.pendingPatch).length > 0) {
        this._flushPatch();
      }
    }
  }

  private async _runNextAction(): Promise<void> {
    if (this.isRunningAction || this.actionQueue.length === 0) return;
    this.isRunningAction = true;

    const action = this.actionQueue.shift()!;
    this._emit({ isMutating: true, isQueued: this.actionQueue.length > 0, error: null });
    console.debug(`[QueueSync] entity=${this.entityKey} action="${action.label}" start`);

    try {
      const result = await action.fn();
      const rev = result?.revision ?? result?.serverRevision ?? null;
      const updAt = result?.updatedAt ? new Date(result.updatedAt).getTime() : (rev ? Date.now() : null);
      this._emit({
        isMutating: false,
        lastAckAt: Date.now(),
        hasLocalChanges: this.actionQueue.length > 0 || Object.keys(this.pendingPatch).length > 0,
        ...(rev !== null ? { serverRevision: rev, serverUpdatedAt: updAt } : {}),
      });
      console.debug(`[QueueSync] entity=${this.entityKey} action="${action.label}" ✓`);
    } catch (e: any) {
      console.error(`[QueueSync] entity=${this.entityKey} action="${action.label}" ✗`, e.message);
      action.rollback?.();
      this._emit({ isMutating: false, error: e, hasLocalChanges: false });
    } finally {
      this.isRunningAction = false;
      if (this.actionQueue.length > 0) {
        this._runNextAction();
      }
    }
  }

  private _emit(update: Partial<QueueState>) {
    this.state = { ...this.state, ...update };
    this.listeners.forEach(l => l());
  }
}

class MutationQueueManager {
  private readonly queues = new Map<string, EntityQueue>();

  get(entityKey: string): EntityQueue {
    if (!this.queues.has(entityKey)) {
      this.queues.set(entityKey, new EntityQueue(entityKey));
    }
    return this.queues.get(entityKey)!;
  }

  async flush(entityKey: string): Promise<void> {
    const queue = this.queues.get(entityKey);
    if (queue) {
      await queue.forceFlush();
    }
  }

  async flushAll(): Promise<void> {
    const flushes = Array.from(this.queues.values()).map(q => q.forceFlush());
    await Promise.all(flushes);
  }

  clear(entityKey: string) {
    this.queues.delete(entityKey);
  }

  clearAll() {
    this.queues.clear();
  }
}

export const mutationQueueManager = new MutationQueueManager();
export type { EntityQueue };
