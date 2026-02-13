import { useQuery } from "@tanstack/react-query";
import { fetchConfigAll } from "@/lib/config";

export function useConfig() {
  return useQuery({
    queryKey: ["config-all"],
    queryFn: fetchConfigAll,
    staleTime: 5 * 60 * 1000, // 5 min cache
    refetchOnWindowFocus: false,
  });
}
