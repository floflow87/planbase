type AnyConfigAll = { registryMap?: Record<string, any> } | undefined | null;

export function getEnum<T = string>(config: AnyConfigAll, key: string, fallback: T[] = []): T[] {
  const v = config?.registryMap?.[key];
  return Array.isArray(v) ? (v as T[]) : fallback;
}

