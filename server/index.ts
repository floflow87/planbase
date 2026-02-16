import dotenv from "dotenv";
import path from "node:path";
import { strapiGet } from "./lib/strapi";

dotenv.config({ path: path.resolve(process.cwd(), ".env") });

console.log("STRAPI_URL =", process.env.STRAPI_URL);
console.log("SUPABASE_URL loaded?", !!process.env.SUPABASE_URL);
console.log("SUPABASE_DB_PASSWORD loaded?", !!process.env.SUPABASE_DB_PASSWORD);
console.log("ENTRY FILE =", import.meta.url);

import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runStartupMigrations } from "./migrations-startup";

const app = express();

function getStrapiConfig() {
  const baseUrl = process.env.STRAPI_URL;
  const token = process.env.STRAPI_API_TOKEN;
  if (!baseUrl || !token) throw new Error("Missing STRAPI_URL or STRAPI_API_TOKEN");
  return { baseUrl, headers: { Authorization: `Bearer ${token}` } };
}

app.get("/api/config/all", async (_req, res) => {
  try {
    const baseUrl = process.env.STRAPI_URL;
    const token = process.env.STRAPI_API_TOKEN;

    if (!baseUrl || !token) {
      return res.json({
        plans: [],
        featureFlags: [],
        featureFlagsMap: {},
        cdcTemplates: [],
        roadmapTemplates: [],
        okrTemplates: [],
        resourceTemplates: [],
        registry: [],
        registryMap: {},
        faq: [],
        onboarding: [],
        accountActions: [],
        _strapiAvailable: false,
      });
    }

    const headers = { Authorization: `Bearer ${token}` };

    const fetchJson = async (path: string) => {
      const r = await fetch(`${baseUrl}${path}`, { headers });
      if (!r.ok) {
        const text = await r.text();
        throw new Error(`Strapi error ${r.status} on ${path}: ${text}`);
      }
      return r.json();
    };

    const [
      plansJ,
      flagsJ,
      cdcJ,
      roadmapJ,
      okrJ,
      resourcesJ,
      registryJ,
      faqJ,
      onboardingJ,
      actionsJ,
    ] = await Promise.all([
      fetchJson("/api/plans?pagination[pageSize]=100"),
      fetchJson("/api/feature-flags?pagination[pageSize]=200"),
      fetchJson("/api/cdc-templates?pagination[pageSize]=100"),
      fetchJson("/api/roadmap-templates?pagination[pageSize]=100"),
      fetchJson("/api/okr-templates?pagination[pageSize]=100"),
      fetchJson("/api/resource-templates?pagination[pageSize]=200"),
      fetchJson("/api/configs?pagination[pageSize]=200"),
      fetchJson("/api/faq-entries?pagination[pageSize]=500"),
      fetchJson("/api/onboarding-steps?pagination[pageSize]=500"),
      fetchJson("/api/account-actions?pagination[pageSize]=200&sort=createdAt:desc"),
    ]);

    // --- Polish mapping (fields utiles seulement) ---

    const plans = (plansJ?.data ?? []).map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      is_active: !!p.is_active,
      price_monthly: p.price_monthly,
      stripe_price_id: p.stripe_price_id ?? null,
      features: p.features ?? {},
    }));

    const featureFlags = (flagsJ?.data ?? []).map((f: any) => ({
      id: f.id,
      key: f.key,
      enabled: !!f.enabled,
      description: f.description ?? null,
    }));
    const featureFlagsMap = Object.fromEntries(featureFlags.map((f: any) => [f.key, f.enabled]));

    const cdcTemplates = (cdcJ?.data ?? []).map((t: any) => ({
      id: t.id,
      key: t.key ?? null,
      name: t.name,
      description: t.description ?? null,
      project_type: t.project_type ?? null,
      is_active: !!t.is_active,
      items: t.items ?? [],
    }));

    const roadmapTemplates = (roadmapJ?.data ?? []).map((t: any) => ({
      id: t.id,
      key: t.key ?? null,
      name: t.name,
      description: t.description ?? null,
      default_view: t.default_view ?? null,
      view_defaults: t.view_defaults ?? {},
      items: t.items ?? [],
      is_active: !!t.is_active,
    }));

    const okrTemplates = (okrJ?.data ?? []).map((t: any) => ({
      id: t.id,
      key: t.key ?? null,
      name: t.name,
      description: t.description ?? null,
      objective_types: t.objective_types ?? [],
      tree_defaults: t.tree_defaults ?? {},
      is_active: !!t.is_active,
    }));

    const resourceTemplates = (resourcesJ?.data ?? []).map((t: any) => ({
      id: t.id,
      key: t.key ?? null,
      name: t.name,
      role: t.role ?? null,
      daily_cost: t.daily_cost ?? null,
      daily_rate: t.daily_rate ?? null,
      meta: t.meta ?? null,
      is_active: !!t.is_active,
    }));

    const registry = (registryJ?.data ?? []).map((c: any) => ({
      id: c.id,
      key: c.key,
      value: c.value ?? null,
      description: c.description ?? null,
      is_active: !!c.is_active,
    }));
    const registryMap = Object.fromEntries(registry.map((c: any) => [c.key, c.value]));

    const faq = (faqJ?.data ?? []).map((f: any) => ({
      id: f.id,
      module: f.module ?? null,
      question: f.question,
      answer: f.answer,
      order: f.order ?? 0,
      is_active: !!f.is_active,
    }));

    const onboarding = (onboardingJ?.data ?? []).map((s: any) => ({
      id: s.id,
      key: s.key,
      title: s.title,
      body: s.body,
      module: s.module ?? null,
      target: s.target ?? null,
      order: s.order ?? 0,
      is_active: !!s.is_active,
    }));

    const accountActions = (actionsJ?.data ?? []).map((a: any) => ({
      id: a.id,
      action: a.action,
      target_type: a.target_type,
      target_id: a.target_id,
      reason: a.reason ?? null,
      status: a.status ?? "pending",
      applied_at: a.applied_at ?? null,
      meta: a.meta ?? null,
      createdAt: a.createdAt ?? null,
    }));

    return res.json({
      plans,
      featureFlags,
      featureFlagsMap,
      cdcTemplates,
      roadmapTemplates,
      okrTemplates,
      resourceTemplates,
      registry,
      registryMap,
      faq,
      onboarding,
      accountActions,
    });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/all", (_req, res) => res.redirect(301, "/api/config/all"));
app.get("/config/ping", (_req, res) => res.redirect(301, "/api/config/ping"));
app.get("/config/feature-flags", (_req, res) => res.redirect(301, "/api/config/feature-flags"));

app.get("/api/config/ping", (_req, res) => {
  return res.json({ ok: true, file: import.meta.url });
});


app.get("/config/plans", async (_req, res) => {
  try {
    const baseUrl = process.env.STRAPI_URL;
    const token = process.env.STRAPI_API_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({ error: "Missing STRAPI_URL or STRAPI_API_TOKEN" });
    }

    const r = await fetch(`${baseUrl}/api/plans?pagination[pageSize]=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "Strapi error", details: text });
    }

    const json: any = await r.json();
    const plans = (json?.data ?? []).map((p: any) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      is_active: p.is_active,
      price_monthly: p.price_monthly,
      stripe_price_id: p.stripe_price_id,
      features: p.features,
    }));


    return res.json({ plans });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/feature-flags", async (_req, res) => {
  try {
    const baseUrl = process.env.STRAPI_URL;
    const token = process.env.STRAPI_API_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({ error: "Missing STRAPI_URL or STRAPI_API_TOKEN" });
    }

    const r = await fetch(`${baseUrl}/api/feature-flags?pagination[pageSize]=200`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "Strapi error", details: text });
    }

    const json: any = await r.json();

    const flags = (json?.data ?? []).map((f: any) => ({
      key: f.key,
      enabled: !!f.enabled,
      description: f.description ?? null,
    }));

    const map = Object.fromEntries(flags.map((f: any) => [f.key, f.enabled]));

    return res.json({ flags, map });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/templates", async (_req, res) => {
  try {
    const baseUrl = process.env.STRAPI_URL;
    const token = process.env.STRAPI_API_TOKEN;

    if (!baseUrl || !token) {
      return res.status(500).json({ error: "Missing STRAPI_URL or STRAPI_API_TOKEN" });
    }

    const r = await fetch(`${baseUrl}/api/cdc-templates?pagination[pageSize]=100`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: "Strapi error", details: text });
    }

    const json: any = await r.json();

    const cdcTemplates = (json?.data ?? []).map((t: any) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      description: t.description ?? null,
      project_type: t.project_type ?? null,
      is_active: !!t.is_active,
      items: t.items ?? [],
    }));

    return res.json({ cdcTemplates });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
    
  }
});

app.get("/config/roadmap-templates", async (_req, res) => {
  try {
    const { baseUrl, headers } = getStrapiConfig();
    const r = await fetch(`${baseUrl}/api/roadmap-templates?pagination[pageSize]=100`, { headers });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    const json: any = await r.json();
    const roadmapTemplates = (json?.data ?? []).map((t: any) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      description: t.description ?? null,
      default_view: t.default_view ?? null,
      view_defaults: t.view_defaults ?? {},
      items: t.items ?? [],
      is_active: !!t.is_active,
    }));

    return res.json({ roadmapTemplates });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/okr-templates", async (_req, res) => {
  try {
    const { baseUrl, headers } = getStrapiConfig();
    const r = await fetch(`${baseUrl}/api/okr-templates?pagination[pageSize]=100`, { headers });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    const json: any = await r.json();
    const okrTemplates = (json?.data ?? []).map((t: any) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      description: t.description ?? null,
      objective_types: t.objective_types ?? [],
      tree_defaults: t.tree_defaults ?? {},
      is_active: !!t.is_active,
    }));

    return res.json({ okrTemplates });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/resource-templates", async (_req, res) => {
  try {
    const { baseUrl, headers } = getStrapiConfig();
    const r = await fetch(`${baseUrl}/api/resource-templates?pagination[pageSize]=200`, { headers });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    const json: any = await r.json();
    const resourceTemplates = (json?.data ?? []).map((t: any) => ({
      id: t.id,
      key: t.key,
      name: t.name,
      role: t.role ?? null,
      daily_cost: t.daily_cost ?? null,
      daily_rate: t.daily_rate ?? null,
      meta: t.meta ?? null,
      is_active: !!t.is_active,
    }));

    return res.json({ resourceTemplates });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/registry", async (_req, res) => {
  try {
    const { baseUrl, headers } = getStrapiConfig();
    const r = await fetch(`${baseUrl}/api/configs?pagination[pageSize]=200`, { headers });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    const json: any = await r.json();
    const registry = (json?.data ?? []).map((c: any) => ({
      id: c.id,
      key: c.key,
      value: c.value ?? null,
      description: c.description ?? null,
      is_active: !!c.is_active,
    }));

    const map = Object.fromEntries(registry.map((c: any) => [c.key, c.value]));
    return res.json({ registry, map });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/faq", async (_req, res) => {
  try {
    const { baseUrl, headers } = getStrapiConfig();
    const r = await fetch(`${baseUrl}/api/faq-entries?pagination[pageSize]=500`, { headers });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    const json: any = await r.json();
    const faq = (json?.data ?? []).map((f: any) => ({
      id: f.id,
      module: f.module ?? null,
      question: f.question,
      answer: f.answer,
      order: f.order ?? 0,
      is_active: !!f.is_active,
    }));

    return res.json({ faq });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/onboarding", async (_req, res) => {
  try {
    const { baseUrl, headers } = getStrapiConfig();
    const r = await fetch(`${baseUrl}/api/onboarding-steps?pagination[pageSize]=500`, { headers });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    const json: any = await r.json();
    const steps = (json?.data ?? []).map((s: any) => ({
      id: s.id,
      key: s.key,
      title: s.title,
      body: s.body,
      module: s.module ?? null,
      target: s.target ?? null,
      order: s.order ?? 0,
      is_active: !!s.is_active,
    }));

    return res.json({ steps });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

app.get("/config/account-actions", async (_req, res) => {
  try {
    const { baseUrl, headers } = getStrapiConfig();
    const r = await fetch(`${baseUrl}/api/account-actions?pagination[pageSize]=200&sort=createdAt:desc`, { headers });
    if (!r.ok) return res.status(r.status).json({ error: await r.text() });

    const json: any = await r.json();
    const actions = (json?.data ?? []).map((a: any) => ({
      id: a.id,
      action: a.action,
      target_type: a.target_type,
      target_id: a.target_id,
      reason: a.reason ?? null,
      status: a.status ?? "pending",
      applied_at: a.applied_at ?? null,
      meta: a.meta ?? null,
      createdAt: a.createdAt,
    }));

    return res.json({ actions });
  } catch (e: any) {
    return res.status(500).json({ error: "Server error", message: e?.message ?? String(e) });
  }
});

// Configure CORS for production
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? (process.env.APP_URL ? [process.env.APP_URL] : ['https://app.planbase.io', 'https://www.planbase.io'])
    : true,
  credentials: true,
}));

declare module 'http' {
  interface IncomingMessage {
    rawBody: unknown
  }
}
app.use(express.json({
  limit: '50mb',
  verify: (req, _res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

app.get("/api/config/feature-flags", async (req, res) => {
  try {
    const data = await strapiGet("/feature-flags?pagination[pageSize]=100");
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

(async () => {
  // Run startup migrations
  await runStartupMigrations();
  
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
