import { db } from "../db";
import { approvals, type Approval, type InsertApproval, type ApprovalStatus, organizationMembers, roadmapItems } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import { logAuditEvent } from "./auditService";

interface RequestApprovalParams {
  organizationId: string;
  projectId?: string;
  resourceType: string;
  resourceId: string;
  requestedByMemberId: string;
  comment?: string;
}

interface DecideApprovalParams {
  approvalId: string;
  decidedByMemberId: string;
  decision: 'approved' | 'rejected' | 'changes_requested';
  comment?: string;
}

export async function requestApproval(params: RequestApprovalParams): Promise<Approval> {
  const { organizationId, projectId, resourceType, resourceId, requestedByMemberId, comment } = params;
  
  const [approval] = await db.insert(approvals).values({
    organizationId,
    projectId: projectId || null,
    resourceType,
    resourceId,
    status: 'pending_approval',
    requestedByMemberId,
    comment: comment || null,
  }).returning();
  
  await logAuditEvent({
    organizationId,
    actorMemberId: requestedByMemberId,
    actionType: 'approval.requested',
    resourceType,
    resourceId,
    meta: { approvalId: approval.id, projectId },
  });
  
  return approval;
}

export async function decideApproval(params: DecideApprovalParams): Promise<Approval> {
  const { approvalId, decidedByMemberId, decision, comment } = params;
  
  const [existing] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId));
  
  if (!existing) {
    throw new Error("Approval not found");
  }
  
  if (existing.status !== 'pending_approval') {
    throw new Error("Approval is not pending");
  }
  
  const [updated] = await db
    .update(approvals)
    .set({
      status: decision,
      decidedByMemberId,
      decidedAt: new Date(),
      comment: comment || existing.comment,
      updatedAt: new Date(),
    })
    .where(eq(approvals.id, approvalId))
    .returning();
  
  await logAuditEvent({
    organizationId: existing.organizationId,
    actorMemberId: decidedByMemberId,
    actionType: 'approval.decided',
    resourceType: existing.resourceType,
    resourceId: existing.resourceId,
    meta: { approvalId, decision, projectId: existing.projectId },
  });
  
  if (decision === 'approved' && existing.resourceType === 'milestone') {
    await db
      .update(roadmapItems)
      .set({
        validatedAt: new Date(),
        validatedBy: decidedByMemberId,
        status: 'done',
        milestoneStatus: 'validated',
        updatedAt: new Date(),
      })
      .where(eq(roadmapItems.id, existing.resourceId));
  }
  
  return updated;
}

export async function getApprovals(
  organizationId: string,
  options: {
    projectId?: string;
    resourceType?: string;
    status?: ApprovalStatus;
    limit?: number;
  } = {}
): Promise<Approval[]> {
  const { projectId, resourceType, status, limit = 50 } = options;
  
  const conditions = [eq(approvals.organizationId, organizationId)];
  
  if (projectId) {
    conditions.push(eq(approvals.projectId, projectId));
  }
  
  if (resourceType) {
    conditions.push(eq(approvals.resourceType, resourceType));
  }
  
  if (status) {
    conditions.push(eq(approvals.status, status));
  }
  
  return db
    .select()
    .from(approvals)
    .where(and(...conditions))
    .orderBy(desc(approvals.createdAt))
    .limit(limit);
}

export async function getApprovalById(approvalId: string): Promise<Approval | null> {
  const [approval] = await db
    .select()
    .from(approvals)
    .where(eq(approvals.id, approvalId));
  
  return approval || null;
}

export async function getPendingApprovalsForProject(projectId: string): Promise<Approval[]> {
  return db
    .select()
    .from(approvals)
    .where(and(
      eq(approvals.projectId, projectId),
      eq(approvals.status, 'pending_approval')
    ))
    .orderBy(desc(approvals.createdAt));
}

export async function getApprovalsWithDetails(
  organizationId: string,
  projectId?: string
) {
  const conditions = [eq(approvals.organizationId, organizationId)];
  if (projectId) {
    conditions.push(eq(approvals.projectId, projectId));
  }
  
  const results = await db
    .select({
      approval: approvals,
      requestedBy: organizationMembers,
    })
    .from(approvals)
    .leftJoin(organizationMembers, eq(approvals.requestedByMemberId, organizationMembers.id))
    .where(and(...conditions))
    .orderBy(desc(approvals.createdAt));
  
  return results;
}
