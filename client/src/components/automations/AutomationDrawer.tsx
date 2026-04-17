import { useState } from "react";
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
import { useToast } from "@/hooks/use-toast";
import {
  Zap, Plus, Trash2, Edit2, ChevronLeft, Send, CheckCircle2,
  AlertCircle, Loader2, Info, FlaskConical
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

const EVENT_OPTIONS: { value: string; label: string; variables: string[] }[] = [
  { value: "backlog.created", label: "Backlog créé", variables: ["title", "project_name", "user_name"] },
  { value: "backlog.updated", label: "Backlog mis à jour", variables: ["title", "project_name", "user_name"] },
  { value: "backlog.prioritized", label: "Ticket priorisé", variables: ["title", "project_name", "user_name", "priority"] },
  { value: "backlog.completed", label: "Ticket terminé", variables: ["title", "project_name", "user_name"] },
  { value: "project.created", label: "Projet créé", variables: ["project_name", "user_name", "client_name"] },
  { value: "project.updated", label: "Projet mis à jour", variables: ["project_name", "user_name", "status"] },
  { value: "project.milestone_reached", label: "Jalon atteint", variables: ["project_name", "milestone", "user_name"] },
  { value: "roadmap.updated", label: "Roadmap mise à jour", variables: ["roadmap_name", "item_title", "user_name"] },
  { value: "crm.deal_created", label: "Opportunité créée", variables: ["deal_name", "client_name", "user_name", "amount"] },
  { value: "crm.deal_won", label: "Deal gagné", variables: ["deal_name", "client_name", "user_name", "amount"] },
  { value: "crm.stage_changed", label: "Étape CRM modifiée", variables: ["deal_name", "client_name", "old_stage", "new_stage"] },
  { value: "note.created", label: "Note créée", variables: ["title", "user_name"] },
  { value: "task.created", label: "Tâche créée", variables: ["title", "project_name", "user_name"] },
  { value: "task.completed", label: "Tâche terminée", variables: ["title", "project_name", "user_name"] },
];

const CONDITION_FIELDS = ["priority", "status", "stage", "client_name", "project_name", "user_name"];
const CONDITION_OPERATORS = [
  { value: "equals", label: "=" },
  { value: "not_equals", label: "≠" },
  { value: "contains", label: "contient" },
  { value: "not_contains", label: "ne contient pas" },
];

interface Condition {
  field: string;
  operator: string;
  value: string;
}

interface AutomationFormData {
  name: string;
  eventType: string;
  conditions: Condition[];
  slackWebhookUrl: string;
  messageTemplate: string;
}

const DEFAULT_FORM: AutomationFormData = {
  name: "",
  eventType: "",
  conditions: [],
  slackWebhookUrl: "",
  messageTemplate: "",
};

function interpolatePreview(template: string): string {
  const samples: Record<string, string> = {
    title: "Fix bug de connexion",
    project_name: "Projet Alpha",
    user_name: "Alice Dupont",
    priority: "high",
    status: "done",
    client_name: "Acme Corp",
    deal_name: "Contrat Acme",
    amount: "12 000 €",
    old_stage: "Qualifié",
    new_stage: "Devis envoyé",
    roadmap_name: "Q2 2025",
    item_title: "Refonte auth",
    milestone: "MVP",
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => samples[k] ?? `{{${k}}}`);
}

export function AutomationDrawer({ open, onOpenChange, scopeType = "global", scopeId, scopeLabel }: AutomationDrawerProps) {
  const { toast } = useToast();
  const [view, setView] = useState<"list" | "form">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AutomationFormData>(DEFAULT_FORM);
  const [testingId, setTestingId] = useState<string | null>(null);

  const qKey = ["/api/automations", scopeType, scopeId ?? "global"];

  const { data: automationList = [], isLoading } = useQuery<any[]>({
    queryKey: qKey,
    queryFn: async () => {
      const params = new URLSearchParams({ scopeType });
      if (scopeId) params.set("scopeId", scopeId);
      const res = await fetch(`/api/automations?${params}`, {
        headers: { "x-user-id": localStorage.getItem("userId") || "", "x-account-id": localStorage.getItem("accountId") || "" },
        credentials: "include",
      });
      return res.json();
    },
    enabled: open,
  });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/automations", data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); toast({ title: "Automation créée", variant: "success" }); resetForm(); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/automations/${id}`, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); toast({ title: "Automation mise à jour", variant: "success" }); resetForm(); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/automations/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: qKey }); toast({ title: "Automation supprimée" }); },
    onError: (e: any) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => apiRequest("PATCH", `/api/automations/${id}`, { isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: qKey }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/automations/${id}/test`),
    onSuccess: () => { setTestingId(null); toast({ title: "Message Slack envoyé avec succès", variant: "success" }); },
    onError: (e: any) => { setTestingId(null); toast({ title: "Erreur webhook", description: e.message, variant: "destructive" }); },
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
      slackWebhookUrl: auto.slackWebhookUrl || "",
      messageTemplate: auto.messageTemplate || "",
    });
    setEditingId(auto.id);
    setView("form");
  }

  function handleSubmit() {
    if (!form.name || !form.eventType || !form.slackWebhookUrl || !form.messageTemplate) {
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
      slackWebhookUrl: form.slackWebhookUrl,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:w-[520px] bg-white dark:bg-gray-900 flex flex-col gap-0 p-0" style={{ zIndex: 9999 }}>
        <SheetHeader className="px-6 py-4 border-b flex-shrink-0">
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
            <div className="px-6 py-4">
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
              <div className="px-6 space-y-2 pb-6">
                {automationList.map((auto: any) => {
                  const eventLabel = EVENT_OPTIONS.find(e => e.value === auto.eventType)?.label ?? auto.eventType;
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
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[11px] text-muted-foreground">Déclencheur :</span>
                            <span className="text-[11px] font-medium text-muted-foreground">{eventLabel}</span>
                          </div>
                        </div>
                        <Switch
                          checked={auto.isActive}
                          onCheckedChange={(v) => toggleMutation.mutate({ id: auto.id, isActive: v })}
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
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Nom <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex : Alerte ticket priorisé"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="text-sm"
                data-testid="input-automation-name"
              />
            </div>

            {/* Trigger */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Déclencheur <span className="text-destructive">*</span></Label>
              <Select value={form.eventType} onValueChange={v => setForm(f => ({ ...f, eventType: v }))}>
                <SelectTrigger className="text-sm" data-testid="select-automation-event">
                  <SelectValue placeholder="Choisir un événement..." />
                </SelectTrigger>
                <SelectContent className="bg-white dark:bg-gray-900" style={{ zIndex: 10000 }}>
                  {EVENT_OPTIONS.map(e => (
                    <SelectItem key={e.value} value={e.value} className="text-xs">{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Conditions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Conditions (optionnel)</Label>
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={addCondition} data-testid="button-add-condition">
                  <Plus className="w-3 h-3" />
                  Ajouter
                </Button>
              </div>
              {form.conditions.length === 0 && (
                <p className="text-xs text-muted-foreground">Sans condition, l'automation se déclenche à chaque fois.</p>
              )}
              {form.conditions.map((cond, i) => (
                <div key={i} className="flex items-center gap-1.5" data-testid={`condition-row-${i}`}>
                  <Select value={cond.field} onValueChange={v => updateCondition(i, { field: v })}>
                    <SelectTrigger className="text-xs h-8 flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-900" style={{ zIndex: 10000 }}>
                      {CONDITION_FIELDS.map(f => (
                        <SelectItem key={f} value={f} className="text-xs">{f}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={cond.operator} onValueChange={v => updateCondition(i, { operator: v })}>
                    <SelectTrigger className="text-xs h-8 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-gray-900" style={{ zIndex: 10000 }}>
                      {CONDITION_OPERATORS.map(op => (
                        <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="valeur"
                    value={cond.value}
                    onChange={e => updateCondition(i, { value: e.target.value })}
                    className="text-xs h-8 flex-1"
                    data-testid={`input-condition-value-${i}`}
                  />
                  <Button variant="ghost" size="icon" className="w-8 h-8 text-muted-foreground hover:text-destructive" onClick={() => removeCondition(i)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Slack Action */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <SiSlack className="w-4 h-4 text-[#4A154B]" />
                <Label className="text-xs font-medium">Action Slack</Label>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Webhook URL <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  value={form.slackWebhookUrl}
                  onChange={e => setForm(f => ({ ...f, slackWebhookUrl: e.target.value }))}
                  className="text-sm font-mono text-xs"
                  data-testid="input-slack-webhook"
                />
                <p className="text-[10px] text-muted-foreground">
                  Crée un Incoming Webhook dans les paramètres de ton espace Slack.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Message template <span className="text-destructive">*</span></Label>
                <Textarea
                  placeholder={"🎯 Ticket priorisé : {{title}}\nProjet : {{project_name}}\nPar : {{user_name}}"}
                  value={form.messageTemplate}
                  onChange={e => setForm(f => ({ ...f, messageTemplate: e.target.value }))}
                  className="text-sm min-h-[100px] font-mono text-xs"
                  data-testid="textarea-message-template"
                />
                {selectedEvent && (
                  <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                    <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                    <span>Variables disponibles : {selectedEvent.variables.map(v => `{{${v}}}`).join(", ")}</span>
                  </div>
                )}
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
            <div className="flex gap-2 pt-2 border-t">
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
      const res = await fetch(`/api/automations?${params}`, {
        headers: { "x-user-id": localStorage.getItem("userId") || "", "x-account-id": localStorage.getItem("accountId") || "" },
        credentials: "include",
      });
      return res.json();
    },
  });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className={`gap-1.5 text-xs ${className ?? ""}`}
        onClick={() => setOpen(true)}
        data-testid="button-automations"
      >
        <Zap className="w-3.5 h-3.5 text-yellow-500" />
        Automatiser
        {count.length > 0 && (
          <Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">{count.length}</Badge>
        )}
      </Button>
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
