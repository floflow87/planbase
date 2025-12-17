// Profitability calculation service with rule-based recommendations engine
import type { Project, TimeEntry, ProjectPayment } from "@shared/schema";

// Types for profitability analysis
export interface ProfitabilityMetrics {
  // Time metrics
  actualDaysWorked: number;
  theoreticalDays: number;
  timeOverrun: number; // Positive = over, negative = under
  timeOverrunPercent: number;
  
  // Financial metrics
  totalBilled: number;
  totalPaid: number;
  remainingToPay: number;
  paymentProgress: number; // Percentage paid
  
  // TJM metrics
  targetTJM: number;
  actualTJM: number;
  tjmGap: number; // Positive = above target, negative = below
  tjmGapPercent: number;
  
  // Profitability metrics
  internalDailyCost: number;
  totalCost: number;
  margin: number;
  marginPercent: number;
  targetMarginPercent: number;
  
  // Status
  status: 'profitable' | 'at_risk' | 'deficit';
  statusLabel: string;
  statusColor: string;
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  issue: string;
  action: string;
  impact: string;
  impactValue?: number;
  category: 'pricing' | 'time' | 'payment' | 'model';
  icon: string;
}

export interface ProfitabilityAnalysis {
  projectId: string;
  projectName: string;
  metrics: ProfitabilityMetrics;
  recommendations: Recommendation[];
  generatedAt: string;
}

// Constants for thresholds
const THRESHOLDS = {
  PROFITABLE_MARGIN: 15, // Above 15% = profitable
  AT_RISK_MARGIN: 0, // Between 0-15% = at risk
  // Below 0% = deficit
  
  TIME_OVERRUN_WARNING: 10, // 10% time overrun triggers warning
  TIME_OVERRUN_CRITICAL: 25, // 25% time overrun is critical
  
  TJM_GAP_WARNING: -10, // 10% below target TJM triggers warning
  TJM_GAP_CRITICAL: -20, // 20% below target TJM is critical
  
  PAYMENT_DELAY_WARNING: 30, // 30% unpaid triggers warning
  
  DEFAULT_INTERNAL_COST: 600, // Default internal daily cost if not specified
  DEFAULT_TARGET_MARGIN: 30, // Default target margin 30%
};

// Calculate actual days worked from time entries
export function calculateActualDays(timeEntries: TimeEntry[]): number {
  const totalSeconds = timeEntries.reduce((sum, entry) => {
    return sum + (entry.duration || 0);
  }, 0);
  // Convert seconds to days (assuming 8-hour workday)
  return totalSeconds / 3600 / 8;
}

// Calculate total payments received
export function calculateTotalPaid(payments: ProjectPayment[]): number {
  return payments.reduce((sum, payment) => {
    return sum + parseFloat(payment.amount?.toString() || '0');
  }, 0);
}

// Determine project status based on margin
function getProjectStatus(marginPercent: number): { status: ProfitabilityMetrics['status']; label: string; color: string } {
  if (marginPercent >= THRESHOLDS.PROFITABLE_MARGIN) {
    return { status: 'profitable', label: 'Rentable', color: 'green' };
  } else if (marginPercent >= THRESHOLDS.AT_RISK_MARGIN) {
    return { status: 'at_risk', label: 'À risque', color: 'orange' };
  } else {
    return { status: 'deficit', label: 'Déficitaire', color: 'red' };
  }
}

// Calculate all profitability metrics
export function calculateMetrics(
  project: Project,
  timeEntries: TimeEntry[],
  payments: ProjectPayment[]
): ProfitabilityMetrics {
  // Time metrics
  const actualDaysWorked = calculateActualDays(timeEntries);
  const theoreticalDays = parseFloat(project.numberOfDays?.toString() || '0');
  const timeOverrun = theoreticalDays > 0 ? actualDaysWorked - theoreticalDays : 0;
  const timeOverrunPercent = theoreticalDays > 0 ? (timeOverrun / theoreticalDays) * 100 : 0;
  
  // Financial metrics
  // totalBilled = CA facturé (utilise project.budget comme source de vérité)
  // totalPaid = CA encaissé (sum of actual payments received)
  // Profitability calculations use totalPaid as revenue (CA encaissé)
  const totalBilled = parseFloat(project.budget?.toString() || '0');
  const totalPaid = calculateTotalPaid(payments);
  const remainingToPay = totalBilled - totalPaid;
  const paymentProgress = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
  
  // TJM metrics - Based on actual revenue received
  const targetTJM = parseFloat(project.billingRate?.toString() || '0');
  const actualTJM = actualDaysWorked > 0 ? totalPaid / actualDaysWorked : 0;
  const tjmGap = targetTJM > 0 ? actualTJM - targetTJM : 0;
  const tjmGapPercent = targetTJM > 0 ? (tjmGap / targetTJM) * 100 : 0;
  
  // Profitability metrics - Based on actual revenue received (CA encaissé)
  const internalDailyCost = parseFloat(project.internalDailyCost?.toString() || THRESHOLDS.DEFAULT_INTERNAL_COST.toString());
  const totalCost = actualDaysWorked * internalDailyCost;
  const margin = totalPaid - totalCost;
  const marginPercent = totalPaid > 0 ? (margin / totalPaid) * 100 : 0;
  const targetMarginPercent = parseFloat(project.targetMarginPercent?.toString() || THRESHOLDS.DEFAULT_TARGET_MARGIN.toString());
  
  // Status
  const statusInfo = getProjectStatus(marginPercent);
  
  return {
    actualDaysWorked: Math.round(actualDaysWorked * 100) / 100,
    theoreticalDays,
    timeOverrun: Math.round(timeOverrun * 100) / 100,
    timeOverrunPercent: Math.round(timeOverrunPercent * 10) / 10,
    
    totalBilled,
    totalPaid,
    remainingToPay,
    paymentProgress: Math.round(paymentProgress * 10) / 10,
    
    targetTJM,
    actualTJM: Math.round(actualTJM * 100) / 100,
    tjmGap: Math.round(tjmGap * 100) / 100,
    tjmGapPercent: Math.round(tjmGapPercent * 10) / 10,
    
    internalDailyCost,
    totalCost: Math.round(totalCost * 100) / 100,
    margin: Math.round(margin * 100) / 100,
    marginPercent: Math.round(marginPercent * 10) / 10,
    targetMarginPercent,
    
    status: statusInfo.status,
    statusLabel: statusInfo.label,
    statusColor: statusInfo.color,
  };
}

// Rule-based recommendations engine
export function generateRecommendations(metrics: ProfitabilityMetrics): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let recId = 1;
  
  // RULE 1: Deficit project - critical priority
  if (metrics.status === 'deficit') {
    const amountToBreakeven = Math.abs(metrics.margin);
    const daysToReduce = metrics.internalDailyCost > 0 ? amountToBreakeven / metrics.internalDailyCost : 0;
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'high',
      issue: `Ce projet est déficitaire de ${Math.abs(metrics.margin).toLocaleString('fr-FR')} €`,
      action: `Pour atteindre l'équilibre, vous devez soit facturer +${amountToBreakeven.toLocaleString('fr-FR')} €, soit réduire le temps passé de ${daysToReduce.toFixed(1)} jours.`,
      impact: `Récupérer ${amountToBreakeven.toLocaleString('fr-FR')} € de marge`,
      impactValue: amountToBreakeven,
      category: 'pricing',
      icon: 'AlertTriangle',
    });
  }
  
  // RULE 2: Below target margin
  if (metrics.marginPercent < metrics.targetMarginPercent && metrics.status !== 'deficit') {
    const marginGap = metrics.targetMarginPercent - metrics.marginPercent;
    const targetMargin = (metrics.targetMarginPercent / 100) * metrics.totalBilled;
    const additionalNeeded = targetMargin - metrics.margin;
    const daysToReduce = metrics.internalDailyCost > 0 ? additionalNeeded / metrics.internalDailyCost : 0;
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: metrics.status === 'at_risk' ? 'high' : 'medium',
      issue: `Marge actuelle (${metrics.marginPercent}%) inférieure à l'objectif (${metrics.targetMarginPercent}%)`,
      action: `Pour atteindre ${metrics.targetMarginPercent}% de marge, facturez +${additionalNeeded.toLocaleString('fr-FR')} € ou réduisez de ${daysToReduce.toFixed(1)} jours.`,
      impact: `+${marginGap.toFixed(1)}% de marge`,
      impactValue: additionalNeeded,
      category: 'pricing',
      icon: 'TrendingUp',
    });
  }
  
  // RULE 3: TJM below target
  if (metrics.tjmGapPercent < THRESHOLDS.TJM_GAP_WARNING && metrics.targetTJM > 0) {
    const tjmDiff = Math.abs(metrics.tjmGap);
    const additionalRevenue = tjmDiff * metrics.actualDaysWorked;
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: metrics.tjmGapPercent < THRESHOLDS.TJM_GAP_CRITICAL ? 'high' : 'medium',
      issue: `TJM réel (${metrics.actualTJM.toLocaleString('fr-FR')} €) inférieur au TJM cible (${metrics.targetTJM.toLocaleString('fr-FR')} €)`,
      action: `Augmentez votre TJM de ${tjmDiff.toLocaleString('fr-FR')} € pour les prochains projets similaires.`,
      impact: `+${additionalRevenue.toLocaleString('fr-FR')} € sur ce projet si TJM cible était appliqué`,
      impactValue: additionalRevenue,
      category: 'pricing',
      icon: 'DollarSign',
    });
  }
  
  // RULE 4: Time overrun
  if (metrics.timeOverrunPercent > THRESHOLDS.TIME_OVERRUN_WARNING && metrics.theoreticalDays > 0) {
    const overrunCost = metrics.timeOverrun * metrics.internalDailyCost;
    const overrunDays = metrics.timeOverrun;
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: metrics.timeOverrunPercent > THRESHOLDS.TIME_OVERRUN_CRITICAL ? 'high' : 'medium',
      issue: `Dépassement de ${overrunDays.toFixed(1)} jours (+${metrics.timeOverrunPercent.toFixed(0)}%) par rapport au prévisionnel`,
      action: `Analysez les causes du dépassement et ajustez vos estimations futures. Coût du dépassement : ${overrunCost.toLocaleString('fr-FR')} €.`,
      impact: `Économiser ${overrunCost.toLocaleString('fr-FR')} € sur les prochains projets`,
      impactValue: overrunCost,
      category: 'time',
      icon: 'Clock',
    });
  }
  
  // RULE 5: Payment delay
  if (metrics.paymentProgress < (100 - THRESHOLDS.PAYMENT_DELAY_WARNING) && metrics.totalBilled > 0) {
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      issue: `Seulement ${metrics.paymentProgress.toFixed(0)}% du montant facturé a été encaissé`,
      action: `Relancez le client pour les ${metrics.remainingToPay.toLocaleString('fr-FR')} € restants à percevoir.`,
      impact: `Récupérer ${metrics.remainingToPay.toLocaleString('fr-FR')} € de trésorerie`,
      impactValue: metrics.remainingToPay,
      category: 'payment',
      icon: 'CreditCard',
    });
  }
  
  // RULE 6: Fixed price with time overrun - suggest switching to time-based
  if (metrics.timeOverrunPercent > THRESHOLDS.TIME_OVERRUN_CRITICAL) {
    const potentialGain = metrics.timeOverrun * metrics.targetTJM;
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'low',
      issue: `Le forfait ne reflète pas le temps réellement passé`,
      action: `Envisagez un modèle en régie (temps passé) pour les prochains projets similaires.`,
      impact: `Gain potentiel de ${potentialGain.toLocaleString('fr-FR')} € si facturé au temps passé`,
      impactValue: potentialGain,
      category: 'model',
      icon: 'RefreshCw',
    });
  }
  
  // RULE 7: Profitable project - positive reinforcement
  if (metrics.status === 'profitable' && recommendations.length === 0) {
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'low',
      issue: `Projet rentable avec une marge de ${metrics.marginPercent.toFixed(1)}%`,
      action: `Continuez ainsi ! Documentez les bonnes pratiques de ce projet pour les reproduire.`,
      impact: `Maintenir une marge supérieure à ${THRESHOLDS.PROFITABLE_MARGIN}%`,
      category: 'pricing',
      icon: 'CheckCircle',
    });
  }
  
  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
  
  return recommendations;
}

// Main function to generate full analysis
export function generateProfitabilityAnalysis(
  project: Project,
  timeEntries: TimeEntry[],
  payments: ProjectPayment[]
): ProfitabilityAnalysis {
  const metrics = calculateMetrics(project, timeEntries, payments);
  const recommendations = generateRecommendations(metrics);
  
  return {
    projectId: project.id,
    projectName: project.name,
    metrics,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}
