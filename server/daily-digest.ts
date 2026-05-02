import { db } from "./db";
import { sql } from "drizzle-orm";

export interface DigestTask {
  id: string;
  title: string;
  priority: string;
  dueDate: string | null;
  daysOverdue: number;
  projectName: string | null;
  projectId: string | null;
  source: string;
  url: string;
}

export interface DigestMilestone {
  id: string;
  title: string;
  projectName: string | null;
  projectId: string | null;
  date: string;
  status: string;
  type: "completed" | "upcoming";
  url: string;
}

export interface DigestBillingProject {
  id: string;
  name: string;
  clientName: string | null;
  reason: string;
  billingStatus: string | null;
  budget: string | null;
  url: string;
}

export interface DigestRecommendation {
  id: string;
  title: string;
  description: string;
  type: "cash" | "task" | "roadmap" | "sprint" | "crm" | "project";
  priority: "high" | "medium" | "low";
  url: string;
}

export interface DigestSummary {
  topTasks: DigestTask[];
  roadmap: {
    completedLast7Days: DigestMilestone[];
    upcomingNext7Days: DigestMilestone[];
  };
  billingProjects: DigestBillingProject[];
  recommendations: DigestRecommendation[];
  metadata: {
    source: "rules_v1";
    generatedAt: string;
    timezone: string;
  };
}

export async function generateDailyDigest(accountId: string, maxTasks = 5): Promise<DigestSummary> {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString().slice(0, 10);
  const sevenDaysAhead = new Date(now.getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000).toISOString().slice(0, 10);
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 86400000).toISOString().slice(0, 10);
  const clampedMaxTasks = Math.min(Math.max(1, maxTasks), 20);

  // ── 1. Top Tasks ──────────────────────────────────────────────────
  let topTasks: DigestTask[] = [];
  try {
    const rows = (await db.execute(sql`
      SELECT t.id, t.title, t.priority, t.due_date,
             p.name as project_name, p.id as project_id
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id AND p.account_id = ${accountId}
      WHERE t.account_id = ${accountId}
        AND t.status NOT IN ('done', 'completed')
        AND (t.priority IN ('high', 'critical') OR (t.due_date IS NOT NULL AND t.due_date <= ${todayStr}))
      ORDER BY
        CASE
          WHEN t.due_date < ${todayStr} AND t.priority IN ('high','critical') THEN 1
          WHEN t.due_date = ${todayStr} AND t.priority IN ('high','critical') THEN 2
          WHEN t.due_date < ${todayStr} THEN 3
          WHEN t.due_date = ${todayStr} THEN 4
          WHEN t.priority IN ('high','critical') THEN 5
          ELSE 6
        END,
        t.due_date ASC NULLS LAST
      LIMIT ${clampedMaxTasks}
    `)) as any[];
    topTasks = rows.map((t) => {
      const dueDate = t.due_date ? String(t.due_date).slice(0, 10) : null;
      const daysOverdue =
        dueDate && dueDate < todayStr
          ? Math.floor((now.getTime() - new Date(dueDate).getTime()) / 86400000)
          : 0;
      return {
        id: t.id,
        title: t.title,
        priority: t.priority || "medium",
        dueDate,
        daysOverdue,
        projectName: t.project_name || null,
        projectId: t.project_id || null,
        source: "task",
        url: `/tasks`,
      };
    });
  } catch {}

  // ── 2. Roadmap signals ────────────────────────────────────────────
  let completedMilestones: DigestMilestone[] = [];
  let upcomingMilestones: DigestMilestone[] = [];
  try {
    const completed = (await db.execute(sql`
      SELECT ri.id, ri.title, ri.end_date, ri.status,
             p.name as project_name, p.id as project_id
      FROM roadmap_items ri
      JOIN roadmaps r ON r.id = ri.roadmap_id
      LEFT JOIN projects p ON p.id = ri.project_id
      WHERE r.account_id = ${accountId}
        AND ri.type IN ('milestone','deliverable')
        AND ri.status IN ('done','completed','terminé')
        AND ri.updated_at >= ${sevenDaysAgo}
      LIMIT 3
    `)) as any[];
    completedMilestones = completed.map((m) => ({
      id: m.id,
      title: m.title,
      projectName: m.project_name || null,
      projectId: m.project_id || null,
      date: m.end_date ? String(m.end_date).slice(0, 10) : todayStr,
      status: m.status,
      type: "completed" as const,
      url: `/roadmap`,
    }));

    const upcoming = (await db.execute(sql`
      SELECT ri.id, ri.title, ri.end_date, ri.status,
             p.name as project_name, p.id as project_id
      FROM roadmap_items ri
      JOIN roadmaps r ON r.id = ri.roadmap_id
      LEFT JOIN projects p ON p.id = ri.project_id
      WHERE r.account_id = ${accountId}
        AND ri.type IN ('milestone','deliverable')
        AND ri.status NOT IN ('done','completed','terminé')
        AND ri.end_date BETWEEN ${todayStr} AND ${sevenDaysAhead}
      ORDER BY ri.end_date ASC
      LIMIT 3
    `)) as any[];
    upcomingMilestones = upcoming.map((m) => ({
      id: m.id,
      title: m.title,
      projectName: m.project_name || null,
      projectId: m.project_id || null,
      date: m.end_date ? String(m.end_date).slice(0, 10) : todayStr,
      status: m.status,
      type: "upcoming" as const,
      url: `/roadmap`,
    }));
  } catch {}

  // ── 3. Billing signals ────────────────────────────────────────────
  let billingProjects: DigestBillingProject[] = [];
  try {
    const rows = (await db.execute(sql`
      SELECT p.id, p.name, p.billing_status, p.budget, p.stage,
             c.name as client_name
      FROM projects p
      LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.account_id = ${accountId}
        AND p.stage NOT IN ('archive','archived')
        AND (
          (p.stage IN ('termine','completed') AND (p.billing_status IS NULL OR p.billing_status NOT IN ('paye','facture','annule')))
          OR p.billing_status = 'a_facturer'
          OR p.billing_status = 'retard'
        )
      ORDER BY
        CASE p.billing_status
          WHEN 'retard' THEN 1
          WHEN 'a_facturer' THEN 2
          ELSE 3
        END
      LIMIT 3
    `)) as any[];
    billingProjects = rows.map((p) => {
      let reason = "Vérifiez le statut de facturation.";
      if (p.billing_status === "retard") {
        reason = "Paiement en retard — relancez le client.";
      } else if (p.billing_status === "a_facturer") {
        reason = "Marqué « À facturer » — prêt pour la facturation.";
      } else if (["termine", "completed"].includes(p.stage)) {
        reason = "Projet finalisé — pensez à facturer.";
      }
      return {
        id: p.id,
        name: p.name,
        clientName: p.client_name || null,
        reason,
        billingStatus: p.billing_status || null,
        budget: p.budget || null,
        url: `/projects/${p.id}`,
      };
    });
  } catch {}

  // ── 4. Recommendations ───────────────────────────────────────────
  const recommendations: DigestRecommendation[] = [];

  // A. Sprints with ≤3 remaining tickets
  try {
    const rows = (await db.execute(sql`
      SELECT s.id, s.name as sprint_name, b.name as backlog_name, b.id as backlog_id,
             COUNT(bt.id) FILTER (WHERE bt.state NOT IN ('done','completed','testing','to_fix')) as remaining
      FROM sprints s
      JOIN backlogs b ON b.id = s.backlog_id
      LEFT JOIN backlog_tasks bt ON bt.sprint_id = s.id
      WHERE b.account_id = ${accountId} AND s.status = 'en_cours'
      GROUP BY s.id, s.name, b.name, b.id
      HAVING COUNT(bt.id) FILTER (WHERE bt.state NOT IN ('done','completed','testing','to_fix')) <= 3
      LIMIT 2
    `)) as any[];
    for (const s of rows) {
      recommendations.push({
        id: `sprint-${s.id}`,
        title: "Sprint presque terminé",
        description: `Plus que ${s.remaining} ticket(s) dans « ${s.sprint_name} » (${s.backlog_name}). Pensez à le clôturer ou préparer le suivant.`,
        type: "sprint",
        priority: "medium",
        url: `/product/backlog/${s.backlog_id}`,
      });
    }
  } catch {}

  // B. Prospects without activity for 90+ days
  try {
    const rows = (await db.execute(sql`
      SELECT c.id, c.name, MAX(a.created_at) as last_activity
      FROM clients c
      LEFT JOIN activities a ON a.client_id = c.id
      WHERE c.account_id = ${accountId}
        AND c.status IN ('prospect','prospecting','lead','opportunity','active')
      GROUP BY c.id, c.name
      HAVING MAX(a.created_at) < ${ninetyDaysAgo} OR MAX(a.created_at) IS NULL
      LIMIT 2
    `)) as any[];
    for (const p of rows) {
      const last = p.last_activity ? new Date(p.last_activity) : null;
      const months = last ? Math.floor((now.getTime() - last.getTime()) / (86400000 * 30)) : null;
      recommendations.push({
        id: `prospect-${p.id}`,
        title: "Prospect sans relance",
        description: `« ${p.name} » n'a pas été relancé${months ? ` depuis ${months} mois` : ""}.`,
        type: "crm",
        priority: "medium",
        url: `/crm/${p.id}`,
      });
    }
  } catch {}

  // C. Active projects without activity for 14+ days
  try {
    const rows = (await db.execute(sql`
      SELECT p.id, p.name, p.updated_at
      FROM projects p
      WHERE p.account_id = ${accountId}
        AND p.stage NOT IN ('termine','completed','archive','archived')
        AND p.updated_at < ${fourteenDaysAgo}
      ORDER BY p.updated_at ASC
      LIMIT 2
    `)) as any[];
    for (const p of rows) {
      const days = Math.floor((now.getTime() - new Date(p.updated_at).getTime()) / 86400000);
      recommendations.push({
        id: `proj-inactive-${p.id}`,
        title: "Projet sans activité récente",
        description: `« ${p.name} » n'a pas eu d'activité depuis ${days} jours. À relancer ou archiver ?`,
        type: "project",
        priority: "low",
        url: `/projects/${p.id}`,
      });
    }
  } catch {}

  // D. Upcoming milestones with no linked tasks
  try {
    const rows = (await db.execute(sql`
      SELECT ri.id, ri.title, ri.end_date
      FROM roadmap_items ri
      JOIN roadmaps r ON r.id = ri.roadmap_id
      WHERE r.account_id = ${accountId}
        AND ri.type = 'milestone'
        AND ri.status NOT IN ('done','completed','terminé')
        AND ri.end_date BETWEEN ${todayStr} AND ${sevenDaysAhead}
      LIMIT 2
    `)) as any[];
    for (const m of rows) {
      recommendations.push({
        id: `milestone-prep-${m.id}`,
        title: "Jalon imminent",
        description: `Le jalon « ${m.title} » arrive le ${m.end_date ? String(m.end_date).slice(0, 10) : "?"} — vérifiez la préparation.`,
        type: "roadmap",
        priority: "high",
        url: `/roadmap`,
      });
    }
  } catch {}

  const typeOrder: Record<string, number> = { cash: 1, task: 2, roadmap: 3, sprint: 4, crm: 5, project: 6 };
  const sorted = recommendations.sort((a, b) => (typeOrder[a.type] || 9) - (typeOrder[b.type] || 9)).slice(0, 5);

  return {
    topTasks,
    roadmap: { completedLast7Days: completedMilestones, upcomingNext7Days: upcomingMilestones },
    billingProjects,
    recommendations: sorted,
    metadata: { source: "rules_v1", generatedAt: now.toISOString(), timezone: "Europe/Paris" },
  };
}

function hasStaleUrls(summary: DigestSummary): boolean {
  const json = JSON.stringify(summary);
  return json.includes('"/backlogs/');
}

export async function getOrCreateTodayDigest(accountId: string, maxTasks = 5): Promise<DigestSummary> {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const rows = (await db.execute(sql`
      SELECT summary_json FROM daily_digests
      WHERE account_id = ${accountId} AND digest_date = ${today}
        AND status IN ('generated','refreshed')
      ORDER BY generated_at DESC LIMIT 1
    `)) as any[];
    if (rows.length > 0 && rows[0].summary_json) {
      const val = rows[0].summary_json;
      const cached: DigestSummary = typeof val === "string" ? JSON.parse(val) : val;
      if (!hasStaleUrls(cached)) return cached;
    }
  } catch {}

  const summary = await generateDailyDigest(accountId, maxTasks);
  try {
    await db.execute(sql`
      INSERT INTO daily_digests (account_id, digest_date, generated_at, timezone, summary_json, status)
      VALUES (${accountId}, ${today}, now(), 'Europe/Paris', ${JSON.stringify(summary)}::jsonb, 'generated')
      ON CONFLICT (account_id, digest_date)
      DO UPDATE SET summary_json = EXCLUDED.summary_json, generated_at = now(), status = 'generated'
    `);
  } catch {}
  return summary;
}

export async function refreshDigest(accountId: string, maxTasks = 5): Promise<DigestSummary> {
  const today = new Date().toISOString().slice(0, 10);
  const summary = await generateDailyDigest(accountId, maxTasks);
  try {
    await db.execute(sql`
      INSERT INTO daily_digests (account_id, digest_date, generated_at, timezone, summary_json, status)
      VALUES (${accountId}, ${today}, now(), 'Europe/Paris', ${JSON.stringify(summary)}::jsonb, 'refreshed')
      ON CONFLICT (account_id, digest_date)
      DO UPDATE SET summary_json = EXCLUDED.summary_json, generated_at = now(), status = 'refreshed'
    `);
  } catch {}
  return summary;
}
