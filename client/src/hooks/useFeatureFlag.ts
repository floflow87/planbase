import { useConfigAll } from "./useConfigAll";

export function useFeatureFlag(flagKey: string, defaultValue = false): boolean {
  const { data } = useConfigAll();
  return data?.featureFlagsMap?.[flagKey] ?? defaultValue;
}
