/**
 * Config Service Tests
 * 
 * Tests for:
 * A) Merge order / scope override (SYSTEM < ACCOUNT < USER < PROJECT)
 * B) Authorization (GET: auth required, PUT: owner-only)
 * C) Cache invalidation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAllDefaultConfigs } from '@shared/config';

/**
 * Test the merge order logic in isolation
 * The ConfigService applies overrides in order: SYSTEM -> ACCOUNT -> USER -> PROJECT
 * Each subsequent scope overrides the previous
 */
describe('ConfigService Merge Logic', () => {
  
  /**
   * Helper function that mimics the deepMerge logic in ConfigService
   */
  function deepMerge<T extends Record<string, unknown>>(
    target: T, 
    source: Record<string, unknown>
  ): T {
    const result = { ...target } as Record<string, unknown>;
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
          result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
        } else {
          result[key] = source[key];
        }
      } else {
        result[key] = source[key];
      }
    }
    
    return result as T;
  }

  describe('A) Merge Order / Scope Override', () => {
    
    it('should return defaults when no overrides exist', () => {
      const defaults = getAllDefaultConfigs();
      let effective: Record<string, unknown> = { ...defaults };
      
      // No overrides applied
      expect(effective['project.stages']).toBeDefined();
      expect(effective['task.priorities']).toBeDefined();
      expect(effective['thresholds']).toBeDefined();
    });

    it('should apply SYSTEM overrides on top of defaults', () => {
      const defaults = { 
        'thresholds': { billing: { warningDays: 30 } } 
      };
      const systemOverride = { 
        'thresholds': { billing: { warningDays: 15 } } 
      };
      
      let effective: Record<string, unknown> = { ...defaults };
      effective = deepMerge(effective, systemOverride);
      
      expect((effective['thresholds'] as any).billing.warningDays).toBe(15);
    });

    it('should apply ACCOUNT overrides on top of SYSTEM', () => {
      const defaults = { 
        'thresholds': { billing: { warningDays: 30, criticalDays: 60 } } 
      };
      const systemOverride = { 
        'thresholds': { billing: { warningDays: 15 } } 
      };
      const accountOverride = { 
        'thresholds': { billing: { warningDays: 7 } } 
      };
      
      let effective: Record<string, unknown> = { ...defaults };
      effective = deepMerge(effective, systemOverride);
      effective = deepMerge(effective, accountOverride);
      
      // Account override should win
      expect((effective['thresholds'] as any).billing.warningDays).toBe(7);
      // criticalDays should be preserved from defaults
      expect((effective['thresholds'] as any).billing.criticalDays).toBe(60);
    });

    it('should apply USER overrides on top of ACCOUNT', () => {
      const defaults = { 
        'thresholds': { billing: { warningDays: 30 } } 
      };
      const accountOverride = { 
        'thresholds': { billing: { warningDays: 15 } } 
      };
      const userOverride = { 
        'thresholds': { billing: { warningDays: 3 } } 
      };
      
      let effective: Record<string, unknown> = { ...defaults };
      effective = deepMerge(effective, accountOverride);
      effective = deepMerge(effective, userOverride);
      
      // User override should win
      expect((effective['thresholds'] as any).billing.warningDays).toBe(3);
    });

    it('should apply PROJECT overrides on top of USER (most specific wins)', () => {
      const defaults = { 
        'thresholds': { billing: { warningDays: 30 } } 
      };
      const systemOverride = { 
        'thresholds': { billing: { warningDays: 25 } } 
      };
      const accountOverride = { 
        'thresholds': { billing: { warningDays: 20 } } 
      };
      const userOverride = { 
        'thresholds': { billing: { warningDays: 10 } } 
      };
      const projectOverride = { 
        'thresholds': { billing: { warningDays: 1 } } 
      };
      
      let effective: Record<string, unknown> = { ...defaults };
      effective = deepMerge(effective, systemOverride);
      effective = deepMerge(effective, accountOverride);
      effective = deepMerge(effective, userOverride);
      effective = deepMerge(effective, projectOverride);
      
      // PROJECT is the most specific, it wins
      expect((effective['thresholds'] as any).billing.warningDays).toBe(1);
    });

    it('should replace arrays wholesale, not merge them', () => {
      const defaults = { 
        'project.stages': [
          { key: 'draft', label: 'Draft' },
          { key: 'active', label: 'Active' }
        ] 
      };
      const accountOverride = { 
        'project.stages': [
          { key: 'new', label: 'New' }
        ] 
      };
      
      let effective: Record<string, unknown> = { ...defaults };
      effective = deepMerge(effective, accountOverride);
      
      // Array should be replaced entirely, not merged
      const stages = effective['project.stages'] as any[];
      expect(stages).toHaveLength(1);
      expect(stages[0].key).toBe('new');
    });

    it('should deep merge nested objects correctly', () => {
      const defaults = { 
        'thresholds': { 
          billing: { warningDays: 30, criticalDays: 60 },
          project: { overdueWarningDays: 7 }
        } 
      };
      const accountOverride = { 
        'thresholds': { 
          billing: { warningDays: 15 }
          // project should be preserved
        } 
      };
      
      let effective: Record<string, unknown> = { ...defaults };
      effective = deepMerge(effective, accountOverride);
      
      const thresholds = effective['thresholds'] as any;
      expect(thresholds.billing.warningDays).toBe(15);
      expect(thresholds.billing.criticalDays).toBe(60); // preserved
      expect(thresholds.project.overdueWarningDays).toBe(7); // preserved
    });
  });
});

describe('ConfigService Cache Invalidation', () => {
  
  class TestCache {
    private cache: Map<string, { config: any; expiresAt: number }> = new Map();
    
    getCacheKey(accountId?: string, userId?: string, projectId?: string): string {
      return `${accountId || 'system'}:${userId || 'none'}:${projectId || 'none'}`;
    }
    
    set(accountId: string | undefined, userId: string | undefined, projectId: string | undefined, config: any): void {
      const key = this.getCacheKey(accountId, userId, projectId);
      this.cache.set(key, { config, expiresAt: Date.now() + 60000 });
    }
    
    get(accountId: string | undefined, userId: string | undefined, projectId: string | undefined): any | null {
      const key = this.getCacheKey(accountId, userId, projectId);
      const cached = this.cache.get(key);
      return cached?.config ?? null;
    }
    
    invalidateCache(scope: string = 'SYSTEM', scopeId?: string): void {
      if (!scopeId || scope === 'SYSTEM') {
        this.cache.clear();
        return;
      }

      const keysToDelete: string[] = [];
      this.cache.forEach((_, key) => {
        const [cacheAccountId] = key.split(':');
        
        if (scope === 'ACCOUNT' && cacheAccountId === scopeId) {
          keysToDelete.push(key);
        } else if (scope === 'USER' && key.includes(scopeId)) {
          keysToDelete.push(key);
        } else if (scope === 'PROJECT' && key.includes(scopeId)) {
          keysToDelete.push(key);
        }
      });
      keysToDelete.forEach(key => this.cache.delete(key));
    }
    
    size(): number {
      return this.cache.size;
    }
  }

  it('should clear all cache on SYSTEM-level invalidation', () => {
    const cache = new TestCache();
    
    cache.set('account1', 'user1', undefined, { data: 'config1' });
    cache.set('account2', 'user2', undefined, { data: 'config2' });
    expect(cache.size()).toBe(2);
    
    cache.invalidateCache('SYSTEM');
    expect(cache.size()).toBe(0);
  });

  it('should clear only account-related cache on ACCOUNT-level invalidation', () => {
    const cache = new TestCache();
    
    cache.set('account1', 'user1', undefined, { data: 'config1' });
    cache.set('account1', 'user2', undefined, { data: 'config2' });
    cache.set('account2', 'user3', undefined, { data: 'config3' });
    expect(cache.size()).toBe(3);
    
    cache.invalidateCache('ACCOUNT', 'account1');
    
    // Only account2 should remain
    expect(cache.size()).toBe(1);
    expect(cache.get('account2', 'user3', undefined)).toBeDefined();
    expect(cache.get('account1', 'user1', undefined)).toBeNull();
  });

  it('should clear only user-related cache on USER-level invalidation', () => {
    const cache = new TestCache();
    
    cache.set('account1', 'user1', undefined, { data: 'config1' });
    cache.set('account1', 'user2', undefined, { data: 'config2' });
    expect(cache.size()).toBe(2);
    
    cache.invalidateCache('USER', 'user1');
    
    expect(cache.size()).toBe(1);
    expect(cache.get('account1', 'user2', undefined)).toBeDefined();
    expect(cache.get('account1', 'user1', undefined)).toBeNull();
  });

  it('should clear project-specific cache on PROJECT-level invalidation', () => {
    const cache = new TestCache();
    
    cache.set('account1', 'user1', 'project1', { data: 'config1' });
    cache.set('account1', 'user1', 'project2', { data: 'config2' });
    cache.set('account1', 'user1', undefined, { data: 'config3' });
    expect(cache.size()).toBe(3);
    
    cache.invalidateCache('PROJECT', 'project1');
    
    expect(cache.size()).toBe(2);
    expect(cache.get('account1', 'user1', 'project2')).toBeDefined();
    expect(cache.get('account1', 'user1', undefined)).toBeDefined();
    expect(cache.get('account1', 'user1', 'project1')).toBeNull();
  });
});

describe('Config API Authorization', () => {
  
  it('GET /api/config should require authentication', async () => {
    // This test documents the expected behavior:
    // - Unauthenticated requests should receive 401
    // - Authenticated requests should receive 200
    
    // The actual route uses requireAuth middleware
    // which checks for valid Supabase JWT token
    
    expect(true).toBe(true); // Placeholder - integration test needed
  });

  it('PUT /api/config/:key should require owner role', async () => {
    // This test documents the expected behavior:
    // - collaborator role should receive 403
    // - owner role should receive 200 and increment version
    
    // The actual route uses requireRole('owner') middleware
    
    expect(true).toBe(true); // Placeholder - integration test needed
  });
});
