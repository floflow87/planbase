import { db } from "../db";
import { shareLinks, type ShareLink, type ShareResourceType } from "@shared/schema";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import crypto from "crypto";
import { logShareCreated, logShareRevoked, logShareAccessed } from "./auditService";

function generateToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

interface CreateShareLinkParams {
  organizationId: string;
  createdByMemberId: string;
  resourceType: ShareResourceType;
  resourceId: string;
  expiresInDays?: number;
  permissions?: { read: boolean; subviews?: string[] };
}

interface ShareLinkResult {
  shareLink: ShareLink;
  token: string;
  shareUrl: string;
}

export async function createShareLink(params: CreateShareLinkParams): Promise<ShareLinkResult> {
  const token = generateToken();
  const tokenHash = hashToken(token);
  
  let expiresAt: Date | null = null;
  if (params.expiresInDays) {
    expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + params.expiresInDays);
  }

  const [shareLink] = await db
    .insert(shareLinks)
    .values({
      organizationId: params.organizationId,
      createdByMemberId: params.createdByMemberId,
      resourceType: params.resourceType,
      resourceId: params.resourceId,
      tokenHash,
      expiresAt,
      permissions: params.permissions || { read: true },
    })
    .returning();

  await logShareCreated(
    params.organizationId,
    params.createdByMemberId,
    shareLink.id,
    params.resourceType,
    params.resourceId
  );

  const shareUrl = `/share/${token}`;

  return { shareLink, token, shareUrl };
}

export async function getShareLinksByResource(
  organizationId: string,
  resourceType: string,
  resourceId: string
): Promise<ShareLink[]> {
  return db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.organizationId, organizationId),
        eq(shareLinks.resourceType, resourceType),
        eq(shareLinks.resourceId, resourceId),
        isNull(shareLinks.revokedAt)
      )
    );
}

export async function revokeShareLink(
  shareLinkId: string,
  organizationId: string,
  actorMemberId: string
): Promise<ShareLink | null> {
  const [existing] = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.id, shareLinkId),
        eq(shareLinks.organizationId, organizationId)
      )
    );

  if (!existing) return null;

  const [revoked] = await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(eq(shareLinks.id, shareLinkId))
    .returning();

  await logShareRevoked(
    organizationId,
    actorMemberId,
    shareLinkId,
    existing.resourceType,
    existing.resourceId
  );

  return revoked;
}

interface ValidateShareTokenResult {
  valid: boolean;
  shareLink?: ShareLink;
  error?: "not_found" | "expired" | "revoked";
}

export async function validateShareToken(token: string): Promise<ValidateShareTokenResult> {
  const tokenHash = hashToken(token);

  const [shareLink] = await db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.tokenHash, tokenHash));

  if (!shareLink) {
    return { valid: false, error: "not_found" };
  }

  if (shareLink.revokedAt) {
    return { valid: false, error: "revoked" };
  }

  if (shareLink.expiresAt && new Date() > shareLink.expiresAt) {
    return { valid: false, error: "expired" };
  }

  return { valid: true, shareLink };
}

export async function recordShareAccess(
  shareLink: ShareLink,
  meta: { ip?: string; userAgent?: string } = {}
): Promise<void> {
  await db
    .update(shareLinks)
    .set({
      lastAccessedAt: new Date(),
      accessCount: sql`${shareLinks.accessCount} + 1`,
    })
    .where(eq(shareLinks.id, shareLink.id));

  await logShareAccessed(
    shareLink.organizationId,
    shareLink.id,
    shareLink.resourceType,
    shareLink.resourceId,
    meta
  );
}

export async function getShareLinkById(
  shareLinkId: string,
  organizationId: string
): Promise<ShareLink | null> {
  const [shareLink] = await db
    .select()
    .from(shareLinks)
    .where(
      and(
        eq(shareLinks.id, shareLinkId),
        eq(shareLinks.organizationId, organizationId)
      )
    );

  return shareLink || null;
}

export async function getAllShareLinks(organizationId: string): Promise<ShareLink[]> {
  return db
    .select()
    .from(shareLinks)
    .where(eq(shareLinks.organizationId, organizationId));
}
