import { google } from "googleapis";
import { storage, getGoogleClientId, getGoogleClientSecret } from "../storage";

export interface GoogleCalendarConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

export function createOAuth2Client(config: GoogleCalendarConfig) {
  return new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    config.redirectUri
  );
}

export function getAuthUrl(oauth2Client: any, state: string) {
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
    state, // state = JSON.stringify({ accountId, userId })
    prompt: "consent", // Force consent screen to get refresh_token
  });
}

export async function exchangeCodeForTokens(oauth2Client: any, code: string) {
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function refreshAccessToken(accountId: string, userId: string) {
  const token = await storage.getGoogleTokenByUserId(accountId, userId);
  if (!token) {
    throw new Error("No Google token found");
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  // Use same domain logic as routes.ts for consistency
  const domain = process.env.GOOGLE_REDIRECT_DOMAIN?.replace(/\/$/, '') 
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  
  const oauth2Client = createOAuth2Client({
    clientId,
    clientSecret,
    redirectUri: `${domain}/api/google/auth/callback`,
  });

  oauth2Client.setCredentials({
    refresh_token: token.refreshToken,
  });

  const { credentials } = await oauth2Client.refreshAccessToken();
  
  if (credentials.access_token && credentials.expiry_date) {
    await storage.updateGoogleTokenExpiry(
      accountId,
      userId,
      credentials.access_token,
      new Date(credentials.expiry_date)
    );
  }

  return credentials.access_token;
}

export async function getCalendarEvents(accountId: string, userId: string, startDate?: Date, endDate?: Date) {
  let token = await storage.getGoogleTokenByUserId(accountId, userId);
  if (!token) {
    return [];
  }

  // Check if token is expired and refresh if needed
  if (new Date(token.expiresAt) < new Date()) {
    await refreshAccessToken(accountId, userId);
    // Reload the refreshed token from storage
    token = await storage.getGoogleTokenByUserId(accountId, userId);
    if (!token) {
      return [];
    }
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  // Use same domain logic as routes.ts for consistency
  const domain = process.env.GOOGLE_REDIRECT_DOMAIN?.replace(/\/$/, '') 
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  
  const oauth2Client = createOAuth2Client({
    clientId,
    clientSecret,
    redirectUri: `${domain}/api/google/auth/callback`,
  });

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const response = await calendar.events.list({
    calendarId: "primary",
    timeMin: startDate?.toISOString(),
    timeMax: endDate?.toISOString(),
    singleEvents: true,
    orderBy: "startTime",
  });

  return response.data.items || [];
}

function buildRRule(recurrence: string, recurrenceDays?: string, recurrenceEndDate?: string): string[] {
  if (!recurrence || recurrence === "none") return [];

  const FREQ_MAP: Record<string, string> = {
    daily: "DAILY",
    weekly: "WEEKLY",
    monthly: "MONTHLY",
    yearly: "YEARLY",
  };

  const freq = FREQ_MAP[recurrence];
  if (!freq) return [];

  let rule = `RRULE:FREQ=${freq}`;

  // For daily recurrence with specific days, use BYDAY
  if (recurrence === "daily" && recurrenceDays) {
    const days = recurrenceDays.split(",").filter(Boolean);
    if (days.length > 0 && days.length < 7) {
      rule = `RRULE:FREQ=WEEKLY;BYDAY=${days.join(",")}`;
    }
  }

  if (recurrenceEndDate) {
    const endDate = new Date(recurrenceEndDate);
    const until = endDate.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    rule += `;UNTIL=${until}`;
  }

  return [rule];
}

export async function createCalendarEvent(
  accountId: string, 
  userId: string, 
  eventData: {
    title: string;
    startDateTime: string;
    endDateTime?: string;
    description?: string;
    recurrence?: string;
    recurrenceDays?: string;
    recurrenceEndDate?: string;
  }
) {
  let token = await storage.getGoogleTokenByUserId(accountId, userId);
  if (!token) {
    throw new Error("No Google token found");
  }

  // Check if token is expired and refresh if needed
  if (new Date(token.expiresAt) < new Date()) {
    await refreshAccessToken(accountId, userId);
    token = await storage.getGoogleTokenByUserId(accountId, userId);
    if (!token) {
      throw new Error("Failed to refresh Google token");
    }
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth not configured");
  }

  const domain = process.env.GOOGLE_REDIRECT_DOMAIN?.replace(/\/$/, '') 
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
  
  const oauth2Client = createOAuth2Client({
    clientId,
    clientSecret,
    redirectUri: `${domain}/api/google/auth/callback`,
  });

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });

  const endTime = eventData.endDateTime 
    ? new Date(eventData.endDateTime)
    : new Date(new Date(eventData.startDateTime).getTime() + 60 * 60 * 1000); // 1 hour default

  const rrule = buildRRule(
    eventData.recurrence || "none",
    eventData.recurrenceDays,
    eventData.recurrenceEndDate
  );

  const event: any = {
    summary: eventData.title,
    description: eventData.description || "",
    start: {
      dateTime: new Date(eventData.startDateTime).toISOString(),
      timeZone: "Europe/Paris",
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: "Europe/Paris",
    },
  };

  if (rrule.length > 0) {
    event.recurrence = rrule;
  }

  const response = await calendar.events.insert({
    calendarId: "primary",
    requestBody: event,
  });

  return response.data;
}

export async function deleteCalendarEvent(
  accountId: string,
  userId: string,
  googleEventId: string
) {
  let token = await storage.getGoogleTokenByUserId(accountId, userId);
  if (!token) return;

  if (new Date(token.expiresAt) < new Date()) {
    await refreshAccessToken(accountId, userId);
    token = await storage.getGoogleTokenByUserId(accountId, userId);
    if (!token) return;
  }

  const clientId = getGoogleClientId();
  const clientSecret = getGoogleClientSecret();
  if (!clientId || !clientSecret) return;

  const domain = process.env.GOOGLE_REDIRECT_DOMAIN?.replace(/\/$/, '')
    || (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null)
    || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

  const oauth2Client = createOAuth2Client({
    clientId,
    clientSecret,
    redirectUri: `${domain}/api/google/auth/callback`,
  });

  oauth2Client.setCredentials({
    access_token: token.accessToken,
    refresh_token: token.refreshToken,
  });

  const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  try {
    await calendar.events.delete({
      calendarId: "primary",
      eventId: googleEventId,
    });
  } catch (err: any) {
    if (err?.code !== 410 && err?.code !== 404) throw err;
  }
}
