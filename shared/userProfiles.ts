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
}

export const USER_PROFILES: UserProfileConfig[] = [
  {
    id: 'freelance',
    label: 'Freelance',
    description: 'Vision complète : tous les outils pour gérer ton activité',
    icon: 'Briefcase',
  },
  {
    id: 'designer',
    label: 'Designer',
    description: 'Focus sur les projets créatifs et le suivi du temps',
    icon: 'Palette',
  },
  {
    id: 'pm',
    label: 'Product Owner / PM',
    description: 'Backlog, roadmap et pilotage produit',
    icon: 'Target',
  },
  {
    id: 'project_manager',
    label: 'Chargé·e de projet',
    description: 'Suivi des projets, alertes et coordination',
    icon: 'FolderKanban',
  },
  {
    id: 'cto',
    label: 'CTO / Tech Lead',
    description: 'Vision technique et suivi des équipes',
    icon: 'Code',
  },
  {
    id: 'developer',
    label: 'Développeur·se',
    description: 'Tâches, temps et notes au quotidien',
    icon: 'Terminal',
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
