import { google } from "googleapis";
import { storage } from "../storage";

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
    scope: ["https://www.googleapis.com/auth/calendar.readonly"],
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

  const account = await storage.getAccount(accountId);
  if (!account?.googleClientId || !account.googleClientSecret) {
    throw new Error("Google OAuth not configured for this account");
  }

  const oauth2Client = createOAuth2Client({
    clientId: account.googleClientId,
    clientSecret: account.googleClientSecret,
    redirectUri: `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/api/google/auth/callback`,
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
  const token = await storage.getGoogleTokenByUserId(accountId, userId);
  if (!token) {
    return [];
  }

  // Check if token is expired and refresh if needed
  if (new Date(token.expiresAt) < new Date()) {
    await refreshAccessToken(accountId, userId);
  }

  const account = await storage.getAccount(accountId);
  if (!account?.googleClientId || !account.googleClientSecret) {
    throw new Error("Google OAuth not configured");
  }

  const oauth2Client = createOAuth2Client({
    clientId: account.googleClientId,
    clientSecret: account.googleClientSecret,
    redirectUri: `${process.env.REPLIT_DEV_DOMAIN || "http://localhost:5000"}/api/google/auth/callback`,
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
