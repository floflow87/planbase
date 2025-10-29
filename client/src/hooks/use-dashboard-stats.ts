import { useQuery } from "@tanstack/react-query";

const ACCOUNT_ID = "demo-account"; // Hardcoded for MVP demo

export function useDashboardStats() {
  return useQuery({
    queryKey: ["/api/accounts", ACCOUNT_ID, "stats"],
    enabled: false, // Will be enabled after seeding
  });
}

export function useActivities() {
  return useQuery({
    queryKey: ["/api/accounts", ACCOUNT_ID, "activities"],
    enabled: false,
  });
}
