import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, MoreVertical, Pencil, Copy, Trash2, FileText, Tag, ChevronDown } from "lucide-react";
import { TEMPLATE_CATEGORIES, TEMPLATE_VARIABLES } from "@/lib/emailTemplateRenderer";

interface EmailTemplate {
  id: string;
  name: string;
  category: string;
  subject: string;
  body: string;
  description?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

const CATEGORY_COLORS: Record<string, string> = {
  commercial: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  projet: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  facturation: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  administratif: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  autre: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
};

function getCategoryLabel(value: string) {
  return TEMPLATE_CATEGORIES.find(c => c.value === value)?.label ?? value;
}

function VariableInsertMenu({ onInsert }: { onInsert: (v: string) => void }) {
  const groups = Array.from(new Set(TEMPLATE_VARIABLES.map(v => v.group)));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" type="button" className="text-xs gap-1">
          <Tag className="w-3 h-3" />
          Insérer variable
          <ChevronDown className="w-3 h-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {groups.map((group, gi) => (
          <div key={group}>
            {gi > 0 && <DropdownMenuSeparator />}
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{group}</div>
            {TEMPLATE_VARIABLES.filter(v => v.group === group).map(v => (
              <DropdownMenuItem key={v.value} onClick={() => onInsert(v.value)} className="text-xs">
                <span className="font-mono text-violet-600 dark:text-violet-400 mr-2">{v.value}</span>
                {v.label}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface EditorDialogProps {
  open: boolean;
  onClose: () => void;
  template?: EmailTemplate | null;
}

function TemplateEditorDialog({ open, onClose, template }: EditorDialogProps) {
  const { toast } = useToast();
  const [name, setName] = useState(template?.name ?? "");
  const [category, setCategory] = useState(template?.category ?? "autre");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [activeField, setActiveField] = useState<"subject" | "body">("body");

  const isEdit = !!template;

  function resetToTemplate(t?: EmailTemplate | null) {
    setName(t?.name ?? "");
    setCategory(t?.category ?? "autre");
    setSubject(t?.subject ?? "");
    setBody(t?.body ?? "");
    setDescription(t?.description ?? "");
    setActiveField("body");
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { name: name.trim(), category, subject, body, description: description || null };
      if (isEdit) {
        const res = await apiRequest(`/api/email-templates/${template!.id}`, "PATCH", payload);
        return res.json();
      } else {
        const res = await apiRequest("/api/email-templates", "POST", payload);
        return res.json();
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: isEdit ? "Template mis à jour" : "Template créé", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600" });
      onClose();
    },
    onError: () => toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" }),
  });

  function handleInsertVariable(v: string) {
    if (activeField === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? subject.length;
      const end = el.selectionEnd ?? subject.length;
      const next = subject.slice(0, start) + v + subject.slice(end);
      setSubject(next);
      setTimeout(() => { el.setSelectionRange(start + v.length, start + v.length); el.focus(); }, 0);
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      const next = body.slice(0, start) + v + body.slice(end);
      setBody(next);
      setTimeout(() => { el.setSelectionRange(start + v.length, start + v.length); el.focus(); }, 0);
    }
  }

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { onClose(); resetToTemplate(template); } }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier le template" : "Nouveau template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Nom du template *</label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex : Relance facture" data-testid="input-template-name" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Catégorie</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger data-testid="select-template-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATE_CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Description interne (optionnelle)</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Usage interne, non envoyé" data-testid="input-template-description" />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Cliquez dans un champ puis insérez une variable</p>
            <VariableInsertMenu onInsert={handleInsertVariable} />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Objet *</label>
            <Input
              ref={subjectRef}
              value={subject}
              onChange={e => setSubject(e.target.value)}
              onFocus={() => setActiveField("subject")}
              placeholder="Ex : Relance – facture {{project.name}}"
              data-testid="input-template-subject"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Corps du message *</label>
            <Textarea
              ref={bodyRef}
              value={body}
              onChange={e => setBody(e.target.value)}
              onFocus={() => setActiveField("body")}
              placeholder={"Bonjour {{contact.first_name}},\n\nJe reviens vers vous concernant..."}
              className="min-h-[220px] font-mono text-sm"
              data-testid="input-template-body"
            />
          </div>
          {body && (
            <TemplatePreview subject={subject} body={body} />
          )}
        </div>
        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => { onClose(); resetToTemplate(template); }}>Annuler</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || !subject.trim() || saveMutation.isPending} data-testid="button-save-template">
            {saveMutation.isPending ? "Enregistrement…" : isEdit ? "Mettre à jour" : "Créer le template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TemplatePreview({ subject, body }: { subject: string; body: string }) {
  const vars = Array.from(new Set([...subject.matchAll(/\{\{[a-z_.]+\}\}/g), ...body.matchAll(/\{\{[a-z_.]+\}\}/g)].map(m => m[0])));
  if (vars.length === 0) return null;
  return (
    <div className="rounded-md border bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800 p-3">
      <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1">Variables détectées</p>
      <div className="flex flex-wrap gap-1">
        {vars.map(v => (
          <code key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-700">{v}</code>
        ))}
      </div>
    </div>
  );
}

import { PremiumGate } from "@/components/billing/PremiumGate";

function EmailTemplatesInner() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/email-templates"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => apiRequest(`/api/email-templates/${id}`, "DELETE"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Template supprimé" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Erreur lors de la suppression", variant: "destructive" }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest(`/api/email-templates/${id}/duplicate`, "POST");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-templates"] });
      toast({ title: "Template dupliqué", className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600" });
    },
    onError: () => toast({ title: "Erreur lors de la duplication", variant: "destructive" }),
  });

  const filtered = templates.filter(t => {
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.subject.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === "all" || t.category === filterCat;
    return matchSearch && matchCat;
  });

  function openCreate() {
    setEditingTemplate(null);
    setEditorOpen(true);
  }

  function openEdit(t: EmailTemplate) {
    setEditingTemplate(t);
    setEditorOpen(true);
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-card">
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold">Templates email</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{templates.length} template{templates.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} data-testid="button-new-template" size="sm">
          <Plus className="w-4 h-4 mr-1.5" />
          Nouveau template
        </Button>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher…"
            className="pl-9 text-xs h-8"
            data-testid="input-template-search"
          />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-44 text-xs h-8" data-testid="select-template-filter">
            <SelectValue placeholder="Catégorie" />
          </SelectTrigger>
          <SelectContent className="text-xs">
            <SelectItem value="all" className="text-xs">Toutes les catégories</SelectItem>
            {TEMPLATE_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-40 bg-muted animate-pulse rounded-md" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-10 h-10 text-muted-foreground mb-3" />
            <p className="text-sm font-medium">
              {templates.length === 0 ? "Aucun template pour l'instant" : "Aucun résultat"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {templates.length === 0 ? "Créez votre premier template pour gagner du temps." : "Modifiez vos filtres de recherche."}
            </p>
            {templates.length === 0 && (
              <Button onClick={openCreate} size="sm" className="mt-4">
                <Plus className="w-4 h-4 mr-1.5" />
                Créer un template
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(t => (
              <Card key={t.id} className="group hover-elevate cursor-default" data-testid={`card-template-${t.id}`}>
                <CardContent className="p-4 flex flex-col h-full gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{t.name}</p>
                      {t.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{t.description}</p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" data-testid={`button-template-menu-${t.id}`}>
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(t)} data-testid={`menu-edit-${t.id}`}>
                          <Pencil className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => duplicateMutation.mutate(t.id)} data-testid={`menu-duplicate-${t.id}`}>
                          <Copy className="w-4 h-4 mr-2" />
                          Dupliquer
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setDeleteTarget(t)} className="text-destructive" data-testid={`menu-delete-${t.id}`}>
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <Badge className={`self-start text-[10px] ${CATEGORY_COLORS[t.category] ?? CATEGORY_COLORS.autre}`}>
                    {getCategoryLabel(t.category)}
                  </Badge>

                  <div className="bg-muted/50 rounded-md p-2.5 flex-1">
                    <p className="text-xs font-medium text-muted-foreground truncate mb-1">
                      {t.subject || <span className="italic">(objet vide)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-line">
                      {t.body || <span className="italic">(corps vide)</span>}
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-1 pt-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)} data-testid={`button-edit-${t.id}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Modifier</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => duplicateMutation.mutate(t.id)} data-testid={`button-dup-${t.id}`}>
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Dupliquer</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="ghost" onClick={() => setDeleteTarget(t)} data-testid={`button-del-${t.id}`}>
                          <Trash2 className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Supprimer</TooltipContent>
                    </Tooltip>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Editor dialog */}
      {editorOpen && (
        <TemplateEditorDialog
          open={editorOpen}
          onClose={() => { setEditorOpen(false); setEditingTemplate(null); }}
          template={editingTemplate}
        />
      )}

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={v => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce template ?</AlertDialogTitle>
            <AlertDialogDescription>
              Le template <strong>"{deleteTarget?.name}"</strong> sera supprimé définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmailTemplatesGated() {
  return (
    <PremiumGate feature="email_templates">
      <EmailTemplatesInner />
    </PremiumGate>
  );
}

export default EmailTemplatesGated;

export function EmailTemplatesTab() {
  return <EmailTemplatesGated />;
}
