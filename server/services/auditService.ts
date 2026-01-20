import { db } from "../db";
import { auditEvents, type InsertAuditEvent, type AuditActionType } from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";

interface AuditLogParams {
  organizationId: string;
  actorMemberId?: string | null;
  actionType: AuditActionType;
  resourceType?: string;
  resourceId?: string;
  meta?: Record<string, unknown>;
}

export async function logAuditEvent(params: AuditLogParams): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      organizationId: params.organizationId,
      actorMemberId: params.actorMemberId || null,
      actionType: params.actionType,
      resourceType: params.resourceType || null,
      resourceId: params.resourceId || null,
      meta: params.meta || {},
    });
  } catch (error) {
    console.error("Failed to log audit event:", error);
  }
}

export async function getAuditEvents(
  organizationId: string,
  options: {
    limit?: number;
    actionType?: string;
    resourceType?: string;
    since?: Date;
  } = {}
) {
  const { limit = 50, actionType, resourceType, since } = options;
  
  const conditions = [eq(auditEvents.organizationId, organizationId)];
  
  if (actionType) {
    conditions.push(eq(auditEvents.actionType, actionType));
  }
  
  if (resourceType) {
    conditions.push(eq(auditEvents.resourceType, resourceType));
  }
  
  if (since) {
    conditions.push(gte(auditEvents.createdAt, since));
  }
  
  return db
    .select()
    .from(auditEvents)
    .where(and(...conditions))
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit);
}

export async function logShareCreated(
  organizationId: string,
  actorMemberId: string,
  shareLinkId: string,
  resourceType: string,
  resourceId: string
) {
  await logAuditEvent({
    organizationId,
    actorMemberId,
    actionType: 'share.created',
    resourceType,
    resourceId,
    meta: { shareLinkId },
  });
}

export async function logShareRevoked(
  organizationId: string,
  actorMemberId: string,
  shareLinkId: string,
  resourceType: string,
  resourceId: string
) {
  await logAuditEvent({
    organizationId,
    actorMemberId,
    actionType: 'share.revoked',
    resourceType,
    resourceId,
    meta: { shareLinkId },
  });
}

export async function logShareAccessed(
  organizationId: string,
  shareLinkId: string,
  resourceType: string,
  resourceId: string,
  meta: { ip?: string; userAgent?: string } = {}
) {
  await logAuditEvent({
    organizationId,
    actorMemberId: null,
    actionType: 'share.accessed',
    resourceType,
    resourceId,
    meta: { shareLinkId, ...meta },
  });
}

export async function logPermissionUpdated(
  organizationId: string,
  actorMemberId: string,
  targetMemberId: string,
  changes: Record<string, unknown>
) {
  await logAuditEvent({
    organizationId,
    actorMemberId,
    actionType: 'permission.updated',
    resourceType: 'member',
    resourceId: targetMemberId,
    meta: changes,
  });
}

export async function logPackApplied(
  organizationId: string,
  actorMemberId: string,
  targetMemberId: string,
  packId: string
) {
  await logAuditEvent({
    organizationId,
    actorMemberId,
    actionType: 'pack.applied',
    resourceType: 'member',
    resourceId: targetMemberId,
    meta: { packId },
  });
}

export async function logProjectAccessGranted(
  organizationId: string,
  actorMemberId: string,
  targetMemberId: string,
  projectId: string,
  accessLevel: string
) {
  await logAuditEvent({
    organizationId,
    actorMemberId,
    actionType: 'project_access.granted',
    resourceType: 'project',
    resourceId: projectId,
    meta: { targetMemberId, accessLevel },
  });
}

export async function logProjectAccessRevoked(
  organizationId: string,
  actorMemberId: string,
  targetMemberId: string,
  projectId: string
) {
  await logAuditEvent({
    organizationId,
    actorMemberId,
    actionType: 'project_access.revoked',
    resourceType: 'project',
    resourceId: projectId,
    meta: { targetMemberId },
  });
}

export async function logMemberRoleChanged(
  organizationId: string,
  actorMemberId: string,
  targetMemberId: string,
  oldRole: string,
  newRole: string
) {
  await logAuditEvent({
    organizationId,
    actorMemberId,
    actionType: 'member.role_changed',
    resourceType: 'member',
    resourceId: targetMemberId,
    meta: { oldRole, newRole },
  });
}

export async function logMemberRemoved(
  organizationId: string,
  actorMemberId: string,
  targetMemberId: string,
  email: string
) {
  await logAuditEvent({
    organizationId,
    actorMemberId,
    actionType: 'member.removed',
    resourceType: 'member',
    resourceId: targetMemberId,
    meta: { email },
  });
}
