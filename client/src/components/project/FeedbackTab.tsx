import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import {
  MessageSquare, Copy, ExternalLink, Link2, Plus,
  ChevronRight, Check, Trash2, MoreHorizontal, UserPlus,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface FeedbackSettings {
  id: string;
  backlogId: string;
  shareToken: string;
  isEnabled: boolean;
  showExistingFeedbacks: boolean;
  allowAttachments: boolean;
}

interface Feedback {
  id: string;
  contributorName: string;
  contributorEmail: string | null;
  type: string;
  title: string;
  description: string;
  importance: string;
  internalStatus: string;
  publicStatus: string;
  source: string;
  createdAt: string;
  archivedAt: string | null;
}

const TYPE_LABELS: Record<string, string> = { bug: "Bug", improvement: "Amélioration", idea: "Idée", question: "Question", other: "Autre" };
const TYPE_COLORS: Record<string, string> = {
  bug: "border-red-400 text-red-600 dark:text-red-400",
  improvement: "border-emerald-400 text-emerald-600 dark:text-emerald-400",
  idea: "border-violet-400 text-violet-600 dark:text-violet-400",
  question: "border-cyan-400 text-cyan-600 dark:text-cyan-400",
  other: "",
};
const IMPORTANCE_LABELS: Record<string, string> = { low: "Faible", medium: "Moyen", high: "Élevé", critical: "Critique" };
const IMPORTANCE_COLORS: Record<string, string> = {
  critical: "border-red-500 text-red-600 dark:text-red-400",
  high: "border-orange-400 text-orange-600 dark:text-orange-400",
  medium: "border-amber-400 text-amber-600 dark:text-amber-400",
  low: "",
};
const INTERNAL_STATUS_LABELS: Record<string, string> = {
  new: "Nouveau",
  to_review: "À analyser",
  accepted: "Retenu",
  converted_to_ticket: "Converti en ticket",
  rejected: "Rejeté",
  archived: "Archivé",
};
const PUBLIC_STATUS_LABELS: Record<string, string> = {
  received: "Reçu",
  reviewing: "En cours d'analyse",
  considered: "Pris en compte",
  not_selected: "Non retenu",
};

const statusUpdateSchema = z.object({
  internalStatus: z.string(),
  publicStatus: z.string(),
});

const addFeedbackSchema = z.object({
  contributorName: z.string().min(1, "Le nom est requis"),
  contributorEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  type: z.enum(["bug", "improvement", "idea", "question", "other"]),
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().min(1, "La description est requise"),
  importance: z.enum(["low", "medium", "high", "critical"]),
});

type AddFeedbackForm = z.infer<typeof addFeedbackSchema>;

interface Props { backlogId: string; }

export function FeedbackTab({ backlogId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterImportance, setFilterImportance] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: settings, isLoading: settingsLoading } = useQuery<FeedbackSettings>({
    queryKey: [`/api/backlogs/${backlogId}/feedback-settings`],
  });

  const { data: feedbacks = [], isLoading: feedbacksLoading } = useQuery<Feedback[]>({
    queryKey: [`/api/backlogs/${backlogId}/feedbacks`],
  });

  const saveSettingsMutation = useMutation({
    mutationFn: (patch: Partial<FeedbackSettings>) =>
      apiRequest(`/api/backlogs/${backlogId}/feedback-settings`, "POST", patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedback-settings`] }),
    onError: () => toast({ title: "Erreur", description: "Impossible de sauvegarder les paramètres", variant: "destructive" }),
  });

  const addFeedbackMutation = useMutation({
    mutationFn: (data: AddFeedbackForm) =>
      apiRequest(`/api/backlogs/${backlogId}/feedbacks`, "POST", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setIsAddOpen(false);
      addForm.reset();
      toast({ title: "Feedback ajouté" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible d'ajouter le feedback", variant: "destructive" }),
  });

  const updateFeedbackMutation = useMutation({
    mutationFn: ({ id, ...patch }: { id: string; internalStatus?: string; publicStatus?: string }) =>
      apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}`, "PATCH", patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setSelectedFeedback(null);
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de mettre à jour le feedback", variant: "destructive" }),
  });

  const deleteFeedbackMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/backlogs/${backlogId}/feedbacks/${id}`, "DELETE"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [`/api/backlogs/${backlogId}/feedbacks`] });
      setSelectedFeedback(null);
      toast({ title: "Feedback supprimé" });
    },
    onError: () => toast({ title: "Erreur", description: "Impossible de supprimer le feedback", variant: "destructive" }),
  });

  const detailForm = useForm<z.infer<typeof statusUpdateSchema>>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: { internalStatus: "new", publicStatus: "received" },
  });

  const addForm = useForm<AddFeedbackForm>({
    resolver: zodResolver(addFeedbackSchema),
    defaultValues: {
      contributorName: "",
      contributorEmail: "",
      type: "idea",
      title: "",
      description: "",
      importance: "medium",
    },
  });

  const openDetail = (fb: Feedback) => {
    setSelectedFeedback(fb);
    detailForm.reset({ internalStatus: fb.internalStatus, publicStatus: fb.publicStatus });
  };

  const publicUrl = settings
    ? `${window.location.origin}/feedback/${settings.shareToken}`
    : null;

  const copyLink = () => {
    if (!publicUrl) return;
    navigator.clipboard.writeText(publicUrl);
    toast({ title: "Lien copié !" });
  };

  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (filterType !== "all" && fb.type !== filterType) return false;
    if (filterImportance !== "all" && fb.importance !== filterImportance) return false;
    if (filterStatus !== "all" && fb.internalStatus !== filterStatus) return false;
    return true;
  });

  if (settingsLoading) {
    return (
      <div className="space-y-4 p-1">
        <Skeleton className="h-28 w-full rounded-md" />
        <Skeleton className="h-56 w-full rounded-md" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Settings card ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Link2 className="w-4 h-4 text-primary shrink-0" />
            <CardTitle className="text-sm">Page externe de feedback</CardTitle>
            <Badge variant={settings?.isEnabled ? "default" : "secondary"} className="text-[10px]">
              {settings?.isEnabled ? "Active" : "Désactivée"}
            </Badge>
          </div>
          <CardDescription className="text-xs">Partagez un lien public pour collecter des retours sur ce backlog.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Switch
                id="feedback-enabled"
                checked={settings?.isEnabled ?? false}
                onCheckedChange={(v) => saveSettingsMutation.mutate({ isEnabled: v })}
                data-testid="switch-feedback-enabled"
              />
              <Label htmlFor="feedback-enabled" className="text-xs">Activer la page publique</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="feedback-show"
                checked={settings?.showExistingFeedbacks ?? false}
                onCheckedChange={(v) => saveSettingsMutation.mutate({ showExistingFeedbacks: v })}
                data-testid="switch-feedback-show"
              />
              <Label htmlFor="feedback-show" className="text-xs">Afficher les feedbacks aux visiteurs</Label>
            </div>
          </div>
          {publicUrl && (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex-1 min-w-0 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground truncate">
                {publicUrl}
              </div>
              <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5 shrink-0" data-testid="button-copy-feedback-link">
                <Copy className="w-3 h-3" />
                Copier le lien
              </Button>
              <Button size="sm" variant="ghost" asChild className="shrink-0">
                <a href={publicUrl} target="_blank" rel="noopener noreferrer" data-testid="button-open-feedback-link">
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Feedbacks table ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              Feedbacks
              {feedbacks.length > 0 && (
                <Badge variant="secondary" className="text-[10px]">{feedbacks.length}</Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              {feedbacks.length > 0 && (
                <>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-7 text-xs w-32" data-testid="select-filter-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      <SelectItem value="bug">Bug</SelectItem>
                      <SelectItem value="improvement">Amélioration</SelectItem>
                      <SelectItem value="idea">Idée</SelectItem>
                      <SelectItem value="question">Question</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterImportance} onValueChange={setFilterImportance}>
                    <SelectTrigger className="h-7 text-xs w-32" data-testid="select-filter-importance">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Toutes importances</SelectItem>
                      <SelectItem value="critical">Critique</SelectItem>
                      <SelectItem value="high">Élevé</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem>
                      <SelectItem value="low">Faible</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="h-7 text-xs w-36" data-testid="select-filter-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les statuts</SelectItem>
                      <SelectItem value="new">Nouveau</SelectItem>
                      <SelectItem value="to_review">À analyser</SelectItem>
                      <SelectItem value="accepted">Retenu</SelectItem>
                      <SelectItem value="rejected">Rejeté</SelectItem>
                      <SelectItem value="archived">Archivé</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              )}
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => setIsAddOpen(true)}
                data-testid="button-add-feedback"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {feedbacksLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
            </div>
          ) : feedbacks.length === 0 ? (
            <div className="text-center py-10">
              <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Aucun feedback pour le moment</p>
              <p className="text-xs text-muted-foreground mb-4">
                Ajoutez un feedback manuellement ou partagez le lien de feedback avec vos clients.
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button size="sm" onClick={() => setIsAddOpen(true)} className="gap-1.5" data-testid="button-add-feedback-empty">
                  <UserPlus className="w-3 h-3" />
                  Ajouter un feedback
                </Button>
                {publicUrl && (
                  <Button size="sm" variant="outline" onClick={copyLink} className="gap-1.5" data-testid="button-copy-link-empty">
                    <Copy className="w-3 h-3" />
                    Copier le lien public
                  </Button>
                )}
              </div>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-6">Aucun feedback ne correspond aux filtres sélectionnés.</p>
          ) : (
            <div className="border rounded-md overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Titre</th>
                    <th className="px-3 py-2 text-left font-medium hidden sm:table-cell">Type</th>
                    <th className="px-3 py-2 text-left font-medium hidden md:table-cell">Importance</th>
                    <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Contributeur</th>
                    <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Source</th>
                    <th className="px-3 py-2 text-left font-medium hidden lg:table-cell">Date</th>
                    <th className="px-3 py-2 text-left font-medium">Statut</th>
                    <th className="px-3 py-2 w-8"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredFeedbacks.map((fb) => (
                    <tr
                      key={fb.id}
                      className="hover-elevate cursor-pointer"
                      onClick={() => openDetail(fb)}
                      data-testid={`feedback-row-${fb.id}`}
                    >
                      <td className="px-3 py-2.5 font-medium text-foreground max-w-[180px] truncate">{fb.title}</td>
                      <td className="px-3 py-2.5 hidden sm:table-cell">
                        <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[fb.type] ?? ""}`}>
                          {TYPE_LABELS[fb.type] ?? fb.type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden md:table-cell">
                        <Badge variant="outline" className={`text-[10px] ${IMPORTANCE_COLORS[fb.importance] ?? ""}`}>
                          {IMPORTANCE_LABELS[fb.importance] ?? fb.importance}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">{fb.contributorName}</td>
                      <td className="px-3 py-2.5 hidden lg:table-cell">
                        <Badge variant="outline" className="text-[10px]">
                          {fb.source === "manual" ? "Manuel" : "Lien public"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 hidden lg:table-cell text-muted-foreground">
                        {new Date(fb.createdAt).toLocaleDateString("fr-FR")}
                      </td>
                      <td className="px-3 py-2.5">
                        <Badge variant="secondary" className="text-[10px]">
                          {INTERNAL_STATUS_LABELS[fb.internalStatus] ?? fb.internalStatus}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button size="icon" variant="ghost" data-testid={`button-feedback-actions-${fb.id}`}>
                              <MoreHorizontal className="w-3.5 h-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openDetail(fb); }}>
                              Voir le détail
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {["new","to_review","accepted","rejected","archived"].map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={fb.internalStatus === s}
                                onClick={(e) => { e.stopPropagation(); updateFeedbackMutation.mutate({ id: fb.id, internalStatus: s }); }}
                              >
                                {fb.internalStatus === s && <Check className="w-3 h-3 mr-1.5" />}
                                {INTERNAL_STATUS_LABELS[s]}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => { e.stopPropagation(); deleteFeedbackMutation.mutate(fb.id); }}
                            >
                              <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Add feedback sheet ── */}
      <Sheet open={isAddOpen} onOpenChange={setIsAddOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-sm font-heading">Ajouter un feedback</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <Form {...addForm}>
              <form
                id="add-feedback-form"
                onSubmit={addForm.handleSubmit((v) => addFeedbackMutation.mutate(v))}
                className="space-y-4"
              >
                <FormField control={addForm.control} name="contributorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Nom du contributeur *</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex : Marie Dupont" className="text-sm" data-testid="input-contributor-name" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="contributorEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Email (optionnel)</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="marie@example.com" className="text-sm" data-testid="input-contributor-email" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={addForm.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-xs" data-testid="select-feedback-type">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bug">Bug</SelectItem>
                          <SelectItem value="improvement">Amélioration</SelectItem>
                          <SelectItem value="idea">Idée</SelectItem>
                          <SelectItem value="question">Question</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={addForm.control} name="importance" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Importance</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-xs" data-testid="select-feedback-importance">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="critical">Critique</SelectItem>
                          <SelectItem value="high">Élevé</SelectItem>
                          <SelectItem value="medium">Moyen</SelectItem>
                          <SelectItem value="low">Faible</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </div>
                <FormField control={addForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Titre *</FormLabel>
                    <FormControl>
                      <Input placeholder="Résumé du feedback" className="text-sm" data-testid="input-feedback-title" {...field} />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={addForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Description *</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Description détaillée du feedback…"
                        className="text-sm resize-none"
                        rows={4}
                        data-testid="textarea-feedback-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
              </form>
            </Form>
          </div>
          <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2 justify-end">
            <Button size="sm" variant="outline" onClick={() => setIsAddOpen(false)}>Annuler</Button>
            <Button
              size="sm"
              type="submit"
              form="add-feedback-form"
              disabled={addFeedbackMutation.isPending}
              data-testid="button-submit-feedback"
            >
              {addFeedbackMutation.isPending ? "Ajout…" : "Ajouter"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Detail drawer ── */}
      <Sheet open={!!selectedFeedback} onOpenChange={(v) => { if (!v) setSelectedFeedback(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-sm font-heading">Détail du feedback</SheetTitle>
          </SheetHeader>
          {selectedFeedback && (
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Titre</p>
                <p className="text-sm font-semibold">{selectedFeedback.title}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{selectedFeedback.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contributeur</p>
                  <p className="text-sm">{selectedFeedback.contributorName}</p>
                  {selectedFeedback.contributorEmail && (
                    <p className="text-xs text-muted-foreground">{selectedFeedback.contributorEmail}</p>
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Date</p>
                  <p className="text-sm">{new Date(selectedFeedback.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</p>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[selectedFeedback.type] ?? ""}`}>
                  {TYPE_LABELS[selectedFeedback.type] ?? selectedFeedback.type}
                </Badge>
                <Badge variant="outline" className={`text-[10px] ${IMPORTANCE_COLORS[selectedFeedback.importance] ?? ""}`}>
                  {IMPORTANCE_LABELS[selectedFeedback.importance] ?? selectedFeedback.importance}
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {selectedFeedback.source === "manual" ? "Ajouté manuellement" : "Via lien public"}
                </Badge>
              </div>
              <Form {...detailForm}>
                <form
                  onSubmit={detailForm.handleSubmit((v) => updateFeedbackMutation.mutate({ id: selectedFeedback.id, ...v }))}
                  className="space-y-3"
                  id="detail-form"
                >
                  <FormField control={detailForm.control} name="internalStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Statut interne</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-xs h-8" data-testid="select-internal-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(INTERNAL_STATUS_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                  <FormField control={detailForm.control} name="publicStatus" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Statut public</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="text-xs h-8" data-testid="select-public-status">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(PUBLIC_STATUS_LABELS).map(([v, l]) => (
                            <SelectItem key={v} value={v}>{l}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />
                </form>
              </Form>
            </div>
          )}
          <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2 justify-between">
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive gap-1.5"
              onClick={() => selectedFeedback && deleteFeedbackMutation.mutate(selectedFeedback.id)}
              disabled={deleteFeedbackMutation.isPending}
              data-testid="button-delete-feedback"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Supprimer
            </Button>
            <Button
              size="sm"
              type="submit"
              form="detail-form"
              disabled={updateFeedbackMutation.isPending}
              data-testid="button-save-feedback-status"
            >
              {updateFeedbackMutation.isPending ? "Sauvegarde…" : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
