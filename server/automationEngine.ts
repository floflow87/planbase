import { db } from "./db";
import { automations } from "@shared/schema";
import { eq, and, or, isNull } from "drizzle-orm";

export type AppEvent =
  | "backlog.created"
  | "backlog.updated"
  | "backlog.prioritized"
  | "backlog.completed"
  | "project.created"
  | "project.updated"
  | "project.milestone_reached"
  | "roadmap.updated"
  | "crm.deal_created"
  | "crm.deal_won"
  | "crm.stage_changed"
  | "note.created"
  | "note.updated"
  | "task.created"
  | "task.completed";

export interface AutomationPayload {
  [key: string]: any;
}

function interpolateTemplate(template: string, payload: AutomationPayload): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return payload[key] !== undefined ? String(payload[key]) : `{{${key}}}`;
  });
}

function evaluateConditions(conditions: any[], payload: AutomationPayload): boolean {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every((cond: any) => {
    const { field, operator, value } = cond;
    const payloadValue = String(payload[field] ?? "").toLowerCase();
    const condValue = String(value ?? "").toLowerCase();
    switch (operator) {
      case "equals": return payloadValue === condValue;
      case "not_equals": return payloadValue !== condValue;
      case "contains": return payloadValue.includes(condValue);
      case "not_contains": return !payloadValue.includes(condValue);
      case "changed": {
        // Check old_{field} vs new_{field} if both exist in payload
        const oldKey = `old_${field}`;
        const newKey = `new_${field}`;
        if (payload[oldKey] !== undefined && payload[newKey] !== undefined) {
          return String(payload[oldKey]).toLowerCase() !== String(payload[newKey]).toLowerCase();
        }
        // Otherwise, the presence of the field in the payload implies it changed
        return payload[field] !== undefined;
      }
      default: return true;
    }
  });
}

async function sendMessage(auto: any, text: string, accountId: string): Promise<void> {
  const autoAny = auto as any;

  // V2: Use Slack Web API if channel is configured
  if (autoAny.slackChannelId || autoAny.slack_channel_id) {
    const channelId = autoAny.slackChannelId || autoAny.slack_channel_id;
    const { getSlackSettings, postSlackMessage } = await import("./lib/slack");
    const settings = await getSlackSettings(accountId);
    if (!settings?.slack_access_token) {
      throw new Error("Slack not connected for this organization");
    }
    await postSlackMessage(settings.slack_access_token, channelId, text);
    return;
  }

  // V1 fallback: incoming webhook
  const webhookUrl = autoAny.slackWebhookUrl || autoAny.slack_webhook_url;
  if (webhookUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Slack webhook error ${response.status}: ${body}`);
    }
    return;
  }

  throw new Error("No Slack channel or webhook configured");
}

export async function emitEvent(
  event: AppEvent,
  payload: AutomationPayload,
  accountId: string
): Promise<void> {
  try {
    console.log(`🤖 [AutomationEngine] emitEvent: ${event}`, { accountId, payload });
    const scopeId = payload.scope_id ?? payload.projectId ?? payload.backlogId ?? payload.roadmapId ?? null;

    const allAutomations = await db
      .select()
      .from(automations)
      .where(
        and(
          eq(automations.accountId, accountId),
          eq(automations.isActive, true),
          eq(automations.eventType, event),
          or(
            eq(automations.scopeType, "global"),
            scopeId
              ? and(
                  eq(automations.scopeType, payload.scopeType ?? "project"),
                  eq(automations.scopeId, scopeId)
                )
              : isNull(automations.scopeId)
          )
        )
      );

    console.log(`🤖 [AutomationEngine] found ${allAutomations.length} automation(s) for event ${event} (scopeId=${scopeId})`);

    await Promise.allSettled(
      allAutomations.map(async (auto) => {
        try {
          const conditions = Array.isArray(auto.conditions) ? auto.conditions : [];
          if (!evaluateConditions(conditions, payload)) return;

          if (auto.actionType === "slack_message") {
            const enrichedPayload = {
              date: new Date().toLocaleString("fr-FR", {
                day: "2-digit", month: "2-digit", year: "numeric",
                hour: "2-digit", minute: "2-digit",
              }),
              ...payload,
            };
            const message = interpolateTemplate(auto.messageTemplate, enrichedPayload);
            await sendMessage(auto, message, accountId);
            console.log(`✅ Automation "${auto.name}" triggered for event ${event}`);
          }
        } catch (err: any) {
          console.warn(`⚠️  Automation "${auto.name}" failed:`, err.message);
        }
      })
    );
  } catch (err: any) {
    console.warn(`⚠️  emitEvent(${event}) failed:`, err.message);
  }
}
