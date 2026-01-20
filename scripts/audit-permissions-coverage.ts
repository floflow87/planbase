#!/usr/bin/env npx tsx
/**
 * RBAC Permissions Coverage Audit Script
 * 
 * This script analyzes server/routes.ts to verify that all module-related
 * routes have the requirePermission middleware applied correctly.
 * 
 * Usage: npx tsx scripts/audit-permissions-coverage.ts
 */

import fs from 'fs';
import path from 'path';

interface RouteInfo {
  method: string;
  path: string;
  lineNumber: number;
  hasRequireAuth: boolean;
  hasRequireOrgMember: boolean;
  hasRequirePermission: boolean;
  permissionModule?: string;
  permissionAction?: string;
  permissionSubview?: string;
}

interface ModuleStats {
  total: number;
  protected: number;
  unprotected: RouteInfo[];
}

const MODULE_ROUTE_PATTERNS: Record<string, RegExp[]> = {
  crm: [
    /\/api\/clients/,
    /\/api\/contacts/,
    /\/api\/opportunities/,
    /\/api\/crm/,
  ],
  projects: [
    /\/api\/projects/,
    /\/api\/project-categories/,
    /\/api\/activities/,
    /\/api\/time-entries/,
    /\/api\/payments/,
    /\/api\/baselines/,
    /\/api\/scope-items/,
    /\/api\/cdc/,
  ],
  product: [
    /\/api\/backlogs/,
    /\/api\/epics/,
    /\/api\/user-stories/,
    /\/api\/backlog-tasks/,
    /\/api\/sprints/,
    /\/api\/retros/,
    /\/api\/recipe/,
    /\/api\/tickets/,
    /\/api\/checklist-items/,
    /\/api\/acceptance-criteria/,
    /\/api\/ticket-comments/,
  ],
  roadmap: [
    /\/api\/roadmaps/,
    /\/api\/roadmap-items/,
    /\/api\/objectives/,
    /\/api\/key-results/,
    /\/api\/milestones/,
  ],
  tasks: [
    /\/api\/tasks/,
    /\/api\/task-columns/,
  ],
  profitability: [
    /\/api\/profitability/,
    /\/api\/simulations/,
    /\/api\/resources/,
    /\/api\/resource-templates/,
  ],
  documents: [
    /\/api\/documents/,
    /\/api\/files/,
    /\/api\/folders/,
    /\/api\/document-templates/,
    /\/api\/document-links/,
  ],
  notes: [
    /\/api\/notes/,
    /\/api\/mindmaps/,
  ],
};

const EXCLUDED_PATHS = [
  /\/api\/health/,
  /\/api\/auth/,
  /\/api\/me/,
  /\/api\/users/,
  /\/api\/seed/,
  /\/api\/views/,
  /\/api\/settings/,
  /\/api\/recommendations/,
  /\/api\/members/,
  /\/api\/permissions/,
  /\/api\/organization/,
  /healthz/,
];

function parseRoutes(content: string): RouteInfo[] {
  const routes: RouteInfo[] = [];
  const lines = content.split('\n');
  
  const routeRegex = /app\.(get|post|patch|put|delete)\s*\(\s*["'`]([^"'`]+)["'`]/i;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(routeRegex);
    
    if (match) {
      const method = match[1].toUpperCase();
      const routePath = match[2];
      
      // Look at current and next few lines for middleware
      const contextLines = lines.slice(Math.max(0, i - 2), i + 5).join(' ');
      
      const hasRequireAuth = /requireAuth/.test(contextLines);
      const hasRequireOrgMember = /requireOrgMember/.test(contextLines);
      const hasRequirePermission = /requirePermission\s*\(/.test(contextLines);
      
      let permissionModule: string | undefined;
      let permissionAction: string | undefined;
      let permissionSubview: string | undefined;
      
      if (hasRequirePermission) {
        const permMatch = contextLines.match(/requirePermission\s*\(\s*["'](\w+)["']\s*,\s*["'](\w+)["'](?:\s*,\s*["']([^"']+)["'])?\)/);
        if (permMatch) {
          permissionModule = permMatch[1];
          permissionAction = permMatch[2];
          permissionSubview = permMatch[3];
        }
      }
      
      routes.push({
        method,
        path: routePath,
        lineNumber: i + 1,
        hasRequireAuth,
        hasRequireOrgMember,
        hasRequirePermission,
        permissionModule,
        permissionAction,
        permissionSubview,
      });
    }
  }
  
  return routes;
}

function classifyRoute(route: RouteInfo): string | null {
  // Check if route should be excluded
  for (const pattern of EXCLUDED_PATHS) {
    if (pattern.test(route.path)) {
      return null;
    }
  }
  
  // Find which module this route belongs to
  for (const [module, patterns] of Object.entries(MODULE_ROUTE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(route.path)) {
        return module;
      }
    }
  }
  
  return null;
}

function expectedAction(method: string): string {
  switch (method) {
    case 'GET': return 'read';
    case 'POST': return 'create';
    case 'PATCH':
    case 'PUT': return 'update';
    case 'DELETE': return 'delete';
    default: return 'read';
  }
}

function analyzeRoutes(routes: RouteInfo[]): Record<string, ModuleStats> {
  const stats: Record<string, ModuleStats> = {};
  
  for (const module of Object.keys(MODULE_ROUTE_PATTERNS)) {
    stats[module] = { total: 0, protected: 0, unprotected: [] };
  }
  
  for (const route of routes) {
    const module = classifyRoute(route);
    if (!module) continue;
    
    stats[module].total++;
    
    if (route.hasRequirePermission && route.permissionModule === module) {
      const expected = expectedAction(route.method);
      if (route.permissionAction === expected) {
        stats[module].protected++;
      } else {
        stats[module].unprotected.push(route);
      }
    } else if (!route.hasRequirePermission) {
      stats[module].unprotected.push(route);
    } else {
      stats[module].protected++;
    }
  }
  
  return stats;
}

function printReport(stats: Record<string, ModuleStats>): void {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           RBAC PERMISSIONS COVERAGE AUDIT REPORT             ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  let totalRoutes = 0;
  let protectedRoutes = 0;
  
  for (const [module, stat] of Object.entries(stats)) {
    totalRoutes += stat.total;
    protectedRoutes += stat.protected;
    
    const coverage = stat.total > 0 
      ? Math.round((stat.protected / stat.total) * 100) 
      : 100;
    
    const status = coverage === 100 ? '✅' : coverage >= 80 ? '⚠️' : '❌';
    
    console.log(`║ ${status} ${module.padEnd(15)} ${stat.protected.toString().padStart(3)}/${stat.total.toString().padStart(3)} routes protected (${coverage}%)`);
    
    if (stat.unprotected.length > 0) {
      for (const route of stat.unprotected.slice(0, 5)) {
        console.log(`║    └─ ${route.method.padEnd(6)} ${route.path.substring(0, 40)} (L${route.lineNumber})`);
      }
      if (stat.unprotected.length > 5) {
        console.log(`║    └─ ... and ${stat.unprotected.length - 5} more`);
      }
    }
  }
  
  console.log('╠══════════════════════════════════════════════════════════════╣');
  
  const totalCoverage = totalRoutes > 0 
    ? Math.round((protectedRoutes / totalRoutes) * 100) 
    : 100;
  
  const overallStatus = totalCoverage === 100 ? '✅' : totalCoverage >= 90 ? '⚠️' : '❌';
  
  console.log(`║ ${overallStatus} TOTAL: ${protectedRoutes}/${totalRoutes} routes protected (${totalCoverage}% coverage)`);
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  // Summary for CI/CD
  if (totalCoverage < 100) {
    console.log('⚠️  Some routes are missing requirePermission middleware.');
    console.log('   Run this script to identify unprotected routes.\n');
  } else {
    console.log('✅ All module routes have proper RBAC protection!\n');
  }
}

async function main(): Promise<void> {
  const routesPath = path.join(process.cwd(), 'server', 'routes.ts');
  
  if (!fs.existsSync(routesPath)) {
    console.error('Error: server/routes.ts not found');
    process.exit(1);
  }
  
  console.log('📊 Analyzing RBAC permissions coverage...\n');
  
  const content = fs.readFileSync(routesPath, 'utf-8');
  const routes = parseRoutes(content);
  const stats = analyzeRoutes(routes);
  
  printReport(stats);
  
  // Return non-zero exit code if coverage is not 100%
  const totalRoutes = Object.values(stats).reduce((sum, s) => sum + s.total, 0);
  const protectedRoutes = Object.values(stats).reduce((sum, s) => sum + s.protected, 0);
  
  if (protectedRoutes < totalRoutes) {
    process.exit(1);
  }
}

main().catch(console.error);
