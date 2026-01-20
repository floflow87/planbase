import { Badge } from "@/components/ui/badge";
import { Clock, Check, X, AlertCircle, FileEdit } from "lucide-react";
import type { ApprovalStatus } from "@shared/schema";

interface ApprovalBadgeProps {
  status: ApprovalStatus;
  size?: "sm" | "default";
}

const statusConfig: Record<ApprovalStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  draft: { label: "Brouillon", variant: "secondary", icon: FileEdit },
  pending_approval: { label: "En attente", variant: "outline", icon: Clock },
  approved: { label: "Approuvé", variant: "default", icon: Check },
  rejected: { label: "Refusé", variant: "destructive", icon: X },
  changes_requested: { label: "Modifications demandées", variant: "outline", icon: AlertCircle },
};

export function ApprovalBadge({ status, size = "default" }: ApprovalBadgeProps) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <Badge 
      variant={config.variant}
      className={size === "sm" ? "text-xs px-2 py-0.5" : ""}
      data-testid={`badge-approval-${status}`}
    >
      <Icon className={size === "sm" ? "w-3 h-3 mr-1" : "w-4 h-4 mr-1.5"} />
      {config.label}
    </Badge>
  );
}
