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

// Score breakdown for transparency
export interface ScoreBreakdown {
  total: number;
  components: {
    label: string;
    value: number;
    description: string;
  }[];
}

export interface Recommendation {
  id: string;
  priority: 'high' | 'medium' | 'low';
  priorityScore: number; // Numeric score for sorting (higher = more urgent)
  scoreBreakdown: ScoreBreakdown; // Detailed breakdown for UI transparency
  decisionType: DecisionType;
  decisionLabel: string; // "Optimiser", "Accélérer", "Ralentir", "Stopper", "Protéger"
  issue: string; // "Pourquoi"
  action: string; // Action recommandée
  impact: string;
  impactValue?: number;
  feasibility: Feasibility;
  feasibilityLabel: string;
  category: 'pricing' | 'time' | 'payment' | 'model' | 'strategic';
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
  payments: ProjectPayment[]
): ProfitabilityMetrics {
  // Time metrics
  const actualDaysWorked = calculateActualDays(timeEntries);
  const theoreticalDays = parseFloat(project.numberOfDays?.toString() || '0');
  const timeOverrun = theoreticalDays > 0 ? actualDaysWorked - theoreticalDays : 0;
  const timeOverrunPercent = theoreticalDays > 0 ? (timeOverrun / theoreticalDays) * 100 : 0;
  
  // Financial metrics
  // totalBilled = CA facturé (utilise project.budget comme source de vérité)
  // totalPaid = CA encaissé (uses same logic as Dashboard: if billingStatus='paye' => full budget)
  // Profitability calculations use totalPaid as revenue (CA encaissé)
  const totalBilled = parseFloat(project.budget?.toString() || '0');
  const totalPaid = calculateTotalPaid(project, payments);
  const remainingToPay = Math.max(0, totalBilled - totalPaid);
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

// Decision type labels
const DECISION_LABELS: Record<DecisionType, string> = {
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
  
  // Analyze 4 axes
  const recoveryCapacity = analyzeRecoveryCapacity(metrics);
  const projectPriority = projectData 
    ? inferProjectPriority(projectData as Project)
    : 'normal';
  const dynamics = analyzeProjectDynamics(metrics, projectStage);
  
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
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'high',
      priorityScore,
      scoreBreakdown,
      decisionType: 'protect',
      decisionLabel: DECISION_LABELS.protect,
      issue: `Ce projet stratégique détruit actuellement de la valeur`,
      action: `Limitez strictement le périmètre. Chaque jour supplémentaire coûte ${dailyMarginErosion.toLocaleString('fr-FR')} €.`,
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
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'high',
      priorityScore,
      scoreBreakdown,
      decisionType: 'stop',
      decisionLabel: DECISION_LABELS.stop,
      issue: `Ce projet détruit actuellement de la valeur (${Math.abs(metrics.margin).toLocaleString('fr-FR')} € de perte)`,
      action: `Chaque jour supplémentaire augmente la perte de ${dailyMarginErosion.toLocaleString('fr-FR')} €. Renégociez ou clôturez rapidement.`,
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
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'slowdown',
      decisionLabel: DECISION_LABELS.slowdown,
      issue: `Chaque jour passé sur ce projet creuse la perte`,
      action: `Limitez l'effort. Chaque jour supplémentaire coûte ${dailyMarginErosion.toLocaleString('fr-FR')} €.`,
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
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'accelerate',
      decisionLabel: DECISION_LABELS.accelerate,
      issue: `Ce projet traîne et la marge s'érode progressivement`,
      action: `Accélérez pour limiter l'érosion. Chaque jour supplémentaire réduit la marge de ${dailyMarginErosion.toLocaleString('fr-FR')} €.`,
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
      recommendations.push({
        id: `rec-${recId++}`,
        priority: 'medium',
        priorityScore,
        scoreBreakdown,
        decisionType: 'accelerate',
        decisionLabel: DECISION_LABELS.accelerate,
        issue: `${metrics.remainingToPay.toLocaleString('fr-FR')} € de facturation en attente`,
        action: `Accélérez pour clôturer et facturer le solde rapidement.`,
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
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'optimize',
      decisionLabel: DECISION_LABELS.optimize,
      issue: `La marge actuelle (${metrics.marginPercent.toFixed(1)}%) est en-dessous de votre objectif`,
      action: `Facturez +${additionalNeeded.toLocaleString('fr-FR')} € ou réduisez de ${daysToReduce.toFixed(1)} jours.`,
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
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: urgency === 'high' ? 'high' : 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'optimize',
      decisionLabel: DECISION_LABELS.optimize,
      issue: `Votre TJM réel (${metrics.actualTJM.toLocaleString('fr-FR')} €) est sous le cible`,
      action: `Augmentez votre TJM de ${tjmDiff.toLocaleString('fr-FR')} € pour les prochains projets.`,
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
    
    recommendations.push({
      id: `rec-${recId++}`,
      priority: 'medium',
      priorityScore,
      scoreBreakdown,
      decisionType: 'optimize',
      decisionLabel: DECISION_LABELS.optimize,
      issue: `${metrics.remainingToPay.toLocaleString('fr-FR')} € de facturation non encaissée`,
      action: `Relancez le client pour récupérer ce montant rapidement.`,
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
      decisionLabel: 'Continuer',
      issue: `Ce projet est rentable avec ${metrics.marginPercent.toFixed(1)}% de marge`,
      action: `Documentez les bonnes pratiques pour les reproduire.`,
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
  payments: ProjectPayment[]
): ProfitabilityAnalysis {
  const metrics = calculateMetrics(project, timeEntries, payments);
  const recommendations = generateRecommendations(
    metrics, 
    project.stage || undefined,
    { priority: project.priority || undefined, budget: project.budget }
  );
  
  return {
    projectId: project.id,
    projectName: project.name,
    metrics,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}
