export type ConfigAll = {
  registryMap: Record<string, any>;
  featureFlagsMap?: Record<string, boolean>;
  plans?: any[];
  featureFlags?: any[];
  cdcTemplates?: any[];
  roadmapTemplates?: any[];
  okrTemplates?: any[];
  resourceTemplates?: any[];
  registry?: any[];
  faq?: any[];
  onboarding?: any[];
  accountActions?: any[];
};

export async function fetchConfigAll(): Promise<ConfigAll> {
  const r = await fetch("/api/config/all", { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
