import { useCallback, useEffect, useState } from "react";
import { mutationQueueManager, type QueueState } from "@/lib/mutationQueue";

export function useMutationQueue<T extends Record<string, any>>(
  entityKey: string,
  debounceMs = 400,
) {
  const [state, setState] = useState<QueueState>(() => mutationQueueManager.get(entityKey).state);

  useEffect(() => {
    const queue = mutationQueueManager.get(entityKey);
    setState({ ...queue.state });
    const listener = () => setState({ ...queue.state });
    queue.listeners.add(listener);
    return () => {
      queue.listeners.delete(listener);
    };
  }, [entityKey]);

  const queuePatch = useCallback(
    (
      patch: Partial<T>,
      commitFn: (patch: Partial<T>) => Promise<any>,
      rollbackFn?: () => void,
    ) => {
      mutationQueueManager
        .get(entityKey)
        .queuePatch(patch as Record<string, any>, commitFn as (patch: Record<string, any>) => Promise<any>, rollbackFn, debounceMs);
    },
    [entityKey, debounceMs],
  );

  const queueAction = useCallback(
    (
      label: string,
      fn: () => Promise<any>,
      rollback?: () => void,
    ) => {
      mutationQueueManager.get(entityKey).queueAction(label, fn, rollback);
    },
    [entityKey],
  );

  const flush = useCallback(
    () => mutationQueueManager.get(entityKey).forceFlush(),
    [entityKey],
  );

  const setServerRevision = useCallback(
    (revision: number, updatedAt?: number) => {
      mutationQueueManager.get(entityKey).setServerRevision(revision, updatedAt);
    },
    [entityKey],
  );

  return {
    ...state,
    isSyncing: state.isMutating,
    queuePatch,
    queueAction,
    flush,
    setServerRevision,
  };
}
