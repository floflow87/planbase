export type ConfigAll = {
  registryMap: Record<string, any>;
  featureFlagsMap?: Record<string, boolean>;
  plans?: any[];
};

export async function fetchConfigAll(): Promise<ConfigAll> {
  const r = await fetch("/config/all", { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
