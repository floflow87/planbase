import { useState, useMemo, useEffect } from "react";
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
import {
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Info,
  RotateCcw, FlaskConical, Calendar as CalendarIcon, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { computeSimulation, daysBetween, type SimulationCurrentState } from "@/lib/simulationUtils";
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
function fmtMonths(n: number) {
  if (n < 1) return `${Math.round(n * 30.4)}j`;
  const months = Math.floor(n);
  const days = Math.round((n - months) * 30.4);
  if (days === 0) return `${months} mois`;
  return `${months} mois et ${days}j`;
}

type BillingType = "fixed_price" | "time_based";

export function SimulationDrawer({ open, onClose, project, currentState }: SimulationDrawerProps) {
  const { toast } = useToast();

  const defaultDaysPerWeek = project.simulationDaysPerWeek
    ? parseFloat(project.simulationDaysPerWeek.toString())
    : 5;
  const defaultBillingType: BillingType =
    (project.billingType === "fixed_price" || project.billingType === "time_based")
      ? project.billingType
      : "fixed_price";

  const [startDate, setStartDate] = useState<Date>(new Date());
  const [isStartOpen, setIsStartOpen] = useState(false);
  const [daysPerWeek, setDaysPerWeek] = useState<number>(defaultDaysPerWeek);
  const [targetMode, setTargetMode] = useState<"days" | "date">("days");
  const [targetEndDate, setTargetEndDate] = useState<Date | undefined>(
    currentState.currentEndDate ? new Date(currentState.currentEndDate) : undefined
  );
  const [isEndOpen, setIsEndOpen] = useState(false);

  const [simBillingType, setSimBillingType] = useState<BillingType>(defaultBillingType);
  const [simTJMStr, setSimTJMStr] = useState<string>(
    currentState.billingRate && currentState.billingRate > 0
      ? currentState.billingRate.toString()
      : ""
  );
  const [simBilledDaysStr, setSimBilledDaysStr] = useState<string>("");
  const [billedDaysLocked, setBilledDaysLocked] = useState(false);

  const simTJM = parseFloat(simTJMStr) || 0;

  const autoFillDays = useMemo(() => {
    if (simBillingType === "time_based") {
      return currentState.remainingDays;
    } else {
      if (targetMode === "date" && targetEndDate) {
        const calendarWindow = Math.max(0, daysBetween(startDate, targetEndDate));
        return Math.floor((calendarWindow * daysPerWeek) / 7);
      }
      return currentState.remainingDays;
    }
  }, [simBillingType, targetMode, startDate, targetEndDate, daysPerWeek, currentState.remainingDays]);

  useEffect(() => {
    if (!billedDaysLocked) {
      setSimBilledDaysStr(autoFillDays > 0 ? autoFillDays.toFixed(1) : "");
    }
  }, [autoFillDays, billedDaysLocked]);

  const simBilledDays = parseFloat(simBilledDaysStr) || 0;

  const inputs = useMemo(() => ({
    simulationStartDate: startDate,
    simulationDaysPerWeek: daysPerWeek,
    targetMode,
    targetEndDate: targetMode === "date" ? (targetEndDate ?? null) : null,
    simBillingType,
    simTJM: simTJM > 0 ? simTJM : undefined,
    simBilledDays: simBilledDays > 0 ? simBilledDays : undefined,
  }), [startDate, daysPerWeek, targetMode, targetEndDate, simBillingType, simTJM, simBilledDays]);

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
    setDaysPerWeek(defaultDaysPerWeek);
    setTargetMode("days");
    setTargetEndDate(currentState.currentEndDate ? new Date(currentState.currentEndDate) : undefined);
    setSimBillingType(defaultBillingType);
    setSimTJMStr(currentState.billingRate && currentState.billingRate > 0 ? currentState.billingRate.toString() : "");
    setBilledDaysLocked(false);
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

  const billingLabel = (t: string) => t === "fixed_price" ? "Forfait" : t === "time_based" ? "Régie" : "Non défini";

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent className="sm:max-w-lg w-full overflow-y-auto flex flex-col gap-0 p-0" data-testid="sheet-simulation">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            <SheetTitle className="text-base">Simuler la trajectoire</SheetTitle>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Ajustez les hypothèses pour projeter votre facturation et votre marge.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">

          {/* ─── BLOC 1 : Hypothèses ─── */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold shrink-0">1</span>
              Hypothèses de simulation
            </h4>

            {/* Dates + rythme */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Date de début</Label>
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
                    <Calendar mode="single" selected={startDate} onSelect={(d) => { if (d) { setStartDate(d); setIsStartOpen(false); } }} initialFocus locale={fr} />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  Jours / semaine
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs bg-white text-foreground border shadow-md">5 = full time · 3 = mi-temps+ · 1 = 1 jour/semaine</TooltipContent>
                  </Tooltip>
                </Label>
                <div className="flex items-center gap-2">
                  <Input type="number" min={0.5} max={7} step={0.5} value={daysPerWeek} onChange={(e) => setDaysPerWeek(parseFloat(e.target.value) || 1)} className="text-xs" data-testid="input-simulation-days-per-week" />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">j/sem.</span>
                </div>
                <div className="flex gap-1 flex-wrap mt-1">
                  {[1, 2, 3, 4, 5].map((d) => (
                    <button key={d} onClick={() => setDaysPerWeek(d)}
                      className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors cursor-pointer ${daysPerWeek === d ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                      data-testid={`btn-days-preset-${d}`}>{d}j</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Date limite cible */}
            <div className="space-y-2">
              <Label className="text-xs flex items-center gap-1">
                Date limite cible
                <Tooltip>
                  <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                  <TooltipContent className="text-xs max-w-xs bg-white text-foreground border shadow-md">Conserver le nb de jours estimés pour projeter la fin, ou fixer une date pour calculer ce qui est disponible.</TooltipContent>
                </Tooltip>
              </Label>
              <div className="flex gap-1">
                <button onClick={() => setTargetMode("days")}
                  className={`flex-1 text-[10px] px-2 py-1.5 rounded border transition-colors cursor-pointer ${targetMode === "days" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                  data-testid="btn-target-mode-days">Garder les jours estimés</button>
                <button onClick={() => setTargetMode("date")}
                  className={`flex-1 text-[10px] px-2 py-1.5 rounded border transition-colors cursor-pointer ${targetMode === "date" ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                  data-testid="btn-target-mode-date">Fixer une date limite</button>
              </div>
              {targetMode === "date" && (
                <Popover open={isEndOpen} onOpenChange={setIsEndOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className={cn("w-full justify-start text-left font-normal text-xs", !targetEndDate && "text-muted-foreground")} data-testid="button-simulation-end-date">
                      <CalendarIcon className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      {targetEndDate ? format(targetEndDate, "dd/MM/yyyy", { locale: fr }) : "Choisir une date limite"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={targetEndDate} onSelect={(d) => { if (d) { setTargetEndDate(d); setIsEndOpen(false); } }} disabled={(d) => d <= startDate} initialFocus locale={fr} />
                  </PopoverContent>
                </Popover>
              )}
            </div>

            {/* ─── Paramètres de facturation ─── */}
            <div className="rounded-md border border-border bg-muted/20 p-3 space-y-3">
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Paramètres de facturation</p>

              {/* Type + TJM */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <div className="flex gap-1">
                    {(["fixed_price", "time_based"] as BillingType[]).map((t) => (
                      <button key={t} onClick={() => setSimBillingType(t)}
                        className={`flex-1 text-[10px] px-2 py-1.5 rounded border transition-colors cursor-pointer ${simBillingType === t ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                        data-testid={`btn-billing-type-${t}`}>
                        {t === "fixed_price" ? "Forfait" : "Régie"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">TJM (€/j)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={50}
                    value={simTJMStr}
                    onChange={(e) => setSimTJMStr(e.target.value)}
                    placeholder="Ex. 800"
                    className="text-xs"
                    data-testid="input-simulation-tjm"
                  />
                </div>
              </div>

              {/* Nb jours facturés */}
              <div className="space-y-1">
                <Label className="text-xs flex items-center gap-1">
                  Jours facturés
                  <Tooltip>
                    <TooltipTrigger asChild><Info className="h-3 w-3 text-muted-foreground cursor-help" /></TooltipTrigger>
                    <TooltipContent className="text-xs max-w-xs bg-white text-foreground border shadow-md">
                      {simBillingType === "time_based"
                        ? "Régie : pré-rempli avec les jours restants selon le CDC."
                        : "Forfait : pré-rempli avec jours/semaine × semaines totales sur la période."}
                    </TooltipContent>
                  </Tooltip>
                  {billedDaysLocked && (
                    <button
                      onClick={() => setBilledDaysLocked(false)}
                      className="ml-auto flex items-center gap-0.5 text-[10px] text-primary hover:underline cursor-pointer"
                      data-testid="button-reset-billed-days"
                    >
                      <RefreshCw className="h-2.5 w-2.5" /> Auto
                    </button>
                  )}
                  {!billedDaysLocked && (
                    <span className="ml-auto text-[10px] text-muted-foreground italic">auto</span>
                  )}
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={0.5}
                  value={simBilledDaysStr}
                  onChange={(e) => { setSimBilledDaysStr(e.target.value); setBilledDaysLocked(true); }}
                  placeholder="Nb de jours"
                  className="text-xs"
                  data-testid="input-simulation-billed-days"
                />
              </div>

              {/* Résumé calculé */}
              {simTJM > 0 && simBilledDays > 0 && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="rounded bg-primary/10 border border-primary/20 px-2.5 py-2">
                    <p className="text-[9px] text-muted-foreground mb-0.5">Total facturé simulé</p>
                    <p className="text-xs font-semibold text-primary">{fmt(result.simTotalBilled)}</p>
                    <p className="text-[9px] text-muted-foreground">{simBilledDays.toFixed(1)}j × {fmt(simTJM)}</p>
                  </div>
                  {result.simMonthlyAmount !== null && result.durationInMonths !== null && (
                    <div className="rounded bg-primary/10 border border-primary/20 px-2.5 py-2">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Ramené au mois</p>
                      <p className="text-xs font-semibold text-primary">{fmt(result.simMonthlyAmount)}/mois</p>
                      <p className="text-[9px] text-muted-foreground">sur {fmtMonths(result.durationInMonths)}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Résumé textuel */}
            {targetMode === "days" && result.remainingWorkDays > 0 && (
              <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-md text-xs text-foreground leading-relaxed">
                À <strong>{daysPerWeek}j/semaine</strong> dès le{" "}
                <strong>{format(startDate, "d MMMM yyyy", { locale: fr })}</strong>, le projet se terminerait le{" "}
                <strong>{fmtDate(result.newEndDate)}</strong>{" "}
                <span className="text-muted-foreground">({result.remainingCalendarLabel})</span>.
              </div>
            )}
            {targetMode === "date" && targetEndDate && result.availableWorkDaysInWindow !== null && (
              <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-md text-xs text-foreground leading-relaxed">
                Entre le <strong>{format(startDate, "d MMMM yyyy", { locale: fr })}</strong> et le{" "}
                <strong>{format(targetEndDate, "d MMMM yyyy", { locale: fr })}</strong> à <strong>{daysPerWeek}j/semaine</strong> ={" "}
                <strong>{result.availableWorkDaysInWindow}j disponibles</strong>
                {simTJM > 0 && <> · <strong>{fmt(simTJM * result.availableWorkDaysInWindow)}</strong> facturables</>}.
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
              <Row label="Mode de facturation" value={billingLabel(project.billingType ?? "")} />
              <Row label="Budget / total facturé" value={currentState.totalBilled > 0 ? fmt(currentState.totalBilled) : "—"} />
              <Row label="Encaissé" value={currentState.totalPaid > 0 ? fmt(currentState.totalPaid) : "—"} />
              <Row label="Restant à encaisser" value={currentState.totalBilled > 0 ? fmt(Math.max(0, currentState.totalBilled - currentState.totalPaid)) : "—"} />
              <Row label="Temps consommé" value={currentState.actualDaysWorked > 0 ? `${currentState.actualDaysWorked.toFixed(1)}j` : "—"} />
              <Row label="Temps restant CDC" value={currentState.remainingDays > 0 ? `${currentState.remainingDays.toFixed(1)}j` : "—"} />
              <Row label="Date de fin" value={currentEndDateFormatted} />
              <Row label="Coût journalier" value={currentState.internalDailyCost > 0 ? fmt(currentState.internalDailyCost) + "/j" : "—"} missing={currentState.internalDailyCost <= 0} />
              {currentState.billingRate && currentState.billingRate > 0 && (
                <Row label="TJM actuel" value={fmt(currentState.billingRate) + "/j"} />
              )}
            </div>
            {currentState.internalDailyCost <= 0 && (
              <p className="text-[10px] text-amber-600 mt-2">Coût journalier non renseigné — les projections de marge ne seront pas disponibles.</p>
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
              <ResultCard
                label={targetMode === "date" ? "Date limite cible" : "Date de fin projetée"}
                value={fmtDate(result.newEndDate)}
                sub={result.remainingCalendarLabel}
                delta={deltaLabel}
                deltaPositive={result.deltaEndDays !== null && result.deltaEndDays <= 0}
                highlight
              />

              {targetMode === "date" && result.availableWorkDaysInWindow !== null && (
                <ResultCard
                  label="Jours disponibles dans la fenêtre"
                  value={`${result.availableWorkDaysInWindow}j`}
                  sub={`à ${daysPerWeek}j/semaine`}
                />
              )}

              {result.simTotalBilled > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <ResultCard
                    label="Total facturé simulé"
                    value={fmt(result.simTotalBilled)}
                    sub={`${simBilledDays.toFixed(1)}j × ${fmt(simTJM)}/j`}
                    highlight
                  />
                  {result.simMonthlyAmount !== null && result.durationInMonths !== null && (
                    <ResultCard
                      label="Revenu mensuel moyen"
                      value={fmt(result.simMonthlyAmount) + "/mois"}
                      sub={`sur ${fmtMonths(result.durationInMonths)}`}
                      highlight
                    />
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <ResultCard
                  label="Restant à facturer"
                  value={result.remainingToInvoice > 0 ? fmt(result.remainingToInvoice) : "—"}
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

              {currentState.internalDailyCost > 0 && result.simTotalBilled > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  <ResultCard
                    label="Marge projetée"
                    value={fmt(result.projectedMargin)}
                    deltaPositive={result.projectedMargin >= 0}
                    delta={result.projectedMargin < 0 ? "Déficit !" : undefined}
                  />
                  <ResultCard
                    label="Marge %"
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
                Données manquantes : {result.missingFields.join(", ")}.
              </p>
            )}
          </div>
        </div>

        {/* ─── Actions ─── */}
        <div className="border-t px-6 py-4 flex items-center gap-2">
          <Button variant="ghost" size="sm" className="text-xs" onClick={handleReset} data-testid="button-reset-simulation">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />Réinitialiser
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" className="text-xs" onClick={onClose} data-testid="button-cancel-simulation">Annuler</Button>
          <Button
            size="sm"
            className="text-xs"
            onClick={() => validateMutation.mutate()}
            disabled={validateMutation.isPending || result.remainingWorkDays <= 0}
            data-testid="button-validate-simulation"
          >
            <FlaskConical className="h-3.5 w-3.5 mr-1.5" />
            {validateMutation.isPending ? "Application…" : "Valider"}
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
  label: string; value: string; sub?: string; delta?: string | null; deltaPositive?: boolean; highlight?: boolean;
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
