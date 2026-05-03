import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertCircle, MessageSquare, Plus, CheckCircle2 } from "lucide-react";

interface PublicFeedbackData {
  project: { name: string; description: string | null };
  isEnabled: boolean;
  showExistingFeedbacks: boolean;
  feedbacks: PublicFeedback[];
}

interface PublicFeedback {
  id: string;
  type: string;
  title: string;
  description: string;
  importance: string;
  publicStatus: string;
  createdAt: string;
}

const feedbackFormSchema = z.object({
  contributorName: z.string().min(1, "Le nom est requis"),
  contributorEmail: z.string().email("Email invalide").optional().or(z.literal("")),
  type: z.string().min(1, "Le type est requis"),
  importance: z.string().min(1, "L'importance est requise"),
  title: z.string().min(2, "Le titre est requis (min. 2 caractères)"),
  description: z.string().min(5, "La description est requise (min. 5 caractères)"),
});
type FeedbackForm = z.infer<typeof feedbackFormSchema>;

const TYPE_LABELS: Record<string, string> = {
  bug: "Bug",
  improvement: "Amélioration",
  idea: "Idée",
  question: "Question",
  other: "Autre",
};
const TYPE_COLORS: Record<string, string> = {
  bug: "border-red-400 text-red-600 dark:text-red-400",
  improvement: "border-emerald-400 text-emerald-600 dark:text-emerald-400",
  idea: "border-violet-400 text-violet-600 dark:text-violet-400",
  question: "border-cyan-400 text-cyan-600 dark:text-cyan-400",
  other: "",
};
const IMPORTANCE_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Moyen",
  high: "Élevé",
  critical: "Critique",
};
const IMPORTANCE_COLORS: Record<string, string> = {
  critical: "border-red-500 text-red-600 dark:text-red-400",
  high: "border-orange-400 text-orange-600 dark:text-orange-400",
  medium: "border-amber-400 text-amber-600 dark:text-amber-400",
  low: "",
};
const PUBLIC_STATUS_LABELS: Record<string, string> = {
  received: "Reçu",
  reviewing: "En cours d'analyse",
  considered: "Pris en compte",
  not_selected: "Non retenu",
};

export default function FeedbackPublicPage() {
  const { shareToken } = useParams<{ shareToken: string }>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<PublicFeedbackData>({
    queryKey: [`/api/public/feedback/${shareToken}`],
    queryFn: async () => {
      const res = await fetch(`/api/public/feedback/${shareToken}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      return res.json();
    },
    retry: false,
  });

  const form = useForm<FeedbackForm>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: { contributorName: "", contributorEmail: "", type: "", importance: "medium", title: "", description: "" },
  });

  const submitMutation = useMutation({
    mutationFn: async (values: FeedbackForm) => {
      const res = await fetch(`/api/public/feedback/${shareToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur lors de l'envoi");
      }
      return res.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      setDrawerOpen(false);
      form.reset();
      refetch();
    },
  });

  const onSubmit = (values: FeedbackForm) => submitMutation.mutate(values);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm">Chargement…</div>
      </div>
    );
  }

  if (isError || !data?.isEnabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-lg font-semibold mb-2">Page non disponible</h1>
          <p className="text-sm text-muted-foreground">Cette page de feedback n'est plus disponible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Minimal header */}
      <header className="bg-background border-b border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
            <MessageSquare className="w-4 h-4 text-primary" />
          </div>
          <span className="text-sm font-semibold text-foreground">Feedback</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Project header */}
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">{data.project.name}</h1>
          {data.project.description && (
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{data.project.description}</p>
          )}
        </div>

        {/* Main CTA card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Vos retours nous aident à améliorer ce projet.</CardTitle>
            <CardDescription>Partagez un bug, une idée, une question ou une suggestion.</CardDescription>
          </CardHeader>
          <CardContent>
            {submitted ? (
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-sm py-1">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                Merci, votre feedback a bien été envoyé.
              </div>
            ) : (
              <Button onClick={() => setDrawerOpen(true)} data-testid="button-add-feedback" className="gap-2">
                <Plus className="w-4 h-4" />
                Ajouter un feedback
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Feedbacks list */}
        {data.showExistingFeedbacks ? (
          <section>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Feedbacks déjà partagés
            </h2>
            {data.feedbacks.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">Aucun feedback n'a encore été partagé.</p>
            ) : (
              <div className="space-y-3">
                {data.feedbacks.map((fb) => (
                  <Card key={fb.id} data-testid={`feedback-card-${fb.id}`}>
                    <CardContent className="pt-4 pb-4">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[fb.type] ?? ""}`}>
                          {TYPE_LABELS[fb.type] ?? fb.type}
                        </Badge>
                        <Badge variant="outline" className={`text-[10px] ${IMPORTANCE_COLORS[fb.importance] ?? ""}`}>
                          {IMPORTANCE_LABELS[fb.importance] ?? fb.importance}
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          {PUBLIC_STATUS_LABELS[fb.publicStatus] ?? fb.publicStatus}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground">{fb.title}</p>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{fb.description}</p>
                      <p className="text-[10px] text-muted-foreground mt-2">
                        {new Date(fb.createdAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </section>
        ) : (
          <p className="text-sm text-muted-foreground">
            Vous pouvez transmettre votre retour via le bouton ci-dessus.
          </p>
        )}
      </main>

      {/* Add feedback drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
          <SheetHeader className="px-5 py-4 border-b border-border shrink-0">
            <SheetTitle className="text-base font-heading">Ajouter un feedback</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" id="feedback-form">
                <FormField control={form.control} name="contributorName" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Votre nom <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Marie Dupont" {...field} data-testid="input-contributor-name" /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="contributorEmail" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Votre email <span className="text-muted-foreground">(optionnel)</span></FormLabel>
                    <FormControl><Input type="email" placeholder="marie@exemple.fr" {...field} data-testid="input-contributor-email" /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <div className="grid grid-cols-2 gap-3">
                  <FormField control={form.control} name="type" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Type <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-feedback-type"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="bug">Bug</SelectItem>
                          <SelectItem value="improvement">Amélioration</SelectItem>
                          <SelectItem value="idea">Idée</SelectItem>
                          <SelectItem value="question">Question</SelectItem>
                          <SelectItem value="other">Autre</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="importance" render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium">Importance <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-feedback-importance"><SelectValue placeholder="Choisir…" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="low">Faible</SelectItem>
                          <SelectItem value="medium">Moyen</SelectItem>
                          <SelectItem value="high">Élevé</SelectItem>
                          <SelectItem value="critical">Critique</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-xs" />
                    </FormItem>
                  )} />
                </div>
                <FormField control={form.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Titre <span className="text-destructive">*</span></FormLabel>
                    <FormControl><Input placeholder="Résumé en une ligne" {...field} data-testid="input-feedback-title" /></FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-medium">Description <span className="text-destructive">*</span></FormLabel>
                    <FormControl>
                      <Textarea placeholder="Décrivez en détail votre retour…" rows={5} {...field} data-testid="textarea-feedback-description" />
                    </FormControl>
                    <FormMessage className="text-xs" />
                  </FormItem>
                )} />
                {submitMutation.isError && (
                  <p className="text-xs text-destructive">{(submitMutation.error as Error).message}</p>
                )}
              </form>
            </Form>
          </div>
          <div className="px-5 py-4 border-t border-border shrink-0 flex gap-2 justify-end">
            <Button variant="ghost" size="sm" onClick={() => setDrawerOpen(false)}>Annuler</Button>
            <Button size="sm" type="submit" form="feedback-form" disabled={submitMutation.isPending} data-testid="button-submit-feedback">
              {submitMutation.isPending ? "Envoi…" : "Envoyer le feedback"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
