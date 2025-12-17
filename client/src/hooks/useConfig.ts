/**
 * useConfig Hook - Frontend configuration consumption
 * 
 * Fetches resolved configuration from the Config Registry API.
 * Uses React Query for caching and automatic refetching.
 * 
 * Usage:
 *   const { config, isLoading, projectStages, taskPriorities, thresholds } = useConfig();
 */

import { useQuery } from "@tanstack/react-query";
import type { 
  PROJECT_STAGES, 
  TASK_PRIORITIES, 
  TASK_STATUSES, 
  BILLING_STATUSES, 
  TIME_CATEGORIES, 
  THRESHOLDS 
} from "@shared/config";

interface ConfigMeta {
  resolvedAt: string;
  accountId?: string;
  userId?: string;
  projectId?: string;
}

interface EffectiveConfig {
  "project.stages": typeof PROJECT_STAGES;
  "task.priorities": typeof TASK_PRIORITIES;
  "task.statuses": typeof TASK_STATUSES;
  "billing.statuses": typeof BILLING_STATUSES;
  "time.categories": typeof TIME_CATEGORIES;
  "thresholds": typeof THRESHOLDS;
}

interface ConfigResponse {
  effective: EffectiveConfig;
  meta: ConfigMeta;
}

interface UseConfigOptions {
  projectId?: string;
  enabled?: boolean;
}

export function useConfig(options: UseConfigOptions = {}) {
  const { projectId, enabled = true } = options;

  // Build URL with query params for projectId if provided
  const url = projectId 
    ? `/api/config?projectId=${encodeURIComponent(projectId)}`
    : "/api/config";

  const { data, isLoading, error, refetch } = useQuery<ConfigResponse>({
    queryKey: [url],
    enabled,
    staleTime: 60000, // Cache for 1 minute
    refetchOnWindowFocus: false,
  });

  return {
    config: data?.effective,
    meta: data?.meta,
    isLoading,
    error,
    refetch,
    
    // Convenience accessors for commonly used configs
    projectStages: data?.effective?.["project.stages"] ?? [],
    taskPriorities: data?.effective?.["task.priorities"] ?? [],
    taskStatuses: data?.effective?.["task.statuses"] ?? [],
    billingStatuses: data?.effective?.["billing.statuses"] ?? [],
    timeCategories: data?.effective?.["time.categories"] ?? [],
    thresholds: data?.effective?.["thresholds"],
  };
}

export type { ConfigResponse, EffectiveConfig, ConfigMeta };
