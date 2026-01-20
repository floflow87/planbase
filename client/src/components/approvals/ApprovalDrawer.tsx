import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ApprovalBadge } from "./ApprovalBadge";
import { useToast } from "@/hooks/use-toast";
import { Check, X, AlertCircle, Loader2 } from "lucide-react";
import type { Approval } from "@shared/schema";

interface ApprovalDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resourceType: string;
  resourceId: string;
  resourceTitle?: string;
  projectId?: string;
}

export function ApprovalDrawer({ 
  open, 
  onOpenChange, 
  resourceType, 
  resourceId, 
  resourceTitle,
  projectId 
}: ApprovalDrawerProps) {
  const { toast } = useToast();
  const [comment, setComment] = useState("");

  const { data: approvals, isLoading } = useQuery<Approval[]>({
    queryKey: ['/api/approvals', { resourceType, resourceId }],
    queryFn: async () => {
      const res = await fetch(`/api/approvals?resourceType=${resourceType}&resourceId=${resourceId}`);
      if (!res.ok) throw new Error("Failed to fetch approvals");
      return res.json();
    },
    enabled: open,
  });

  const currentApproval = approvals?.find(a => a.resourceId === resourceId && a.status === 'pending_approval');

  const requestMutation = useMutation({
    mutationFn: async () => {
      return apiRequest('/api/approvals/request', {
        method: 'POST',
        body: JSON.stringify({ resourceType, resourceId, projectId, comment }),
      });
    },
    onSuccess: () => {
      toast({ title: "Demande envoyée", description: "La demande de validation a été envoyée." });
      queryClient.invalidateQueries({ queryKey: ['/api/approvals'] });
      setComment("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const decideMutation = useMutation({
    mutationFn: async ({ decision }: { decision: 'approved' | 'rejected' | 'changes_requested' }) => {
      if (!currentApproval) throw new Error("No pending approval");
      return apiRequest('/api/approvals/decide', {
        method: 'POST',
        body: JSON.stringify({ approvalId: currentApproval.id, decision, comment }),
      });
    },
    onSuccess: (_, { decision }) => {
      const messages: Record<string, string> = {
        approved: "Approuvé avec succès",
        rejected: "Refusé",
        changes_requested: "Modifications demandées",
      };
      toast({ title: messages[decision] });
      queryClient.invalidateQueries({ queryKey: ['/api/approvals'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      setComment("");
    },
    onError: (error: Error) => {
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
  });

  const isPending = requestMutation.isPending || decideMutation.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md" data-testid="drawer-approval">
        <SheetHeader>
          <SheetTitle>Validation</SheetTitle>
          <SheetDescription>
            {resourceTitle || `${resourceType} - ${resourceId.slice(0, 8)}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : currentApproval ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Statut:</span>
                <ApprovalBadge status={currentApproval.status} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="decision-comment">Commentaire (optionnel)</Label>
                <Textarea
                  id="decision-comment"
                  placeholder="Ajouter un commentaire..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="resize-none"
                  data-testid="input-approval-comment"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => decideMutation.mutate({ decision: 'approved' })}
                  disabled={isPending}
                  className="flex-1"
                  data-testid="button-approve"
                >
                  {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                  Approuver
                </Button>
                <Button
                  variant="outline"
                  onClick={() => decideMutation.mutate({ decision: 'changes_requested' })}
                  disabled={isPending}
                  data-testid="button-request-changes"
                >
                  <AlertCircle className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => decideMutation.mutate({ decision: 'rejected' })}
                  disabled={isPending}
                  data-testid="button-reject"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Aucune validation en attente. Vous pouvez demander une validation pour cet élément.
              </p>

              <div className="space-y-2">
                <Label htmlFor="request-comment">Commentaire (optionnel)</Label>
                <Textarea
                  id="request-comment"
                  placeholder="Ajouter un contexte..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  className="resize-none"
                  data-testid="input-request-comment"
                />
              </div>

              <Button
                onClick={() => requestMutation.mutate()}
                disabled={isPending}
                className="w-full"
                data-testid="button-request-approval"
              >
                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Demander une validation
              </Button>

              {approvals && approvals.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Historique</h4>
                  <div className="space-y-2">
                    {approvals.slice(0, 5).map((approval) => (
                      <div key={approval.id} className="flex items-center justify-between text-sm">
                        <ApprovalBadge status={approval.status} size="sm" />
                        <span className="text-muted-foreground">
                          {new Date(approval.createdAt).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
