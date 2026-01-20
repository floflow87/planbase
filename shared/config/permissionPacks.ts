import type { RbacModule, RbacAction, Subview } from '../schema';

export interface PermissionPackEntry {
  module: RbacModule;
  actions: RbacAction[];
  subviews?: string[];
}

export interface PermissionPack {
  id: string;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
  permissions: PermissionPackEntry[];
  defaultSubviews: Record<string, string[]>;
}

export const PERMISSION_PACKS: PermissionPack[] = [
  {
    id: 'admin',
    name: 'Administrateur',
    nameEn: 'Administrator',
    description: 'Accès complet à tous les modules avec droits de gestion',
    descriptionEn: 'Full access to all modules with management rights',
    icon: 'shield',
    permissions: [
      { module: 'crm', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'projects', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'product', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'roadmap', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'tasks', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'notes', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'documents', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'profitability', actions: ['read', 'create', 'update', 'delete'] },
    ],
    defaultSubviews: {
      crm: ['crm.clients', 'crm.opportunities', 'crm.kpis'],
      product: ['product.backlog', 'product.epics', 'product.stats', 'product.retrospective', 'product.recipe'],
      profitability: ['profitability.overview', 'profitability.byProject', 'profitability.simulations', 'profitability.resources'],
      documents: ['documents.list', 'documents.upload', 'documents.integrations'],
      roadmap: ['roadmap.gantt', 'roadmap.output', 'roadmap.okr', 'roadmap.tree'],
      projects: ['projects.list', 'projects.details', 'projects.scope', 'projects.billing'],
    },
  },
  {
    id: 'member',
    name: 'Membre standard',
    nameEn: 'Standard Member',
    description: 'Accès complet en lecture/écriture sur les modules opérationnels',
    descriptionEn: 'Full read/write access on operational modules',
    icon: 'user',
    permissions: [
      { module: 'crm', actions: ['read', 'create', 'update'] },
      { module: 'projects', actions: ['read', 'create', 'update'] },
      { module: 'product', actions: ['read', 'create', 'update'] },
      { module: 'roadmap', actions: ['read', 'create', 'update'] },
      { module: 'tasks', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'notes', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'documents', actions: ['read', 'create', 'update'] },
      { module: 'profitability', actions: ['read'] },
    ],
    defaultSubviews: {
      crm: ['crm.clients', 'crm.opportunities', 'crm.kpis'],
      product: ['product.backlog', 'product.epics', 'product.stats', 'product.retrospective', 'product.recipe'],
      profitability: ['profitability.overview', 'profitability.byProject'],
      documents: ['documents.list', 'documents.upload'],
      roadmap: ['roadmap.gantt', 'roadmap.output', 'roadmap.okr', 'roadmap.tree'],
      projects: ['projects.list', 'projects.details', 'projects.scope'],
    },
  },
  {
    id: 'guest',
    name: 'Invité (lecture seule)',
    nameEn: 'Guest (Read-only)',
    description: 'Accès en lecture seule aux modules de base',
    descriptionEn: 'Read-only access to basic modules',
    icon: 'eye',
    permissions: [
      { module: 'projects', actions: ['read'] },
      { module: 'roadmap', actions: ['read'] },
      { module: 'tasks', actions: ['read'] },
      { module: 'notes', actions: ['read'] },
      { module: 'documents', actions: ['read'] },
    ],
    defaultSubviews: {
      projects: ['projects.list', 'projects.details'],
      roadmap: ['roadmap.output'],
      documents: ['documents.list'],
    },
  },
  {
    id: 'client_portal',
    name: 'Portail Client',
    nameEn: 'Client Portal',
    description: 'Accès client restreint aux projets autorisés uniquement',
    descriptionEn: 'Restricted client access to authorized projects only',
    icon: 'building',
    permissions: [
      { module: 'projects', actions: ['read'] },
      { module: 'roadmap', actions: ['read'], subviews: ['roadmap.output'] },
      { module: 'documents', actions: ['read'] },
      { module: 'notes', actions: ['read'] },
    ],
    defaultSubviews: {
      projects: ['projects.details'],
      roadmap: ['roadmap.output'],
      documents: ['documents.list'],
    },
  },
  {
    id: 'collaborator',
    name: 'Collaborateur projet',
    nameEn: 'Project Collaborator',
    description: 'Accès lecture/écriture sur Projets, Tâches et Notes (sans rentabilité)',
    descriptionEn: 'Read/write access on Projects, Tasks and Notes (no profitability)',
    icon: 'users',
    permissions: [
      { module: 'projects', actions: ['read', 'update'] },
      { module: 'product', actions: ['read', 'create', 'update'] },
      { module: 'roadmap', actions: ['read'] },
      { module: 'tasks', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'notes', actions: ['read', 'create', 'update', 'delete'] },
      { module: 'documents', actions: ['read', 'create', 'update'] },
    ],
    defaultSubviews: {
      product: ['product.backlog', 'product.epics', 'product.stats'],
      roadmap: ['roadmap.gantt', 'roadmap.output'],
      documents: ['documents.list', 'documents.upload'],
      projects: ['projects.list', 'projects.details', 'projects.scope'],
    },
  },
];

export function getPermissionPack(packId: string): PermissionPack | undefined {
  return PERMISSION_PACKS.find(p => p.id === packId);
}

export function getPackPermissionMatrix(pack: PermissionPack): Record<string, Record<string, boolean>> {
  const matrix: Record<string, Record<string, boolean>> = {};
  
  for (const entry of pack.permissions) {
    if (!matrix[entry.module]) {
      matrix[entry.module] = { read: false, create: false, update: false, delete: false };
    }
    for (const action of entry.actions) {
      matrix[entry.module][action] = true;
    }
  }
  
  return matrix;
}
