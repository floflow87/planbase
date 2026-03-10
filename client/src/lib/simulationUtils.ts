export interface SimulationInputs {
  simulationStartDate: Date;
  simulationDaysPerWeek: number;
  targetMode: "days" | "date";
  targetEndDate?: Date | null;
  simBillingType?: "fixed_price" | "time_based" | null;
  simTJM?: number;
  simBilledDays?: number;
}

export interface SimulationCurrentState {
  totalEstimatedDays: number;
  actualDaysWorked: number;
  remainingDays: number;
  totalBilled: number;
  totalPaid: number;
  internalDailyCost: number;
  currentEndDate?: Date | null;
  billingType?: string | null;
  billingRate?: number;
}

export interface SimulationResult {
  remainingWorkDays: number;
  calendarDaysNeeded: number;
  newEndDate: Date;
  remainingCalendarLabel: string;
  availableWorkDaysInWindow: number | null;
  simTotalBilled: number;
  simMonthlyAmount: number | null;
  durationInMonths: number | null;
  remainingToInvoice: number;
  projectedRemainingCost: number;
  projectedTotalCost: number;
  projectedMargin: number;
  projectedMarginPercent: number;
  deltaEndDays: number | null;
  riskLevel: "ok" | "warning" | "danger" | "unknown";
  riskLabel: string;
  canCompute: boolean;
  missingFields: string[];
}

export function addCalendarDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + Math.ceil(days));
  return result;
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

export function formatCalendarDuration(calendarDays: number): string {
  if (calendarDays <= 0) return "immédiatement";
  const weeks = Math.floor(calendarDays / 7);
  const days = calendarDays % 7;
  if (weeks === 0) return `${days}j calendaire${days > 1 ? "s" : ""}`;
  if (days === 0) return `${weeks} semaine${weeks > 1 ? "s" : ""}`;
  return `${weeks} sem. et ${days}j`;
}

export function computeSimulation(
  inputs: SimulationInputs,
  state: SimulationCurrentState
): SimulationResult {
  const missingFields: string[] = [];
  const daysPerWeek = Math.max(1, Math.min(7, inputs.simulationDaysPerWeek));

  let remainingWorkDays: number;
  let calendarDaysNeeded: number;
  let newEndDate: Date;
  let availableWorkDaysInWindow: number | null = null;

  if (inputs.targetMode === "date" && inputs.targetEndDate) {
    const calendarWindow = Math.max(0, daysBetween(inputs.simulationStartDate, inputs.targetEndDate));
    availableWorkDaysInWindow = Math.floor((calendarWindow * daysPerWeek) / 7);
    remainingWorkDays = availableWorkDaysInWindow;
    calendarDaysNeeded = calendarWindow;
    newEndDate = new Date(inputs.targetEndDate);
  } else {
    remainingWorkDays = Math.max(0, state.remainingDays);
    calendarDaysNeeded = daysPerWeek > 0
      ? Math.ceil((remainingWorkDays / daysPerWeek) * 7)
      : 0;
    newEndDate = addCalendarDays(inputs.simulationStartDate, calendarDaysNeeded);
  }

  const remainingCalendarLabel = formatCalendarDuration(calendarDaysNeeded);

  const durationInMonths = calendarDaysNeeded > 0 ? calendarDaysNeeded / 30.4 : null;

  const effectiveBillingType = inputs.simBillingType ?? state.billingType ?? "fixed_price";
  const effectiveTJM = (inputs.simTJM !== undefined && inputs.simTJM > 0) ? inputs.simTJM : (state.billingRate ?? 0);
  const effectiveBilledDays = inputs.simBilledDays !== undefined ? inputs.simBilledDays : remainingWorkDays;

  const simTotalBilled = effectiveTJM > 0 ? effectiveTJM * effectiveBilledDays : 0;
  const simMonthlyAmount = (durationInMonths && durationInMonths > 0 && simTotalBilled > 0)
    ? simTotalBilled / durationInMonths
    : null;

  const effectiveTotalBilled = simTotalBilled > 0 ? simTotalBilled : state.totalBilled;

  if (effectiveTotalBilled <= 0) missingFields.push("montant facturé");
  if (effectiveTJM <= 0) missingFields.push("TJM");
  if (state.internalDailyCost <= 0) missingFields.push("coût journalier interne");

  const remainingToInvoice = Math.max(0, effectiveTotalBilled - state.totalPaid);
  const projectedRemainingCost = remainingWorkDays * state.internalDailyCost;
  const alreadySpentCost = state.actualDaysWorked * state.internalDailyCost;
  const projectedTotalCost = alreadySpentCost + projectedRemainingCost;
  const projectedMargin = effectiveTotalBilled - projectedTotalCost;
  const projectedMarginPercent =
    effectiveTotalBilled > 0 ? (projectedMargin / effectiveTotalBilled) * 100 : 0;

  const deltaEndDays = state.currentEndDate
    ? daysBetween(state.currentEndDate, newEndDate)
    : null;

  let riskLevel: SimulationResult["riskLevel"] = "unknown";
  let riskLabel = "Données insuffisantes";

  if (effectiveTotalBilled > 0) {
    if (state.internalDailyCost > 0) {
      if (projectedMarginPercent >= 25) {
        riskLevel = "ok"; riskLabel = "Trajectoire saine";
      } else if (projectedMarginPercent >= 10) {
        riskLevel = "warning"; riskLabel = "Marge réduite";
      } else if (projectedMarginPercent >= 0) {
        riskLevel = "danger"; riskLabel = "Marge critique";
      } else {
        riskLevel = "danger"; riskLabel = "Dépassement de budget";
      }
    } else {
      riskLevel = "unknown"; riskLabel = "Coût journalier non renseigné";
    }
  }

  return {
    remainingWorkDays,
    calendarDaysNeeded,
    newEndDate,
    remainingCalendarLabel,
    availableWorkDaysInWindow,
    simTotalBilled,
    simMonthlyAmount,
    durationInMonths,
    remainingToInvoice,
    projectedRemainingCost,
    projectedTotalCost,
    projectedMargin,
    projectedMarginPercent,
    deltaEndDays,
    riskLevel,
    riskLabel,
    canCompute: missingFields.length === 0,
    missingFields,
  };
}
