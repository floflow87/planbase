/**
 * Config Service - Layered configuration resolution
 * 
 * Resolution order (each layer overrides the previous):
 * 1. Hardcoded defaults (@shared/config)
 * 2. Strapi registryMap (if available)
 * 3. DB settings (scope hierarchy: SYSTEM -> ACCOUNT -> USER -> PROJECT)
 * 
 * If Strapi is unavailable, falls back to defaults + DB.
 * Never returns null: always provides default values.
 */

import { db } from "../db";
import { settings } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getAllDefaultConfigs, type ConfigKey } from "@shared/config";

export type SettingsScope = "SYSTEM" | "ACCOUNT" | "USER" | "PROJECT";

type ConfigSource = "default" | "strapi" | "db";

interface SourceInfo {
  source: ConfigSource;
  resolvedAt: string;
}

interface ResolvedConfig {
  defaults: ReturnType<typeof getAllDefaultConfigs>;
  overrides: Record<string, unknown>;
  effective: Record<string, unknown>;
  sources: Record<string, SourceInfo>;
  meta: {
    resolvedAt: string;
    accountId?: string;
    userId?: string;
    projectId?: string;
    strapiAvailable: boolean;
  };
}

const ENUM_KEYS: ConfigKey[] = [
  "project.stages",
  "task.priorities",
  "task.statuses",
  "billing.statuses",
  "time.categories",
];

const OBJECT_KEYS: ConfigKey[] = [
  "thresholds",
];

const PASSTHROUGH_KEYS = [
  "project.stages.ui",
] as const;

class ConfigService {
  private cache: Map<string, { config: ResolvedConfig; expiresAt: number }> = new Map();
  private cacheTTL = 60000;

  private strapiCache: { data: Record<string, unknown>; expiresAt: number } | null = null;
  private strapiCacheTTL = 60000;

  private getCacheKey(accountId?: string, userId?: string, projectId?: string): string {
    return `${accountId || "system"}:${userId || "none"}:${projectId || "none"}`;
  }

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

  private validateConfigValue(key: ConfigKey, value: unknown): boolean {
    if (value === null || value === undefined) return false;

    if (ENUM_KEYS.includes(key)) {
      if (!Array.isArray(value)) {
        console.warn(`[ConfigService] Invalid type for "${key}": expected array, got ${typeof value}. Using fallback.`);
        return false;
      }
      return true;
    }

    if (OBJECT_KEYS.includes(key)) {
      if (typeof value !== "object" || Array.isArray(value)) {
        console.warn(`[ConfigService] Invalid type for "${key}": expected object, got ${Array.isArray(value) ? "array" : typeof value}. Using fallback.`);
        return false;
      }
      return true;
    }

    return true;
  }

  private async fetchStrapiRegistry(): Promise<Record<string, unknown>> {
    if (this.strapiCache && this.strapiCache.expiresAt > Date.now()) {
      return this.strapiCache.data;
    }

    const baseUrl = process.env.STRAPI_URL;
    const token = process.env.STRAPI_API_TOKEN;

    if (!baseUrl || !token) {
      return {};
    }

    try {
      const res = await fetch(`${baseUrl}/api/configs?pagination[pageSize]=200`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        console.warn(`[ConfigService] Strapi returned ${res.status}, using fallback`);
        return this.strapiCache?.data ?? {};
      }

      const json = await res.json();
      const registry: Record<string, unknown> = {};

      for (const rawItem of (json?.data ?? [])) {
        const item = rawItem.attributes ?? rawItem;
        if (item.key && item.value !== null && item.value !== undefined && item.is_active !== false) {
          registry[item.key] = item.value;
        }
      }

      this.strapiCache = { data: registry, expiresAt: Date.now() + this.strapiCacheTTL };
      return registry;
    } catch (error: any) {
      console.warn(`[ConfigService] Strapi unavailable: ${error.message}. Using fallback.`);
      return this.strapiCache?.data ?? {};
    }
  }

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
    const sources: Record<string, SourceInfo> = {};
    let strapiAvailable = false;
    const now = new Date().toISOString();

    for (const key of Object.keys(defaults)) {
      sources[key] = { source: "default", resolvedAt: now };
    }

    try {
      const strapiRegistry = await this.fetchStrapiRegistry();
      strapiAvailable = Object.keys(strapiRegistry).length > 0;

      const allConfigKeys = [...ENUM_KEYS, ...OBJECT_KEYS] as string[];
      for (const key of allConfigKeys) {
        if (key in strapiRegistry) {
          const val = strapiRegistry[key];
          if (this.validateConfigValue(key as ConfigKey, val)) {
            overrides[key] = val;
            effective[key] = val;
            sources[key] = { source: "strapi", resolvedAt: now };
          }
        }
      }

      for (const key of PASSTHROUGH_KEYS) {
        if (key in strapiRegistry) {
          overrides[key] = strapiRegistry[key];
          effective[key] = strapiRegistry[key];
          sources[key] = { source: "strapi", resolvedAt: now };
        }
      }
    } catch (error) {
      console.warn("[ConfigService] Strapi fetch failed during resolve, continuing with defaults:", error);
    }

    try {
      const systemSettings = await this.getSettingsByScope("SYSTEM");
      for (const [key, val] of Object.entries(systemSettings)) {
        if (this.validateConfigValue(key as ConfigKey, val)) {
          overrides[key] = val;
          effective = this.deepMerge(effective as Record<string, unknown>, { [key]: val });
          sources[key] = { source: "db", resolvedAt: now };
        }
      }

      if (accountId) {
        const accountSettings = await this.getSettingsByScope("ACCOUNT", accountId);
        for (const [key, val] of Object.entries(accountSettings)) {
          if (this.validateConfigValue(key as ConfigKey, val)) {
            overrides[key] = val;
            effective = this.deepMerge(effective as Record<string, unknown>, { [key]: val });
            sources[key] = { source: "db", resolvedAt: now };
          }
        }
      }

      if (userId) {
        const userSettings = await this.getSettingsByScope("USER", userId);
        for (const [key, val] of Object.entries(userSettings)) {
          if (this.validateConfigValue(key as ConfigKey, val)) {
            overrides[key] = val;
            effective = this.deepMerge(effective as Record<string, unknown>, { [key]: val });
            sources[key] = { source: "db", resolvedAt: now };
          }
        }
      }

      if (projectId) {
        const projectSettings = await this.getSettingsByScope("PROJECT", projectId);
        for (const [key, val] of Object.entries(projectSettings)) {
          if (this.validateConfigValue(key as ConfigKey, val)) {
            overrides[key] = val;
            effective = this.deepMerge(effective as Record<string, unknown>, { [key]: val });
            sources[key] = { source: "db", resolvedAt: now };
          }
        }
      }
    } catch (error) {
      console.error("Error resolving DB config, using defaults + strapi:", error);
    }

    const config: ResolvedConfig = {
      defaults,
      overrides,
      effective,
      sources,
      meta: {
        resolvedAt: now,
        accountId,
        userId,
        projectId,
        strapiAvailable,
      },
    };

    this.cache.set(cacheKey, { config, expiresAt: Date.now() + this.cacheTTL });
    
    return config;
  }

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

    this.invalidateCache(scope, scopeId || undefined);
  }

  invalidateCache(scope: SettingsScope = "SYSTEM", scopeId?: string): void {
    if (!scopeId || scope === "SYSTEM") {
      this.cache.clear();
      return;
    }

    const keysToDelete: string[] = [];
    this.cache.forEach((_, key) => {
      const [cacheAccountId] = key.split(":");
      
      if (scope === "ACCOUNT" && cacheAccountId === scopeId) {
        keysToDelete.push(key);
      } else if (scope === "USER" && key.includes(scopeId)) {
        keysToDelete.push(key);
      } else if (scope === "PROJECT" && key.includes(scopeId)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.cache.delete(key));
  }

  invalidateStrapiCache(): void {
    this.strapiCache = null;
    this.cache.clear();
  }

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
