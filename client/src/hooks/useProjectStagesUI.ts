import { useMemo } from "react";
import { useConfigAll } from "./useConfigAll";
import {
  PROJECT_STAGES,
  projectStageByKey,
  type ProjectStageKey,
} from "@shared/config";

interface StageUIOverride {
  key: string;
  label?: string;
  colorClass?: string;
  textColorClass?: string;
  darkColorClass?: string;
  order?: number;
  isTerminal?: boolean;
  isVisible?: boolean;
}

interface StagesUIPayload {
  stages?: StageUIOverride[];
  visibleKeys?: string[];
}

export interface ResolvedStage {
  key: string;
  label: string;
  colorClass: string;
  order: number;
  isTerminal: boolean;
}

const DEFAULT_COLOR =
  "bg-gray-100 border-gray-200 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700";

function buildFullColor(s: { colorClass: string; textColorClass: string; darkColorClass: string }) {
  return `${s.colorClass} ${s.textColorClass} ${s.darkColorClass}`;
}

export function useProjectStagesUI() {
  const { data, isLoading } = useConfigAll();

  const result = useMemo(() => {
    const payload: StagesUIPayload | undefined = data?.registryMap?.["project.stages.ui"];
    const overrideMap = new Map<string, StageUIOverride>();

    if (payload?.stages && Array.isArray(payload.stages)) {
      for (const s of payload.stages) {
        if (s && typeof s.key === "string") {
          overrideMap.set(s.key, s);
        }
      }
    }

    const visibleKeysRaw = payload?.visibleKeys;
    const hasVisibleKeys = Array.isArray(visibleKeysRaw) && visibleKeysRaw.length > 0;
    const visibleKeysSet = hasVisibleKeys ? new Set(visibleKeysRaw) : null;

    const allKeys = new Set<string>();
    for (const s of PROJECT_STAGES) allKeys.add(s.key);
    for (const k of overrideMap.keys()) allKeys.add(k);

    const resolveStage = (key: string): ResolvedStage => {
      const override = overrideMap.get(key);
      const hardcoded = projectStageByKey[key as ProjectStageKey];

      const label = override?.label ?? hardcoded?.label ?? key;

      let colorClass: string;
      if (override?.colorClass && override?.textColorClass) {
        colorClass = `${override.colorClass} ${override.textColorClass} ${override.darkColorClass ?? ""}`;
      } else if (hardcoded) {
        colorClass = buildFullColor(hardcoded);
      } else {
        colorClass = DEFAULT_COLOR;
      }

      const order = override?.order ?? hardcoded?.order ?? 999;
      const isTerminal = override?.isTerminal ?? (hardcoded as any)?.isTerminal === true;

      return { key, label, colorClass, order, isTerminal };
    };

    const allStages = Array.from(allKeys)
      .map(resolveStage)
      .sort((a, b) => a.order - b.order);

    const visibleStages = visibleKeysSet
      ? allStages.filter((s) => visibleKeysSet.has(s.key))
      : allStages;

    const labelsMap: Record<string, string> = {};
    const colorsMap: Record<string, string> = {};
    const orderMap: Record<string, number> = {};
    for (const s of allStages) {
      labelsMap[s.key] = s.label;
      colorsMap[s.key] = s.colorClass;
      orderMap[s.key] = s.order;
    }

    return {
      allStages,
      visibleStages,
      visibleKeys: visibleKeysRaw ?? null,
      labels: labelsMap,
      colors: colorsMap,
      order: orderMap,
      getLabel: (key: string | null): string => {
        if (!key) return "Non défini";
        return labelsMap[key] ?? resolveStage(key).label;
      },
      getColor: (key: string | null): string => {
        if (!key) return DEFAULT_COLOR;
        return colorsMap[key] ?? resolveStage(key).colorClass;
      },
    };
  }, [data]);

  return { ...result, isLoading };
}
