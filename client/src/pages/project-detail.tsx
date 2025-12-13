import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Calendar as CalendarIcon, Euro, Tag, Edit, Trash2, Users, Star, FileText, DollarSign, Timer, Clock, Check, ChevronsUpDown, Plus, FolderKanban, Play, Kanban, LayoutGrid, User, ChevronDown, ChevronRight, Flag, Layers, ListTodo, ExternalLink, MessageSquare, Phone, Mail, Video, StickyNote, MoreHorizontal, CheckCircle2, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Project, Task, Client, AppUser, TaskColumn, Note, Document, ProjectPayment, Backlog, Epic, UserStory, BacklogTask, Sprint, BacklogColumn, ChecklistItem, BacklogItemState, BacklogPriority, Activity } from "@shared/schema";
import { billingStatusOptions, backlogModeOptions, backlogItemStateOptions, backlogPriorityOptions } from "@shared/schema";
import { useState, useEffect, useRef, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, formatDateForStorage } from "@/lib/queryClient";
import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";

interface ProjectWithRelations extends Project {
  client?: Client;
  tasks?: Task[];
}

type TimeEntry = {
  id: string;
  projectId: string | null;
  userId: string;
  startTime: string;
  endTime: string | null;
  duration: number | null;
  description: string | null;
  accountId: string;
  createdAt: string;
  updatedAt: string;
};

interface CategoryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  categories: { id: string; name: string }[];
}

function CategoryCombobox({ value, onChange, categories }: CategoryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const handleCreateCategory = async () => {
    const trimmedValue = searchValue.trim();
    if (!trimmedValue) return;

    try {
      // Create the category via API
      await apiRequest('/api/project-categories', 'POST', { name: trimmedValue });
      // Invalidate the cache to refetch categories
      queryClient.invalidateQueries({ queryKey: ['/api/project-categories'] });
      // Update local state
      onChange(trimmedValue);
      setOpen(false);
      setSearchValue("");
    } catch (error: any) {
      console.error('Error creating category:', error);
    }
  };

  // Filter categories based on search
  // Sort alphabetically for predictable ordering
  const sortedCategories = [...categories].sort((a, b) => a.name.localeCompare(b.name));
  
  const filteredCategories = searchValue === ""
    ? sortedCategories // No search: show all categories
    : sortedCategories
        .filter((cat) => 
          cat.name.toLowerCase().includes(searchValue.toLowerCase())
        );
  
  // Ensure currently selected category is always included at the top
  if (value && !filteredCategories.some(cat => cat.name === value)) {
    const selectedCategory = categories.find(cat => cat.name === value);
    if (selectedCategory) {
      filteredCategories.unshift(selectedCategory);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          data-testid="button-category-selector"
        >
          {value || "Sélectionnez une catégorie..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command shouldFilter={false}>
          <CommandInput 
            placeholder="Rechercher ou créer..." 
            value={searchValue}
            onValueChange={setSearchValue}
            data-testid="input-category-search"
          />
          <CommandList>
            <CommandEmpty>
              {searchValue.trim() && (
                <button
                  className="w-full text-sm py-2 px-4 hover-elevate active-elevate-2 rounded-sm text-left"
                  onClick={handleCreateCategory}
                  data-testid="button-create-category"
                >
                  Créer "{searchValue.trim()}"
                </button>
              )}
            </CommandEmpty>
            <CommandGroup>
              {filteredCategories.map((cat) => (
                <CommandItem
                  key={cat.id}
                  value={cat.name}
                  onSelect={(currentValue) => {
                    onChange(currentValue);
                    setOpen(false);
                    setSearchValue("");
                  }}
                  data-testid={`option-category-${cat.name}`}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === cat.name ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {cat.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TimeTrackingTab({ projectId, project }: { projectId: string; project?: ProjectWithRelations }) {
  const { toast } = useToast();
  const [deleteEntryId, setDeleteEntryId] = useState<string | null>(null);
  
  // Free time entry form state
  const [showAddTimeForm, setShowAddTimeForm] = useState(false);
  const [newTimeDate, setNewTimeDate] = useState<Date | undefined>(new Date());
  const [newTimeHours, setNewTimeHours] = useState<string>("");
  const [newTimeMinutes, setNewTimeMinutes] = useState<string>("0");
  const [newTimeDescription, setNewTimeDescription] = useState<string>("");
  const [isNewTimeDatePickerOpen, setIsNewTimeDatePickerOpen] = useState(false);
  const [isAddingTime, setIsAddingTime] = useState(false);

  const { data: timeEntries = [], isLoading } = useQuery<TimeEntry[]>({
    queryKey: [`/api/projects/${projectId}/time-entries`],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/accounts", project?.accountId, "users"],
    enabled: !!project?.accountId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return await apiRequest(`/api/time-entries/${entryId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/time-entries`] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      toast({
        title: "Session supprimée",
        description: "La session de temps a été supprimée avec succès",
        variant: "success",
      });
      setDeleteEntryId(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Calculate total time in seconds
  const totalTimeSeconds = timeEntries.reduce((sum, entry) => {
    return sum + (entry.duration || 0);
  }, 0);

  // Convert to hours
  const totalTimeHours = totalTimeSeconds / 3600;

  // Calculate profitability
  const calculateProfitability = () => {
    if (!project) return null;

    const billingRate = parseFloat(project.billingRate || "0");
    const totalBilled = parseFloat(project.totalBilled || "0");
    const billingUnit = project.billingUnit || "hour";
    const billingType = project.billingType || "time";

    // Convert time to the right unit
    let timeInUnits = totalTimeHours;
    if (billingUnit === "day") {
      timeInUnits = totalTimeHours / 8; // Assuming 8 hours per day
    }

    // Calculate actual cost (time spent × rate)
    const actualCost = timeInUnits * billingRate;

    // Calculate TJM réel (pour facturation au temps passé uniquement)
    // TJM réel = montant facturé / (heures totales / 8)
    let realDailyRate = undefined;
    if (billingType === "time") {
      const totalDays = totalTimeHours / 8;
      realDailyRate = totalDays > 0 ? totalBilled / totalDays : 0;
    }

    // Calculate TJM théorique
    // TJM théorique = montant total facturé / nombre de jours
    const numberOfDays = parseFloat(project.numberOfDays || "0");
    const theoreticalDailyRate = (numberOfDays > 0 && !isNaN(numberOfDays) && totalBilled > 0) 
      ? totalBilled / numberOfDays 
      : undefined;

    // Calculate profit/loss
    const profitLoss = totalBilled - actualCost;
    const profitLossPercentage = totalBilled > 0 ? (profitLoss / totalBilled) * 100 : 0;

    return {
      actualCost,
      realDailyRate,
      theoreticalDailyRate,
      totalBilled,
      profitLoss,
      profitLossPercentage,
      isProfit: profitLoss >= 0,
      billingType,
    };
  };

  const profitability = calculateProfitability();

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h${minutes > 0 ? ` ${minutes}min` : ""}`;
    }
    return `${minutes}min`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <Loader />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Résumé</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Temps total enregistré</p>
              <p className="text-2xl font-semibold" data-testid="text-total-time">
                {totalTimeHours.toFixed(2)} heures
              </p>
              <p className="text-xs text-muted-foreground">
                {timeEntries.length} session{timeEntries.length !== 1 ? "s" : ""}
              </p>
            </div>

            {profitability && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Rentabilité</p>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={profitability.isProfit ? "default" : "destructive"}
                    className={profitability.isProfit ? "bg-green-600 dark:bg-green-700" : ""}
                    data-testid="badge-profitability"
                  >
                    {profitability.isProfit ? "GAIN" : "PERTE"}
                  </Badge>
                  <span className={`text-lg font-semibold ${profitability.isProfit ? "text-green-600 dark:text-green-500" : "text-red-600 dark:text-red-500"}`} data-testid="text-profit-loss">
                    {profitability.profitLoss >= 0 ? "+" : ""}
                    {profitability.profitLoss.toFixed(2)} €
                  </span>
                </div>
                <div className="text-xs text-muted-foreground space-y-1">
                  {profitability.billingType === "time" && profitability.realDailyRate !== undefined ? (
                    <p>TJM réel: {profitability.realDailyRate.toFixed(2)} €</p>
                  ) : (
                    <p>Coût réel: {profitability.actualCost.toFixed(2)} €</p>
                  )}
                  {profitability.theoreticalDailyRate !== undefined && (
                    <p>TJM théorique: {profitability.theoreticalDailyRate.toFixed(2)} €</p>
                  )}
                  <p>Montant facturé: {profitability.totalBilled.toFixed(2)} €</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add Time Entry Form */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Ajouter du temps</CardTitle>
          <Button
            variant={showAddTimeForm ? "ghost" : "default"}
            size="sm"
            onClick={() => setShowAddTimeForm(!showAddTimeForm)}
            data-testid="button-toggle-add-time"
          >
            {showAddTimeForm ? "Annuler" : <><Plus className="h-4 w-4 mr-2" />Ajouter du temps</>}
          </Button>
        </CardHeader>
        {showAddTimeForm && (
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm">Heures</Label>
                  <Input
                    type="number"
                    min="0"
                    value={newTimeHours}
                    onChange={(e) => setNewTimeHours(e.target.value)}
                    placeholder="0"
                    data-testid="input-time-hours"
                  />
                </div>
                <div>
                  <Label className="text-sm">Minutes</Label>
                  <Select
                    value={newTimeMinutes}
                    onValueChange={setNewTimeMinutes}
                  >
                    <SelectTrigger data-testid="select-time-minutes">
                      <SelectValue placeholder="0" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 min</SelectItem>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="45">45 min</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-sm">Date</Label>
                  <Popover open={isNewTimeDatePickerOpen} onOpenChange={setIsNewTimeDatePickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !newTimeDate && "text-muted-foreground"
                        )}
                        data-testid="button-time-date"
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {newTimeDate ? format(newTimeDate, "dd/MM/yyyy", { locale: fr }) : "Sélectionner"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={newTimeDate}
                        onSelect={(date) => {
                          setNewTimeDate(date);
                          setIsNewTimeDatePickerOpen(false);
                        }}
                        initialFocus
                        locale={fr}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <div>
                <Label className="text-sm">Description (optionnelle)</Label>
                <Input
                  value={newTimeDescription}
                  onChange={(e) => setNewTimeDescription(e.target.value)}
                  placeholder="Note sur la session de travail"
                  data-testid="input-time-description"
                />
              </div>
              <div className="flex justify-end">
                <Button
                  onClick={async () => {
                    const hours = parseInt(newTimeHours) || 0;
                    const minutes = parseInt(newTimeMinutes) || 0;
                    const totalSeconds = (hours * 3600) + (minutes * 60);
                    
                    if (totalSeconds <= 0) {
                      toast({
                        title: "Erreur",
                        description: "Veuillez entrer une durée valide",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    if (!newTimeDate) {
                      toast({
                        title: "Erreur",
                        description: "Veuillez sélectionner une date",
                        variant: "destructive",
                      });
                      return;
                    }
                    
                    setIsAddingTime(true);
                    try {
                      const startTime = new Date(newTimeDate);
                      startTime.setHours(9, 0, 0, 0);
                      
                      await apiRequest("/api/time-entries/manual", "POST", {
                        projectId,
                        startTime: startTime.toISOString(),
                        endTime: new Date(startTime.getTime() + totalSeconds * 1000).toISOString(),
                        duration: totalSeconds,
                        description: newTimeDescription || null,
                      });
                      
                      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/time-entries`] });
                      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
                      
                      setNewTimeHours("");
                      setNewTimeMinutes("0");
                      setNewTimeDescription("");
                      setShowAddTimeForm(false);
                      
                      toast({
                        title: "Temps ajouté",
                        description: `${hours}h${minutes > 0 ? ` ${minutes}min` : ""} ajoutés au projet`,
                        variant: "success",
                      });
                    } catch (error: any) {
                      toast({
                        title: "Erreur",
                        description: error.message || "Impossible d'ajouter le temps",
                        variant: "destructive",
                      });
                    } finally {
                      setIsAddingTime(false);
                    }
                  }}
                  disabled={isAddingTime}
                  data-testid="button-save-time"
                >
                  {isAddingTime ? "Enregistrement..." : "Enregistrer"}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Time Entries List */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Sessions de temps</CardTitle>
        </CardHeader>
        <CardContent>
          {timeEntries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Aucune session de temps enregistrée pour ce projet.
            </div>
          ) : (
            <div className="space-y-2">
              {timeEntries.map((entry) => {
                const user = users.find((u) => u.id === entry.userId);
                return (
                  <div
                    key={entry.id}
                    className="p-3 border rounded-md hover-elevate"
                    data-testid={`time-entry-${entry.id}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {format(new Date(entry.startTime), "dd MMM yyyy 'à' HH:mm", { locale: fr })}
                          </span>
                        </div>
                        {entry.description && (
                          <p className="text-sm text-muted-foreground mt-1">{entry.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {user && (
                            <Badge variant="outline" className="text-xs">
                              {user.firstName} {user.lastName}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <Badge variant="secondary" data-testid={`duration-${entry.id}`}>
                          {entry.duration ? formatDuration(entry.duration) : "En cours"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteEntryId(entry.id)}
                          data-testid={`button-delete-${entry.id}`}
                          className="h-8 w-8"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteEntryId} onOpenChange={(open) => !open && setDeleteEntryId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette session ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est irréversible. La session de temps sera définitivement supprimée.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteEntryId && deleteMutation.mutate(deleteEntryId)}
              disabled={deleteMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Helper functions for ticket display - defined outside component to avoid recreating
const getTicketPriorityColor = (priority: string | null) => {
  switch (priority) {
    case "critique": return "text-red-600 dark:text-red-400";
    case "haute": return "text-orange-500 dark:text-orange-400";
    case "moyenne": return "text-yellow-500 dark:text-yellow-400";
    case "basse": return "text-blue-500 dark:text-blue-400";
    default: return "text-gray-400";
  }
};

const getTicketStateStyle = (state: string) => {
  switch (state) {
    case "a_faire": return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
    case "en_cours": return "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300";
    case "review": return "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300";
    case "termine": return "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300";
    default: return "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300";
  }
};

// Component to display a backlog row with expandable ticket list
interface BacklogRowWithTicketsProps {
  backlog: {
    id: string;
    name: string;
    description: string | null;
    mode: string;
    createdAt: string;
    activeSprint?: { id: string; name: string } | null;
  };
  isExpanded: boolean;
  onToggle: () => void;
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  totalTickets: number;
  creatorName: string | null;
  modeLabel: string;
  navigate: (path: string) => void;
}

function BacklogRowWithTickets({
  backlog, isExpanded, onToggle, todoCount, inProgressCount, doneCount, totalTickets,
  creatorName, modeLabel, navigate
}: BacklogRowWithTicketsProps) {
  // Fetch full backlog data with tickets only when expanded
  const { data: backlogData, isLoading: ticketsLoading } = useQuery<{
    epics: Epic[];
    userStories: UserStory[];
    backlogTasks: BacklogTask[];
  }>({
    queryKey: ['/api/backlogs', backlog.id],
    enabled: isExpanded,
  });
  
  // Transform tickets to flat list with type info
  const allTickets = useMemo(() => {
    if (!backlogData) return [];
    const tickets: Array<{
      id: string;
      type: 'epic' | 'user_story' | 'task';
      title: string;
      state: string;
      priority: string | null;
      estimatePoints: number | null;
    }> = [];
    
    backlogData.epics?.forEach(epic => {
      tickets.push({
        id: epic.id,
        type: 'epic',
        title: epic.title,
        state: epic.state,
        priority: epic.priority,
        estimatePoints: null,
      });
    });
    
    backlogData.userStories?.forEach(story => {
      tickets.push({
        id: story.id,
        type: 'user_story',
        title: story.title,
        state: story.state,
        priority: story.priority,
        estimatePoints: story.estimatePoints,
      });
    });
    
    backlogData.backlogTasks?.forEach(task => {
      tickets.push({
        id: task.id,
        type: 'task',
        title: task.title,
        state: task.state,
        priority: task.priority,
        estimatePoints: task.estimatePoints,
      });
    });
    
    return tickets;
  }, [backlogData]);

  const getStateLabel = (state: string) => {
    const option = backlogItemStateOptions.find(o => o.value === state);
    return option?.label || state;
  };

  // Mode icon component to avoid recreating on each render
  const modeIcon = backlog.mode === "kanban" ? <Kanban className="h-3 w-3" /> : <LayoutGrid className="h-3 w-3" />;

  // Handle row click - navigate only if clicking directly on the row, not on buttons
  const handleRowClick = (e: React.MouseEvent<HTMLTableRowElement>) => {
    // Check if the click target is an interactive element
    const target = e.target as HTMLElement;
    const isInteractive = target.closest('button') || 
                          target.closest('a') || 
                          target.tagName === 'BUTTON' || 
                          target.tagName === 'A';
    if (!isInteractive) {
      navigate(`/product/backlog/${backlog.id}`);
    }
  };

  return (
    <>
      {/* Main backlog row - clicking non-interactive areas navigates to backlog detail */}
      <tr 
        className="hover:bg-muted/30 cursor-pointer"
        onClick={handleRowClick}
        data-testid={`row-backlog-${backlog.id}`}
      >
        <td className="px-2 py-3">
          {totalTickets > 0 && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-6 w-6"
              onClick={(e) => {
                e.stopPropagation();
                onToggle();
              }}
              data-testid={`button-toggle-backlog-${backlog.id}`}
            >
              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          )}
        </td>
        <td className="px-4 py-3">
          <div className="flex flex-col">
            <span className="text-sm font-medium" data-testid={`title-backlog-${backlog.id}`}>{backlog.name}</span>
            {backlog.description && (
              <span className="text-xs text-muted-foreground line-clamp-1">{backlog.description}</span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 hidden sm:table-cell">
          <Badge variant="secondary" className="flex items-center gap-1 w-fit text-xs">
            {modeIcon}
            {modeLabel}
          </Badge>
        </td>
        <td className="px-4 py-3 hidden md:table-cell">
          {backlog.activeSprint ? (
            <Badge className="bg-violet-500 text-white flex items-center gap-1 w-fit text-xs">
              <Play className="h-3 w-3" />
              {backlog.activeSprint.name}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          {totalTickets > 0 ? (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-1.5">
                {todoCount}
              </Badge>
              <Badge variant="outline" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs px-1.5">
                {inProgressCount}
              </Badge>
              <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs px-1.5">
                {doneCount}
              </Badge>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">0</span>
          )}
        </td>
        <td className="px-4 py-3 hidden xl:table-cell">
          {creatorName ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{creatorName}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">-</span>
          )}
        </td>
        <td className="px-4 py-3 hidden lg:table-cell">
          {backlog.createdAt && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <CalendarIcon className="h-3 w-3" />
              {format(new Date(backlog.createdAt), "d MMM yyyy", { locale: fr })}
            </div>
          )}
        </td>
        <td className="px-2 py-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/product/backlog/${backlog.id}`);
            }}
            data-testid={`button-open-backlog-${backlog.id}`}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
        </td>
      </tr>
      
      {/* Expanded ticket rows */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0">
            <div className="bg-muted/20 border-t">
              {ticketsLoading ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  Chargement des tickets...
                </div>
              ) : allTickets.length === 0 ? (
                <div className="py-4 text-center text-sm text-muted-foreground">
                  Aucun ticket dans ce backlog
                </div>
              ) : (
                <div className="divide-y">
                  {allTickets.map((ticket) => {
                    const typeIcon = ticket.type === 'epic' 
                      ? <Layers className="h-3 w-3 text-violet-500" />
                      : ticket.type === 'user_story'
                        ? <ListTodo className="h-3 w-3 text-blue-500" />
                        : <Check className="h-3 w-3 text-green-500" />;
                    
                    return (
                      <div 
                        key={ticket.id}
                        className="px-6 py-2 hover:bg-muted/40 cursor-pointer flex items-center gap-3"
                        onClick={() => navigate(`/product/backlog/${backlog.id}?ticket=${ticket.id}`)}
                        data-testid={`ticket-row-${ticket.id}`}
                      >
                        <div className="w-5 flex justify-center">
                          {typeIcon}
                        </div>
                        <span className="text-sm flex-1 truncate">{ticket.title}</span>
                        <div className="flex items-center gap-2">
                          {ticket.priority && (
                            <Flag className={cn("h-3 w-3", getTicketPriorityColor(ticket.priority))} />
                          )}
                          {ticket.estimatePoints && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              {ticket.estimatePoints}
                            </Badge>
                          )}
                          <Badge variant="outline" className={cn("text-[10px] px-1.5", getTicketStateStyle(ticket.state))}>
                            {getStateLabel(ticket.state)}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const navigate = (path: string) => setLocation(path);
  const { toast } = useToast();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTaskDetailDialogOpen, setIsTaskDetailDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteTaskId, setDeleteTaskId] = useState<string | null>(null);
  const [isDeleteTaskDialogOpen, setIsDeleteTaskDialogOpen] = useState(false);
  const [projectFormData, setProjectFormData] = useState({
    name: "",
    description: "",
    clientId: "",
    stage: "prospection",
    category: "",
    startDate: undefined as Date | undefined,
    endDate: undefined as Date | undefined,
    budget: "",
  });

  // Task edit state with debounced autosave
  const [taskEditData, setTaskEditData] = useState<Partial<Task>>({});
  const taskSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastSavedTaskRef = useRef<string>("");

  // Billing fields state
  const [totalBilledValue, setTotalBilledValue] = useState<string>("");
  const [billingRateValue, setBillingRateValue] = useState<string>("");
  const [numberOfDaysValue, setNumberOfDaysValue] = useState<string>("");

  // Payment tracking state
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentDescription, setPaymentDescription] = useState<string>("");
  const [isPaymentDatePickerOpen, setIsPaymentDatePickerOpen] = useState(false);
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null);
  // Payment editing state
  const [editingPayment, setEditingPayment] = useState<ProjectPayment | null>(null);
  const [editPaymentAmount, setEditPaymentAmount] = useState<string>("");
  const [editPaymentDate, setEditPaymentDate] = useState<Date | undefined>(undefined);
  const [editPaymentDescription, setEditPaymentDescription] = useState<string>("");
  const [isEditPaymentDatePickerOpen, setIsEditPaymentDatePickerOpen] = useState(false);
  
  // Expanded backlogs state for showing tickets
  const [expandedBacklogs, setExpandedBacklogs] = useState<Set<string>>(new Set());

  // Activity management state
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);
  const [isDeleteActivityDialogOpen, setIsDeleteActivityDialogOpen] = useState(false);
  const [activityFormData, setActivityFormData] = useState({
    kind: "custom" as string,
    description: "",
    occurredAt: "",
  });

  const { data: project, isLoading: projectLoading } = useQuery<ProjectWithRelations>({
    queryKey: ['/api/projects', id],
  });

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ['/api/users'],
  });

  const { data: columns = [] } = useQuery<TaskColumn[]>({
    queryKey: ['/api/projects', id, 'task-columns'],
    enabled: !!id,
  });

  const { data: projectNotes = [] } = useQuery<Note[]>({
    queryKey: ['/api/projects', id, 'notes'],
    enabled: !!id,
  });

  const { data: projectCategories = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ['/api/project-categories'],
  });

  // Fetch all projects to get all existing categories
  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Merge all categories: from database + from all projects
  const allCategories = useMemo(() => {
    const dbCategoryNames = projectCategories.map(c => c.name);
    const projectCategoryNames = allProjects
      .filter(p => p.category && p.category.trim())
      .map(p => p.category!);
    const allNames = new Set([...dbCategoryNames, ...projectCategoryNames]);
    return Array.from(allNames)
      .sort()
      .map((name, index) => {
        const existing = projectCategories.find(c => c.name === name);
        return existing || { id: `temp-${index}`, name };
      });
  }, [projectCategories, allProjects]);

  const { data: projectDocuments = [] } = useQuery<Document[]>({
    queryKey: ['/api/projects', id, 'documents'],
    enabled: !!id,
  });

  // Fetch payments for this project (API now returns totals)
  interface PaymentsResponse {
    payments: ProjectPayment[];
    totalPaid: number;
    remainingAmount: number;
    budget: number;
    billingStatus: string | null;
  }
  const { data: paymentsData } = useQuery<PaymentsResponse>({
    queryKey: ['/api/projects', id, 'payments'],
    enabled: !!id,
  });

  // Extract data from API response
  const payments = paymentsData?.payments || [];
  const totalPaid = paymentsData?.totalPaid || 0;
  const remainingAmount = paymentsData?.remainingAmount || 0;

  // Fetch activities for this project
  const { data: projectActivities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/projects', id, 'activities'],
    enabled: !!id,
  });

  // Fetch all backlogs and filter by projectId
  interface BacklogWithDetails extends Backlog {
    ticketCounts?: { todo: number; inProgress: number; done: number; total: number };
    activeSprint?: { id: string; name: string } | null;
    creator?: { id: string; firstName?: string; lastName?: string; email: string } | null;
  }
  
  // Full backlog data with tickets (for expanded view)
  type BacklogFullData = Backlog & {
    epics: Epic[];
    userStories: UserStory[];
    backlogTasks: BacklogTask[];
    sprints: Sprint[];
    columns: BacklogColumn[];
  };
  
  const { data: allBacklogs = [] } = useQuery<BacklogWithDetails[]>({
    queryKey: ['/api/backlogs'],
    enabled: !!id,
  });
  
  // Filter backlogs linked to this project
  const projectBacklogs = useMemo(() => {
    return allBacklogs.filter((b) => b.projectId === id);
  }, [allBacklogs, id]);
  
  // Toggle backlog expansion
  const toggleBacklogExpanded = (backlogId: string) => {
    setExpandedBacklogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(backlogId)) {
        newSet.delete(backlogId);
      } else {
        newSet.add(backlogId);
      }
      return newSet;
    });
  };

  // Initialize billing fields when project loads
  useEffect(() => {
    if (project) {
      setTotalBilledValue(project.totalBilled || project.budget || "");
      setBillingRateValue(project.billingRate || "");
      setNumberOfDaysValue(project.numberOfDays || "");
    }
  }, [project]);

  const updateProjectMutation = {
    mutate: async ({ data }: { data: Partial<Project> }) => {
      try {
        // Auto-set progress to 100% when stage is "termine"
        if (data.stage === "termine" && data.progress === undefined) {
          data.progress = 100;
        }
        await apiRequest(`/api/projects/${id}`, "PATCH", data);
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
        toast({
          title: "Projet mis à jour",
          description: "Le projet a été mis à jour avec succès.",
          variant: "success",
        });
        setIsEditDialogOpen(false);
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de mettre à jour le projet.",
          variant: "destructive",
        });
        throw error; // Re-throw to allow handleSubmitEdit to catch
      }
    },
    mutateAsync: async ({ data }: { data: Partial<Project> }) => {
      // Auto-set progress to 100% when stage is "termine"
      if (data.stage === "termine" && data.progress === undefined) {
        data.progress = 100;
      }
      await apiRequest(`/api/projects/${id}`, "PATCH", data);
      queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
      toast({
        title: "Projet mis à jour",
        description: "Le projet a été mis à jour avec succès.",
        variant: "success",
      });
      setIsEditDialogOpen(false);
    },
  };

  const deleteProjectMutation = {
    mutate: async () => {
      try {
        await apiRequest(`/api/projects/${id}`, "DELETE");
        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
        toast({
          title: "Projet supprimé",
          description: "Le projet a été supprimé avec succès.",
          variant: "success",
        });
        setLocation("/projects");
      } catch (error: any) {
        toast({
          title: "Erreur",
          description: error.message || "Impossible de supprimer le projet.",
          variant: "destructive",
        });
      }
    },
  };

  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      return await apiRequest(`/api/tasks/${taskId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setIsDeleteTaskDialogOpen(false);
      setDeleteTaskId(null);
      toast({ title: "Tâche supprimée", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression de la tâche", variant: "destructive" });
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ taskId, data }: { taskId: string; data: Partial<Task> }) => {
      return await apiRequest(`/api/tasks/${taskId}`, "PATCH", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour de la tâche", variant: "destructive" });
    },
  });

  // Create note linked to project
  const createNoteMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/notes", "POST", {
        title: `Note - ${project?.name || "Nouveau"}`,
        content: { type: 'doc', content: [] },
        plainText: "",
        status: "draft",
        visibility: "private",
      });
      return await response.json();
    },
    onSuccess: async (newNote) => {
      // Link note to project
      await apiRequest(`/api/notes/${newNote.id}/links`, "POST", {
        targetType: "project",
        targetId: id,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/note-links"] });
      toast({
        title: "Note créée",
        description: "La note a été créée et liée au projet",
        variant: "success",
      });
      setLocation(`/notes/${newNote.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la note",
        variant: "destructive",
      });
    },
  });

  // Create task linked to project
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      const defaultColumn = columns[0];
      const response = await apiRequest("/api/tasks", "POST", {
        title: "Nouvelle tâche",
        description: "",
        projectId: id,
        columnId: defaultColumn?.id || null,
        priority: "medium",
        status: "todo",
      });
      return await response.json();
    },
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      toast({
        title: "Tâche créée",
        description: "La tâche a été créée et liée au projet",
        variant: "success",
      });
      // Open task detail dialog
      setSelectedTask(newTask);
      setIsTaskDetailDialogOpen(true);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la tâche",
        variant: "destructive",
      });
    },
  });

  // Create document linked to project
  const createDocumentMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("/api/documents", "POST", {
        name: `Document - ${project?.name || "Nouveau"}`,
        templateId: null,
        formData: {},
        content: "",
        plainText: "",
        status: "draft",
        projectId: id,
      });
      return await response.json();
    },
    onSuccess: (newDocument) => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", id, "documents"] });
      toast({
        title: "Document créé",
        description: "Le document a été créé et lié au projet",
        variant: "success",
      });
      setLocation(`/documents/${newDocument.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer le document",
        variant: "destructive",
      });
    },
  });

  // Activity mutations
  const createActivityMutation = useMutation({
    mutationFn: async (data: { kind: string; description: string; occurredAt: string }) => {
      return await apiRequest("/api/activities", "POST", {
        subjectType: "project",
        subjectId: id,
        kind: data.kind,
        description: data.description,
        occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'activities'] });
      setIsActivityDialogOpen(false);
      setActivityFormData({ kind: "custom", description: "", occurredAt: "" });
      toast({ title: "Activité créée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création de l'activité", variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async (data: { id: string; kind: string; description: string; occurredAt: string }) => {
      return await apiRequest(`/api/activities/${data.id}`, "PATCH", {
        kind: data.kind,
        description: data.description,
        occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'activities'] });
      setIsActivityDialogOpen(false);
      setEditingActivity(null);
      setActivityFormData({ kind: "custom", description: "", occurredAt: "" });
      toast({ title: "Activité modifiée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la modification de l'activité", variant: "destructive" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return await apiRequest(`/api/activities/${activityId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'activities'] });
      setIsDeleteActivityDialogOpen(false);
      setDeleteActivityId(null);
      toast({ title: "Activité supprimée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression de l'activité", variant: "destructive" });
    },
  });

  const handleActivitySubmit = () => {
    if (!activityFormData.description.trim()) return;
    if (editingActivity) {
      updateActivityMutation.mutate({
        id: editingActivity.id,
        ...activityFormData,
      });
    } else {
      createActivityMutation.mutate(activityFormData);
    }
  };

  const openActivityDialog = (activity?: Activity) => {
    if (activity) {
      setEditingActivity(activity);
      setActivityFormData({
        kind: activity.kind,
        description: activity.description || "",
        occurredAt: activity.occurredAt ? format(new Date(activity.occurredAt), "yyyy-MM-dd") : "",
      });
    } else {
      setEditingActivity(null);
      setActivityFormData({ kind: "custom", description: "", occurredAt: format(new Date(), "yyyy-MM-dd") });
    }
    setIsActivityDialogOpen(true);
  };

  // Debounced autosave for task edits
  useEffect(() => {
    if (!selectedTask || !taskEditData.id) return;

    const currentData = JSON.stringify(taskEditData);
    if (currentData === lastSavedTaskRef.current) return;

    if (taskSaveTimeoutRef.current) {
      clearTimeout(taskSaveTimeoutRef.current);
    }

    taskSaveTimeoutRef.current = setTimeout(() => {
      const { id: taskId, ...dataToSave } = taskEditData;
      updateTaskMutation.mutate({ taskId: taskId!, data: dataToSave });
      lastSavedTaskRef.current = currentData;
    }, 500);

    return () => {
      if (taskSaveTimeoutRef.current) {
        clearTimeout(taskSaveTimeoutRef.current);
      }
    };
  }, [taskEditData]);

  // Initialize task edit data when opening dialog
  useEffect(() => {
    if (selectedTask && isTaskDetailDialogOpen) {
      setTaskEditData(selectedTask);
      lastSavedTaskRef.current = JSON.stringify(selectedTask);
    }
  }, [selectedTask, isTaskDetailDialogOpen]);

  const getStageLabel = (stage: string) => {
    const labels: Record<string, string> = {
      prospection: "Prospection",
      en_cours: "En cours",
      livre: "Livré",
      termine: "Terminé",
      signe: "Signé",
    };
    return labels[stage] || stage;
  };

  const getStageColor = (stage: string) => {
    const colors: Record<string, string> = {
      prospection: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
      en_cours: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
      livre: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200",
      termine: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
      signe: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
    };
    return colors[stage] || "";
  };

  const getBillingStatusColor = (status: string | null) => {
    switch (status || "brouillon") {
      case "brouillon":
        return "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-800";
      case "devis_envoye":
        return "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800";
      case "devis_accepte":
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "bon_commande":
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "facture":
        return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800";
      case "paye":
        return "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800";
      case "partiel":
        return "bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800";
      case "annule":
        return "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400 dark:border-gray-700";
      case "retard":
        return "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800";
      default:
        return "bg-gray-50 text-gray-600 border-gray-200 dark:bg-gray-800/20 dark:text-gray-400 dark:border-gray-700";
    }
  };

  const getBillingDaysOverdue = (billingDueDate: string | null) => {
    if (!billingDueDate) return "";
    const dueDate = new Date(billingDueDate);
    const today = new Date();
    const diffTime = today.getTime() - dueDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays > 0) {
      return ` (${diffDays}j)`;
    }
    return "";
  };

  const handleEditProject = () => {
    if (!project) return;
    setProjectFormData({
      name: project.name,
      description: project.description || "",
      clientId: project.clientId || "",
      stage: project.stage || "prospection",
      category: project.category || "",
      startDate: project.startDate ? new Date(project.startDate) : undefined,
      endDate: project.endDate ? new Date(project.endDate) : undefined,
      budget: project.budget || "",
    });
    setIsEditDialogOpen(true);
  };

  const handleSubmitEdit = async () => {
    try {
      // Update the project using mutateAsync to catch errors
      await updateProjectMutation.mutateAsync({
        data: {
          name: projectFormData.name,
          description: projectFormData.description,
          clientId: projectFormData.clientId || null,
          stage: projectFormData.stage,
          category: projectFormData.category || null,
          startDate: projectFormData.startDate ? formatDateForStorage(projectFormData.startDate) : null,
          endDate: projectFormData.endDate ? formatDateForStorage(projectFormData.endDate) : null,
          budget: projectFormData.budget || null,
        },
      });
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder le projet",
        variant: "destructive",
      });
    }
  };

  if (projectLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader size="lg" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Projet non trouvé</h2>
          <p className="text-muted-foreground mb-4">Le projet demandé n'existe pas ou a été supprimé.</p>
          <Link href="/projects">
            <Button data-testid="button-back-to-projects">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour aux projets
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const projectTasks = project.tasks || [];
  const tasksByStatus = columns.reduce((acc, column) => {
    acc[column.id] = projectTasks.filter(task => task.columnId === column.id);
    return acc;
  }, {} as Record<string, Task[]>);

  // Calculate progress based on completed tasks
  const completedColumn = columns.find(col => col.name === "Terminé");
  const completedTasksCount = completedColumn ? (tasksByStatus[completedColumn.id] || []).length : 0;
  const totalTasksCount = projectTasks.length;
  const progressPercentage = totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden">
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-start gap-2 sm:gap-3 w-full sm:w-auto">
            <Link href="/projects">
              <Button variant="ghost" size="icon" data-testid="button-back" className="shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-start sm:items-center gap-2 flex-wrap">
                <h1 className="text-[16px] sm:text-[26px] font-bold truncate" data-testid="project-title">{project.name}</h1>
                <Badge className={`${getStageColor(project.stage || "prospection")} shrink-0`} data-testid="badge-stage">
                  {getStageLabel(project.stage || "prospection")}
                </Badge>
                {project.category && (
                  <Badge variant="outline" data-testid="badge-category" className="shrink-0">
                    {project.category}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {project.client ? (
                  <Link href={`/crm/${project.clientId}`}>
                    <p className="text-muted-foreground text-sm hover:text-primary cursor-pointer hover:underline">
                      {project.client.company || project.client.name}
                    </p>
                  </Link>
                ) : (
                  <p className="text-muted-foreground text-sm">
                    Client non défini
                  </p>
                )}
                {project.budget && (
                  <Badge className="bg-budget text-budget-foreground shrink-0" data-testid="badge-budget">
                    <Euro className="h-3 w-3 mr-1" />
                    {project.budget}
                  </Badge>
                )}
                <Badge 
                  data-testid="badge-billing-status-budget"
                  className={`${getBillingStatusColor(project.billingStatus)} shrink-0`}
                >
                  {billingStatusOptions.find(o => o.value === (project.billingStatus || "brouillon"))?.label}
                  {project.billingStatus === "retard" && getBillingDaysOverdue(project.billingDueDate)}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={handleEditProject} data-testid="button-edit-project" className="flex-1 sm:flex-none">
              <Edit className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Modifier</span>
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => setIsDeleteDialogOpen(true)}
              data-testid="button-delete-project"
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline text-[12px]">Supprimer</span>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {project.description && (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight text-[16px]">Description</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-[12px]" data-testid="project-description">
                  {project.description}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className={!project.description ? "lg:col-span-3" : ""}>
            <CardHeader className="pb-3">
              <CardTitle className="tracking-tight font-semibold text-[#17171c] text-[16px]">Période</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[12px]">Début:</span>
                    <span className="text-[12px]" data-testid="project-start-date">
                      {project.startDate 
                        ? format(new Date(project.startDate), "dd MMM yyyy", { locale: fr })
                        : "Non définie"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[12px]">Fin:</span>
                    <span className="text-[12px]" data-testid="project-end-date">
                      {project.endDate 
                        ? format(new Date(project.endDate), "dd MMM yyyy", { locale: fr })
                        : "Non définie"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {totalTasksCount > 0 && (
          <Card className="mb-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Progression des tâches</CardTitle>
                <span className="text-sm font-semibold" data-testid="progress-percentage">
                  {progressPercentage}%
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Progress value={progressPercentage} className="h-2" data-testid="progress-bar" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span data-testid="completed-tasks-count">{completedTasksCount} tâche{completedTasksCount !== 1 ? 's' : ''} terminée{completedTasksCount !== 1 ? 's' : ''}</span>
                  <span data-testid="total-tasks-count">{totalTasksCount} tâche{totalTasksCount !== 1 ? 's' : ''} au total</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="activities" className="w-full">
          <TabsList className="w-full justify-start mb-4 overflow-x-auto overflow-y-hidden flex-nowrap">
            <TabsTrigger value="activities" className="gap-2 text-xs" data-testid="tab-activities">
              <MessageSquare className="h-4 w-4" />
              Activité
              <Badge variant="secondary" className="ml-1" data-testid="activities-count">
                {projectActivities.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="tasks" className="gap-2 text-xs">
              <Users className="h-4 w-4" />
              Tâches
              <Badge variant="secondary" className="ml-1" data-testid="tasks-count">
                {projectTasks.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-2 text-xs">
              <FileText className="h-4 w-4" />
              Notes
              <Badge variant="secondary" className="ml-1" data-testid="notes-count">
                {projectNotes.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2 text-xs">
              <FileText className="h-4 w-4" />
              Documents
              <Badge variant="secondary" className="ml-1" data-testid="documents-count">
                {projectDocuments.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="backlogs" className="gap-2 text-xs" data-testid="tab-backlogs">
              <FolderKanban className="h-4 w-4" />
              Backlogs
              <Badge variant="secondary" className="ml-1" data-testid="backlogs-count">
                {projectBacklogs.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2 text-xs" data-testid="tab-billing">
              <DollarSign className="h-4 w-4" />
              Facturation
            </TabsTrigger>
            <TabsTrigger value="time" className="gap-2 text-xs" data-testid="tab-time">
              <Timer className="h-4 w-4" />
              Temps
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tasks" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end mb-4">
                  <Button 
                    size="sm" 
                    onClick={() => createTaskMutation.mutate()}
                    disabled={createTaskMutation.isPending}
                    data-testid="button-create-task"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createTaskMutation.isPending ? "Création..." : "Créer une tâche"}
                  </Button>
                </div>
                {projectTasks.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[12px]">
                    Aucune tâche associée à ce projet.
                  </div>
                ) : (
                  <Accordion type="multiple" defaultValue={[]} className="space-y-2">
                    {columns.map((column) => {
                      const columnTasks = tasksByStatus[column.id] || [];
                      if (columnTasks.length === 0) return null;
                      
                      return (
                        <AccordionItem key={column.id} value={column.id} className="border rounded-md">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: column.color }}
                              />
                              <h3 className="text-sm font-semibold">{column.name}</h3>
                              <Badge variant="outline">{columnTasks.length}</Badge>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-3">
                            <div className="space-y-2">
                              {columnTasks.map((task) => {
                                const assignedUser = users.find(u => u.id === task.assignedToId);
                                
                                return (
                                  <div 
                                    key={task.id}
                                    className="p-3 border rounded-md hover-elevate cursor-pointer"
                                    onClick={() => {
                                      setSelectedTask(task);
                                      setIsTaskDetailDialogOpen(true);
                                    }}
                                    data-testid={`task-${task.id}`}
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="flex-1">
                                        <h4 
                                          className="text-sm font-medium mb-1"
                                          data-testid={`title-task-${task.id}`}
                                        >
                                          {task.title}
                                        </h4>
                                        {task.description && (
                                          <p className="text-xs text-muted-foreground line-clamp-2">
                                            {task.description}
                                          </p>
                                        )}
                                        {task.dueDate && (
                                          <div className="flex items-center gap-1 mt-2 text-[11px] text-muted-foreground">
                                            <CalendarIcon className="h-3 w-3" />
                                            {format(new Date(task.dueDate), "dd MMM yyyy", { locale: fr })}
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        {assignedUser && (
                                          <Avatar className="h-8 w-8">
                                            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                                              {assignedUser.firstName?.[0]}{assignedUser.lastName?.[0]}
                                            </AvatarFallback>
                                          </Avatar>
                                        )}
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-8 w-8"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeleteTaskId(task.id);
                                            setIsDeleteTaskDialogOpen(true);
                                          }}
                                          data-testid={`button-delete-task-${task.id}`}
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end mb-4">
                  <Button 
                    size="sm" 
                    onClick={() => createNoteMutation.mutate()}
                    disabled={createNoteMutation.isPending}
                    data-testid="button-create-note"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createNoteMutation.isPending ? "Création..." : "Créer une note"}
                  </Button>
                </div>
                {projectNotes.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[12px]">
                    Aucune note liée à ce projet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectNotes.map((note) => (
                      <Link key={note.id} href={`/notes/${note.id}`}>
                        <div className="p-4 border rounded-md hover-elevate cursor-pointer" data-testid={`note-${note.id}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium mb-1" data-testid={`title-note-${note.id}`}>
                                {note.title || "Sans titre"}
                              </h4>
                              {note.summary && (
                                <p className="text-xs text-muted-foreground line-clamp-2">
                                  {note.summary}
                                </p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="text-[10px]">
                                  {note.status === "draft" ? "Brouillon" : note.status === "active" ? "Actif" : "Archivé"}
                                </Badge>
                                {note.updatedAt && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Modifié {format(new Date(note.updatedAt), "dd MMM yyyy", { locale: fr })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="documents" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                <div className="flex justify-end mb-4">
                  <Button 
                    size="sm" 
                    onClick={() => createDocumentMutation.mutate()}
                    disabled={createDocumentMutation.isPending}
                    data-testid="button-create-document"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {createDocumentMutation.isPending ? "Création..." : "Créer un document"}
                  </Button>
                </div>
                {projectDocuments.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[12px]">
                    Aucun document lié à ce projet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {projectDocuments.map((document) => (
                      <Link key={document.id} href={`/documents/${document.id}`}>
                        <div className="p-4 border rounded-md hover-elevate cursor-pointer" data-testid={`document-${document.id}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium mb-1" data-testid={`title-document-${document.id}`}>
                                {document.name || "Sans titre"}
                              </h4>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  variant={document.status === "draft" ? "outline" : "default"}
                                  className={document.status === "draft" ? "text-muted-foreground" : "bg-green-600 dark:bg-green-700 text-white"}
                                  data-testid={`status-${document.id}`}
                                >
                                  {document.status === "draft" ? "Brouillon" : 
                                   document.status === "published" ? "Publié" : "Archivé"}
                                </Badge>
                                {document.updatedAt && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Modifié {format(new Date(document.updatedAt), "dd MMM yyyy", { locale: fr })}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backlogs" className="mt-0">
            <Card>
              <CardContent className="pt-6">
                {projectBacklogs.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-[12px]">
                    Aucun backlog associé à ce projet.
                  </div>
                ) : (
                  <div className="border rounded-lg overflow-hidden bg-card">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr className="text-left text-xs font-medium text-muted-foreground">
                          <th className="px-4 py-2 w-8"></th>
                          <th className="px-4 py-2">Nom</th>
                          <th className="px-4 py-2 hidden sm:table-cell">Mode</th>
                          <th className="px-4 py-2 hidden md:table-cell">Sprint actif</th>
                          <th className="px-4 py-2 hidden lg:table-cell">Tickets</th>
                          <th className="px-4 py-2 hidden xl:table-cell">Créateur</th>
                          <th className="px-4 py-2 hidden lg:table-cell">Créé le</th>
                          <th className="px-4 py-2 w-10"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {projectBacklogs.map((backlog) => {
                          const todoCount = backlog.ticketCounts?.todo || 0;
                          const inProgressCount = backlog.ticketCounts?.inProgress || 0;
                          const doneCount = backlog.ticketCounts?.done || 0;
                          const totalTickets = todoCount + inProgressCount + doneCount;
                          const creatorName = backlog.creator 
                            ? (backlog.creator.firstName && backlog.creator.lastName 
                                ? `${backlog.creator.firstName} ${backlog.creator.lastName}`
                                : backlog.creator.email)
                            : null;
                          const modeLabel = backlogModeOptions.find(m => m.value === backlog.mode)?.label || backlog.mode;
                          const isExpanded = expandedBacklogs.has(backlog.id);
                          
                          return (
                            <BacklogRowWithTickets 
                              key={backlog.id}
                              backlog={backlog}
                              isExpanded={isExpanded}
                              onToggle={() => toggleBacklogExpanded(backlog.id)}
                              todoCount={todoCount}
                              inProgressCount={inProgressCount}
                              doneCount={doneCount}
                              totalTickets={totalTickets}
                              creatorName={creatorName}
                              modeLabel={modeLabel}
                              navigate={navigate}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="mt-0">
            <Card>
              <CardContent className="pt-6 grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="billing-status">Statut de facturation</Label>
                  <Select
                    value={project?.billingStatus || "brouillon"}
                    onValueChange={async (value) => {
                      try {
                        const updateData: { billingStatus: string; billingDueDate?: string | null } = {
                          billingStatus: value,
                        };
                        if (value !== "retard") {
                          updateData.billingDueDate = null;
                        }
                        await apiRequest(`/api/projects/${id}`, "PATCH", updateData);
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                        const statusOption = billingStatusOptions.find(o => o.value === value);
                        toast({
                          title: "Statut de facturation mis à jour",
                          description: statusOption?.label || value,
                          variant: "success",
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erreur",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="billing-status" data-testid="select-billing-status">
                      <SelectValue placeholder="Sélectionner un statut">
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full shrink-0" 
                            style={{ backgroundColor: billingStatusOptions.find(o => o.value === (project?.billingStatus || "brouillon"))?.color }}
                          />
                          <span>{billingStatusOptions.find(o => o.value === (project?.billingStatus || "brouillon"))?.label}</span>
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {billingStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} data-testid={`option-billing-status-${option.value}`}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full shrink-0" 
                              style={{ backgroundColor: option.color }}
                            />
                            <span>{option.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    État actuel de la facturation du projet
                  </p>
                </div>

                {project?.billingStatus === "retard" && (
                  <div>
                    <Label>Date d'échéance</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !project?.billingDueDate && "text-muted-foreground"
                          )}
                          data-testid="button-billing-due-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {project?.billingDueDate 
                            ? format(new Date(project.billingDueDate), "dd MMM yyyy", { locale: fr })
                            : "Sélectionner une date"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={project?.billingDueDate ? new Date(project.billingDueDate) : undefined}
                          onSelect={async (date) => {
                            try {
                              await apiRequest(`/api/projects/${id}`, "PATCH", {
                                billingDueDate: date ? formatDateForStorage(date) : null,
                              });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects'] });
                              toast({
                                title: "Date d'échéance mise à jour",
                                description: date ? format(date, "dd MMM yyyy", { locale: fr }) : "Date supprimée",
                                variant: "success",
                              });
                            } catch (error: any) {
                              toast({
                                title: "Erreur",
                                description: error.message,
                                variant: "destructive",
                              });
                            }
                          }}
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                    <p className="text-xs text-muted-foreground mt-1">
                      {project?.billingDueDate && (() => {
                        const dueDate = new Date(project.billingDueDate);
                        const today = new Date();
                        const diffTime = today.getTime() - dueDate.getTime();
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if (diffDays > 0) {
                          return <span className="text-destructive font-medium">En retard de {diffDays} jour{diffDays > 1 ? 's' : ''}</span>;
                        } else if (diffDays === 0) {
                          return <span className="text-amber-600 font-medium">Échéance aujourd'hui</span>;
                        } else {
                          return <span className="text-muted-foreground">Dans {Math.abs(diffDays)} jour{Math.abs(diffDays) > 1 ? 's' : ''}</span>;
                        }
                      })()}
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="billing-type">Type de facturation</Label>
                  <Select
                    value={project?.billingType || "time"}
                    onValueChange={async (value) => {
                      try {
                        await apiRequest(`/api/projects/${id}`, "PATCH", {
                          billingType: value,
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                        toast({
                          title: "Mise à jour réussie",
                          description: "Le type de facturation a été modifié",
                          variant: "success",
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erreur",
                          description: error.message,
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="billing-type" data-testid="select-billing-type">
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="time" data-testid="option-billing-time">
                        Temps passé
                      </SelectItem>
                      <SelectItem value="fixed" data-testid="option-billing-fixed">
                        Forfait
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    {project?.billingType === "fixed" 
                      ? "Facturation au forfait : montant total fixe"
                      : "Facturation au temps passé : taux horaire ou journalier"}
                  </p>
                </div>

                {project?.billingType === "time" && (
                  <>
                    <div>
                      <Label htmlFor="billing-rate">Taux de facturation</Label>
                      <Input
                        id="billing-rate"
                        type="number"
                        placeholder="150"
                        value={billingRateValue}
                        onChange={(e) => setBillingRateValue(e.target.value)}
                        onBlur={async () => {
                          const trimmedValue = billingRateValue.trim();
                          if (trimmedValue !== project?.billingRate) {
                            try {
                              // Parse and validate the number
                              const numValue = trimmedValue === "" ? null : parseFloat(trimmedValue);
                              if (trimmedValue !== "" && (isNaN(numValue!) || numValue! < 0)) {
                                throw new Error("Veuillez entrer un nombre valide");
                              }
                              
                              await apiRequest(`/api/projects/${id}`, "PATCH", {
                                billingRate: trimmedValue === "" ? null : trimmedValue,
                              });
                              queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                              queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                            } catch (error: any) {
                              toast({
                                title: "Erreur",
                                description: error.message,
                                variant: "destructive",
                              });
                              // Rollback to previous value
                              setBillingRateValue(project?.billingRate || "");
                            }
                          }
                        }}
                        data-testid="input-billing-rate"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Taux horaire ou journalier en euros
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="billing-unit">Unité de facturation</Label>
                      <Select
                        value={project?.billingUnit || "hour"}
                        onValueChange={async (value) => {
                          try {
                            await apiRequest(`/api/projects/${id}`, "PATCH", {
                              billingUnit: value,
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                            queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                            toast({
                              title: "Mise à jour réussie",
                              description: "L'unité de facturation a été modifiée",
                              variant: "success",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Erreur",
                              description: error.message,
                              variant: "destructive",
                            });
                          }
                        }}
                      >
                        <SelectTrigger id="billing-unit" data-testid="select-billing-unit">
                          <SelectValue placeholder="Sélectionner une unité" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="hour" data-testid="option-unit-hour">
                            Heure
                          </SelectItem>
                          <SelectItem value="day" data-testid="option-unit-day">
                            Jour
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <div>
                  <Label htmlFor="total-billed">Montant total facturé</Label>
                  <Input
                    id="total-billed"
                    type="number"
                    placeholder="5000"
                    value={totalBilledValue}
                    onChange={(e) => setTotalBilledValue(e.target.value)}
                    onBlur={async () => {
                      const trimmedValue = totalBilledValue.trim();
                      if (trimmedValue !== project?.totalBilled) {
                        try {
                          // Parse and validate the number
                          const numValue = trimmedValue === "" ? null : parseFloat(trimmedValue);
                          if (trimmedValue !== "" && (isNaN(numValue!) || numValue! < 0)) {
                            throw new Error("Veuillez entrer un nombre valide");
                          }
                          
                          await apiRequest(`/api/projects/${id}`, "PATCH", {
                            totalBilled: trimmedValue === "" ? null : trimmedValue,
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                          queryClient.invalidateQueries({ queryKey: [`/api/projects/${id}/time-entries`] });
                          toast({
                            title: "Montant facturé mis à jour",
                            description: trimmedValue ? `${parseFloat(trimmedValue).toFixed(2)} €` : "Montant supprimé",
                            variant: "success",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message,
                            variant: "destructive",
                          });
                          // Rollback to previous value
                          setTotalBilledValue(project?.totalBilled || "");
                        }
                      }
                    }}
                    data-testid="input-total-billed"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Montant total facturé au client en euros
                  </p>
                </div>

                <div>
                  <Label htmlFor="number-of-days">Nombre de jours</Label>
                  <Input
                    id="number-of-days"
                    type="number"
                    step="0.5"
                    placeholder="10"
                    value={numberOfDaysValue}
                    onChange={(e) => setNumberOfDaysValue(e.target.value)}
                    onBlur={async () => {
                      const trimmedValue = numberOfDaysValue.trim();
                      if (trimmedValue !== project?.numberOfDays) {
                        try {
                          // Parse and validate the number
                          const numValue = trimmedValue === "" ? null : parseFloat(trimmedValue);
                          if (trimmedValue !== "" && (isNaN(numValue!) || numValue! < 0)) {
                            throw new Error("Veuillez entrer un nombre valide");
                          }
                          
                          await apiRequest(`/api/projects/${id}`, "PATCH", {
                            numberOfDays: trimmedValue === "" ? null : trimmedValue,
                          });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                          toast({
                            title: "Nombre de jours mis à jour",
                            description: trimmedValue ? `${parseFloat(trimmedValue)} jour${parseFloat(trimmedValue) > 1 ? 's' : ''}` : "Nombre de jours supprimé",
                            variant: "success",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message,
                            variant: "destructive",
                          });
                          // Rollback to previous value
                          setNumberOfDaysValue(project?.numberOfDays || "");
                        }
                      }
                    }}
                    data-testid="input-number-of-days"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Nombre de jours pour le calcul du TJM théorique
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Payment Tracking Section */}
            <Card className="mt-4">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Euro className="h-5 w-5" />
                    Suivi des paiements
                  </CardTitle>
                  <Button
                    size="sm"
                    onClick={() => {
                      setShowPaymentForm(true);
                      setPaymentAmount(remainingAmount > 0 ? remainingAmount.toFixed(2) : "");
                      setPaymentDate(new Date());
                      setPaymentDescription("");
                    }}
                    data-testid="button-add-payment"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Ajouter un paiement
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Progress bar */}
                {project?.budget && parseFloat(project.budget) > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Progression du paiement</span>
                      <span className="font-medium">
                        {totalPaid.toFixed(2)} € / {parseFloat(project.budget).toFixed(2)} €
                      </span>
                    </div>
                    <Progress 
                      value={Math.min(100, (totalPaid / parseFloat(project.budget)) * 100)} 
                      className="h-2"
                      data-testid="progress-payment"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{((totalPaid / parseFloat(project.budget)) * 100).toFixed(0)}% payé</span>
                      <span>{remainingAmount > 0 ? `${remainingAmount.toFixed(2)} € restant` : "Entièrement payé"}</span>
                    </div>
                  </div>
                )}

                {/* Payment form */}
                {showPaymentForm && (
                  <div className="border rounded-lg p-4 space-y-4 bg-muted/30" data-testid="form-payment">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="payment-amount" className="text-xs">Montant (€)</Label>
                        <Input
                          id="payment-amount"
                          type="number"
                          step="0.01"
                          placeholder={remainingAmount > 0 ? remainingAmount.toFixed(2) : "0.00"}
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          data-testid="input-payment-amount"
                        />
                        {remainingAmount > 0 && paymentAmount !== remainingAmount.toFixed(2) && (
                          <Button
                            variant="link"
                            size="sm"
                            className="px-0 h-auto text-xs"
                            onClick={() => setPaymentAmount(remainingAmount.toFixed(2))}
                            data-testid="button-autofill-amount"
                          >
                            Compléter avec le solde ({remainingAmount.toFixed(2)} €)
                          </Button>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs">Date du paiement</Label>
                        <Popover open={isPaymentDatePickerOpen} onOpenChange={setIsPaymentDatePickerOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "w-full justify-start text-left font-normal bg-popover",
                                !paymentDate && "text-muted-foreground"
                              )}
                              data-testid="button-payment-date"
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {paymentDate ? format(paymentDate, "dd MMM yyyy", { locale: fr }) : "Sélectionner"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={paymentDate}
                              onSelect={(date) => {
                                setPaymentDate(date);
                                setIsPaymentDatePickerOpen(false);
                              }}
                              initialFocus
                              locale={fr}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="payment-description" className="text-xs">Description (optionnelle)</Label>
                      <Input
                        id="payment-description"
                        placeholder="Note ou référence du paiement"
                        value={paymentDescription}
                        onChange={(e) => setPaymentDescription(e.target.value)}
                        data-testid="input-payment-description"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setShowPaymentForm(false)}
                        data-testid="button-cancel-payment"
                      >
                        Annuler
                      </Button>
                      <Button
                        onClick={async () => {
                          if (!paymentAmount || !paymentDate) {
                            toast({
                              title: "Erreur",
                              description: "Veuillez remplir le montant et la date",
                              variant: "destructive",
                            });
                            return;
                          }
                          try {
                            await apiRequest(`/api/projects/${id}/payments`, "POST", {
                              amount: paymentAmount,
                              paymentDate: formatDateForStorage(paymentDate),
                              description: paymentDescription || null,
                            });
                            queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                            queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                            setShowPaymentForm(false);
                            setPaymentAmount("");
                            setPaymentDescription("");
                            toast({
                              title: "Paiement enregistré",
                              description: `Paiement de ${parseFloat(paymentAmount).toFixed(2)} € enregistré`,
                              variant: "success",
                            });
                          } catch (error: any) {
                            toast({
                              title: "Erreur",
                              description: error.message || "Impossible d'enregistrer le paiement",
                              variant: "destructive",
                            });
                          }
                        }}
                        data-testid="button-save-payment"
                      >
                        Enregistrer
                      </Button>
                    </div>
                  </div>
                )}

                {/* Payment history */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">Historique des paiements</h4>
                  {payments.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic py-4 text-center">
                      Aucun paiement enregistré
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {payments.map((payment) => (
                        <div
                          key={payment.id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card hover-elevate"
                          data-testid={`payment-item-${payment.id}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                              <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <div className="text-[13px] font-semibold">
                                {parseFloat(payment.amount).toFixed(2)} €
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(payment.paymentDate), "dd MMM yyyy", { locale: fr })}
                                {payment.description && ` — ${payment.description}`}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditingPayment(payment);
                                setEditPaymentAmount(payment.amount);
                                setEditPaymentDate(new Date(payment.paymentDate));
                                setEditPaymentDescription(payment.description || "");
                              }}
                              data-testid={`button-edit-payment-${payment.id}`}
                              className="h-8 w-8 text-muted-foreground hover:text-primary"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletePaymentId(payment.id)}
                              data-testid={`button-delete-payment-${payment.id}`}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Edit Payment Dialog */}
            <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Modifier le paiement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div>
                    <Label htmlFor="edit-payment-amount" className="text-sm">Montant (€)</Label>
                    <Input
                      id="edit-payment-amount"
                      type="number"
                      step="0.01"
                      value={editPaymentAmount}
                      onChange={(e) => setEditPaymentAmount(e.target.value)}
                      data-testid="input-edit-payment-amount"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Date du paiement</Label>
                    <Popover open={isEditPaymentDatePickerOpen} onOpenChange={setIsEditPaymentDatePickerOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal bg-popover",
                            !editPaymentDate && "text-muted-foreground"
                          )}
                          data-testid="button-edit-payment-date"
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {editPaymentDate ? format(editPaymentDate, "dd MMM yyyy", { locale: fr }) : "Sélectionner"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={editPaymentDate}
                          onSelect={(date) => {
                            setEditPaymentDate(date);
                            setIsEditPaymentDatePickerOpen(false);
                          }}
                          initialFocus
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <Label htmlFor="edit-payment-description" className="text-sm">Description (optionnelle)</Label>
                    <Input
                      id="edit-payment-description"
                      placeholder="Note ou référence du paiement"
                      value={editPaymentDescription}
                      onChange={(e) => setEditPaymentDescription(e.target.value)}
                      data-testid="input-edit-payment-description"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setEditingPayment(null)}
                    data-testid="button-cancel-edit-payment"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={async () => {
                      if (!editPaymentAmount || !editPaymentDate || !editingPayment) {
                        toast({
                          title: "Erreur",
                          description: "Veuillez remplir le montant et la date",
                          variant: "destructive",
                        });
                        return;
                      }
                      try {
                        await apiRequest(`/api/payments/${editingPayment.id}`, "PATCH", {
                          amount: editPaymentAmount,
                          paymentDate: formatDateForStorage(editPaymentDate),
                          description: editPaymentDescription || null,
                        });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                        queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                        setEditingPayment(null);
                        toast({
                          title: "Paiement modifié",
                          description: "Le paiement a été mis à jour avec succès",
                          variant: "success",
                        });
                      } catch (error: any) {
                        toast({
                          title: "Erreur",
                          description: error.message || "Impossible de modifier le paiement",
                          variant: "destructive",
                        });
                      }
                    }}
                    data-testid="button-save-edit-payment"
                  >
                    Enregistrer
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Delete Payment Confirmation Dialog */}
            <AlertDialog open={!!deletePaymentId} onOpenChange={(open) => !open && setDeletePaymentId(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce paiement ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est irréversible. Le paiement sera définitivement supprimé et le statut de facturation sera recalculé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel data-testid="button-cancel-delete-payment">Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={async () => {
                      if (deletePaymentId) {
                        try {
                          await apiRequest(`/api/payments/${deletePaymentId}`, "DELETE");
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id, 'payments'] });
                          queryClient.invalidateQueries({ queryKey: ['/api/projects', id] });
                          setDeletePaymentId(null);
                          toast({
                            title: "Paiement supprimé",
                            description: "Le paiement a été supprimé avec succès",
                            variant: "success",
                          });
                        } catch (error: any) {
                          toast({
                            title: "Erreur",
                            description: error.message || "Impossible de supprimer le paiement",
                            variant: "destructive",
                          });
                        }
                      }
                    }}
                    className="bg-destructive hover:bg-destructive/90"
                    data-testid="button-confirm-delete-payment"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </TabsContent>

          <TabsContent value="time" className="mt-0">
            <TimeTrackingTab projectId={id!} project={project} />
          </TabsContent>

          <TabsContent value="activities" className="mt-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-4">
                <CardTitle className="text-base">Activités</CardTitle>
                <Button 
                  size="sm" 
                  onClick={() => openActivityDialog()}
                  data-testid="button-new-activity"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle activité
                </Button>
              </CardHeader>
              <CardContent>
                {projectActivities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Aucune activité enregistrée pour ce projet.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projectActivities.map((activity) => {
                      const user = users.find(u => u.id === activity.createdBy);
                      const getKindLabel = (kind: string) => {
                        const labels: Record<string, string> = {
                          email: "Email",
                          call: "Appel",
                          meeting: "Réunion",
                          note: "Note",
                          custom: "Autre",
                        };
                        return labels[kind] || kind;
                      };
                      const getKindColor = (kind: string) => {
                        const colors: Record<string, string> = {
                          email: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
                          call: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
                          meeting: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
                          note: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
                          custom: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
                        };
                        return colors[kind] || colors.custom;
                      };
                      const getKindIcon = (kind: string) => {
                        switch (kind) {
                          case "email": return <Mail className="h-3 w-3" />;
                          case "call": return <Phone className="h-3 w-3" />;
                          case "meeting": return <Video className="h-3 w-3" />;
                          case "note": return <StickyNote className="h-3 w-3" />;
                          default: return <MoreHorizontal className="h-3 w-3" />;
                        }
                      };

                      return (
                        <div 
                          key={activity.id} 
                          className="p-4 border rounded-md hover-elevate"
                          data-testid={`activity-${activity.id}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge className={cn("text-xs flex items-center gap-1", getKindColor(activity.kind))}>
                                  {getKindIcon(activity.kind)}
                                  {getKindLabel(activity.kind)}
                                </Badge>
                                {activity.occurredAt && (
                                  <span className="text-xs text-muted-foreground">
                                    {format(new Date(activity.occurredAt), "dd MMM yyyy", { locale: fr })}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm">{activity.description}</p>
                              {user && (
                                <p className="text-xs text-muted-foreground mt-2">
                                  Par {user.firstName} {user.lastName}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openActivityDialog(activity)}
                                data-testid={`button-edit-activity-${activity.id}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setDeleteActivityId(activity.id);
                                  setIsDeleteActivityDialogOpen(true);
                                }}
                                data-testid={`button-delete-activity-${activity.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Historique - Timeline du projet */}
            <Card className="mt-4">
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight text-[18px]">Historique</CardTitle>
              </CardHeader>
              <CardContent>
                {projectTasks.length === 0 && projectNotes.length === 0 && projectDocuments.length === 0 && !project ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucun historique pour le moment
                  </div>
                ) : (
                  <div className="relative space-y-6 pl-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {[
                      ...(project ? [{ ...project, _date: new Date(project.createdAt), _type: 'project_created' as const }] : []),
                      ...projectTasks.map((t) => ({ ...t, _date: new Date(t.createdAt), _type: 'task' as const })),
                      ...projectNotes.map((n) => ({ ...n, _date: new Date(n.createdAt), _type: 'note' as const })),
                      ...projectDocuments.map((d) => ({ ...d, _date: new Date(d.createdAt), _type: 'document' as const })),
                    ]
                      .sort((a, b) => b._date.getTime() - a._date.getTime())
                      .map((item) => {
                        const author = users.find((u) => u.id === item.createdBy);
                        
                        if (item._type === 'project_created') {
                          return (
                            <div key="project-created" className="relative" data-testid="history-project-created">
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <Briefcase className="w-3 h-3 text-primary-foreground" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">
                                    {author?.firstName} {author?.lastName}
                                  </span>{" "}
                                  a créé le projet
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'task') {
                          return (
                            <div key={`task-${item.id}`} className="relative" data-testid={`history-task-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé une tâche : {(item as Task).title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'note') {
                          return (
                            <div key={`note-${item.id}`} className="relative" data-testid={`history-note-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                                <StickyNote className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé une note : {(item as Note).title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'document') {
                          return (
                            <div key={`document-${item.id}`} className="relative" data-testid={`history-document-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                                <FileText className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a ajouté un document : {(item as Document).name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <Sheet open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-edit-project">
          <SheetHeader>
            <SheetTitle>Modifier le projet</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 flex-1 py-4">
            <div>
              <Label htmlFor="edit-name">Nom du projet *</Label>
              <Input
                id="edit-name"
                value={projectFormData.name}
                onChange={(e) => setProjectFormData({ ...projectFormData, name: e.target.value })}
                data-testid="input-edit-name"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={projectFormData.description}
                onChange={(e) => setProjectFormData({ ...projectFormData, description: e.target.value })}
                rows={3}
                data-testid="input-edit-description"
              />
            </div>
            <div>
              <Label htmlFor="edit-client">Client</Label>
              <Select
                value={projectFormData.clientId}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, clientId: value })}
              >
                <SelectTrigger id="edit-client" data-testid="select-edit-client">
                  <SelectValue placeholder="Sélectionner un client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id} className="bg-popover cursor-pointer">
                      {client.company || client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-stage">Étape</Label>
              <Select
                value={projectFormData.stage}
                onValueChange={(value) => setProjectFormData({ ...projectFormData, stage: value })}
              >
                <SelectTrigger id="edit-stage" data-testid="select-edit-stage">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="prospection">Prospection</SelectItem>
                  <SelectItem value="signe">Signé</SelectItem>
                  <SelectItem value="en_cours">En cours</SelectItem>
                  <SelectItem value="livre">Livré</SelectItem>
                  <SelectItem value="termine">Terminé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="edit-category">Catégorie</Label>
              <CategoryCombobox
                value={projectFormData.category || ""}
                onChange={(value) => setProjectFormData({ ...projectFormData, category: value })}
                categories={allCategories}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Sélectionnez une catégorie existante ou créez-en une nouvelle
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-edit-start-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {projectFormData.startDate ? (
                        format(projectFormData.startDate, "PPP", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover">
                    <Calendar
                      mode="single"
                      selected={projectFormData.startDate}
                      onSelect={(date) => setProjectFormData({ ...projectFormData, startDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label>Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-edit-end-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {projectFormData.endDate ? (
                        format(projectFormData.endDate, "PPP", { locale: fr })
                      ) : (
                        <span>Choisir une date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover">
                    <Calendar
                      mode="single"
                      selected={projectFormData.endDate}
                      onSelect={(date) => setProjectFormData({ ...projectFormData, endDate: date })}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div>
              <Label htmlFor="edit-budget">Budget</Label>
              <Input
                id="edit-budget"
                value={projectFormData.budget}
                onChange={(e) => setProjectFormData({ ...projectFormData, budget: e.target.value })}
                placeholder="ex: 10 000€"
                data-testid="input-edit-budget"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end border-t pt-4">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} data-testid="button-cancel-edit">
              Annuler
            </Button>
            <Button onClick={handleSubmitEdit} data-testid="button-submit-edit">
              Enregistrer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-project">
          <DialogHeader>
            <DialogTitle>Supprimer le projet</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer ce projet ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setIsDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteProjectMutation.mutate()}
              data-testid="button-confirm-delete"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Sheet open={isTaskDetailDialogOpen} onOpenChange={setIsTaskDetailDialogOpen}>
        <SheetContent className="sm:max-w-xl w-full overflow-y-auto" data-testid="dialog-task-detail">
          <SheetHeader>
            <SheetTitle>Détails de la tâche</SheetTitle>
          </SheetHeader>
          {selectedTask && taskEditData.id && (
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="task-title">Titre *</Label>
                <Input
                  id="task-title"
                  value={taskEditData.title || ""}
                  onChange={(e) => setTaskEditData({ ...taskEditData, title: e.target.value })}
                  data-testid="input-task-title"
                />
              </div>

              <div>
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={taskEditData.description || ""}
                  onChange={(e) => setTaskEditData({ ...taskEditData, description: e.target.value })}
                  rows={3}
                  data-testid="input-task-description"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-priority">Priorité</Label>
                  <Select
                    value={taskEditData.priority || "medium"}
                    onValueChange={(value) => setTaskEditData({ ...taskEditData, priority: value })}
                  >
                    <SelectTrigger id="task-priority" data-testid="select-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Basse</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="task-assigned">Assigné à</Label>
                  <Select
                    value={taskEditData.assignedToId || "none"}
                    onValueChange={(value) => setTaskEditData({ 
                      ...taskEditData, 
                      assignedToId: value === "none" ? null : value 
                    })}
                  >
                    <SelectTrigger id="task-assigned" data-testid="select-task-assigned">
                      <SelectValue placeholder="Non assigné" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non assigné</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName} {user.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="task-due-date">Date d'échéance</Label>
                  <Input
                    id="task-due-date"
                    type="date"
                    value={taskEditData.dueDate || ""}
                    onChange={(e) => setTaskEditData({ ...taskEditData, dueDate: e.target.value || null })}
                    data-testid="input-task-due-date"
                  />
                </div>

                <div>
                  <Label htmlFor="task-effort">Effort</Label>
                  <Select
                    value={taskEditData.effort?.toString() || "none"}
                    onValueChange={(value) => setTaskEditData({ 
                      ...taskEditData, 
                      effort: value === "none" ? null : parseInt(value) 
                    })}
                  >
                    <SelectTrigger id="task-effort" data-testid="select-task-effort">
                      <SelectValue placeholder="Non défini" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Non défini</SelectItem>
                      <SelectItem value="1">1 - Très facile</SelectItem>
                      <SelectItem value="2">2 - Facile</SelectItem>
                      <SelectItem value="3">3 - Moyen</SelectItem>
                      <SelectItem value="4">4 - Difficile</SelectItem>
                      <SelectItem value="5">5 - Très difficile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="task-column">Statut</Label>
                <Select
                  value={taskEditData.columnId || ""}
                  onValueChange={(value) => setTaskEditData({ ...taskEditData, columnId: value || null })}
                >
                  <SelectTrigger id="task-column" data-testid="select-task-column">
                    <SelectValue placeholder="Sélectionner un statut" />
                  </SelectTrigger>
                  <SelectContent>
                    {columns.map((column) => (
                      <SelectItem key={column.id} value={column.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: column.color }}
                          />
                          {column.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="flex justify-end pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsTaskDetailDialogOpen(false)}
              data-testid="button-close-task-detail"
            >
              Fermer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog open={isDeleteTaskDialogOpen} onOpenChange={setIsDeleteTaskDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-task-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la tâche</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette tâche ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-task">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTaskId && deleteTaskMutation.mutate(deleteTaskId)}
              data-testid="button-confirm-delete-task"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Activity Dialog */}
      <Dialog open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
        <DialogContent data-testid="dialog-activity">
          <DialogHeader>
            <DialogTitle>{editingActivity ? "Modifier l'activité" : "Nouvelle activité"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Type d'activité</Label>
              <Select
                value={activityFormData.kind}
                onValueChange={(value) => setActivityFormData({ ...activityFormData, kind: value })}
              >
                <SelectTrigger data-testid="select-activity-kind">
                  <SelectValue placeholder="Sélectionner un type" />
                </SelectTrigger>
                <SelectContent className="bg-card">
                  <SelectItem value="email">Email</SelectItem>
                  <SelectItem value="call">Appel</SelectItem>
                  <SelectItem value="meeting">Réunion</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="custom">Autre</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={activityFormData.description}
                onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                placeholder="Description de l'activité..."
                className="min-h-[100px]"
                data-testid="input-activity-description"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={activityFormData.occurredAt}
                onChange={(e) => setActivityFormData({ ...activityFormData, occurredAt: e.target.value })}
                data-testid="input-activity-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActivityDialogOpen(false)} data-testid="button-cancel-activity">
              Annuler
            </Button>
            <Button 
              onClick={handleActivitySubmit} 
              disabled={!activityFormData.description.trim()}
              data-testid="button-save-activity"
            >
              {editingActivity ? "Modifier" : "Créer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Activity Dialog */}
      <AlertDialog open={isDeleteActivityDialogOpen} onOpenChange={setIsDeleteActivityDialogOpen}>
        <AlertDialogContent data-testid="dialog-delete-activity-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer l'activité</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette activité ? Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-activity">Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteActivityId && deleteActivityMutation.mutate(deleteActivityId)}
              data-testid="button-confirm-delete-activity"
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
