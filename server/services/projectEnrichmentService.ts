/**
 * Project Enrichment Service
 * Automatically infers project configuration based on category, client, and user profile
 * No form changes required - enrichment happens in the background
 */

// Project type inference based on category keywords
const PROJECT_TYPE_MAPPINGS: Record<string, { keywords: string[]; billingMode: string; phases: string[]; scopeTypes: string[]; pilotingStrategy: string }> = {
  dev_saas: {
    keywords: ['saas', 'logiciel', 'plateforme', 'application', 'app', 'web', 'développement', 'dev', 'software', 'api'],
    billingMode: 'forfait',
    phases: ['T1', 'T2', 'T3', 'T4', 'LT'],
    scopeTypes: ['functional', 'technical', 'design', 'gestion'],
    pilotingStrategy: 'temps_critique',
  },
  design: {
    keywords: ['design', 'graphisme', 'ui', 'ux', 'identité', 'branding', 'logo', 'charte', 'visuel', 'création'],
    billingMode: 'forfait',
    phases: ['T1', 'T2', 'LT'],
    scopeTypes: ['design', 'functional', 'gestion'],
    pilotingStrategy: 'equilibre',
  },
  conseil: {
    keywords: ['conseil', 'consulting', 'stratégie', 'audit', 'accompagnement', 'formation', 'coaching', 'atelier'],
    billingMode: 'regie',
    phases: ['T1', 'LT'],
    scopeTypes: ['gestion', 'functional'],
    pilotingStrategy: 'marge_critique',
  },
  ecommerce: {
    keywords: ['ecommerce', 'e-commerce', 'boutique', 'shop', 'magasin', 'vente', 'commerce', 'shopify', 'prestashop'],
    billingMode: 'forfait',
    phases: ['T1', 'T2', 'T3', 'LT'],
    scopeTypes: ['functional', 'technical', 'design', 'gestion'],
    pilotingStrategy: 'temps_critique',
  },
  site_vitrine: {
    keywords: ['site', 'vitrine', 'wordpress', 'landing', 'page', 'web'],
    billingMode: 'forfait',
    phases: ['T1', 'T2', 'LT'],
    scopeTypes: ['design', 'functional', 'technical'],
    pilotingStrategy: 'equilibre',
  },
  integration: {
    keywords: ['intégration', 'api', 'connecteur', 'synchronisation', 'migration', 'import', 'export'],
    billingMode: 'mixte',
    phases: ['T1', 'T2', 'T3', 'LT'],
    scopeTypes: ['technical', 'functional', 'gestion'],
    pilotingStrategy: 'temps_critique',
  },
  formation: {
    keywords: ['formation', 'training', 'cours', 'atelier', 'workshop', 'apprentissage'],
    billingMode: 'regie',
    phases: ['T1', 'LT'],
    scopeTypes: ['gestion', 'functional'],
    pilotingStrategy: 'marge_critique',
  },
  cpo: {
    keywords: ['cpo', 'product', 'produit', 'roadmap', 'backlog', 'scrum', 'agile', 'part time', 'part-time'],
    billingMode: 'regie',
    phases: ['T1', 'T2', 'T3', 'T4', 'LT'],
    scopeTypes: ['functional', 'gestion', 'technical'],
    pilotingStrategy: 'equilibre',
  },
};

// Default configuration when no match is found
const DEFAULT_CONFIG = {
  projectType: 'autre',
  billingMode: 'forfait',
  phases: ['T1', 'T2', 'T3', 'T4', 'LT'],
  scopeTypes: ['functional', 'technical', 'design', 'gestion'],
  pilotingStrategy: 'equilibre',
};

export interface ProjectEnrichmentResult {
  projectTypeInferred: string;
  billingModeSuggested: string;
  expectedPhases: string[];
  expectedScopeTypes: string[];
  pilotingStrategy: string;
}

/**
 * Infer project configuration based on project name and category
 */
export function inferProjectConfiguration(
  projectName: string,
  category: string | null | undefined
): ProjectEnrichmentResult {
  const searchText = `${projectName || ''} ${category || ''}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  
  // Find matching project type based on keywords
  let bestMatch: { type: string; score: number } = { type: 'autre', score: 0 };
  
  for (const [projectType, config] of Object.entries(PROJECT_TYPE_MAPPINGS)) {
    let score = 0;
    for (const keyword of config.keywords) {
      const normalizedKeyword = keyword.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if (searchText.includes(normalizedKeyword)) {
        // Weight by keyword specificity (longer keywords are more specific)
        score += keyword.length;
      }
    }
    
    if (score > bestMatch.score) {
      bestMatch = { type: projectType, score };
    }
  }
  
  // Return configuration based on best match
  if (bestMatch.score > 0) {
    const config = PROJECT_TYPE_MAPPINGS[bestMatch.type];
    return {
      projectTypeInferred: bestMatch.type,
      billingModeSuggested: config.billingMode,
      expectedPhases: config.phases,
      expectedScopeTypes: config.scopeTypes,
      pilotingStrategy: config.pilotingStrategy,
    };
  }
  
  // Return default configuration
  return {
    projectTypeInferred: DEFAULT_CONFIG.projectType,
    billingModeSuggested: DEFAULT_CONFIG.billingMode,
    expectedPhases: DEFAULT_CONFIG.phases,
    expectedScopeTypes: DEFAULT_CONFIG.scopeTypes,
    pilotingStrategy: DEFAULT_CONFIG.pilotingStrategy,
  };
}

/**
 * Get human-readable label for project type
 */
export function getProjectTypeLabel(projectType: string): string {
  const labels: Record<string, string> = {
    dev_saas: 'Développement SaaS',
    design: 'Design & Graphisme',
    conseil: 'Conseil & Accompagnement',
    ecommerce: 'E-commerce',
    site_vitrine: 'Site Vitrine',
    integration: 'Intégration & API',
    formation: 'Formation',
    cpo: 'Product Management',
    autre: 'Autre',
  };
  return labels[projectType] || 'Autre';
}

/**
 * Get human-readable label for billing mode
 */
export function getBillingModeLabel(billingMode: string): string {
  const labels: Record<string, string> = {
    forfait: 'Forfait (prix fixe)',
    regie: 'Régie (temps passé)',
    mixte: 'Mixte (forfait + régie)',
  };
  return labels[billingMode] || billingMode;
}

/**
 * Get human-readable label for piloting strategy
 */
export function getPilotingStrategyLabel(strategy: string): string {
  const labels: Record<string, string> = {
    temps_critique: 'Temps critique (livraison prioritaire)',
    marge_critique: 'Marge critique (rentabilité prioritaire)',
    equilibre: 'Équilibre (temps & marge)',
  };
  return labels[strategy] || strategy;
}
