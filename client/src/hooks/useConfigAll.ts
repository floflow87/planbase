import { useQuery } from "@tanstack/react-query";
import { fetchConfigAll, type ConfigAll } from "../lib/config"; // adapte le chemin

export function useConfigAll() {
  return useQuery<ConfigAll>({
    queryKey: ["config-all"],
    queryFn: fetchConfigAll,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
