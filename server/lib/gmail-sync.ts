import { google, gmail_v1 } from "googleapis";
import crypto from "crypto";
import { storage, getGoogleClientId, getGoogleClientSecret } from "../storage";
import { createOAuth2Client, refreshAccessToken } from "./google-calendar";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.send",
];
const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

export interface GmailParsedMessage {
  gmailMessageId: string;
  gmailThreadId: string;
  rfcMessageId: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  fromEmail: string;
  fromName: string;
  sentAt: Date;
  direction: "sent" | "received";
  hasAttachments: boolean;
  isCalendarInvite: boolean;
  labels: string[];
  participants: GmailParticipant[];
}

export interface GmailParticipant {
  emailAddress: string;
  displayName: string;
  role: "from" | "to" | "cc" | "bcc";
}

export interface GmailActivityPayload {
  gmailMessageId: string;
  emailMessageId: string;
  rfcMessageId: string;
  threadId: string;
  subject: string;
  snippet: string;
  bodyText: string;
  bodyHtml: string;
  fromEmail: string;
  fromName: string;
  direction: "sent" | "received";
  hasAttachments: boolean;
  contactNames: string;
  recipients: string;
  participants: Array<{ email: string; name: string; role: string }>;
}

function getStateSecret(): string {
  return process.env.SESSION_SECRET || process.env.GOOGLE_CLIENT_SECRET || "planbase-gmail-state-secret";
}

function signState(payload: string): string {
  const hmac = crypto.createHmac("sha256", getStateSecret());
  hmac.update(payload);
  return hmac.digest("hex");
}

function getRedirectDomain() {
  if (process.env.GOOGLE_REDIRECT_DOMAIN) {
    return process.env.GOOGLE_REDIRECT_DOMAIN.replace(/\/$/, '');
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return `https://${process.env.REPLIT_DEV_DOMAIN}`;
  }
  return `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
}

export function createSignedState(accountId: string, userId: string, purpose?: string): string {
  const payload = JSON.stringify({ accountId, userId, purpose: purpose || "calendar" });
  const sig = signState(payload);
  return JSON.stringify({ payload, sig });
}

export function verifySignedState(state: string): { accountId: string; userId: string; purpose: string } {
  const parsed = JSON.parse(state);
  const { payload, sig } = parsed;
  if (!payload || !sig) {
    throw new Error("Invalid OAuth state: missing payload or signature");
  }
  const expectedSig = signState(payload);
  if (!crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expectedSig, "hex"))) {
    throw new Error("Invalid OAuth state: signature mismatch");
  }
  const data = JSON.parse(payload);
  return { accountId: data.accountId, userId: data.userId, purpose: data.purpose || "calendar" };
}

export function getGmailAuthUrl(accountId: string, userId: string): string {
  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  const domain = getRedirectDomain();
  const oauth2Client = createOAuth2Client({
    clientId,
    clientSecret,
    redirectUri: `${domain}/api/google/auth/callback`,
  });

  const state = JSON.stringify({ accountId, userId, purpose: "gmail" });

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [...CALENDAR_SCOPES, ...GMAIL_SCOPES],
    state,
    prompt: "consent",
  });
  return authUrl;
}

async function getAuthedGmailClient(accountId: string, userId: string) {
  let token = await storage.getGoogleTokenByUserId(accountId, userId);
  if (!token) throw new Error("No Google token found");

  if (new Date(token.expiresAt) < new Date()) {
    await refreshAccessToken(accountId, userId);
    token = await storage.getGoogleTokenByUserId(accountId, userId);
    if (!token) throw new Error("Failed to refresh Google token");
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) throw new Error("Google OAuth not configured");

  const domain = getRedirectDomain();
  const oauth2Client = createOAuth2Client({
    clientId,
    clientSecret,
    redirectUri: `${domain}/api/google/auth/callback`,
  });

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  return { gmail: google.gmail({ version: "v1", auth: oauth2Client }), userEmail: token.email };
}

interface GmailHeader {
  name: string;
  value: string;
}

function getHeader(headers: GmailHeader[], name: string): string {
  const header = headers.find((h) => h.name?.toLowerCase() === name.toLowerCase());
  return header?.value || "";
}

function parseEmailAddress(raw: string): { email: string; name: string } {
  const match = raw.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
  if (match) {
    return { name: (match[1] || "").trim(), email: match[2].trim().toLowerCase() };
  }
  return { name: "", email: raw.trim().toLowerCase() };
}

function parseAddressList(raw: string): Array<{ email: string; name: string }> {
  if (!raw) return [];
  return raw.split(",").map((addr) => parseEmailAddress(addr.trim())).filter((a) => a.email);
}

function extractTextBody(payload: Record<string, unknown> | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain") {
    const body = payload.body as Record<string, unknown> | undefined;
    if (body?.data) {
      return Buffer.from(body.data as string, "base64url").toString("utf-8");
    }
  }
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }
  return "";
}

function extractHtmlBody(payload: Record<string, unknown> | undefined): string {
  if (!payload) return "";
  if (payload.mimeType === "text/html") {
    const body = payload.body as Record<string, unknown> | undefined;
    if (body?.data) {
      return Buffer.from(body.data as string, "base64url").toString("utf-8");
    }
  }
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      const html = extractHtmlBody(part);
      if (html) return html;
    }
  }
  return "";
}

function hasCalendarPart(payload: Record<string, unknown> | undefined): boolean {
  if (!payload) return false;
  if (payload.mimeType === "text/calendar") return true;
  if (payload.mimeType === "application/ics") return true;
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      if (hasCalendarPart(part)) return true;
    }
  }
  return false;
}

function detectAttachments(payload: Record<string, unknown> | undefined): boolean {
  if (!payload) return false;
  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (!parts) return false;
  for (const part of parts) {
    const filename = part.filename as string | undefined;
    if (filename && filename.length > 0) return true;
    if (detectAttachments(part)) return true;
  }
  return false;
}

const NOREPLY_PATTERNS = [
  /^no[-_.]?reply/i,
  /^noreply/i,
  /^do[-_.]?not[-_.]?reply/i,
  /^mailer[-_.]?daemon/i,
  /^postmaster/i,
  /^notifications?@/i,
  /^news(letter)?@/i,
];

function isFilteredAddress(email: string): boolean {
  return NOREPLY_PATTERNS.some((p) => p.test(email));
}

export function parseMessage(msg: Record<string, unknown>, userEmail: string): GmailParsedMessage | null {
  const payload = msg.payload as Record<string, unknown> | undefined;
  const headers = (payload?.headers || []) as GmailHeader[];
  const subject = getHeader(headers, "Subject");
  const from = getHeader(headers, "From");
  const to = getHeader(headers, "To");
  const cc = getHeader(headers, "Cc");
  const bcc = getHeader(headers, "Bcc");
  const dateStr = getHeader(headers, "Date");
  const rfcMessageId = getHeader(headers, "Message-ID") || getHeader(headers, "Message-Id") || "";

  const fromParsed = parseEmailAddress(from);

  if (isFilteredAddress(fromParsed.email)) return null;

  const toList = parseAddressList(to);
  const ccList = parseAddressList(cc);
  const bccList = parseAddressList(bcc);

  const direction = fromParsed.email.toLowerCase() === userEmail.toLowerCase() ? "sent" : "received";

  const sentAt = dateStr ? new Date(dateStr) : new Date();

  const bodyText = extractTextBody(payload as Record<string, unknown> | undefined);
  const bodyHtml = extractHtmlBody(payload as Record<string, unknown> | undefined);

  const hasAttachments = detectAttachments(payload as Record<string, unknown> | undefined);
  const isCalendarInvite = hasCalendarPart(payload as Record<string, unknown> | undefined);

  const participants: GmailParticipant[] = [
    { emailAddress: fromParsed.email, displayName: fromParsed.name, role: "from" },
    ...toList.map((a): GmailParticipant => ({ emailAddress: a.email, displayName: a.name, role: "to" })),
    ...ccList.map((a): GmailParticipant => ({ emailAddress: a.email, displayName: a.name, role: "cc" })),
    ...bccList.map((a): GmailParticipant => ({ emailAddress: a.email, displayName: a.name, role: "bcc" })),
  ];

  return {
    gmailMessageId: msg.id as string,
    gmailThreadId: (msg.threadId as string) || "",
    rfcMessageId,
    subject,
    snippet: (msg.snippet as string) || "",
    bodyText,
    bodyHtml,
    fromEmail: fromParsed.email,
    fromName: fromParsed.name,
    sentAt,
    direction,
    hasAttachments,
    isCalendarInvite,
    labels: (msg.labelIds as string[]) || [],
    participants,
  };
}

async function fetchMessageIds(gmail: gmail_v1.Gmail, limit = 200, afterDate?: Date): Promise<string[]> {
  const allMessageIds = new Set<string>();

  let afterQuery: string | undefined;
  if (afterDate) {
    const y = afterDate.getFullYear();
    const m = String(afterDate.getMonth() + 1).padStart(2, "0");
    const d = String(afterDate.getDate()).padStart(2, "0");
    afterQuery = `after:${y}/${m}/${d}`;
  }

  for (const label of ["INBOX", "SENT"]) {
    let pageToken: string | undefined;
    let fetched = 0;
    do {
      const listRes = await gmail.users.messages.list({
        userId: "me",
        maxResults: 100,
        labelIds: [label],
        pageToken,
        ...(afterQuery ? { q: afterQuery } : {}),
      });

      const messages = listRes.data.messages || [];
      for (const m of messages) {
        if (m.id) allMessageIds.add(m.id);
      }
      fetched += messages.length;
      pageToken = listRes.data.nextPageToken || undefined;
    } while (pageToken && fetched < limit);
  }

  return [...allMessageIds];
}

async function fetchMessageIdsByHistory(gmail: gmail_v1.Gmail, startHistoryId: string): Promise<{ messageIds: string[]; newHistoryId: string | null }> {
  const messageIds: string[] = [];
  let pageToken: string | undefined;
  let newHistoryId: string | null = null;

  try {
    do {
      const historyRes = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        maxResults: 100,
        pageToken,
      });

      newHistoryId = historyRes.data.historyId || null;
      const historyRecords = historyRes.data.history || [];

      for (const record of historyRecords) {
        const added = record.messagesAdded || [];
        for (const item of added) {
          if (item.message?.id) {
            messageIds.push(item.message.id);
          }
        }
      }

      pageToken = historyRes.data.nextPageToken || undefined;
    } while (pageToken);
  } catch (err: any) {
    const statusCode = err?.code || err?.response?.status || err?.status;
    if (statusCode === 404) {
      return { messageIds: [], newHistoryId: null };
    }
    throw err;
  }

  return { messageIds: [...new Set(messageIds)], newHistoryId };
}

function buildActivityPayload(parsed: GmailParsedMessage, emailMsgId: string, contactNames: string): GmailActivityPayload {
  const toRecipients = parsed.participants
    .filter((p) => p.role === "to" || p.role === "cc")
    .map((p) => p.displayName || p.emailAddress)
    .join(", ");

  return {
    gmailMessageId: parsed.gmailMessageId,
    emailMessageId: emailMsgId,
    rfcMessageId: parsed.rfcMessageId,
    threadId: parsed.gmailThreadId,
    subject: parsed.subject,
    snippet: parsed.snippet,
    bodyText: parsed.bodyText,
    bodyHtml: parsed.bodyHtml,
    fromEmail: parsed.fromEmail,
    fromName: parsed.fromName,
    direction: parsed.direction,
    hasAttachments: parsed.hasAttachments,
    contactNames,
    recipients: toRecipients,
    participants: parsed.participants.slice(0, 10).map((p) => ({
      email: p.emailAddress,
      name: p.displayName,
      role: p.role,
    })),
  };
}

export async function syncGmail(accountId: string, userId: string, forceFullSync = false): Promise<{ synced: number; linked: number }> {
  console.log(`📧 Gmail sync starting for account=${accountId}, user=${userId}, forceFullSync=${forceFullSync}`);
  const { gmail, userEmail } = await getAuthedGmailClient(accountId, userId);

  const token = await storage.getGoogleTokenByUserId(accountId, userId);
  if (!token) throw new Error("No Google token found");

  const syncPeriodMonths = token.gmailSyncPeriodMonths ?? 3;
  const afterDate = new Date();
  afterDate.setMonth(afterDate.getMonth() - syncPeriodMonths);

  let allMessageIds: string[];
  let useIncremental = false;
  const lastHistoryId = forceFullSync ? null : await storage.getGmailLastHistoryId(accountId, userId);

  if (lastHistoryId) {
    console.log(`📧 Gmail sync: trying incremental sync from historyId=${lastHistoryId}`);
    const result = await fetchMessageIdsByHistory(gmail, lastHistoryId);
    if (result.newHistoryId) {
      allMessageIds = result.messageIds;
      useIncremental = true;
      await storage.setGmailLastHistoryId(accountId, userId, result.newHistoryId);
      console.log(`📧 Gmail sync: incremental found ${allMessageIds.length} new messages`);
    } else {
      console.log(`📧 Gmail sync: incremental failed (history expired), falling back to full sync`);
      allMessageIds = await fetchMessageIds(gmail, 200, afterDate);
    }
  } else {
    console.log(`📧 Gmail sync: no history ID or forced, performing full sync (last ${syncPeriodMonths} months)`);
    allMessageIds = await fetchMessageIds(gmail, 200, afterDate);
  }

  console.log(`📧 Gmail sync: ${allMessageIds.length} messages to process`);

  const profileRes = await gmail.users.getProfile({ userId: "me" });
  const currentHistoryId = profileRes.data.historyId;
  if (currentHistoryId && !useIncremental) {
    await storage.setGmailLastHistoryId(accountId, userId, currentHistoryId);
  }

  let synced = 0;
  let linked = 0;

  const allContacts = await storage.getContactsByAccountId(accountId);
  const contactEmailMap = new Map<string, { contactId: string; clientId: string }>();
  for (const contact of allContacts) {
    if (contact.email) {
      contactEmailMap.set(contact.email.toLowerCase(), {
        contactId: contact.id,
        clientId: contact.clientId,
      });
    }
  }

  for (const msgId of allMessageIds) {
    try {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: msgId,
        format: "full",
      });

      const parsed = parseMessage(msgRes.data, userEmail);
      if (!parsed) continue;
      if (parsed.isCalendarInvite) continue;

      const emailMsg = await storage.upsertEmailMessage({
        accountId,
        userId,
        gmailMessageId: parsed.gmailMessageId,
        gmailThreadId: parsed.gmailThreadId,
        subject: parsed.subject,
        snippet: parsed.snippet,
        bodyText: parsed.bodyText,
        fromEmail: parsed.fromEmail,
        fromName: parsed.fromName,
        sentAt: parsed.sentAt,
        direction: parsed.direction,
        hasAttachments: parsed.hasAttachments ? 1 : 0,
        labels: parsed.labels,
      });

      if (!emailMsg) continue;
      synced++;

      await storage.upsertEmailParticipants(
        emailMsg.id,
        parsed.participants.map((p) => ({
          emailMessageId: emailMsg.id,
          emailAddress: p.emailAddress,
          displayName: p.displayName,
          role: p.role,
        }))
      );

      const matchedContacts = new Set<string>();
      const matchedClients = new Set<string>();

      for (const participant of parsed.participants) {
        const match = contactEmailMap.get(participant.emailAddress.toLowerCase());
        if (match) {
          matchedContacts.add(match.contactId);
          matchedClients.add(match.clientId);
        }
      }

      if (matchedContacts.size > 0) {
        const links: Array<{ emailMessageId: string; contactId: string; clientId: string; linkType: string }> = [];
        for (const contactId of matchedContacts) {
          const contact = allContacts.find((c) => c.id === contactId);
          if (contact) {
            links.push({
              emailMessageId: emailMsg.id,
              contactId,
              clientId: contact.clientId,
              linkType: "participant",
            });
          }
        }
        if (links.length > 0) {
          await storage.upsertEmailLinks(emailMsg.id, links);
          linked += links.length;
        }

        for (const clientId of matchedClients) {
          const contactsForClient = allContacts.filter(
            (c) => c.clientId === clientId && matchedContacts.has(c.id)
          );
          const contactNames = contactsForClient.map((c) => c.fullName).join(", ");

          const existingClientActivities = await storage.getActivitiesBySubject(accountId, "client", clientId);
          const existingClientActivity = existingClientActivities.find((a) => {
            const p = a.payload as Record<string, unknown> | null;
            return a.kind === "email" && p?.gmailMessageId === parsed.gmailMessageId;
          });

          if (!existingClientActivity) {
            await storage.createActivity({
              accountId,
              subjectType: "client",
              subjectId: clientId,
              kind: "email",
              description: parsed.subject || "(sans objet)",
              occurredAt: parsed.sentAt,
              payload: buildActivityPayload(parsed, emailMsg.id, contactNames),
              createdBy: userId,
            });
          } else if ((parsed.bodyText || parsed.bodyHtml) && (!(existingClientActivity.payload as Record<string, unknown>)?.bodyText && !(existingClientActivity.payload as Record<string, unknown>)?.bodyHtml)) {
            await storage.updateActivity(existingClientActivity.id, {
              payload: buildActivityPayload(parsed, emailMsg.id, contactNames),
            });
          }
        }

        for (const contactId of matchedContacts) {
          const contact = allContacts.find((c) => c.id === contactId);
          const contactName = contact?.fullName || "";

          const existingContactActivities = await storage.getActivitiesBySubject(accountId, "contact", contactId);
          const existingContactActivity = existingContactActivities.find((a) => {
            const p = a.payload as Record<string, unknown> | null;
            return a.kind === "email" && p?.gmailMessageId === parsed.gmailMessageId;
          });

          if (!existingContactActivity) {
            await storage.createActivity({
              accountId,
              subjectType: "contact",
              subjectId: contactId,
              kind: "email",
              description: parsed.subject || "(sans objet)",
              occurredAt: parsed.sentAt,
              payload: buildActivityPayload(parsed, emailMsg.id, contactName),
              createdBy: userId,
            });
          } else if ((parsed.bodyText || parsed.bodyHtml) && (!(existingContactActivity.payload as Record<string, unknown>)?.bodyText && !(existingContactActivity.payload as Record<string, unknown>)?.bodyHtml)) {
            await storage.updateActivity(existingContactActivity.id, {
              payload: buildActivityPayload(parsed, emailMsg.id, contactName),
            });
          }
        }
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to sync Gmail message ${msgId}:`, errMsg);
    }
  }

  await storage.setGmailSyncTimestamp(accountId, userId);

  console.log(`📧 Gmail sync complete: ${synced} emails synced, ${linked} links created`);
  return { synced, linked };
}

export async function sendGmailEmail(
  accountId: string,
  userId: string,
  to: string,
  subject: string,
  body: string,
  replyToMessageId?: string,
  threadId?: string,
): Promise<{ gmailMessageId: string }> {
  const { gmail, userEmail } = await getAuthedGmailClient(accountId, userId);

  const headers = [
    `From: ${userEmail}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset="UTF-8"`,
  ];

  if (replyToMessageId) {
    headers.push(`In-Reply-To: ${replyToMessageId}`);
    headers.push(`References: ${replyToMessageId}`);
  }

  const rawMessage = headers.join("\r\n") + "\r\n\r\n" + body;
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sendRes = await gmail.users.messages.send({
    userId: "me",
    requestBody: {
      raw: encodedMessage,
      threadId: threadId || undefined,
    },
  });

  const sentMsgId = sendRes.data.id;
  if (!sentMsgId) throw new Error("Gmail send failed: no message ID returned");

  return { gmailMessageId: sentMsgId };
}
