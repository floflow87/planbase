export const USER_PROFILE_TYPES = [
  'freelance',
  'designer',
  'pm',
  'project_manager',
  'cto',
  'developer',
] as const;

export type UserProfileType = typeof USER_PROFILE_TYPES[number];

export interface UserProfileConfig {
  id: UserProfileType;
  label: string;
  description: string;
  icon: string;
  transitionTitle: string;
  transitionDescription: string;
  projectFields: ProfileProjectField[];
}

export interface ProfileProjectField {
  id: string;
  label: string;
  placeholder: string;
  type: 'text' | 'textarea' | 'number' | 'select';
  options?: string[];
}

export const USER_PROFILES: UserProfileConfig[] = [
  {
    id: 'designer',
    label: 'Designer',
    description: 'Je conçois des interfaces, des identités ou des expériences. Je travaille par phases créatives, itérations et livrables.',
    icon: 'Palette',
    transitionTitle: 'Structurons ton premier projet créatif',
    transitionDescription: 'On va poser les grandes phases, les livrables et t\'aider à garder une vision claire du temps passé.',
    projectFields: [
      { id: 'phases', label: 'Phases créatives', placeholder: 'Ex: Recherche, Conception, Itérations, Livraison', type: 'textarea' },
      { id: 'deliverables', label: 'Livrables attendus', placeholder: 'Ex: Maquettes, Charte graphique, Prototypes', type: 'textarea' },
    ],
  },
  {
    id: 'project_manager',
    label: 'Chargé·e de projet',
    description: 'Je coordonne des projets, des équipes et des délais. Mon objectif est de livrer dans les temps et d\'anticiper les risques.',
    icon: 'FolderKanban',
    transitionTitle: 'Créons ton premier projet',
    transitionDescription: 'On commence par le cadre : périmètre, délais et points de vigilance.',
    projectFields: [
      { id: 'milestones', label: 'Jalons principaux', placeholder: 'Ex: Kick-off, Livraison v1, Recette finale', type: 'textarea' },
      { id: 'constraints', label: 'Contraintes de planning', placeholder: 'Ex: Deadline client, dépendances équipes', type: 'textarea' },
      { id: 'stakeholders', label: 'Parties prenantes', placeholder: 'Ex: Client, équipe dev, direction', type: 'textarea' },
    ],
  },
  {
    id: 'pm',
    label: 'Product Owner / PM',
    description: 'Je définis la vision produit, priorise le backlog et arbitre le périmètre pour maximiser la valeur.',
    icon: 'Target',
    transitionTitle: 'Lançons ton premier projet produit',
    transitionDescription: 'On va poser la vision, les objectifs et les premières hypothèses.',
    projectFields: [
      { id: 'vision', label: 'Vision produit', placeholder: 'Décris en une phrase ce que tu veux accomplir', type: 'textarea' },
      { id: 'objectives', label: 'Objectifs business', placeholder: 'Ex: Augmenter le taux de conversion, réduire le churn', type: 'textarea' },
      { id: 'hypotheses', label: 'Hypothèses clés', placeholder: 'Ex: Les utilisateurs veulent X, Y améliore Z', type: 'textarea' },
    ],
  },
  {
    id: 'cto',
    label: 'CTO / Tech Lead',
    description: 'Je pilote les choix techniques, l\'architecture et la dette. Je sécurise la delivery et la scalabilité.',
    icon: 'Code',
    transitionTitle: 'Structurons ton premier projet technique',
    transitionDescription: 'On va poser les contraintes, l\'architecture et les zones de risque.',
    projectFields: [
      { id: 'techConstraints', label: 'Contraintes techniques', placeholder: 'Ex: Stack imposée, intégrations, performance', type: 'textarea' },
      { id: 'infrastructure', label: 'Infra / dette', placeholder: 'Ex: Migration cloud, refactoring, CI/CD', type: 'textarea' },
      { id: 'risks', label: 'Zones de risque', placeholder: 'Ex: Scalabilité, sécurité, dépendances', type: 'textarea' },
    ],
  },
  {
    id: 'developer',
    label: 'Développeur·se',
    description: 'Je développe des fonctionnalités, corrige des bugs et contribue au produit au quotidien.',
    icon: 'Terminal',
    transitionTitle: 'Créons ton premier projet de dev',
    transitionDescription: 'On va poser les bases pour suivre tes tâches et ton temps.',
    projectFields: [
      { id: 'techStack', label: 'Stack technique', placeholder: 'Ex: React, Node.js, PostgreSQL', type: 'text' },
      { id: 'mainFeatures', label: 'Fonctionnalités principales', placeholder: 'Ex: Auth, Dashboard, API', type: 'textarea' },
    ],
  },
  {
    id: 'freelance',
    label: 'Freelance (vision complète)',
    description: 'Je gère mes projets de bout en bout : production, temps, facturation et rentabilité.',
    icon: 'Briefcase',
    transitionTitle: 'Créons ton premier projet client',
    transitionDescription: 'On va poser les bases pour suivre le temps, le budget et la rentabilité.',
    projectFields: [
      { id: 'budget', label: 'Budget cible', placeholder: 'Ex: 5000€', type: 'number' },
      { id: 'tjm', label: 'TJM', placeholder: 'Ex: 500€/jour', type: 'number' },
      { id: 'marginTarget', label: 'Objectif de marge', placeholder: 'Ex: 30%', type: 'text' },
    ],
  },
];

export type DashboardBlockId = 'kpis' | 'priorityAction' | 'revenueChart' | 'activityFeed' | 'recentProjects' | 'myDay' | 'recentNotes' | 'recentBacklog';

export interface ProfileDashboardConfig {
  visibleBlocks: DashboardBlockId[];
  blockOrder: DashboardBlockId[];
}

export const DASHBOARD_CONFIG_BY_PROFILE: Record<UserProfileType, ProfileDashboardConfig> = {
  freelance: {
    visibleBlocks: ['kpis', 'priorityAction', 'revenueChart', 'activityFeed', 'recentProjects', 'myDay', 'recentNotes', 'recentBacklog'],
    blockOrder: ['kpis', 'priorityAction', 'revenueChart', 'activityFeed', 'recentProjects', 'myDay', 'recentNotes', 'recentBacklog'],
  },
  designer: {
    visibleBlocks: ['kpis', 'recentProjects', 'myDay', 'recentNotes', 'activityFeed'],
    blockOrder: ['kpis', 'recentProjects', 'myDay', 'recentNotes', 'activityFeed', 'priorityAction', 'revenueChart', 'recentBacklog'],
  },
  pm: {
    visibleBlocks: ['kpis', 'recentBacklog', 'priorityAction', 'recentProjects', 'activityFeed'],
    blockOrder: ['kpis', 'recentBacklog', 'priorityAction', 'recentProjects', 'activityFeed', 'myDay', 'revenueChart', 'recentNotes'],
  },
  project_manager: {
    visibleBlocks: ['kpis', 'priorityAction', 'recentProjects', 'myDay', 'activityFeed'],
    blockOrder: ['kpis', 'priorityAction', 'recentProjects', 'myDay', 'activityFeed', 'revenueChart', 'recentNotes', 'recentBacklog'],
  },
  cto: {
    visibleBlocks: ['kpis', 'recentBacklog', 'myDay', 'priorityAction', 'recentProjects'],
    blockOrder: ['kpis', 'recentBacklog', 'myDay', 'priorityAction', 'recentProjects', 'activityFeed', 'revenueChart', 'recentNotes'],
  },
  developer: {
    visibleBlocks: ['kpis', 'myDay', 'recentProjects', 'recentNotes', 'activityFeed'],
    blockOrder: ['kpis', 'myDay', 'recentProjects', 'recentNotes', 'activityFeed', 'priorityAction', 'revenueChart', 'recentBacklog'],
  },
};

export function getProfileLabel(profileType: UserProfileType | undefined | null): string {
  if (!profileType) return 'Non défini';
  const profile = USER_PROFILES.find(p => p.id === profileType);
  return profile?.label || 'Non défini';
}

export function getProfileById(profileType: UserProfileType): UserProfileConfig | undefined {
  return USER_PROFILES.find(p => p.id === profileType);
}
