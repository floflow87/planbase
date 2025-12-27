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

// Decision types for the new recommendation engine
export type DecisionType = 'optimize' | 'accelerate' | 'slowdown' | 'stop' | 'protect';

// Feasibility assessment
export type Feasibility = 'realistic' | 'discuss' | 'unrealistic';

// Recovery capacity analysis
export type RecoveryCapacity = 'recoverable' | 'difficult' | 'unrecoverable';

// Project dynamics
export type ProjectDynamics = 'advancing' | 'stagnating' | 'dragging';

// Recommendation horizon - Determines if action is possible on this project
export type RecommendationHorizon = 'immediate' | 'strategic' | 'learning';

export interface HorizonInfo {
  label: string;
  description: string;
  isActionable: boolean;
}

export const HORIZON_LABELS: Record<RecommendationHorizon, HorizonInfo> = {
  immediate: { 
    label: 'Action immédiate', 
    description: 'Projet en cours, action possible maintenant',
    isActionable: true
  },
  strategic: { 
    label: 'Décision stratégique', 
    description: 'Insight pour améliorer les prochains projets',
    isActionable: false
  },
  learning: { 
    label: 'Apprentissage', 
    description: 'Historique - aucune action possible',
    isActionable: false
  },
};

// Decision labels - New system (no more "Quand possible" or "Pour info")
export type DecisionLabel = 'critical' | 'urgent' | 'plan' | 'insight' | 'healthy';

export interface DecisionLabelInfo {
  emoji: string;
  label: string;
  timing: string;
  description: string;
}

export const DECISION_LABELS: Record<DecisionLabel, DecisionLabelInfo> = {
  critical: { emoji: '🚨', label: 'À traiter maintenant', timing: 'Aujourd\'hui', description: 'Impact direct sur trésorerie ou perte immédiate' },
  urgent: { emoji: '⚠️', label: 'À traiter rapidement', timing: 'Rapidement', description: 'Risque financier si laissé en l\'état' },
  plan: { emoji: '⏰', label: 'Cette semaine', timing: 'Cette semaine', description: 'Opportunité de gain à planifier' },
  insight: { emoji: '💡', label: 'À planifier', timing: 'À planifier', description: 'Insight exploitable prochainement' },
  healthy: { emoji: 'ℹ️', label: 'Information', timing: 'Information', description: 'Aucune action urgente requise' },
};

// Score breakdown for transparency
export interface ScoreBreakdown {
  total: number;
  components: {
    label: string;
    value: number;
    description: string;
  }[];
}

// 3-block structure for clear recommendations
export interface RecommendationBlocks {
  // Block 1: Past observation - "What happened"
  pastImpact: {
    amount: number;
    condition: string; // e.g., "si le TJM cible avait été appliqué"
    period: string; // e.g., "sur les jours déjà réalisés"
  };
  // Block 2: Current implication - "What it means now"
  currentImplication: {
    isPast: boolean; // true = opportunity passed, false = still actionable
    message: string; // e.g., "Ce levier reste exploitable sur les jours restants"
    actionableOn?: string[]; // e.g., ["jours restants", "projets similaires", "prochains projets"]
  };
  // Block 3: Concrete action - "What to do now"
  concreteAction: {
    primary: string; // Main action
    alternatives?: string[]; // Alternative actions
  };
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  priorityScore: number; // Numeric score for sorting (higher = more urgent)
  scoreBreakdown: ScoreBreakdown; // Detailed breakdown for UI transparency
  decisionType: DecisionType;
  decisionLabel: string; // "Optimiser", "Accélérer", "Ralentir", "Stopper", "Protéger"
  // New decision label system
  decision: DecisionLabel;
  decisionInfo: DecisionLabelInfo;
  // Horizon system - Determines actionability
  horizon: RecommendationHorizon;
  horizonInfo: HorizonInfo;
  issue: string; // "Pourquoi"
  action: string; // Action recommandée (kept for backward compatibility)
  // New 3-block structure
  blocks?: RecommendationBlocks;
  impact: string;
  impactValue?: number;
  feasibility: Feasibility;
  feasibilityLabel: string;
  category: 'pricing' | 'time' | 'payment' | 'model' | 'strategic';
  icon: string;
}

// Health Score breakdown for project health transparency
export interface HealthScoreBreakdown {
  total: number;
  isEvaluable: boolean; // False if minimal data is missing
  completenessPercent: number; // 0-100, how much data is available
  missingData: string[]; // List of missing data for UI
  components: {
    label: string;
    value: number;
    maxValue: number;
    description: string;
    hasData: boolean; // Whether this component has actual data
  }[];
}

export interface ProfitabilityAnalysis {
  projectId: string;
  projectName: string;
  metrics: ProfitabilityMetrics;
  recommendations: Recommendation[];
  healthScore: number; // 0-100, higher = healthier project
  healthScoreBreakdown: HealthScoreBreakdown;
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
  
  // Note: Le coût journalier cible vient UNIQUEMENT du TJM (projet ou global)
  // Plus de constante DEFAULT_INTERNAL_COST codée en dur
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
// Uses same logic as Dashboard: if billingStatus === 'paye', consider full budget as paid
export function calculateTotalPaid(project: Project, payments: ProjectPayment[]): number {
  // If project is marked as fully paid, consider full budget as received
  if (project.billingStatus === 'paye') {
    return parseFloat(project.budget?.toString() || '0');
  }
  // Otherwise, sum individual payments
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
  payments: ProjectPayment[],
  globalTJM?: number // TJM global from account settings
): ProfitabilityMetrics {
  // Time metrics
  const actualDaysWorked = calculateActualDays(timeEntries);
  const theoreticalDays = parseFloat(project.numberOfDays?.toString() || '0');
  const timeOverrun = theoreticalDays > 0 ? actualDaysWorked - theoreticalDays : 0;
  const timeOverrunPercent = theoreticalDays > 0 ? (timeOverrun / theoreticalDays) * 100 : 0;
  
  // For cost calculations: use actual days if available, otherwise fall back to theoretical days
  // This allows users to see estimated costs based on planned days when no time has been tracked yet
  const daysForCostCalculation = actualDaysWorked > 0 ? actualDaysWorked : theoreticalDays;
  
  // Financial metrics
  // totalBilled = Montant facturé (utilise project.totalBilled en priorité, puis project.budget comme fallback)
  // totalPaid = CA encaissé (uses same logic as Dashboard: if billingStatus='paye' => full budget)
  // Profitability calculations use totalBilled as revenue for theoretical margin
  const totalBilled = parseFloat(project.totalBilled?.toString() || project.budget?.toString() || '0');
  const totalPaid = calculateTotalPaid(project, payments);
  const remainingToPay = Math.max(0, totalBilled - totalPaid);
  const paymentProgress = totalBilled > 0 ? (totalPaid / totalBilled) * 100 : 0;
  
  // TJM metrics - Based on actual revenue received
  // Valeur / jour facturée = CA encaissé / jours passés (calculé a posteriori)
  const actualTJM = actualDaysWorked > 0 ? totalPaid / actualDaysWorked : 0;
  
  // Coût journalier cible - Hiérarchie :
  // 1. TJM projet (billingRate) si défini
  // 2. Pour les forfaits : budget / numberOfDays si les deux sont définis
  // 3. TJM global (paramètres) sinon
  const projectTJM = project.billingRate ? parseFloat(project.billingRate.toString()) : null;
  
  // Calculer le TJM effectif pour les projets au forfait (budget / jours)
  const forfaitTJM = (totalBilled > 0 && theoreticalDays > 0) 
    ? totalBilled / theoreticalDays 
    : null;
  
  // Appliquer la hiérarchie : billingRate > forfait calculé > global
  const targetTJM = projectTJM ?? forfaitTJM ?? (globalTJM && globalTJM > 0 ? globalTJM : 0);
  
  // Debug logging pour vérifier les valeurs
  console.log(`📊 PROFITABILITY [${project.name}]: projectTJM=${projectTJM}, forfaitTJM=${forfaitTJM}, globalTJM=${globalTJM}, targetTJM=${targetTJM}`);
  
  // Écart entre valeur/jour réelle et coût cible
  const tjmGap = targetTJM > 0 ? actualTJM - targetTJM : 0;
  const tjmGapPercent = targetTJM > 0 ? (tjmGap / targetTJM) * 100 : 0;
  
  // Profitability metrics - Based on billed amount (Montant facturé) for theoretical margin
  // Marge = Montant facturé - (Coût cible * jours)
  // Le coût cible est UNIQUEMENT le TJM cible (global ou projet) - jamais internalDailyCost du projet
  const internalDailyCost = targetTJM;
  // Use daysForCostCalculation which falls back to theoretical days when no time is tracked
  const totalCost = daysForCostCalculation * internalDailyCost;
  // Use totalBilled (montant facturé) instead of totalPaid (CA encaissé) for theoretical margin
  const margin = totalBilled - totalCost;
  const marginPercent = totalBilled > 0 ? (margin / totalBilled) * 100 : 0;
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

// ==========================================
// HEALTH SCORE CALCULATION
// Score de santé du projet basé sur 4 axes objectifs
// ==========================================

interface HealthScoreResult {
  score: number;
  breakdown: HealthScoreBreakdown;
}

export function calculateHealthScore(metrics: ProfitabilityMetrics): HealthScoreResult {
  const components: HealthScoreBreakdown['components'] = [];
  const missingData: string[] = [];
  
  // Detect available data
  const hasMarginData = metrics.totalBilled > 0 || metrics.totalPaid > 0 || metrics.actualDaysWorked > 0;
  const hasTJMData = metrics.targetTJM > 0;
  const hasPaymentData = metrics.totalBilled > 0;
  const hasTimeData = metrics.theoreticalDays > 0 && metrics.actualDaysWorked > 0;
  
  // Count available axes for completeness
  const dataAxes = [hasMarginData, hasTJMData, hasPaymentData, hasTimeData];
  const availableAxes = dataAxes.filter(Boolean).length;
  const completenessPercent = Math.round((availableAxes / 4) * 100);
  
  // Build missing data list
  if (!hasMarginData) missingData.push('Facturation ou temps de travail');
  if (!hasTJMData) missingData.push('TJM cible');
  if (!hasPaymentData) missingData.push('Facturation');
  if (!hasTimeData) missingData.push('Budget temps ou temps travaillé');
  
  // Project is evaluable if at least 2 data axes are present (50% minimum)
  const isEvaluable = availableAxes >= 2;
  
  // 1. Marge (0-30 points) - Plus la marge est haute, mieux c'est
  let marginScore = 0;
  if (hasMarginData) {
    if (metrics.marginPercent >= 30) {
      marginScore = 30;
    } else if (metrics.marginPercent >= 15) {
      marginScore = 20 + ((metrics.marginPercent - 15) / 15) * 10;
    } else if (metrics.marginPercent >= 0) {
      marginScore = 10 + (metrics.marginPercent / 15) * 10;
    } else if (metrics.marginPercent >= -20) {
      marginScore = Math.max(0, 10 + (metrics.marginPercent / 20) * 10);
    } else {
      marginScore = 0;
    }
  }
  // No data = 0 points (not neutral)
  
  components.push({
    label: 'Marge',
    value: Math.round(marginScore),
    maxValue: 30,
    hasData: hasMarginData,
    description: hasMarginData 
      ? (metrics.marginPercent >= 15 
          ? `Rentable (${metrics.marginPercent.toFixed(1)}%)`
          : metrics.marginPercent >= 0 
            ? `À risque (${metrics.marginPercent.toFixed(1)}%)`
            : `Déficitaire (${metrics.marginPercent.toFixed(1)}%)`)
      : 'Données manquantes'
  });
  
  // 2. TJM (0-25 points) - Écart par rapport au TJM cible
  let tjmScore = 0;
  if (hasTJMData) {
    if (metrics.tjmGapPercent >= 0) {
      tjmScore = 25;
    } else if (metrics.tjmGapPercent >= -10) {
      tjmScore = 20 + ((10 + metrics.tjmGapPercent) / 10) * 5;
    } else if (metrics.tjmGapPercent >= -25) {
      tjmScore = 10 + ((25 + metrics.tjmGapPercent) / 15) * 10;
    } else {
      tjmScore = Math.max(0, 10 + (metrics.tjmGapPercent + 25) / 25 * 10);
    }
  }
  // No TJM target = 0 points (not neutral)
  
  components.push({
    label: 'TJM effectif',
    value: Math.round(tjmScore),
    maxValue: 25,
    hasData: hasTJMData,
    description: hasTJMData
      ? (metrics.tjmGapPercent >= 0 
          ? `TJM atteint (${metrics.actualTJM.toLocaleString('fr-FR')} €/j)`
          : `TJM sous cible (${metrics.tjmGapPercent.toFixed(1)}%)`)
      : 'TJM cible non défini'
  });
  
  // 3. Encaissement (0-25 points) - Progression des paiements
  let paymentScore = 0;
  if (hasPaymentData) {
    if (metrics.paymentProgress >= 100) {
      paymentScore = 25;
    } else if (metrics.paymentProgress >= 75) {
      paymentScore = 20 + ((metrics.paymentProgress - 75) / 25) * 5;
    } else if (metrics.paymentProgress >= 50) {
      paymentScore = 15 + ((metrics.paymentProgress - 50) / 25) * 5;
    } else if (metrics.paymentProgress >= 25) {
      paymentScore = 10 + ((metrics.paymentProgress - 25) / 25) * 5;
    } else {
      paymentScore = (metrics.paymentProgress / 25) * 10;
    }
  }
  // No billing = 0 points (not neutral)
  
  components.push({
    label: 'Encaissement',
    value: Math.round(paymentScore),
    maxValue: 25,
    hasData: hasPaymentData,
    description: hasPaymentData
      ? (metrics.paymentProgress >= 100 
          ? 'Tout encaissé'
          : `${metrics.paymentProgress.toFixed(0)}% encaissé`)
      : 'Pas de facturation'
  });
  
  // 4. Dérive temps (0-20 points) - Respect du budget temps
  let timeScore = 0;
  if (hasTimeData) {
    if (metrics.timeOverrunPercent <= 0) {
      timeScore = 20;
    } else if (metrics.timeOverrunPercent <= 10) {
      timeScore = 15 + ((10 - metrics.timeOverrunPercent) / 10) * 5;
    } else if (metrics.timeOverrunPercent <= 25) {
      timeScore = 10 + ((25 - metrics.timeOverrunPercent) / 15) * 5;
    } else if (metrics.timeOverrunPercent <= 50) {
      timeScore = 5 + ((50 - metrics.timeOverrunPercent) / 25) * 5;
    } else {
      timeScore = Math.max(0, 5 - (metrics.timeOverrunPercent - 50) / 50 * 5);
    }
  }
  // No time budget = 0 points (not neutral)
  
  components.push({
    label: 'Respect temps',
    value: Math.round(timeScore),
    maxValue: 20,
    hasData: hasTimeData,
    description: hasTimeData
      ? (metrics.timeOverrunPercent <= 0 
          ? 'Dans les temps'
          : `Dépassement +${metrics.timeOverrunPercent.toFixed(0)}%`)
      : 'Budget temps non défini'
  });
  
  // Calculate weighted score based on available data
  // If not evaluable, score is 0
  let totalScore = 0;
  let maxPossibleScore = 0;
  
  if (isEvaluable) {
    // Sum actual scores and max scores for available axes only
    if (hasMarginData) {
      totalScore += marginScore;
      maxPossibleScore += 30;
    }
    if (hasTJMData) {
      totalScore += tjmScore;
      maxPossibleScore += 25;
    }
    if (hasPaymentData) {
      totalScore += paymentScore;
      maxPossibleScore += 25;
    }
    if (hasTimeData) {
      totalScore += timeScore;
      maxPossibleScore += 20;
    }
    
    // Normalize to 0-100 scale based on available data
    if (maxPossibleScore > 0) {
      totalScore = Math.round((totalScore / maxPossibleScore) * 100);
    }
  }
  
  return {
    score: isEvaluable ? Math.min(100, Math.max(0, totalScore)) : 0,
    breakdown: {
      total: totalScore,
      isEvaluable,
      completenessPercent,
      missingData,
      components
    }
  };
}

// ==========================================
// DECISION ENGINE - 4 AXES ANALYSIS
// ==========================================

// Axe A: Profitability status (already calculated in metrics.status)

// Axe B: Recovery capacity analysis
function analyzeRecoveryCapacity(metrics: ProfitabilityMetrics): RecoveryCapacity {
  // Calculate what percentage of theoretical budget is already consumed
  const budgetConsumedPercent = metrics.theoreticalDays > 0 
    ? (metrics.actualDaysWorked / metrics.theoreticalDays) * 100 
    : 0;
  
  // Amount needed to break even or reach target
  const amountToRecover = metrics.status === 'deficit' 
    ? Math.abs(metrics.margin) 
    : (metrics.targetMarginPercent / 100) * metrics.totalPaid - metrics.margin;
  
  // Check if recovery is realistic
  if (metrics.status === 'profitable') {
    return 'recoverable';
  }
  
  // If more than 80% of budget consumed and still deficit/at_risk
  if (budgetConsumedPercent > 80 && metrics.status === 'deficit') {
    return 'unrecoverable';
  }
  
  // If 50-80% consumed, difficult but possible
  if (budgetConsumedPercent > 50 && (metrics.status === 'deficit' || metrics.status === 'at_risk')) {
    return 'difficult';
  }
  
  // TJM gap analysis
  if (metrics.tjmGapPercent < -30) {
    return 'difficult';
  }
  
  return 'recoverable';
}

// Axe C: Project priority inference (fallback if not set)
function inferProjectPriority(project: Project): 'low' | 'normal' | 'high' | 'strategic' {
  // Use explicit priority if set
  if (project.priority && ['low', 'normal', 'high', 'strategic'].includes(project.priority)) {
    return project.priority as 'low' | 'normal' | 'high' | 'strategic';
  }
  
  // Fallback: infer from budget
  const budget = parseFloat(project.budget?.toString() || '0');
  
  if (budget >= 50000) return 'strategic';
  if (budget >= 20000) return 'high';
  if (budget >= 5000) return 'normal';
  return 'low';
}

// Axe D: Project dynamics analysis
function analyzeProjectDynamics(metrics: ProfitabilityMetrics, projectStage?: string): ProjectDynamics {
  // If project is finished, it's "advancing" (completed)
  if (projectStage === 'termine' || projectStage === 'livre') {
    return 'advancing';
  }
  
  // Calculate pace: compare actual progress vs expected
  const expectedProgress = metrics.theoreticalDays > 0 ? metrics.actualDaysWorked / metrics.theoreticalDays : 0;
  const paymentProgress = metrics.paymentProgress / 100;
  
  // If time consumed but low payment progress = dragging
  if (expectedProgress > 0.5 && paymentProgress < 0.3) {
    return 'dragging';
  }
  
  // If time significantly overrun = stagnating
  if (metrics.timeOverrunPercent > 25) {
    return 'stagnating';
  }
  
  return 'advancing';
}

// Axe E: Recommendation Horizon - Determines if action is possible on THIS project
interface HorizonResult {
  horizon: RecommendationHorizon;
  horizonInfo: HorizonInfo;
}

function determineProjectHorizon(projectStage?: string, metrics?: ProfitabilityMetrics): HorizonResult {
  // Normalize stage to lowercase for comparison
  const stage = (projectStage || '').toLowerCase();
  
  // LEARNING: Archived or cancelled projects - no action possible (check FIRST)
  const archivedStages = ['archive', 'archived', 'annule', 'annulé', 'cancelled', 'closed', 'abandonne', 'abandonné'];
  if (archivedStages.some(s => stage.includes(s))) {
    return { horizon: 'learning', horizonInfo: HORIZON_LABELS.learning };
  }
  
  // STRATEGIC: Completed, delivered, signed, paid projects - insights for future projects (check BEFORE immediate)
  // These are no longer actionable on the current project, regardless of payment status
  const completedStages = ['termine', 'completed', 'livre', 'delivered', 'signe', 'signed', 'paye', 'paid', 'facture', 'invoiced'];
  if (completedStages.some(s => stage.includes(s))) {
    return { horizon: 'strategic', horizonInfo: HORIZON_LABELS.strategic };
  }
  
  // IMMEDIATE: In-progress or prospection projects with payment not complete - action possible NOW
  const inProgressStages = ['en_cours', 'production', 'livraison_partielle', 'in_progress', 'ongoing', 'started', 'actif', 'active', 'prospection', 'prospect'];
  const isInProgress = inProgressStages.some(s => stage.includes(s)) || stage === '';
  const hasRemainingPayment = metrics ? metrics.paymentProgress < 100 : true;
  
  if (isInProgress && hasRemainingPayment) {
    return { horizon: 'immediate', horizonInfo: HORIZON_LABELS.immediate };
  }
  
  // Default to STRATEGIC: Prospect or other stages - insights for future projects
  return { horizon: 'strategic', horizonInfo: HORIZON_LABELS.strategic };
}

// Helper to calculate priority score with breakdown
interface PriorityScoreResult {
  score: number;
  breakdown: ScoreBreakdown;
}

function calculatePriorityScore(
  impactValue: number,
  priority: 'low' | 'normal' | 'high' | 'strategic',
  urgency: 'low' | 'medium' | 'high',
  feasibility: Feasibility,
  marginPercent?: number,
  recoveryCapacity?: RecoveryCapacity
): PriorityScoreResult {
  const components: ScoreBreakdown['components'] = [];
  
  // 1. Impact score (0-40 range) - clamped and normalized
  // Safe handling of negative or very large values
  const safeImpactValue = Math.max(0, impactValue);
  const rawImpact = safeImpactValue / 500;
  const impactScore = Math.min(40, Math.max(0, rawImpact));
  components.push({
    label: 'Impact financier',
    value: Math.round(impactScore),
    description: `${safeImpactValue.toLocaleString('fr-FR')} € potentiels`
  });
  
  // 2. Urgency score (0-25 range)
  const urgencyScores: Record<string, number> = { low: 5, medium: 15, high: 25 };
  const urgencyScore = urgencyScores[urgency] ?? 5;
  const urgencyDesc: Record<string, string> = { 
    low: 'Peut attendre', 
    medium: 'A traiter cette semaine', 
    high: 'Action requise sous 48h' 
  };
  components.push({
    label: 'Urgence',
    value: urgencyScore,
    description: urgencyDesc[urgency] ?? 'Non definie'
  });
  
  // 3. Project priority score (0-20 range)
  const priorityScores: Record<string, number> = { low: 3, normal: 10, high: 17, strategic: 20 };
  const priorityScore = priorityScores[priority] ?? 10;
  const priorityLabels: Record<string, string> = { 
    low: 'Priorite basse', 
    normal: 'Priorite normale', 
    high: 'Priorite haute', 
    strategic: 'Projet strategique' 
  };
  components.push({
    label: 'Priorite projet',
    value: priorityScore,
    description: priorityLabels[priority] ?? 'Priorite normale'
  });
  
  // 4. Margin status (0-10 range) - always reported
  let marginBonus = 0;
  let marginDesc = '';
  if (marginPercent !== undefined) {
    if (marginPercent < 0) {
      marginBonus = Math.min(10, Math.max(0, Math.abs(marginPercent) * 0.3));
      marginDesc = `Marge negative: ${marginPercent.toFixed(1)}%`;
    } else if (marginPercent < 15) {
      marginDesc = `Marge faible: ${marginPercent.toFixed(1)}%`;
    } else {
      marginDesc = `Marge saine: ${marginPercent.toFixed(1)}%`;
    }
  } else {
    marginDesc = 'Non evaluee';
  }
  components.push({
    label: 'Etat de la marge',
    value: Math.round(marginBonus),
    description: marginDesc
  });
  
  // 5. Recovery capacity (0-10 range) - always reported
  let recoveryBonus = 0;
  let recoveryDesc = '';
  if (recoveryCapacity === 'unrecoverable') {
    recoveryBonus = 10;
    recoveryDesc = 'Situation critique, action urgente';
  } else if (recoveryCapacity === 'difficult') {
    recoveryBonus = 5;
    recoveryDesc = 'Redressement possible mais difficile';
  } else {
    recoveryDesc = 'Rattrapage possible';
  }
  components.push({
    label: 'Capacite de redressement',
    value: recoveryBonus,
    description: recoveryDesc
  });
  
  // Calculate raw total before feasibility modifier
  const rawTotal = impactScore + urgencyScore + priorityScore + marginBonus + recoveryBonus;
  
  // 6. Feasibility modifier (reduces score if action is hard to implement) - always reported
  const feasibilityModifiers: Record<Feasibility, number> = { 
    realistic: 1.0, 
    discuss: 0.8, 
    unrealistic: 0.5 
  };
  const feasibilityMod = feasibilityModifiers[feasibility];
  const adjustedTotal = rawTotal * feasibilityMod;
  const feasibilityPenalty = Math.round(rawTotal - adjustedTotal);
  
  // Always report feasibility status
  const feasibilityLabels: Record<Feasibility, string> = {
    realistic: 'Action realisable',
    discuss: 'Necessite negociation',
    unrealistic: 'Mise en oeuvre complexe'
  };
  components.push({
    label: 'Faisabilite',
    value: feasibilityPenalty > 0 ? -feasibilityPenalty : 0,
    description: feasibilityLabels[feasibility]
  });
  
  // Final score clamped to 0-100
  const finalScore = Math.min(100, Math.max(0, Math.round(adjustedTotal)));
  
  return {
    score: finalScore,
    breakdown: {
      total: finalScore,
      components
    }
  };
}

// Decision type labels (action verb)
const DECISION_TYPE_LABELS: Record<DecisionType, string> = {
  optimize: 'Optimiser',
  accelerate: 'Accélérer',
  slowdown: 'Ralentir',
  stop: 'Stopper',
  protect: 'Protéger'
};

const FEASIBILITY_LABELS: Record<Feasibility, string> = {
  realistic: 'Réaliste',
  discuss: 'À discuter',
  unrealistic: 'Peu réaliste'
};

// Helper to determine decision label based on priority score and context
function getDecisionLabel(
  priorityScore: number, 
  marginPercent: number, 
  recoveryCapacity: RecoveryCapacity
): { decision: DecisionLabel; decisionInfo: DecisionLabelInfo } {
  // Critical: score >= 80 OR unrecoverable deficit
  if (priorityScore >= 80 || (marginPercent < -15 && recoveryCapacity === 'unrecoverable')) {
    return { decision: 'critical', decisionInfo: DECISION_LABELS.critical };
  }
  // Urgent: score 60-79 OR at_risk with difficult recovery
  if (priorityScore >= 60 || (marginPercent < 0 && recoveryCapacity === 'difficult')) {
    return { decision: 'urgent', decisionInfo: DECISION_LABELS.urgent };
  }
  // Plan: score 40-59
  if (priorityScore >= 40) {
    return { decision: 'plan', decisionInfo: DECISION_LABELS.plan };
  }
  // Insight: score 20-39
  if (priorityScore >= 20) {
    return { decision: 'insight', decisionInfo: DECISION_LABELS.insight };
  }
  // Healthy: score < 20
  return { decision: 'healthy', decisionInfo: DECISION_LABELS.healthy };
}

// ==========================================
// MAIN RECOMMENDATION ENGINE
// ==========================================
export function generateRecommendations(
  metrics: ProfitabilityMetrics, 
  projectStage?: string,
  projectData?: { priority?: string; budget?: string | number | null }
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  let recId = 1;
  
  // Analyze 5 axes
  const recoveryCapacity = analyzeRecoveryCapacity(metrics);
  const projectPriority = projectData 
    ? inferProjectPriority(projectData as Project)
    : 'normal';
  const dynamics = analyzeProjectDynamics(metrics, projectStage);
  
  // Axe E: Determine base horizon for this project
  const baseHorizon = determineProjectHorizon(projectStage, metrics);
  
  // Daily margin erosion cost
  const dailyMarginErosion = metrics.internalDailyCost;
  
  // ==========================================
  // TYPE 5: PROTECT (Strategic projects) - Check first
  // ==========================================
  if (projectPriority === 'strategic' && (metrics.status === 'deficit' || metrics.status === 'at_risk')) {
    const feasibility: Feasibility = 'discuss';
    const { score: priorityScore, breakdown: scoreBreakdown } = calculatePriorityScore(
      Math.abs(metrics.margin), projectPriority, 'high', feasibility, metrics.marginPercent, recoveryCapacity
    );
    
    const { decision, decisionInfo } = getDecisionLabel(priorityScore, metrics.marginPercent, recoveryCapacity);
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'high',
      priorityScore,
      scoreBreakdown,
      decisionType: 'protect',
      decisionLabel: DECISION_TYPE_LABELS.protect,
      decision,
      decisionInfo,
      horizon: baseHorizon.horizon,
      horizonInfo: baseHorizon.horizonInfo,
      issue: `Ce projet stratégique détruit actuellement de la valeur`,
      action: `Limitez strictement le périmètre. Chaque jour supplémentaire coûte ${dailyMarginErosion.toLocaleString('fr-FR')} €.`,
      blocks: {
        pastImpact: {
          amount: Math.abs(metrics.margin),
          condition: 'perte constatée à date',
          period: 'sur les jours déjà réalisés'
        },
        currentImplication: {
          isPast: false,
          message: 'Ce levier reste exploitable',
          actionableOn: ['périmètre restant', 'prochains projets']
        },
        concreteAction: {
          primary: `Limiter strictement le périmètre restant`,
          alternatives: ['Renégocier le budget', 'Réduire le temps restant']
        }
      },
      impact: `Préserver la relation client tout en limitant les pertes`,
      impactValue: Math.abs(metrics.margin),
      feasibility,
      feasibilityLabel: FEASIBILITY_LABELS[feasibility],
      category: 'strategic',
      icon: 'Shield',
    });
  }
  
  // ==========================================
  // TYPE 4: STOP / RENEGOCIATE
  // ==========================================
  if (
    metrics.status === 'deficit' && 
    recoveryCapacity === 'unrecoverable' && 
    projectPriority !== 'strategic'
  ) {
    const additionalLoss = metrics.internalDailyCost * 5; // 5 more days estimate
    const feasibility: Feasibility = 'discuss';
    const { score: priorityScore, breakdown: scoreBreakdown } = calculatePriorityScore(
      Math.abs(metrics.margin), projectPriority, 'high', feasibility, metrics.marginPercent, recoveryCapacity
    );
    
    const { decision, decisionInfo } = getDecisionLabel(priorityScore, metrics.marginPercent, recoveryCapacity);
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'high',
      priorityScore,
      scoreBreakdown,
      decisionType: 'stop',
      decisionLabel: DECISION_TYPE_LABELS.stop,
      decision,
      decisionInfo,
      horizon: baseHorizon.horizon,
      horizonInfo: baseHorizon.horizonInfo,
      issue: `Ce projet détruit actuellement de la valeur (${Math.abs(metrics.margin).toLocaleString('fr-FR')} € de perte)`,
      action: `Chaque jour supplémentaire augmente la perte de ${dailyMarginErosion.toLocaleString('fr-FR')} €. Renégociez ou clôturez rapidement.`,
      blocks: {
        pastImpact: {
          amount: Math.abs(metrics.margin),
          condition: 'perte cumulée à date',
          period: 'sur les jours déjà réalisés'
        },
        currentImplication: {
          isPast: false,
          message: 'Chaque jour supplémentaire aggrave la perte',
          actionableOn: ['clôture rapide', 'renégociation']
        },
        concreteAction: {
          primary: `Renégocier ou clôturer le projet`,
          alternatives: ['Facturer un avenant', 'Arrêter les travaux']
        }
      },
      impact: `Éviter ${additionalLoss.toLocaleString('fr-FR')} € de pertes supplémentaires`,
      impactValue: additionalLoss,
      feasibility,
      feasibilityLabel: FEASIBILITY_LABELS[feasibility],
      category: 'pricing',
      icon: 'StopCircle',
    });
  }
  
  // ==========================================
  // TYPE 3: SLOWDOWN / FREEZE
  // ==========================================
  else if (
    metrics.status === 'deficit' && 
    projectPriority === 'low' &&
    recoveryCapacity !== 'recoverable'
  ) {
    const potentialSavings = dailyMarginErosion * 3;
    const feasibility: Feasibility = 'realistic';
    const { score: priorityScore, breakdown: scoreBreakdown } = calculatePriorityScore(
      potentialSavings, projectPriority, 'medium', feasibility, metrics.marginPercent, recoveryCapacity
    );
    
    const { decision, decisionInfo } = getDecisionLabel(priorityScore, metrics.marginPercent, recoveryCapacity);
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'slowdown',
      decisionLabel: DECISION_TYPE_LABELS.slowdown,
      decision,
      decisionInfo,
      horizon: baseHorizon.horizon,
      horizonInfo: baseHorizon.horizonInfo,
      issue: `Chaque jour passé sur ce projet creuse la perte`,
      action: `Limitez l'effort. Chaque jour supplémentaire coûte ${dailyMarginErosion.toLocaleString('fr-FR')} €.`,
      blocks: {
        pastImpact: {
          amount: potentialSavings,
          condition: 'si l\'effort avait été réduit plus tôt',
          period: 'sur les 3 derniers jours'
        },
        currentImplication: {
          isPast: false,
          message: 'Ce levier reste exploitable sur le temps restant',
          actionableOn: ['jours restants', 'prochains projets']
        },
        concreteAction: {
          primary: `Limiter l'effort sur ce projet`,
          alternatives: ['Réduire le périmètre', 'Déléguer les tâches']
        }
      },
      impact: `Économiser jusqu'à ${potentialSavings.toLocaleString('fr-FR')} € en réduisant l'effort`,
      impactValue: potentialSavings,
      feasibility,
      feasibilityLabel: FEASIBILITY_LABELS[feasibility],
      category: 'time',
      icon: 'PauseCircle',
    });
  }
  
  // ==========================================
  // TYPE 2: ACCELERATE
  // ==========================================
  if (
    dynamics === 'dragging' && 
    (metrics.status === 'profitable' || recoveryCapacity === 'recoverable')
  ) {
    const feasibility: Feasibility = 'realistic';
    const { score: priorityScore, breakdown: scoreBreakdown } = calculatePriorityScore(
      metrics.remainingToPay, projectPriority, 'medium', feasibility, metrics.marginPercent, recoveryCapacity
    );
    
    const { decision, decisionInfo } = getDecisionLabel(priorityScore, metrics.marginPercent, recoveryCapacity);
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'accelerate',
      decisionLabel: DECISION_TYPE_LABELS.accelerate,
      decision,
      decisionInfo,
      horizon: baseHorizon.horizon,
      horizonInfo: baseHorizon.horizonInfo,
      issue: `Ce projet traîne et la marge s'érode progressivement`,
      action: `Accélérez pour limiter l'érosion. Chaque jour supplémentaire réduit la marge de ${dailyMarginErosion.toLocaleString('fr-FR')} €.`,
      blocks: {
        pastImpact: {
          amount: dailyMarginErosion * 2,
          condition: 'si le projet avait avancé plus vite',
          period: 'sur la semaine écoulée'
        },
        currentImplication: {
          isPast: false,
          message: 'Ce levier reste exploitable',
          actionableOn: ['jours restants', 'livraison rapide']
        },
        concreteAction: {
          primary: `Accélérer pour livrer plus vite`,
          alternatives: ['Augmenter les ressources', 'Simplifier le périmètre']
        }
      },
      impact: `Préserver ${dailyMarginErosion.toLocaleString('fr-FR')} € par jour gagné`,
      impactValue: dailyMarginErosion,
      feasibility,
      feasibilityLabel: FEASIBILITY_LABELS[feasibility],
      category: 'time',
      icon: 'Zap',
    });
  }
  
  // Accelerate for in-progress projects with remaining payment
  if (
    projectStage === 'en_cours' && 
    metrics.remainingToPay > 0 &&
    metrics.paymentProgress < 70
  ) {
    const feasibility: Feasibility = 'realistic';
    const { score: priorityScore, breakdown: scoreBreakdown } = calculatePriorityScore(
      metrics.remainingToPay, projectPriority, 'medium', feasibility, metrics.marginPercent, recoveryCapacity
    );
    
    // Only add if not already a dragging project recommendation
    if (dynamics !== 'dragging') {
      const { decision, decisionInfo } = getDecisionLabel(priorityScore, metrics.marginPercent, recoveryCapacity);
      recommendations.push({
        id: `rec-${recId++}`,
        priority: 'medium',
        priorityScore,
        scoreBreakdown,
        decisionType: 'accelerate',
        decisionLabel: DECISION_TYPE_LABELS.accelerate,
        decision,
        decisionInfo,
        horizon: baseHorizon.horizon,
        horizonInfo: baseHorizon.horizonInfo,
        issue: `${metrics.remainingToPay.toLocaleString('fr-FR')} € de facturation en attente`,
        action: `Accélérez pour clôturer et facturer le solde rapidement.`,
        blocks: {
          pastImpact: {
            amount: metrics.remainingToPay,
            condition: 'facturation bloquée',
            period: 'depuis le début du projet'
          },
          currentImplication: {
            isPast: false,
            message: 'Ce montant peut encore être facturé',
            actionableOn: ['clôture du projet', 'facturation intermédiaire']
          },
          concreteAction: {
            primary: `Clôturer et facturer le solde`,
            alternatives: ['Facturer un acompte', 'Relancer le client']
          }
        },
        impact: `Débloquer ${metrics.remainingToPay.toLocaleString('fr-FR')} € de facturation`,
        impactValue: metrics.remainingToPay,
        feasibility,
        feasibilityLabel: FEASIBILITY_LABELS[feasibility],
        category: 'time',
        icon: 'Clock',
      });
    }
  }
  
  // ==========================================
  // TYPE 1: OPTIMIZE
  // ==========================================
  // Optimize: Small margin gap, recoverable
  if (
    metrics.status === 'at_risk' && 
    recoveryCapacity === 'recoverable' &&
    metrics.marginPercent > 0
  ) {
    const marginGap = metrics.targetMarginPercent - metrics.marginPercent;
    const additionalNeeded = (marginGap / 100) * metrics.totalPaid;
    const daysToReduce = metrics.internalDailyCost > 0 ? additionalNeeded / metrics.internalDailyCost : 0;
    
    const feasibility: Feasibility = marginGap < 10 ? 'realistic' : 'discuss';
    const { score: priorityScore, breakdown: scoreBreakdown } = calculatePriorityScore(
      additionalNeeded, projectPriority, 'low', feasibility, metrics.marginPercent, recoveryCapacity
    );
    
    const { decision, decisionInfo } = getDecisionLabel(priorityScore, metrics.marginPercent, recoveryCapacity);
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'optimize',
      decisionLabel: DECISION_TYPE_LABELS.optimize,
      decision,
      decisionInfo,
      horizon: baseHorizon.horizon,
      horizonInfo: baseHorizon.horizonInfo,
      issue: `La marge actuelle (${metrics.marginPercent.toFixed(1)}%) est en-dessous de votre objectif`,
      action: `Facturez +${additionalNeeded.toLocaleString('fr-FR')} € ou réduisez de ${daysToReduce.toFixed(1)} jours.`,
      blocks: {
        pastImpact: {
          amount: additionalNeeded,
          condition: 'si la marge cible avait été atteinte',
          period: 'sur ce projet'
        },
        currentImplication: {
          isPast: false,
          message: 'Ce levier reste exploitable',
          actionableOn: ['facturation additionnelle', 'réduction du temps restant']
        },
        concreteAction: {
          primary: `Facturer ${additionalNeeded.toLocaleString('fr-FR')} € supplémentaires`,
          alternatives: [`Réduire de ${daysToReduce.toFixed(1)} jours`, 'Renégocier le périmètre']
        }
      },
      impact: `+${marginGap.toFixed(1)}% de marge`,
      impactValue: additionalNeeded,
      feasibility,
      feasibilityLabel: FEASIBILITY_LABELS[feasibility],
      category: 'pricing',
      icon: 'TrendingUp',
    });
  }
  
  // Optimize: TJM below target (for future projects)
  if (metrics.tjmGapPercent < THRESHOLDS.TJM_GAP_WARNING && metrics.targetTJM > 0) {
    const tjmDiff = Math.abs(metrics.tjmGap);
    const additionalRevenue = tjmDiff * metrics.actualDaysWorked;
    
    const feasibility: Feasibility = 'realistic';
    const urgency = metrics.tjmGapPercent < THRESHOLDS.TJM_GAP_CRITICAL ? 'high' : 'medium';
    const { score: priorityScore, breakdown: scoreBreakdown } = calculatePriorityScore(
      additionalRevenue, projectPriority, urgency, feasibility, metrics.marginPercent, recoveryCapacity
    );
    
    const { decision, decisionInfo } = getDecisionLabel(priorityScore, metrics.marginPercent, recoveryCapacity);
    recommendations.push({
      id: `rec-${recId++}`,
      priority: urgency === 'high' ? 'high' : 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'optimize',
      decisionLabel: DECISION_TYPE_LABELS.optimize,
      decision,
      decisionInfo,
      horizon: 'strategic',
      horizonInfo: HORIZON_LABELS.strategic,
      issue: `Votre TJM réel (${metrics.actualTJM.toLocaleString('fr-FR')} €) est sous le cible`,
      action: `Augmentez votre TJM de ${tjmDiff.toLocaleString('fr-FR')} € pour les prochains projets.`,
      blocks: {
        pastImpact: {
          amount: additionalRevenue,
          condition: 'si le TJM cible avait été appliqué',
          period: 'sur ce projet'
        },
        currentImplication: {
          isPast: true,
          message: 'Ce levier n\'est plus exploitable sur ce projet',
          actionableOn: ['prochains projets', 'renégociations futures']
        },
        concreteAction: {
          primary: `Appliquer le TJM cible sur les prochains projets`,
          alternatives: ['Négocier des avenants', 'Revoir la grille tarifaire']
        }
      },
      impact: `+${additionalRevenue.toLocaleString('fr-FR')} € si TJM cible était appliqué`,
      impactValue: additionalRevenue,
      feasibility,
      feasibilityLabel: FEASIBILITY_LABELS[feasibility],
      category: 'pricing',
      icon: 'DollarSign',
    });
  }
  
  // Optimize: Payment collection (finished projects)
  if (
    (projectStage === 'termine' || projectStage === 'livre') && 
    metrics.remainingToPay > 0 &&
    metrics.paymentProgress < 70
  ) {
    const feasibility: Feasibility = 'realistic';
    const { score: priorityScore, breakdown: scoreBreakdown } = calculatePriorityScore(
      metrics.remainingToPay, projectPriority, 'medium', feasibility, metrics.marginPercent, recoveryCapacity
    );
    
    const { decision, decisionInfo } = getDecisionLabel(priorityScore, metrics.marginPercent, recoveryCapacity);
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'optimize',
      decisionLabel: DECISION_TYPE_LABELS.optimize,
      decision,
      decisionInfo,
      horizon: baseHorizon.horizon,
      horizonInfo: baseHorizon.horizonInfo,
      issue: `${metrics.remainingToPay.toLocaleString('fr-FR')} € de facturation non encaissée`,
      action: `Relancez le client pour récupérer ce montant rapidement.`,
      blocks: {
        pastImpact: {
          amount: metrics.remainingToPay,
          condition: 'facturation réalisée mais non encaissée',
          period: 'depuis la livraison'
        },
        currentImplication: {
          isPast: false,
          message: 'Ce montant peut encore être récupéré',
          actionableOn: ['relance client', 'mise en demeure']
        },
        concreteAction: {
          primary: `Relancer le client pour encaissement`,
          alternatives: ['Envoyer un rappel', 'Contacter par téléphone']
        }
      },
      impact: `Récupérer ${metrics.remainingToPay.toLocaleString('fr-FR')} € de trésorerie`,
      impactValue: metrics.remainingToPay,
      feasibility,
      feasibilityLabel: FEASIBILITY_LABELS[feasibility],
      category: 'payment',
      icon: 'CreditCard',
    });
  }
  
  // ==========================================
  // POSITIVE REINFORCEMENT
  // ==========================================
  if (metrics.status === 'profitable' && recommendations.length === 0) {
    const { decision, decisionInfo } = getDecisionLabel(10, metrics.marginPercent, recoveryCapacity);
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'low',
      priorityScore: 10,
      scoreBreakdown: {
        total: 10,
        components: [
          { label: 'Projet rentable', value: 10, description: `Marge de ${metrics.marginPercent.toFixed(1)}%` }
        ]
      },
      decisionType: 'optimize',
      decisionLabel: DECISION_TYPE_LABELS.optimize,
      decision,
      decisionInfo,
      horizon: 'strategic',
      horizonInfo: HORIZON_LABELS.strategic,
      issue: `Ce projet est rentable avec ${metrics.marginPercent.toFixed(1)}% de marge`,
      action: `Documentez les bonnes pratiques pour les reproduire.`,
      blocks: {
        pastImpact: {
          amount: 0,
          condition: 'aucune perte',
          period: 'sur ce projet'
        },
        currentImplication: {
          isPast: false,
          message: 'Projet performant - à reproduire',
          actionableOn: ['prochains projets', 'bonnes pratiques']
        },
        concreteAction: {
          primary: `Documenter les bonnes pratiques`,
          alternatives: ['Répliquer sur d\'autres projets', 'Partager avec l\'équipe']
        }
      },
      impact: `Maintenir une marge supérieure à ${THRESHOLDS.PROFITABLE_MARGIN}%`,
      feasibility: 'realistic',
      feasibilityLabel: FEASIBILITY_LABELS.realistic,
      category: 'pricing',
      icon: 'CheckCircle',
    });
  }
  
  // ==========================================
  // SORT BY PRIORITY SCORE (higher = more urgent)
  // ==========================================
  recommendations.sort((a, b) => b.priorityScore - a.priorityScore);
  
  return recommendations;
}

// Main function to generate full analysis
export function generateProfitabilityAnalysis(
  project: Project,
  timeEntries: TimeEntry[],
  payments: ProjectPayment[],
  globalTJM?: number // TJM global from account settings
): ProfitabilityAnalysis {
  const metrics = calculateMetrics(project, timeEntries, payments, globalTJM);
  const recommendations = generateRecommendations(
    metrics, 
    project.stage || undefined,
    { priority: project.priority || undefined, budget: project.budget }
  );
  
  // Calculate Health Score (objective project health)
  const healthScoreResult = calculateHealthScore(metrics);
  
  return {
    projectId: project.id,
    projectName: project.name,
    metrics,
    recommendations,
    healthScore: healthScoreResult.score,
    healthScoreBreakdown: healthScoreResult.breakdown,
    generatedAt: new Date().toISOString(),
  };
}
