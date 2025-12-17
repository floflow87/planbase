/**
 * Config Service - DB-first configuration resolution
 * 
 * This service loads default configurations from shared/config
 * and overlays them with DB-stored settings based on scope hierarchy:
 * SYSTEM -> ACCOUNT -> USER -> PROJECT
 * 
 * Lower scopes override higher scopes.
 */

import { db } from "../db";
import { settings } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAllDefaultConfigs, type ConfigKey } from "@shared/config";

export type SettingsScope = "SYSTEM" | "ACCOUNT" | "USER" | "PROJECT";

interface ResolvedConfig {
  defaults: ReturnType<typeof getAllDefaultConfigs>;
  overrides: Record<string, unknown>;
  effective: Record<string, unknown>;
  meta: {
    resolvedAt: string;
    accountId?: string;
    userId?: string;
    projectId?: string;
  };
}

class ConfigService {
  private cache: Map<string, { config: ResolvedConfig; expiresAt: number }> = new Map();
  private cacheTTL = 60000; // 1 minute cache TTL

  private getCacheKey(accountId?: string, userId?: string, projectId?: string): string {
    return `${accountId || "system"}:${userId || "none"}:${projectId || "none"}`;
  }

  /**
   * Deep merge two objects, with source overriding target
   */
  private deepMerge<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
    const result = { ...target } as Record<string, unknown>;
    
    for (const key in source) {
      if (source[key] !== null && typeof source[key] === "object" && !Array.isArray(source[key])) {
        if (target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
          result[key] = this.deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
        } else {
          result[key] = source[key];
        }
      } else {
        result[key] = source[key];
      }
    }
    
    return result as T;
  }

  /**
   * Get configuration for a specific key at a given scope
   */
  async getSettingByKey(
    key: ConfigKey,
    scope: SettingsScope,
    scopeId?: string
  ): Promise<unknown | null> {
    try {
      const conditions = [eq(settings.key, key), eq(settings.scope, scope)];
      
      if (scopeId) {
        conditions.push(eq(settings.scopeId, scopeId));
      } else if (scope === "SYSTEM") {
        conditions.push(isNull(settings.scopeId));
      }

      const result = await db
        .select()
        .from(settings)
        .where(and(...conditions))
        .limit(1);

      return result[0]?.value ?? null;
    } catch (error) {
      console.error(`Error fetching setting ${key} at scope ${scope}:`, error);
      return null;
    }
  }

  /**
   * Get all settings for a given scope
   */
  async getSettingsByScope(scope: SettingsScope, scopeId?: string): Promise<Record<string, unknown>> {
    try {
      const conditions = [eq(settings.scope, scope)];
      
      if (scopeId) {
        conditions.push(eq(settings.scopeId, scopeId));
      } else if (scope === "SYSTEM") {
        conditions.push(isNull(settings.scopeId));
      }

      const results = await db
        .select()
        .from(settings)
        .where(and(...conditions));

      const settingsMap: Record<string, unknown> = {};
      for (const row of results) {
        settingsMap[row.key] = row.value;
      }
      
      return settingsMap;
    } catch (error) {
      console.error(`Error fetching settings for scope ${scope}:`, error);
      return {};
    }
  }

  /**
   * Resolve effective configuration by merging defaults with DB overrides
   * Follows scope hierarchy: SYSTEM -> ACCOUNT -> USER -> PROJECT
   */
  async resolveConfig(
    accountId?: string,
    userId?: string,
    projectId?: string
  ): Promise<ResolvedConfig> {
    const cacheKey = this.getCacheKey(accountId, userId, projectId);
    const cached = this.cache.get(cacheKey);
    
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    const defaults = getAllDefaultConfigs();
    let effective: Record<string, unknown> = { ...defaults };
    const overrides: Record<string, unknown> = {};

    try {
      // 1. Apply SYSTEM overrides
      const systemSettings = await this.getSettingsByScope("SYSTEM");
      if (Object.keys(systemSettings).length > 0) {
        Object.assign(overrides, systemSettings);
        effective = this.deepMerge(effective, systemSettings);
      }

      // 2. Apply ACCOUNT overrides (if accountId provided)
      if (accountId) {
        const accountSettings = await this.getSettingsByScope("ACCOUNT", accountId);
        if (Object.keys(accountSettings).length > 0) {
          Object.assign(overrides, accountSettings);
          effective = this.deepMerge(effective, accountSettings);
        }
      }

      // 3. Apply USER overrides (if userId provided)
      if (userId) {
        const userSettings = await this.getSettingsByScope("USER", userId);
        if (Object.keys(userSettings).length > 0) {
          Object.assign(overrides, userSettings);
          effective = this.deepMerge(effective, userSettings);
        }
      }

      // 4. Apply PROJECT overrides (if projectId provided)
      if (projectId) {
        const projectSettings = await this.getSettingsByScope("PROJECT", projectId);
        if (Object.keys(projectSettings).length > 0) {
          Object.assign(overrides, projectSettings);
          effective = this.deepMerge(effective, projectSettings);
        }
      }
    } catch (error) {
      console.error("Error resolving config, using defaults:", error);
    }

    const config: ResolvedConfig = {
      defaults,
      overrides,
      effective,
      meta: {
        resolvedAt: new Date().toISOString(),
        accountId,
        userId,
        projectId,
      },
    };

    this.cache.set(cacheKey, { config, expiresAt: Date.now() + this.cacheTTL });
    
    return config;
  }

  /**
   * Update a configuration setting
   */
  async updateSetting(
    key: ConfigKey,
    value: unknown,
    scope: SettingsScope,
    scopeId: string | null,
    updatedBy?: string
  ): Promise<void> {
    const existing = await db
      .select()
      .from(settings)
      .where(
        and(
          eq(settings.key, key),
          eq(settings.scope, scope),
          scopeId ? eq(settings.scopeId, scopeId) : isNull(settings.scopeId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(settings)
        .set({
          value: value as Record<string, unknown>,
          version: existing[0].version + 1,
          source: "customized",
          updatedAt: new Date(),
          updatedBy: updatedBy || null,
        })
        .where(eq(settings.id, existing[0].id));
    } else {
      await db.insert(settings).values({
        key,
        value: value as Record<string, unknown>,
        scope,
        scopeId,
        source: "customized",
        updatedBy: updatedBy || null,
      });
    }

    // Invalidate cache with proper scope
    this.invalidateCache(scope, scopeId || undefined);
  }

  /**
   * Invalidate cached configurations
   * For account-level changes, clears all user caches within that account
   * For user-level changes, clears all caches for that user
   */
  invalidateCache(scope: SettingsScope = "SYSTEM", scopeId?: string): void {
    if (!scopeId || scope === "SYSTEM") {
      // System-level changes invalidate everything
      this.cache.clear();
      return;
    }

    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      const [cacheAccountId] = key.split(":");
      
      if (scope === "ACCOUNT" && cacheAccountId === scopeId) {
        // Account changes invalidate all users in that account
        keysToDelete.push(key);
      } else if (scope === "USER" && key.includes(scopeId)) {
        // User changes invalidate that user's caches
        keysToDelete.push(key);
      } else if (scope === "PROJECT" && key.includes(scopeId)) {
        // Project changes invalidate project-specific caches
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  /**
   * Get just the effective config (convenience method)
   */
  async getEffectiveConfig(
    accountId?: string,
    userId?: string,
    projectId?: string
  ): Promise<Record<string, unknown>> {
    const resolved = await this.resolveConfig(accountId, userId, projectId);
    return resolved.effective;
  }
}

export const configService = new ConfigService();
