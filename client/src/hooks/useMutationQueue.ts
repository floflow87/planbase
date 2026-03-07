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
      commitFn: (patch: Partial<T>) => Promise<void>,
      rollbackFn?: () => void,
    ) => {
      mutationQueueManager
        .get(entityKey)
        .queuePatch(patch as Record<string, any>, commitFn as (patch: Record<string, any>) => Promise<void>, rollbackFn, debounceMs);
    },
    [entityKey, debounceMs],
  );

  const flush = useCallback(
    () => mutationQueueManager.get(entityKey).forceFlush(),
    [entityKey],
  );

  return { ...state, queuePatch, flush };
}
