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

export type PaymentRhythm =
  | "at_order"
  | "monthly"
  | "at_milestone"
  | "quarterly"
  | "at_delivery"
  | "deposit_monthly"
  | "deposit_delivery"
  | "30d_after_delivery";

export const PAYMENT_RHYTHM_LABELS: Record<PaymentRhythm, string> = {
  at_order: "À la commande",
  monthly: "Mensuellement",
  at_milestone: "Au milestone",
  quarterly: "Trimestriellement",
  at_delivery: "À la livraison",
  deposit_monthly: "Acompte + mensuel",
  deposit_delivery: "Acompte + solde livraison",
  "30d_after_delivery": "30j après livraison",
};

export const RHYTHMS_WITH_DEPOSIT: PaymentRhythm[] = ["deposit_monthly", "deposit_delivery"];
export const RHYTHMS_WITH_MILESTONE: PaymentRhythm[] = ["at_milestone"];

export interface PaymentInstallment {
  date: Date;
  amount: number;
  label: string;
  pct: number;
  type: "deposit" | "regular" | "balance";
}

function addMonths(date: Date, n: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d;
}

function addDaysToDate(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function snapToEndOfMonth(date: Date): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1, 0);
  return d;
}

export function computePaymentSchedule(
  rhythm: PaymentRhythm,
  totalAmount: number,
  startDate: Date,
  endDate: Date,
  depositPct: number = 30,
  milestoneCount: number = 3,
  endOfMonth: boolean = false,
  depositAmtOverride?: number
): PaymentInstallment[] {
  const snap = (d: Date) => endOfMonth ? snapToEndOfMonth(d) : d;
  if (totalAmount <= 0) return [];
  const resolveDeposit = () =>
    depositAmtOverride != null && depositAmtOverride > 0
      ? depositAmtOverride
      : Math.round(totalAmount * (depositPct / 100));

  const durationMs = Math.max(0, endDate.getTime() - startDate.getTime());
  const durationMonths = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24 * 30.4)));
  const durationDays = Math.max(1, Math.round(durationMs / (1000 * 60 * 60 * 24)));

  switch (rhythm) {
    case "at_order":
      return [{ date: snap(new Date(startDate)), amount: totalAmount, label: "À la commande", pct: 100, type: "regular" }];

    case "at_delivery":
      return [{ date: snap(new Date(endDate)), amount: totalAmount, label: "À la livraison", pct: 100, type: "regular" }];

    case "30d_after_delivery":
      return [{ date: snap(addDaysToDate(endDate, 30)), amount: totalAmount, label: "30j après livraison", pct: 100, type: "regular" }];

    case "monthly": {
      const perMonth = totalAmount / durationMonths;
      return Array.from({ length: durationMonths }, (_, i) => ({
        date: snap(addMonths(startDate, i + 1)),
        amount: perMonth,
        label: `Mensualité ${i + 1}/${durationMonths}`,
        pct: 100 / durationMonths,
        type: "regular" as const,
      }));
    }

    case "quarterly": {
      const quarters = Math.max(1, Math.ceil(durationMonths / 3));
      const perQuarter = totalAmount / quarters;
      return Array.from({ length: quarters }, (_, i) => ({
        date: snap(addMonths(startDate, (i + 1) * 3)),
        amount: perQuarter,
        label: `Trimestre ${i + 1}/${quarters}`,
        pct: 100 / quarters,
        type: "regular" as const,
      }));
    }

    case "at_milestone": {
      const count = Math.max(1, milestoneCount);
      const perMilestone = totalAmount / count;
      const intervalDays = durationDays / count;
      return Array.from({ length: count }, (_, i) => ({
        date: snap(addDaysToDate(startDate, Math.round(intervalDays * (i + 1)))),
        amount: perMilestone,
        label: `Milestone ${i + 1}/${count}`,
        pct: 100 / count,
        type: "regular" as const,
      }));
    }

    case "deposit_delivery": {
      const deposit = resolveDeposit();
      const balance = totalAmount - deposit;
      const actualPct = Math.round((deposit / totalAmount) * 100);
      return [
        { date: new Date(startDate), amount: deposit, label: `Acompte (${actualPct}%)`, pct: actualPct, type: "deposit" },
        { date: snap(new Date(endDate)), amount: balance, label: `Solde à la livraison (${100 - actualPct}%)`, pct: 100 - actualPct, type: "balance" },
      ];
    }

    case "deposit_monthly": {
      const deposit = resolveDeposit();
      const remaining = totalAmount - deposit;
      const months = durationMonths;
      const perMonth = remaining / months;
      const actualDepositPct = Math.round((deposit / totalAmount) * 100);
      const schedule: PaymentInstallment[] = [
        { date: new Date(startDate), amount: deposit, label: `Acompte (${actualDepositPct}%)`, pct: actualDepositPct, type: "deposit" },
      ];
      for (let i = 0; i < months; i++) {
        schedule.push({
          date: snap(addMonths(startDate, i + 1)),
          amount: perMonth,
          label: `Mensuel ${i + 1}/${months}`,
          pct: (100 - actualDepositPct) / months,
          type: "regular",
        });
      }
      return schedule;
    }

    default:
      return [];
  }
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
      if (projectedMarginPercent >= 25) { riskLevel = "ok"; riskLabel = "Trajectoire saine"; }
      else if (projectedMarginPercent >= 10) { riskLevel = "warning"; riskLabel = "Marge réduite"; }
      else if (projectedMarginPercent >= 0) { riskLevel = "danger"; riskLabel = "Marge critique"; }
      else { riskLevel = "danger"; riskLabel = "Dépassement de budget"; }
    } else {
      riskLevel = "unknown"; riskLabel = "Coût journalier non renseigné";
    }
  }

  return {
    remainingWorkDays, calendarDaysNeeded, newEndDate, remainingCalendarLabel,
    availableWorkDaysInWindow, simTotalBilled, simMonthlyAmount, durationInMonths,
    remainingToInvoice, projectedRemainingCost, projectedTotalCost,
    projectedMargin, projectedMarginPercent, deltaEndDays,
    riskLevel, riskLabel,
    canCompute: missingFields.length === 0,
    missingFields,
  };
}
