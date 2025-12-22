import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { supabase } from "./supabase";

// Track if we're already handling a 401 to prevent infinite loops
let isHandling401 = false;

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    
    // Auto sign-out on 401 to clear invalid tokens
    if (res.status === 401 && !isHandling401) {
      // Skip if already on login page
      if (window.location.pathname === "/login") {
        throw new Error(`${res.status}: ${text}`);
      }
      
      isHandling401 = true;
      console.warn("401 Unauthorized - signing out to clear invalid session");
      
      // Clear all queries first to prevent more requests
      queryClient.clear();
      
      await supabase.auth.signOut();
      
      // Redirect to login
      window.location.href = "/login";
      
      // Reset flag after a delay
      setTimeout(() => { isHandling401 = false; }, 2000);
    }
    
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Format a Date object to YYYY-MM-DD string preserving calendar day
 * This avoids timezone issues when storing dates
 */
export function formatDateForStorage(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get the current Supabase session token
 * Always uses JWT-based authentication - no dev fallbacks
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
    };
  }
  
  // No session = no auth headers
  // This will trigger a 401 response and redirect to login
  return {};
}

export async function apiRequest(
  url: string,
  method: string,
  data?: unknown | undefined,
): Promise<Response> {
  const authHeaders = await getAuthHeaders();
  
  const res = await fetch(url, {
    method,
    headers: {
      ...authHeaders,
      ...(data ? { "Content-Type": "application/json" } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const authHeaders = await getAuthHeaders();
    
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders,
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh, optimistic updates handle immediacy
      gcTime: 1000 * 60 * 30, // 30 minutes garbage collection
      retry: false,
      refetchOnMount: false, // Don't refetch on every mount if data is fresh
    },
    mutations: {
      retry: false,
    },
  },
});

// ============================================
// OPTIMISTIC UPDATE UTILITIES
// ============================================

/**
 * Generic optimistic update for lists (add item)
 */
export function optimisticAdd<T extends { id: string }>(
  queryKey: string[],
  newItem: T
) {
  // Cancel ongoing queries
  queryClient.cancelQueries({ queryKey });
  
  // Snapshot current data
  const previousData = queryClient.getQueryData<T[]>(queryKey);
  
  // Optimistically add to list
  queryClient.setQueryData<T[]>(queryKey, (old) => {
    if (!old) return [newItem];
    return [newItem, ...old];
  });
  
  return { previousData };
}

/**
 * Generic optimistic update for lists (update item)
 */
export function optimisticUpdate<T extends { id: string }>(
  queryKey: string[],
  itemId: string,
  updates: Partial<T>
) {
  // Cancel ongoing queries
  queryClient.cancelQueries({ queryKey });
  
  // Snapshot current data
  const previousData = queryClient.getQueryData<T[]>(queryKey);
  
  // Optimistically update item in list
  queryClient.setQueryData<T[]>(queryKey, (old) => {
    if (!old) return old;
    return old.map(item => 
      item.id === itemId ? { ...item, ...updates } : item
    );
  });
  
  return { previousData };
}

/**
 * Generic optimistic update for single item
 */
export function optimisticUpdateSingle<T extends { id: string }>(
  queryKey: string[],
  updates: Partial<T>
) {
  // Cancel ongoing queries
  queryClient.cancelQueries({ queryKey });
  
  // Snapshot current data
  const previousData = queryClient.getQueryData<T>(queryKey);
  
  // Optimistically update the item
  queryClient.setQueryData<T>(queryKey, (old) => {
    if (!old) return old;
    return { ...old, ...updates };
  });
  
  return { previousData };
}

/**
 * Generic optimistic update for lists (delete item)
 */
export function optimisticDelete<T extends { id: string }>(
  queryKey: string[],
  itemId: string
) {
  // Cancel ongoing queries
  queryClient.cancelQueries({ queryKey });
  
  // Snapshot current data
  const previousData = queryClient.getQueryData<T[]>(queryKey);
  
  // Optimistically remove from list
  queryClient.setQueryData<T[]>(queryKey, (old) => {
    if (!old) return old;
    return old.filter(item => item.id !== itemId);
  });
  
  return { previousData };
}

/**
 * Rollback helper for optimistic updates
 */
export function rollbackOptimistic<T>(
  queryKey: string[],
  previousData: T | undefined
) {
  if (previousData !== undefined) {
    queryClient.setQueryData(queryKey, previousData);
  }
}

/**
 * Invalidate after mutation settles (success or error)
 */
export function invalidateAfterMutation(queryKeys: string[][]) {
  queryKeys.forEach(key => {
    queryClient.invalidateQueries({ queryKey: key });
  });
}
