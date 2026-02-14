import { useMemo } from "react";
import { useConfig, type StageMeta } from "./useConfig";
import {
  PROJECT_STAGES,
  projectStageByKey,
  getProjectStageLabel as hardcodedLabel,
  getProjectStageColorClass as hardcodedColor,
  getProjectStageOrder as hardcodedOrder,
  isTerminalStage as hardcodedIsTerminal,
  type ProjectStageKey,
} from "@shared/config";

interface ResolvedStageMeta {
  key: string;
  label: string;
  colorClass: string;
  order: number;
  isTerminal: boolean;
  isVisible: boolean;
  source: "strapi" | "hardcoded";
}

const DEFAULT_COLOR = "bg-gray-100 border-gray-200 text-gray-700 dark:bg-gray-800/50 dark:text-gray-400 dark:border-gray-700";

function buildStageMap(strapiStages: StageMeta[] | undefined): Map<string, StageMeta> {
  const map = new Map<string, StageMeta>();
  if (!strapiStages || !Array.isArray(strapiStages)) return map;
  for (const s of strapiStages) {
    if (s && typeof s.key === "string") {
      map.set(s.key, s);
    }
  }
  return map;
}

function resolveOne(
  stageKey: string,
  strapiMap: Map<string, StageMeta>,
  visibleKeys: string[] | undefined
): ResolvedStageMeta {
  const strapiMeta = strapiMap.get(stageKey);
  const hardcoded = projectStageByKey[stageKey as ProjectStageKey];

  if (strapiMeta) {
    const colorClass = strapiMeta.colorClass && strapiMeta.textColorClass
      ? `${strapiMeta.colorClass} ${strapiMeta.textColorClass} ${strapiMeta.darkColorClass ?? ""}`
      : hardcoded
        ? `${hardcoded.colorClass} ${hardcoded.textColorClass} ${hardcoded.darkColorClass}`
        : DEFAULT_COLOR;

    return {
      key: stageKey,
      label: strapiMeta.label ?? hardcoded?.label ?? stageKey,
      colorClass,
      order: strapiMeta.order ?? hardcoded?.order ?? 0,
      isTerminal: strapiMeta.isTerminal ?? hardcodedIsTerminal(stageKey),
      isVisible: visibleKeys ? visibleKeys.includes(stageKey) : (strapiMeta.isVisible !== false),
      source: "strapi",
    };
  }

  return {
    key: stageKey,
    label: hardcoded?.label ?? stageKey,
    colorClass: hardcoded
      ? `${hardcoded.colorClass} ${hardcoded.textColorClass} ${hardcoded.darkColorClass}`
      : DEFAULT_COLOR,
    order: hardcoded?.order ?? 0,
    isTerminal: hardcodedIsTerminal(stageKey),
    isVisible: visibleKeys ? visibleKeys.includes(stageKey) : true,
    source: "hardcoded",
  };
}

export function useProjectStageMeta(stageKey?: string | null) {
  const { stagesUI, isLoading } = useConfig();

  const { strapiMap, visibleKeys } = useMemo(() => {
    const stages = stagesUI?.stages;
    return {
      strapiMap: buildStageMap(stages),
      visibleKeys: stagesUI?.visibleKeys,
    };
  }, [stagesUI]);

  const meta = useMemo(() => {
    if (!stageKey) {
      return {
        key: "",
        label: "Non defini",
        colorClass: DEFAULT_COLOR,
        order: 0,
        isTerminal: false,
        isVisible: true,
        source: "hardcoded" as const,
      };
    }
    return resolveOne(stageKey, strapiMap, visibleKeys);
  }, [stageKey, strapiMap, visibleKeys]);

  return { ...meta, isLoading };
}

export function useAllProjectStages() {
  const { stagesUI, isLoading } = useConfig();

  const { allStages, visibleStages, strapiMap, visibleKeys } = useMemo(() => {
    const sMap = buildStageMap(stagesUI?.stages);
    const vKeys = stagesUI?.visibleKeys;

    const allKeys = new Set<string>();

    for (const s of PROJECT_STAGES) {
      allKeys.add(s.key);
    }
    if (stagesUI?.stages) {
      for (const s of stagesUI.stages) {
        if (s.key) allKeys.add(s.key);
      }
    }

    const sorted = Array.from(allKeys)
      .map(k => resolveOne(k, sMap, vKeys))
      .sort((a, b) => a.order - b.order);

    return {
      allStages: sorted,
      visibleStages: sorted.filter(s => s.isVisible),
      strapiMap: sMap,
      visibleKeys: vKeys,
    };
  }, [stagesUI]);

  const getLabel = (key: string | null): string => {
    if (!key) return "Non defini";
    const s = strapiMap.get(key);
    if (s) return s.label ?? projectStageByKey[key as ProjectStageKey]?.label ?? key;
    return projectStageByKey[key as ProjectStageKey]?.label ?? key;
  };

  const getColor = (key: string | null): string => {
    if (!key) return DEFAULT_COLOR;
    return resolveOne(key, strapiMap, visibleKeys).colorClass;
  };

  return {
    allStages,
    visibleStages,
    getLabel,
    getColor,
    isLoading,
  };
}

export type { ResolvedStageMeta };
