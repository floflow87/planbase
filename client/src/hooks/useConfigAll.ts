import { useQuery } from "@tanstack/react-query";
import { fetchConfigAll, type ConfigAll } from "@/lib/config";

export function useConfigAll() {
  return useQuery<ConfigAll>({
    queryKey: ["config-all"],
    queryFn: fetchConfigAll,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
