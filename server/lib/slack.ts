import { db } from "../db";
import { accounts } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface SlackSettings {
  slack_access_token?: string;
  slack_team_id?: string;
  slack_team_name?: string;
  slack_bot_user_id?: string;
  slack_connected_at?: string;
}

export function getSlackRedirectUri(requestHost?: string): string {
  if (process.env.SLACK_REDIRECT_DOMAIN) {
    return `${process.env.SLACK_REDIRECT_DOMAIN.replace(/\/$/, "")}/api/slack/oauth/callback`;
  }
  if (requestHost) {
    const protocol = requestHost.includes("localhost") ? "http" : "https";
    return `${protocol}://${requestHost}/api/slack/oauth/callback`;
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}/api/slack/oauth/callback`;
  }
  return `http://localhost:5000/api/slack/oauth/callback`;
}

export function getSlackAuthUrl(state: string, requestHost?: string): string {
  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) throw new Error("SLACK_CLIENT_ID not configured");

  const redirectUri = getSlackRedirectUri(requestHost);
  const scopes = encodeURIComponent("channels:read,groups:read,chat:write,users:read");

  return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
}

export async function exchangeCodeForToken(code: string, redirectUri: string): Promise<{
  access_token: string;
  team: { id: string; name: string };
  bot_user_id: string;
}> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("Slack OAuth not configured");

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`https://slack.com/api/oauth.v2.access?${params}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack OAuth error: ${data.error}`);

  return {
    access_token: data.access_token,
    team: data.team,
    bot_user_id: data.bot_user_id,
  };
}

export async function getSlackSettings(accountId: string): Promise<SlackSettings | null> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return null;
  const settings = (account.settings as any) || {};
  if (!settings.slack_access_token) return null;
  return {
    slack_access_token: settings.slack_access_token,
    slack_team_id: settings.slack_team_id,
    slack_team_name: settings.slack_team_name,
    slack_bot_user_id: settings.slack_bot_user_id,
    slack_connected_at: settings.slack_connected_at,
  };
}

export async function saveSlackSettings(accountId: string, slackSettings: SlackSettings): Promise<void> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) throw new Error("Account not found");
  const existing = (account.settings as any) || {};
  await db.update(accounts).set({
    settings: { ...existing, ...slackSettings },
    updatedAt: new Date(),
  }).where(eq(accounts.id, accountId));
}

export async function clearSlackSettings(accountId: string): Promise<void> {
  const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return;
  const settings = { ...(account.settings as any) || {} };
  delete settings.slack_access_token;
  delete settings.slack_team_id;
  delete settings.slack_team_name;
  delete settings.slack_bot_user_id;
  delete settings.slack_connected_at;
  await db.update(accounts).set({ settings, updatedAt: new Date() }).where(eq(accounts.id, accountId));
}

export async function listSlackChannels(accessToken: string): Promise<{ id: string; name: string; isPrivate: boolean }[]> {
  const results: { id: string; name: string; isPrivate: boolean }[] = [];
  let cursor: string | undefined;

  do {
    const params = new URLSearchParams({
      types: "public_channel,private_channel",
      exclude_archived: "true",
      limit: "200",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(`https://slack.com/api/conversations.list?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = await res.json();
    if (!data.ok) throw new Error(`Slack API error: ${data.error}`);

    for (const ch of data.channels || []) {
      results.push({ id: ch.id, name: ch.name, isPrivate: ch.is_private });
    }
    cursor = data.response_metadata?.next_cursor;
  } while (cursor);

  return results.sort((a, b) => a.name.localeCompare(b.name));
}

export async function postSlackMessage(accessToken: string, channelId: string, text: string): Promise<void> {
  const res = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel: channelId, text }),
  });
  const data = await res.json();
  if (!data.ok) {
    const errorMap: Record<string, string> = {
      not_in_channel: "Le bot Slack n'est pas dans ce channel. Invitez-le avec /invite @Planbase dans Slack.",
      channel_not_found: "Channel introuvable. Vérifiez que le channel existe encore.",
      invalid_auth: "Token Slack invalide ou expiré. Reconnectez Slack dans les paramètres.",
      token_revoked: "Token Slack révoqué. Reconnectez Slack dans les paramètres.",
      missing_scope: "Permissions Slack insuffisantes. Reconnectez Slack pour mettre à jour les autorisations.",
      channel_is_archived: "Le channel Slack est archivé.",
      is_bot: "Impossible d'envoyer à un bot.",
      no_text: "Le message est vide.",
    };
    throw new Error(errorMap[data.error] ?? `Erreur Slack : ${data.error}`);
  }
}
