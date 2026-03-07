type PatchCommit = (patch: Record<string, any>) => Promise<void>;
type RollbackFn = () => void;

export interface QueueState {
  isMutating: boolean;
  error: Error | null;
  lastAckAt: number | null;
  pendingCount: number;
}

class EntityQueue {
  readonly entityKey: string;
  private pendingPatch: Record<string, any> = {};
  private pendingCommitFn: PatchCommit | null = null;
  private patchTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private baseRollback: RollbackFn | null = null;

  state: QueueState = { isMutating: false, error: null, lastAckAt: null, pendingCount: 0 };
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
    this._emit({ pendingCount: count });

    console.debug(`[QueueSync] entity=${this.entityKey} queuePatch`, Object.keys(patch), `pending=${count}`);

    if (this.patchTimer) clearTimeout(this.patchTimer);
    if (!this.isFlushing) {
      if (debounceMs === 0) {
        this._flush();
      } else {
        this.patchTimer = setTimeout(() => this._flush(), debounceMs);
      }
    }
  }

  hasPendingPatch(): boolean {
    return Object.keys(this.pendingPatch).length > 0;
  }

  async forceFlush(): Promise<void> {
    if (this.patchTimer) {
      clearTimeout(this.patchTimer);
      this.patchTimer = null;
    }
    return this._flush();
  }

  private async _flush(): Promise<void> {
    if (this.isFlushing) return;
    if (Object.keys(this.pendingPatch).length === 0 || !this.pendingCommitFn) return;

    const patch = { ...this.pendingPatch };
    const commitFn = this.pendingCommitFn;
    const rollback = this.baseRollback;

    this.pendingPatch = {};
    this.pendingCommitFn = null;
    this.baseRollback = null;
    this.isFlushing = true;

    this._emit({ isMutating: true, pendingCount: 0, error: null });
    console.debug(`[QueueSync] entity=${this.entityKey} flush →`, Object.keys(patch));

    try {
      await commitFn(patch);
      this._emit({ isMutating: false, lastAckAt: Date.now() });
      console.debug(`[QueueSync] entity=${this.entityKey} ✓ ack`);
    } catch (e: any) {
      console.error(`[QueueSync] entity=${this.entityKey} ✗ error:`, e.message);
      rollback?.();
      this._emit({ isMutating: false, error: e });
    } finally {
      this.isFlushing = false;
      if (Object.keys(this.pendingPatch).length > 0) {
        this._flush();
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

  clear(entityKey: string) {
    this.queues.delete(entityKey);
  }

  clearAll() {
    this.queues.clear();
  }
}

export const mutationQueueManager = new MutationQueueManager();
