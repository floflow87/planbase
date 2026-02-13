import { useQuery } from "@tanstack/react-query";

async function fetchConfigAll() {
  const r = await fetch("/config/all");
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

export function useConfigAll() {
  return useQuery({
    queryKey: ["config-all-strapi"],
    queryFn: fetchConfigAll,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
