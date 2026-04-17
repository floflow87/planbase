import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import {
  Zap, Plus, Trash2, Edit2, ChevronLeft, CheckCircle2,
  AlertCircle, Loader2, Info, FlaskConical, Hash, Lock
} from "lucide-react";
import { SiSlack } from "react-icons/si";

export type AutomationScopeType = "global" | "project" | "backlog" | "roadmap" | "crm";

interface AutomationDrawerProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scopeType?: AutomationScopeType;
  scopeId?: string;
  scopeLabel?: string;
}

export const EVENT_OPTIONS: { value: string; label: string; variables: string[] }[] = [
  // Backlog
  { value: "backlog.ticket_created", label: "Ticket créé", variables: ["title", "backlog_name", "product_name", "user_name", "priority"] },
  { value: "backlog.ticket_updated", label: "Ticket mis à jour", variables: ["title", "backlog_name", "product_name", "user_name"] },
  { value: "backlog.prioritized", label: "Ticket priorisé", variables: ["title", "backlog_name", "product_name", "user_name", "priority"] },
  { value: "backlog.ticket_completed", label: "Ticket terminé", variables: ["title", "backlog_name", "product_name", "user_name"] },
  { value: "backlog.sprint_started", label: "Sprint démarré", variables: ["sprint_name", "backlog_name", "product_name", "user_name"] },
  { value: "backlog.sprint_completed", label: "Sprint terminé", variables: ["sprint_name", "backlog_name", "product_name", "user_name"] },
  // Project
  { value: "project.created", label: "Projet créé", variables: ["project_name", "user_name", "client_name"] },
  { value: "project.updated", label: "Projet mis à jour", variables: ["project_name", "user_name", "status"] },
  { value: "project.milestone_reached", label: "Jalon atteint", variables: ["project_name", "milestone", "user_name"] },
  { value: "task.created", label: "Tâche créée", variables: ["title", "project_name", "user_name"] },
  { value: "task.completed", label: "Tâche terminée", variables: ["title", "project_name", "user_name"] },
  // Roadmap
  { value: "roadmap.updated", label: "Roadmap mise à jour", variables: ["roadmap_name", "item_title", "user_name"] },
  { value: "roadmap.item_created", label: "Élément créé", variables: ["item_title", "roadmap_name", "user_name"] },
  { value: "roadmap.item_completed", label: "Élément terminé", variables: ["item_title", "roadmap_name", "user_name"] },
  // CRM
  { value: "crm.deal_created", label: "Opportunité créée", variables: ["deal_name", "client_name", "user_name", "amount"] },
  { value: "crm.deal_won", label: "Deal gagné", variables: ["deal_name", "client_name", "user_name", "amount"] },
  { value: "crm.stage_changed", label: "Étape CRM modifiée", variables: ["deal_name", "client_name", "old_stage", "new_stage"] },
  { value: "crm.client_created", label: "Client créé", variables: ["client_name", "user_name"] },
  // Notes
  { value: "note.created", label: "Note créée", variables: ["title", "user_name"] },
];

const SCOPE_EVENT_FILTER: Record<AutomationScopeType, string[] | null> = {
  global: null,
  project: ["project.created", "project.updated", "project.milestone_reached", "task.created", "task.completed"],
  backlog: ["backlog.ticket_created", "backlog.ticket_updated", "backlog.prioritized", "backlog.ticket_completed", "backlog.sprint_started", "backlog.sprint_completed"],
  roadmap: ["roadmap.updated", "roadmap.item_created", "roadmap.item_completed"],
  crm: ["crm.deal_created", "crm.deal_won", "crm.stage_changed", "crm.client_created"],
};

const SCOPE_CONDITION_FIELDS: Record<AutomationScopeType, string[]> = {
  global: ["priority", "status", "stage", "client_name", "project_name", "user_name"],
  project: ["priority", "status", "project_name", "user_name"],
  backlog: ["priority", "status", "backlog_name", "product_name", "user_name"],
  roadmap: ["roadmap_name", "user_name"],
  crm: ["stage", "client_name", "user_name"],
};

const CONDITION_VALUE_OPTIONS: Record<string, { value: string; label: string }[]> = {
  priority: [
    { value: "low", label: "Basse" },
    { value: "medium", label: "Moyenne" },
    { value: "high", label: "Haute" },
    { value: "critical", label: "Critique" },
  ],
  status: [
    { value: "todo", label: "À faire" },
    { value: "in_progress", label: "En cours" },
    { value: "done", label: "Terminé" },
    { value: "cancelled", label: "Annulé" },
  ],
  stage: [
    { value: "prospecting", label: "Prospect" },
    { value: "qualified", label: "Qualifié" },
    { value: "negotiation", label: "Négociation" },
    { value: "quote_sent", label: "Devis envoyé" },
    { value: "quote_approved", label: "Devis validé" },
    { value: "won", label: "Gagné" },
    { value: "lost", label: "Perdu" },
  ],
};

const CONDITION_OPERATORS = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "contains", label: "∈" },
  { value: "not_contains", label: "∉" },
];

const VARIABLE_LABELS: Record<string, string> = {
  deal_name: "opportunité",
  client_name: "nom du client",
  old_stage: "ancienne étape",
  new_stage: "nouvelle étape",
  user_name: "déclenché par",
  project_name: "projet",
  title: "titre",
  priority: "priorité",
  status: "statut",
  amount: "montant",
  roadmap_name: "roadmap",
  item_title: "élément",
  milestone: "jalon",
  backlog_name: "nom du backlog",
  product_name: "produit",
  sprint_name: "sprint",
};

const CONDITION_FIELD_LABELS: Record<string, string> = {
  user_name: "Utilisateur",
  stage: "Étape",
  client_name: "Client",
  priority: "Priorité",
  status: "Statut",
  project_name: "Projet",
  backlog_name: "Backlog",
  product_name: "Produit",
  roadmap_name: "Roadmap",
};

export const SCOPE_LABELS: Record<string, string> = {
  global: "Global",
  project: "Projet",
  backlog: "Backlog",
  roadmap: "Roadmap",
  crm: "CRM",
};


interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface SlackChannel {
  id: string;
  name: string;
  isPrivate: boolean;
}

interface AutomationFormData {
  name: string;
  eventType: string;
  conditions: Condition[];
  slackChannelId: string;
  slackChannelName: string;
  messageTemplate: string;
}

const DEFAULT_FORM: AutomationFormData = {
  name: "",
  eventType: "",
  conditions: [],
  slackChannelId: "",
  slackChannelName: "",
  messageTemplate: "",
};

function interpolatePreview(template: string): string {
  const samples: Record<string, string> = {
    title: "Refonte onboarding client",
    project_name: "LVBCA – Design Hermès",
    user_name: "Florent Martin",
    priority: "Haute",
    status: "En cours",
    client_name: "LVBCA",
    deal_name: "Contrat LVBCA Q2 2026",
    amount: "8 500 €",
    old_stage: "Qualifié",
    new_stage: "Devis envoyé",
    roadmap_name: "Q2 2026",
    item_title: "Refonte authentification",
    milestone: "MVP v1",
    backlog_name: "Backlog Produit Q2",
    product_name: "PlanBase",
    sprint_name: "Sprint 4 – Automations",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => samples[k] ?? `{{${k}}}`);
}

interface SlackStatus {
  connected: boolean;
  teamId?: string;
  teamName?: string;
  connectedAt?: string;
}

export function AutomationDrawer({ open, onOpenChange, scopeType = "global", scopeId, scopeLabel }: AutomationDrawerProps) {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AutomationFormData>(DEFAULT_FORM);
  const [testingId, setTestingId] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function insertVariable(variable: string) {
    const el = textareaRef.current;
    if (!el) {
      setForm(f => ({ ...f, messageTemplate: f.messageTemplate + `{{${variable}}}` }));
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const snippet = `{{${variable}}}`;
    const newVal = el.value.slice(0, start) + snippet + el.value.slice(end);
    setForm(f => ({ ...f, messageTemplate: newVal }));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  const qKey = ["/api/automations", scopeType, scopeId ?? "global"];

  const { data: automationList = [], isLoading } = useQuery<any[]>({
    queryKey: qKey,
    queryFn: async () => {
      const params = new URLSearchParams({ scopeType });
      if (scopeId) params.set("scopeId", scopeId);
      const res = await apiRequest(`/api/automations?${params}`, "GET");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: open,
  });

  const { data: slackStatus } = useQuery<SlackStatus>({
    queryKey: ["/api/slack/status"],
    enabled: open,
  });

  const { data: slackChannels = [], isLoading: isLoadingChannels } = useQuery<SlackChannel[]>({
    queryKey: ["/api/slack/channels"],
    enabled: open && view === "form" && slackStatus?.connected === true,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/automations", "POST", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); toast({ title: "Automation créée", variant: "success" }); resetForm(); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest(`/api/automations/${id}`, "PATCH", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); toast({ title: "Automation mise à jour", variant: "success" }); resetForm(); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest(`/api/automations/${id}`, "DELETE"),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); toast({ title: "Automation supprimée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest(`/api/automations/${id}`, "PATCH", { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });

  const testMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/automations/${id}/test`, "POST");
      return await res.json();
    },
    onSuccess: (_data, _id) => {
      setTestingId(null);
      toast({ title: "Message Slack envoyé avec succès", description: "Le message de test a bien été posté dans le channel.", variant: "success" });
    },
    onError: (e: any) => {
      setTestingId(null);
      // Parse JSON error message if possible
      let msg = e.message || "Erreur inconnue";
      try {
        const match = msg.match(/^\d+: (.+)$/s);
        if (match) {
          const parsed = JSON.parse(match[1]);
          msg = parsed.error || msg;
        }
      } catch {}
      toast({ title: "Erreur Slack", description: msg, variant: "destructive" });
    },
    retry: 0,
  });

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setView("list");
  }

  function openCreate() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
    setView("form");
  }

  function openEdit(auto: any) {
    setForm({
      name: auto.name,
      eventType: auto.eventType,
      conditions: Array.isArray(auto.conditions) ? auto.conditions : [],
      slackChannelId: auto.slackChannelId || auto.slack_channel_id || "",
      slackChannelName: auto.slackChannelName || auto.slack_channel_name || "",
      messageTemplate: auto.messageTemplate || "",
    });
    setEditingId(auto.id);
    setView("form");
  }

  function handleSubmit() {
    if (!form.name || !form.eventType || !form.slackChannelId || !form.messageTemplate) {
      toast({ title: "Champs requis manquants", description: "Remplis tous les champs obligatoires.", variant: "destructive" });
      return;
    }
    const payload = {
      name: form.name,
      scopeType,
      scopeId: scopeId ?? null,
      eventType: form.eventType,
      conditions: form.conditions,
      actionType: "slack_message",
      slackChannelId: form.slackChannelId,
      slackChannelName: form.slackChannelName,
      messageTemplate: form.messageTemplate,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  function addCondition() {
    setForm(f => ({ ...f, conditions: [...f.conditions, { field: "status", operator: "equals", value: "" }] }));
  }

  function removeCondition(i: number) {
    setForm(f => ({ ...f, conditions: f.conditions.filter((_, idx) => idx !== i) }));
  }

  function updateCondition(i: number, patch: Partial<Condition>) {
    setForm(f => ({ ...f, conditions: f.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) }));
  }

  const selectedEvent = EVENT_OPTIONS.find(e => e.value === form.eventType);
  const preview = form.messageTemplate ? interpolatePreview(form.messageTemplate) : "";
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isSlackConnected = slackStatus?.connected === true;

  const filteredEventOptions = SCOPE_EVENT_FILTER[scopeType] === null
    ? EVENT_OPTIONS
    : EVENT_OPTIONS.filter(e => SCOPE_EVENT_FILTER[scopeType]!.includes(e.value));

  const conditionFields = SCOPE_CONDITION_FIELDS[scopeType];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[480px] bg-white dark:bg-gray-900 flex flex-col gap-0 p-0" style={{ zIndex: 9999 }}>
        <SheetHeader className="px-4 sm:px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            {view === "form" && (
              <Button variant="ghost" size="icon" onClick={resetForm} className="mr-1" data-testid="button-back-automations">
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
            <Zap className="w-4 h-4 text-yellow-500" />
            <SheetTitle className="text-base font-semibold">
              {view === "list" ? "Automatisations" : editingId ? "Modifier l'automation" : "Nouvelle automation"}
            </SheetTitle>
            {view === "list" && scopeLabel && (
              <Badge variant="secondary" className="text-xs ml-1">{scopeLabel}</Badge>
            )}
          </div>
          {view === "list" && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {scopeType === "global"
                ? "Ces automatisations s'appliquent à toute l'organisation."
                : `Automatisations spécifiques à ce ${scopeType}.`}
            </p>
          )}
        </SheetHeader>

        {/* LIST VIEW */}
        {view === "list" && (
          <div className="flex-1 overflow-y-auto">
            {/* Slack status banner */}
            <div className={`mx-4 sm:mx-6 mt-4 mb-2 rounded-md px-3 py-2 flex items-center gap-2 text-xs border ${isSlackConnected ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400"}`}>
              <SiSlack className="w-3.5 h-3.5 flex-shrink-0" />
              {isSlackConnected ? (
                <span>Slack connecté — <strong>{slackStatus?.teamName}</strong></span>
              ) : (
                <span>
                  Slack non connecté.{" "}
                  <Link href="/settings?tab=integrations" className="underline font-medium" onClick={() => onOpenChange(false)}>
                    Connecter Slack
                  </Link>
                </span>
              )}
            </div>

            <div className="px-4 sm:px-6 py-3">
              <Button size="sm" onClick={openCreate} className="w-full gap-2" data-testid="button-create-automation">
                <Plus className="w-3.5 h-3.5" />
                Créer une automation
              </Button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : automationList.length === 0 ? (
              <div className="text-center py-12 px-6">
                <Zap className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground font-medium">Aucune automation</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Crée ta première règle pour recevoir des alertes Slack automatiquement.</p>
              </div>
            ) : (
              <div className="px-4 sm:px-6 space-y-2 pb-6">
                {automationList.map((auto: any) => {
                  const eventLabel = EVENT_OPTIONS.find(e => e.value === auto.eventType)?.label ?? auto.eventType;
                  const channelName = auto.slackChannelName || auto.slack_channel_name;
                  return (
                    <div key={auto.id} className="border rounded-md p-3 space-y-2 bg-card hover-elevate" data-testid={`card-automation-${auto.id}`}>
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{auto.name}</span>
                            <Badge variant={auto.isActive ? "default" : "secondary"} className="text-[10px]">
                              {auto.isActive ? "Actif" : "Inactif"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">Déclencheur :</span>
                            <span className="text-[11px] font-medium text-muted-foreground">{eventLabel}</span>
                            {channelName && (
                              <>
                                <span className="text-[11px] text-muted-foreground">·</span>
                                <span className="text-[11px] text-muted-foreground flex items-center gap-0.5">
                                  <Hash className="w-2.5 h-2.5" />
                                  {channelName}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                        <Switch
                          checked={auto.isActive}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: auto.id, isActive: v })}
                          className="scale-[0.7] origin-right -ml-2 shrink-0"
                          data-testid={`switch-automation-${auto.id}`}
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" className="text-xs h-7 gap-1.5" onClick={() => openEdit(auto)} data-testid={`button-edit-automation-${auto.id}`}>
                          <Edit2 className="w-3 h-3" />
                          Modifier
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7 gap-1.5"
                          disabled={testingId === auto.id}
                          onClick={() => { setTestingId(auto.id); testMutation.mutate(auto.id); }}
                          data-testid={`button-test-automation-${auto.id}`}
                        >
                          {testingId === auto.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
                          Tester
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-destructive ml-auto"
                          onClick={() => deleteMutation.mutate(auto.id)}
                          disabled={deleteMutation.isPending}
                          data-testid={`button-delete-automation-${auto.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* FORM VIEW */}
        {view === "form" && (
          <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
            {/* Slack not connected warning */}
            {!isSlackConnected && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2.5 text-xs text-amber-700 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  Slack n'est pas connecté.{" "}
                  <Link href="/settings?tab=integrations" className="underline font-medium" onClick={() => { onOpenChange(false); }}>
                    Connecter Slack depuis les paramètres.
                  </Link>
                </span>
              </div>
            )}

            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nom <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex : Alerte deal gagné"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-xs h-8"
                data-testid="input-automation-name"
              />
            </div>

            {/* Event */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Déclencheur <span className="text-destructive">*</span></Label>
              <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                <SelectTrigger className="text-xs h-8" data-testid="select-event-type">
                  <SelectValue placeholder="Choisir un événement..." />
                </SelectTrigger>
                <SelectContent style={{ zIndex: 10000 }}>
                  {filteredEventOptions.map(e => (
                    <SelectItem key={e.value} value={e.value} className="text-[11px]">{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Conditions <span className="text-xs text-muted-foreground font-normal">(optionnel)</span></Label>
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={addCondition} data-testid="button-add-condition">
                  <Plus className="w-3 h-3" />
                  Ajouter
                </Button>
              </div>
              {form.conditions.map((cond, i) => {
                const valueOptions = CONDITION_VALUE_OPTIONS[cond.field];
                return (
                  <div key={i} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 p-2 rounded-md border bg-muted/20">
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <Select value={cond.field} onValueChange={v => updateCondition(i, { field: v, value: "" })}>
                        <SelectTrigger className="text-[11px] h-7 flex-1" data-testid={`select-condition-field-${i}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 10000 }}>
                          {conditionFields.map(f => (
                            <SelectItem key={f} value={f} className="text-[11px]">
                              {CONDITION_FIELD_LABELS[f] ?? f}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={cond.operator} onValueChange={v => updateCondition(i, { operator: v })}>
                        <SelectTrigger className="text-sm h-7 w-10 flex-shrink-0 px-1 font-mono" data-testid={`select-condition-operator-${i}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent style={{ zIndex: 10000 }}>
                          {CONDITION_OPERATORS.map(o => <SelectItem key={o.value} value={o.value} className="text-sm font-mono">{o.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      {valueOptions ? (
                        <Select value={cond.value} onValueChange={v => updateCondition(i, { value: v })}>
                          <SelectTrigger className="text-[11px] h-7 flex-1" data-testid={`select-condition-value-${i}`}>
                            <SelectValue placeholder="Choisir..." />
                          </SelectTrigger>
                          <SelectContent style={{ zIndex: 10000 }}>
                            {valueOptions.map(o => <SelectItem key={o.value} value={o.value} className="text-[11px]">{o.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          placeholder="valeur"
                          value={cond.value}
                          onChange={e => updateCondition(i, { value: e.target.value })}
                          className="text-[11px] h-7 flex-1"
                          data-testid={`input-condition-value-${i}`}
                        />
                      )}
                      <Button variant="ghost" size="icon" className="w-7 h-7 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={() => removeCondition(i)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Slack Action */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <SiSlack className="w-4 h-4 text-[#4A154B]" />
                <Label className="text-xs font-medium">Action Slack</Label>
                {slackStatus?.teamName && (
                  <Badge variant="secondary" className="text-[10px] ml-auto">{slackStatus.teamName}</Badge>
                )}
              </div>

              {/* Channel selector */}
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Channel <span className="text-destructive">*</span></Label>
                {!isSlackConnected ? (
                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Slack doit être connecté pour choisir un channel.
                  </div>
                ) : isLoadingChannels ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Chargement des channels...
                  </div>
                ) : (
                  <Select
                    value={form.slackChannelId}
                    onValueChange={v => {
                      const ch = slackChannels.find(c => c.id === v);
                      setForm(f => ({ ...f, slackChannelId: v, slackChannelName: ch?.name ?? "" }));
                    }}
                  >
                    <SelectTrigger className="text-xs h-8" data-testid="select-slack-channel">
                      <SelectValue placeholder="Choisir un channel Slack..." />
                    </SelectTrigger>
                    <SelectContent style={{ zIndex: 10000 }}>
                      {slackChannels.map(ch => (
                        <SelectItem key={ch.id} value={ch.id} className="text-[11px]">
                          <span className="flex items-center gap-1.5">
                            {ch.isPrivate ? <Lock className="w-3 h-3 text-muted-foreground" /> : <Hash className="w-3 h-3 text-muted-foreground" />}
                            {ch.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Message template */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-muted-foreground">Message template <span className="text-destructive">*</span></Label>
                  {selectedEvent && (
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Info className="w-3 h-3 flex-shrink-0" />
                      Cliquez pour insérer
                    </span>
                  )}
                </div>
                {selectedEvent && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedEvent.variables.map(v => (
                      <button
                        key={v}
                        type="button"
                        onMouseDown={e => { e.preventDefault(); insertVariable(v); }}
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-mono bg-primary/10 text-primary border border-primary/20 hover-elevate cursor-pointer select-none"
                        data-testid={`button-var-${v}`}
                        title={`{{${v}}}`}
                      >
                        <Hash className="w-2.5 h-2.5 flex-shrink-0" />
                        {VARIABLE_LABELS[v] ?? v}
                      </button>
                    ))}
                  </div>
                )}
                <Textarea
                  ref={textareaRef}
                  placeholder={"Ticket priorisé : {{title}}\nProjet : {{project_name}}\nPar : {{user_name}}"}
                  value={form.messageTemplate}
                  onChange={e => setForm(f => ({ ...f, messageTemplate: e.target.value }))}
                  className="text-sm min-h-[100px] font-mono text-xs"
                  data-testid="textarea-message-template"
                />
              </div>

              {/* Preview */}
              {preview && (
                <div className="rounded-md bg-muted/30 border p-3 space-y-1">
                  <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Aperçu</p>
                  <p className="text-xs whitespace-pre-wrap">{preview}</p>
                </div>
              )}
            </div>

            {/* Submit */}
            <div className="flex gap-2 pt-2 border-t pb-4">
              <Button variant="outline" size="sm" className="flex-1" onClick={resetForm} data-testid="button-cancel-automation">
                Annuler
              </Button>
              <Button size="sm" className="flex-1 gap-2" onClick={handleSubmit} disabled={isSaving} data-testid="button-save-automation">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {editingId ? "Mettre à jour" : "Créer l'automation"}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

interface AutomationButtonProps {
  scopeType?: AutomationScopeType;
  scopeId?: string;
  scopeLabel?: string;
  className?: string;
}

export function AutomationButton({ scopeType = "global", scopeId, scopeLabel, className }: AutomationButtonProps) {
  const [open, setOpen] = useState(false);
  const { data: count = [] } = useQuery<any[]>({
    queryKey: ["/api/automations", scopeType, scopeId ?? "global"],
    queryFn: async () => {
      const params = new URLSearchParams({ scopeType });
      if (scopeId) params.set("scopeId", scopeId);
      const res = await apiRequest(`/api/automations?${params}`, "GET");
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOpen(true)}
            className={`relative ${className ?? ""}`}
            data-testid="button-open-automations"
          >
            <Zap className="w-4 h-4 text-yellow-500" />
            {count.length > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center leading-none font-medium">
                {count.length}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[10px] px-2 py-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-border shadow-sm">Automatisations</TooltipContent>
      </Tooltip>
      <AutomationDrawer
        open={open}
        onOpenChange={setOpen}
        scopeType={scopeType}
        scopeId={scopeId}
        scopeLabel={scopeLabel}
      />
    </>
  );
}
