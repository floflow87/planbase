import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info, RotateCcw, FlaskConical } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { computeSimulation, type SimulationCurrentState } from "@/lib/simulationUtils";
import type { Project } from "@shared/schema";

interface SimulationDrawerProps {
  open: boolean;
  onClose: () => void;
  project: Project;
  currentState: SimulationCurrentState;
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
function fmtPct(n: number) {
  return `${n.toFixed(1)}%`;
}
function fmtDate(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

const TODAY = new Date().toISOString().split("T")[0];

export function SimulationDrawer({ open, onClose, project, currentState }: SimulationDrawerProps) {
  const { toast } = useToast();

  const defaultStartDate = TODAY;
  const defaultDaysPerWeek = project.simulationDaysPerWeek
    ? parseFloat(project.simulationDaysPerWeek.toString())
    : 5;

  const [startDate, setStartDate] = useState(defaultStartDate);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(defaultDaysPerWeek);

  const inputs = useMemo(() => ({
    simulationStartDate: new Date(startDate + "T00:00:00"),
    simulationDaysPerWeek: daysPerWeek,
  }), [startDate, daysPerWeek]);

  const result = useMemo(() => computeSimulation(inputs, currentState), [inputs, currentState]);

  const validateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        simulationDaysPerWeek: daysPerWeek.toString(),
        simulationStartDate: startDate,
        endDate: result.newEndDate.toISOString().split("T")[0],
      };
      return apiRequest(`/api/projects/${project.id}`, "PATCH", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/profitability"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", project.id] });
      toast({
        title: "Simulation appliquée",
        description: `Nouvelle date de fin projetée : ${fmtDate(result.newEndDate)}`,
      });
      onClose();
    },
    onError: () => {
      toast({ title: "Erreur", description: "Impossible d'appliquer la simulation.", variant: "destructive" });
    },
  });

  const handleReset = () => {
    setStartDate(defaultStartDate);
    setDaysPerWeek(5);
  };

  const riskIcon = result.riskLevel === "ok"
    ? <CheckCircle2 className="h-4 w-4 text-green-500" />
    : result.riskLevel === "warning"
    ? <AlertTriangle className="h-4 w-4 text-amber-500" />
    : result.riskLevel === "danger"
    ? <AlertTriangle className="h-4 w-4 text-red-500" />
    : <Info className="h-4 w-4 text-muted-foreground" />;

  const riskBadgeClass =
    result.riskLevel === "ok" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
    result.riskLevel === "warning" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
    result.riskLevel === "danger" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
    "bg-muted text-muted-foreground";

  const deltaLabel = result.deltaEndDays !== null
    ? result.deltaEndDays === 0 ? "Date inchangée"
    : result.deltaEndDays > 0 ? `+${result.deltaEndDays}j vs actuel`
    : `${result.deltaEndDays}j vs actuel`
    : null;

  const currentEndDateFormatted = currentState.currentEndDate
    ? fmtDate(currentState.currentEndDate)
    : "Non définie";

  const billingLabel =
    project.billingType === "fixed_price" ? "Forfait" :
    project.billingType === "time_based" ? "Régie" :
    "Non défini";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="sm:max-w-lg w-full overflow-y-auto flex flex-col gap-0 p-0" data-testid="sheet-simulation">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <SheetTitle className="text-base">Simuler la trajectoire</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Projetez un nouveau scénario de charge et de facturation. Validez pour l'appliquer au projet.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* ─── BLOC 1 : Hypothèses ─── */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold shrink-0">1</span>
              Hypothèses de simulation
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date de début du scénario</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="text-xs h-8"
                  data-testid="input-simulation-start-date"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  Jours travaillés / semaine
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs bg-white text-foreground border shadow-md">
                      Ex : 5 = full time, 3 = mi-temps+, 1 = journée/semaine
                    </TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0.5}
                    max={7}
                    step={0.5}
                    value={daysPerWeek}
                    onChange={(e) => setDaysPerWeek(parseFloat(e.target.value) || 1)}
                    className="text-xs h-8"
                    data-testid="input-simulation-days-per-week"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">j/sem.</span>
                </div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDaysPerWeek(d)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${
                        daysPerWeek === d
                          ? "bg-primary text-white border-primary"
                          : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                      }`}
                      data-testid={`btn-days-preset-${d}`}
                    >
                      {d}j
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Résumé textuel */}
            {result.remainingWorkDays > 0 && (
              <div className="mt-3 p-2.5 bg-primary/5 border border-primary/20 rounded-md text-xs text-foreground leading-relaxed">
                En passant à <strong>{daysPerWeek}j/semaine</strong> à partir du{" "}
                <strong>{fmtDate(new Date(startDate + "T00:00:00"))}</strong>, le projet se terminerait
                le <strong>{fmtDate(result.newEndDate)}</strong>{" "}
                <span className="text-muted-foreground">({result.remainingCalendarLabel})</span>.
              </div>
            )}
            {result.remainingWorkDays === 0 && currentState.totalEstimatedDays > 0 && (
              <div className="mt-3 p-2.5 bg-green-50 border border-green-200 rounded-md text-xs text-green-700">
                Le projet est déjà terminé selon les estimations de temps.
              </div>
            )}
          </div>

          <Separator />

          {/* ─── BLOC 2 : Situation actuelle ─── */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-muted-foreground text-[10px] font-bold shrink-0">2</span>
              Situation actuelle
            </h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <Row label="Mode de facturation" value={billingLabel} />
              <Row label="Budget total" value={currentState.totalBilled > 0 ? fmt(currentState.totalBilled) : "—"} />
              <Row label="Déjà encaissé" value={currentState.totalPaid > 0 ? fmt(currentState.totalPaid) : "—"} />
              <Row label="Restant à encaisser" value={currentState.totalBilled > 0 ? fmt(Math.max(0, currentState.totalBilled - currentState.totalPaid)) : "—"} />
              <Row label="Temps consommé" value={currentState.actualDaysWorked > 0 ? `${currentState.actualDaysWorked.toFixed(1)}j` : "—"} />
              <Row label="Temps restant estimé" value={currentState.remainingDays > 0 ? `${currentState.remainingDays.toFixed(1)}j` : "—"} />
              <Row label="Date de fin actuelle" value={currentEndDateFormatted} />
              <Row
                label="Coût journalier interne"
                value={currentState.internalDailyCost > 0 ? fmt(currentState.internalDailyCost) + "/j" : "—"}
                missing={currentState.internalDailyCost <= 0}
              />
            </div>
            {currentState.internalDailyCost <= 0 && (
              <p className="text-[10px] text-amber-600 mt-2">
                Coût journalier non renseigné — les projections de marge ne seront pas disponibles.
              </p>
            )}
          </div>

          <Separator />

          {/* ─── BLOC 3 : Résultats ─── */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold shrink-0">3</span>
              Résultat de la simulation
              <Badge className={`text-[10px] px-1.5 py-0 ml-auto ${riskBadgeClass}`}>
                <span className="flex items-center gap-1">{riskIcon}{result.riskLabel}</span>
              </Badge>
            </h4>

            <div className="space-y-2">
              {/* Date de fin projetée */}
              <ResultCard
                label="Nouvelle date de fin projetée"
                value={fmtDate(result.newEndDate)}
                sub={result.remainingCalendarLabel}
                delta={deltaLabel}
                deltaPositive={result.deltaEndDays !== null && result.deltaEndDays <= 0}
                highlight
              />

              <div className="grid grid-cols-2 gap-2">
                <ResultCard
                  label="Restant à facturer"
                  value={currentState.totalBilled > 0 ? fmt(result.remainingToInvoice) : "—"}
                  sub="hors acomptes versés"
                />
                {currentState.internalDailyCost > 0 && (
                  <ResultCard
                    label="Coût restant projeté"
                    value={fmt(result.projectedRemainingCost)}
                    sub={`${result.remainingWorkDays.toFixed(1)}j × ${fmt(currentState.internalDailyCost)}`}
                  />
                )}
              </div>

              {currentState.internalDailyCost > 0 && currentState.totalBilled > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <ResultCard
                    label="Marge projetée"
                    value={fmt(result.projectedMargin)}
                    deltaPositive={result.projectedMargin >= 0}
                    delta={result.projectedMargin < 0 ? "Déficit !" : undefined}
                  />
                  <ResultCard
                    label="Marge projetée %"
                    value={fmtPct(result.projectedMarginPercent)}
                    deltaPositive={result.projectedMarginPercent >= 25}
                    delta={
                      result.projectedMarginPercent < 0 ? "Négatif"
                      : result.projectedMarginPercent < 10 ? "Critique"
                      : result.projectedMarginPercent < 25 ? "Réduite"
                      : undefined
                    }
                  />
                </div>
              )}
            </div>

            {result.missingFields.length > 0 && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Données manquantes pour un calcul complet : {result.missingFields.join(", ")}.
              </p>
            )}
          </div>
        </div>

        {/* ─── BLOC 4 : Actions ─── */}
        <div className="border-t px-6 py-4 flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={handleReset}
            data-testid="button-reset-simulation"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Réinitialiser
          </Button>
          <div className="flex-1" />
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={onClose}
            data-testid="button-cancel-simulation"
          >
            Annuler
          </Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending || result.remainingWorkDays <= 0}
            data-testid="button-validate-simulation"
          >
            <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
            {validateMutation.isPending ? "Application…" : "Valider la simulation"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({ label, value, missing }: { label: string; value: string; missing?: boolean }) {
  return (
    <>
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-medium text-right ${missing ? "text-amber-500" : "text-foreground"}`}>{value}</span>
    </>
  );
}

function ResultCard({
  label, value, sub, delta, deltaPositive, highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: string | null;
  deltaPositive?: boolean;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-md p-3 border ${highlight ? "bg-primary/5 border-primary/20" : "bg-muted/30 border-border"}`}>
      <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
      <div className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
      {delta && (
        <div className={`text-[10px] mt-1 flex items-center gap-1 ${deltaPositive ? "text-green-600" : "text-red-500"}`}>
          {deltaPositive ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
          {delta}
        </div>
      )}
    </div>
  );
}
