import { useState, useMemo } from "react";
import { useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info, RotateCcw, FlaskConical, Calendar as CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
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

export function SimulationDrawer({ open, onClose, project, currentState }: SimulationDrawerProps) {
  const { toast } = useToast();

  const defaultDaysPerWeek = project.simulationDaysPerWeek
    ? parseFloat(project.simulationDaysPerWeek.toString())
    : 5;

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(defaultDaysPerWeek);
  const [targetMode, setTargetMode] = useState<"days" | "date">("days");
  const [targetEndDate, setTargetEndDate] = useState<Date | undefined>(
    currentState.currentEndDate ? new Date(currentState.currentEndDate) : undefined
  );
  const [isEndOpen, setIsEndOpen] = useState(false);

  const inputs = useMemo(() => ({
    simulationStartDate: startDate,
    simulationDaysPerWeek: daysPerWeek,
    targetMode,
    targetEndDate: targetMode === "date" ? (targetEndDate ?? null) : null,
  }), [startDate, daysPerWeek, targetMode, targetEndDate]);

  const result = useMemo(() => computeSimulation(inputs, currentState), [inputs, currentState]);

  const validateMutation = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        simulationDaysPerWeek: daysPerWeek.toString(),
        simulationStartDate: startDate.toISOString().split("T")[0],
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
    setStartDate(new Date());
    setDaysPerWeek(5);
    setTargetMode("days");
    setTargetEndDate(currentState.currentEndDate ? new Date(currentState.currentEndDate) : undefined);
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

  const isTimeBasedBilling = project.billingType === "time_based";

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
              {/* Date de début */}
              <div className="space-y-1">
                <Label className="text-xs">Date de début du scénario</Label>
                <Popover open={isStartOpen} onOpenChange={setIsStartOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("w-full justify-start text-left font-normal text-xs", !startDate && "text-muted-foreground")}
                      data-testid="button-simulation-start-date"
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {startDate ? format(startDate, "dd/MM/yyyy", { locale: fr }) : "Sélectionner"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={(d) => { if (d) { setStartDate(d); setIsStartOpen(false); } }}
                      initialFocus
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Jours / semaine */}
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
                    className="text-xs"
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

            {/* ─── Date limite cible ─── */}
            <div className="mt-3 space-y-2">
              <Label className="text-xs flex items-center gap-1">
                Date limite cible
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="text-xs max-w-xs bg-white text-foreground border shadow-md">
                    Conserver le nombre de jours estimés pour projeter une date de fin, ou fixer une date pour voir combien de jours (et de facturation) sont disponibles.
                  </TooltipContent>
                </Tooltip>
              </Label>
              <div className="flex gap-1">
                <button
                  onClick={() => setTargetMode("days")}
                  className={`flex-1 text-[10px] px-2 py-1.5 rounded border transition-colors cursor-pointer ${
                    targetMode === "days"
                      ? "bg-primary text-white border-primary"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                  data-testid="btn-target-mode-days"
                >
                  Garder les jours estimés
                </button>
                <button
                  onClick={() => setTargetMode("date")}
                  className={`flex-1 text-[10px] px-2 py-1.5 rounded border transition-colors cursor-pointer ${
                    targetMode === "date"
                      ? "bg-primary text-white border-primary"
                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                  }`}
                  data-testid="btn-target-mode-date"
                >
                  Fixer une date limite
                </button>
              </div>

              {targetMode === "date" && (
                <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className={cn("w-full justify-start text-left font-normal text-xs", !targetEndDate && "text-muted-foreground")}
                      data-testid="button-simulation-end-date"
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {targetEndDate ? format(targetEndDate, "dd/MM/yyyy", { locale: fr }) : "Choisir une date limite"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={targetEndDate}
                      onSelect={(d) => { if (d) { setTargetEndDate(d); setIsEndOpen(false); } }}
                      disabled={(d) => d <= startDate}
                      initialFocus
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* Résumé textuel */}
            {targetMode === "days" && result.remainingWorkDays > 0 && (
              <div className="mt-3 p-2.5 bg-primary/5 border border-primary/20 rounded-md text-xs text-foreground leading-relaxed">
                En passant à <strong>{daysPerWeek}j/semaine</strong> à partir du{" "}
                <strong>{format(startDate, "d MMMM yyyy", { locale: fr })}</strong>, le projet se terminerait
                le <strong>{fmtDate(result.newEndDate)}</strong>{" "}
                <span className="text-muted-foreground">({result.remainingCalendarLabel})</span>.
              </div>
            )}
            {targetMode === "days" && result.remainingWorkDays === 0 && currentState.totalEstimatedDays > 0 && (
              <div className="mt-3 p-2.5 bg-green-50 border border-green-200 rounded-md text-xs text-green-700">
                Le projet est déjà terminé selon les estimations de temps.
              </div>
            )}
            {targetMode === "date" && targetEndDate && result.availableWorkDaysInWindow !== null && (
              <div className="mt-3 p-2.5 bg-primary/5 border border-primary/20 rounded-md text-xs text-foreground leading-relaxed">
                Entre le <strong>{format(startDate, "d MMMM yyyy", { locale: fr })}</strong> et le{" "}
                <strong>{format(targetEndDate, "d MMMM yyyy", { locale: fr })}</strong> à{" "}
                <strong>{daysPerWeek}j/semaine</strong>, il reste{" "}
                <strong>{result.availableWorkDaysInWindow.toFixed(0)}j</strong> disponibles{" "}
                {isTimeBasedBilling && result.projectedBilling !== null && (
                  <>— soit <strong>{fmt(result.projectedBilling)}</strong> facturables à ce rythme</>
                )}.
              </div>
            )}
          </div>

          <Separator />

          {/* ─── BLOC 2 : Situation actuelle ─── */}
          <div>
            <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold shrink-0">2</span>
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
              {isTimeBasedBilling && currentState.billingRate && currentState.billingRate > 0 && (
                <Row label="TJM facturé" value={fmt(currentState.billingRate) + "/j"} />
              )}
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
                label={targetMode === "date" ? "Date limite cible" : "Nouvelle date de fin projetée"}
                value={fmtDate(result.newEndDate)}
                sub={result.remainingCalendarLabel}
                delta={deltaLabel}
                deltaPositive={result.deltaEndDays !== null && result.deltaEndDays <= 0}
                highlight
              />

              {/* Jours disponibles en mode date */}
              {targetMode === "date" && result.availableWorkDaysInWindow !== null && (
                <ResultCard
                  label="Jours disponibles dans la fenêtre"
                  value={`${result.availableWorkDaysInWindow.toFixed(0)}j`}
                  sub={`à ${daysPerWeek}j/semaine`}
                  highlight={false}
                />
              )}

              {/* Facturation projetée en régie */}
              {isTimeBasedBilling && result.projectedBilling !== null && (
                <ResultCard
                  label={targetMode === "date" ? "Facturation dans cette fenêtre" : "Facturation projetée totale"}
                  value={fmt(result.projectedBilling)}
                  sub={`${(currentState.actualDaysWorked + result.remainingWorkDays).toFixed(1)}j × TJM`}
                  highlight
                />
              )}

              <div className="grid grid-cols-2 gap-2">
                <ResultCard
                  label="Restant à facturer"
                  value={(currentState.totalBilled > 0 || (isTimeBasedBilling && result.projectedBilling !== null))
                    ? fmt(result.remainingToInvoice)
                    : "—"}
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

              {currentState.internalDailyCost > 0 && (currentState.totalBilled > 0 || (isTimeBasedBilling && result.projectedBilling !== null)) && (
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

        {/* ─── Actions ─── */}
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
