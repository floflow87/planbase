import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Map, LayoutGrid, Calendar as CalendarIcon, Rocket, FolderKanban, X, Link2, ArrowRight, ChevronsUpDown, Check, MoreHorizontal, Pencil, Trash2, Copy, Package, FileText, ListTodo, RefreshCw, Tag, Ticket, Search, Filter, FileUp, Target, Columns } from "lucide-react";
import { PermissionGuard, ReadOnlyBanner, useReadOnlyMode } from "@/components/guards/PermissionGuard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader } from "@/components/Loader";
import { OkrTreeView } from "@/components/okr/okr-tree-view";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/contexts/AuthContext";
import { GanttView } from "@/components/roadmap/gantt-view";
import { OutputView } from "@/components/roadmap/output-view";
import { RoadmapIndicators } from "@/components/roadmap/roadmap-indicators";
import { MilestonesZone } from "@/components/roadmap/milestones-zone";
import { RoadmapRecommendations } from "@/components/roadmap/roadmap-recommendations";
import { RoadmapItemDetailPanel } from "@/components/roadmap/roadmap-item-detail-panel";
import { NowNextLaterView } from "@/components/roadmap/now-next-later-view";
import type { Roadmap, RoadmapItem, Project, RoadmapDependency, Epic, UserStory, BacklogTask } from "@shared/schema";

const PHASE_LABELS: { [key: string]: string } = {
  T1: "Court terme (T1)",
  T2: "Moyen terme (T2)",
  T3: "Long terme (T3)",
  LT: "Très long terme",
  all: "Toutes les phases",
};

const STATUS_LABELS: { [key: string]: string } = {
  planned: "Planifié",
  in_progress: "En cours",
  done: "Terminé",
  blocked: "Bloqué",
  all: "Tous les statuts",
};

const ROADMAP_STATUS_LABELS: { [key: string]: { label: string; color: string } } = {
  planned: { label: "Planifiée", color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" },
  in_progress: { label: "En cours", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  closed: { label: "Clôturée", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
};

const TYPE_LABELS: { [key: string]: string } = {
  deliverable: "Livrable",
  milestone: "Milestone",
  initiative: "Initiative",
  feature: "Fonctionnalité",
  all: "Tous les types",
};

type ViewMode = "gantt" | "output" | "nnl";
type RoadmapType = "feature_based" | "now_next_later";
type LinkedType = "free" | "epic" | "ticket" | "cdc";

export default function RoadmapPage() {
  const { toast } = useToast();
  const { accountId } = useAuth();
  const searchString = useSearch();
  const { readOnly, canCreate, canUpdate, canDelete } = useReadOnlyMode("roadmap");
  
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(() => {
    // First check URL params, then fallback to localStorage
    const urlParams = new URLSearchParams(window.location.search);
    const urlProjectId = urlParams.get("projectId");
    if (urlProjectId) return urlProjectId;
    const saved = localStorage.getItem("roadmap-selected-project");
    return saved || null;
  });
  const [selectedRoadmapId, setSelectedRoadmapId] = useState<string | null>(() => {
    const saved = localStorage.getItem("roadmap-selected-roadmap");
    return saved || null;
  });
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("roadmap-view-mode");
    return (saved as ViewMode) || "gantt";
  });
  const [activeMainTab, setActiveMainTab] = useState("roadmap");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createStep, setCreateStep] = useState<1 | 2>(1);
  const [newRoadmapName, setNewRoadmapName] = useState("");
  const [newRoadmapHorizon, setNewRoadmapHorizon] = useState("");
  const [newRoadmapType, setNewRoadmapType] = useState<RoadmapType>("feature_based");
  const [importEpics, setImportEpics] = useState(false);
  const [importTickets, setImportTickets] = useState(false);
  
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<RoadmapItem | null>(null);
  const [projectSearchOpen, setProjectSearchOpen] = useState(false);
  const [projectSearchValue, setProjectSearchValue] = useState("");
  
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [roadmapToManage, setRoadmapToManage] = useState<Roadmap | null>(null);
  const [detailItem, setDetailItem] = useState<RoadmapItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  
  // Filters state
  const [filterPhase, setFilterPhase] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  const [itemForm, setItemForm] = useState({
    title: "",
    type: "deliverable",
    priority: "normal",
    status: "planned",
    startDate: null as Date | null,
    endDate: null as Date | null,
    description: "",
    releaseTag: "",
    phase: "" as string,
    linkedType: "free" as LinkedType,
    linkedId: null as string | null,
    linkedTitle: "",
  });

  // Handle projectId from URL params (for navigation from PostCreationSuggestions)
  useEffect(() => {
    const urlParams = new URLSearchParams(searchString);
    const urlProjectId = urlParams.get("projectId");
    if (urlProjectId && urlProjectId !== selectedProjectId) {
      setSelectedProjectId(urlProjectId);
    }
  }, [searchString]);

  useEffect(() => {
    if (selectedProjectId) {
      localStorage.setItem("roadmap-selected-project", selectedProjectId);
    }
  }, [selectedProjectId]);

  useEffect(() => {
    if (selectedRoadmapId) {
      localStorage.setItem("roadmap-selected-roadmap", selectedRoadmapId);
    }
  }, [selectedRoadmapId]);

  useEffect(() => {
    localStorage.setItem("roadmap-view-mode", viewMode);
  }, [viewMode]);

  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const isUnlinkedMode = selectedProjectId === "__unlinked__";

  const { data: roadmaps = [], isLoading: isLoadingRoadmaps } = useQuery<Roadmap[]>({
    queryKey: isUnlinkedMode ? ['/api/roadmaps', { unlinked: true }] : [`/api/projects/${selectedProjectId}/roadmaps`],
    queryFn: isUnlinkedMode 
      ? async () => { const res = await apiRequest('/api/roadmaps?unlinked=true', 'GET'); return res.json(); }
      : undefined,
    enabled: !!selectedProjectId,
  });

  const activeRoadmapId = selectedRoadmapId || (roadmaps.length > 0 ? roadmaps[0].id : null);

  const activeRoadmap = roadmaps.find(r => r.id === activeRoadmapId);

  useEffect(() => {
    if (activeRoadmap?.type === "now_next_later") {
      setViewMode("nnl");
    } else if (activeRoadmap && viewMode === "nnl") {
      setViewMode("gantt");
    }
  }, [activeRoadmapId, activeRoadmap?.type]);

  const { data: roadmapItems = [], isLoading: isLoadingItems } = useQuery<RoadmapItem[]>({
    queryKey: [`/api/roadmaps/${activeRoadmapId}/items`],
    enabled: !!activeRoadmapId,
  });

  const { data: roadmapDependencies = [] } = useQuery<RoadmapDependency[]>({
    queryKey: [`/api/roadmaps/${activeRoadmapId}/dependencies`],
    enabled: !!activeRoadmapId,
  });

  // Query for phases data (aligned with roadmap-tab)
  interface PhaseInfo {
    projectStartDate: string | null;
    currentPhase: string;
    phases: {
      [key: string]: {
        start: string;
        end: string | null;
        isCurrent: boolean;
        itemCount: number;
      };
    };
  }
  
  const { data: phasesData } = useQuery<PhaseInfo>({
    queryKey: [`/api/projects/${selectedProjectId}/roadmap/phases`],
    enabled: !!selectedProjectId && !isUnlinkedMode,
  });

  // Calculate phase for an item based on its dates (aligned with roadmap-tab)
  const getItemPhase = (item: RoadmapItem): string | null => {
    if (!phasesData?.phases) return null;
    const itemPhase = (item as any).phase;
    if (itemPhase) return itemPhase;
    
    const startDate = item.startDate || (item as any).targetDate || item.endDate;
    if (!startDate) return null;
    
    const date = new Date(startDate);
    for (const [phase, info] of Object.entries(phasesData.phases)) {
      const phaseStart = new Date(info.start);
      const phaseEnd = info.end ? new Date(info.end) : null;
      if (date >= phaseStart && (!phaseEnd || date < phaseEnd)) {
        return phase;
      }
    }
    return 'LT';
  };

  const { data: backlogs = [] } = useQuery<{ id: string }[]>({
    queryKey: [`/api/projects/${selectedProjectId}/backlogs`],
    enabled: !!selectedProjectId && !isUnlinkedMode,
  });

  const backlogId = backlogs.length > 0 ? backlogs[0].id : null;

  const { data: epics = [] } = useQuery<Epic[]>({
    queryKey: [`/api/backlogs/${backlogId}/epics`],
    enabled: !!backlogId,
  });

  const { data: userStories = [] } = useQuery<UserStory[]>({
    queryKey: [`/api/backlogs/${backlogId}/user-stories`],
    enabled: !!backlogId,
  });

  const { data: backlogTasks = [] } = useQuery<BacklogTask[]>({
    queryKey: [`/api/backlogs/${backlogId}/tasks`],
    enabled: !!backlogId,
  });

  // CDC tasks are standalone tasks without a userStoryId
  const cdcTasks = useMemo(() => {
    return backlogTasks.filter(task => !task.userStoryId);
  }, [backlogTasks]);

  const availableVersions = useMemo(() => {
    const tags = new Set<string>();
    roadmapItems.forEach(item => {
      if (item.releaseTag) tags.add(item.releaseTag);
    });
    return Array.from(tags).sort();
  }, [roadmapItems]);

  // Filter items based on selected filters (aligned with roadmap-tab)
  const filteredItems = useMemo(() => {
    let items = [...roadmapItems];
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        (item.description && item.description.toLowerCase().includes(query))
      );
    }
    
    // Filter by phase using getItemPhase
    if (filterPhase !== "all") {
      items = items.filter(item => {
        const phase = getItemPhase(item);
        return phase === filterPhase;
      });
    }
    
    // Filter by status
    if (filterStatus !== "all") {
      items = items.filter(item => item.status === filterStatus);
    }
    
    // Filter by type
    if (filterType !== "all") {
      items = items.filter(item => item.type === filterType);
    }
    
    return items;
  }, [roadmapItems, searchQuery, filterPhase, filterStatus, filterType, phasesData]);

  const hasActiveFilters = filterPhase !== "all" || filterStatus !== "all" || filterType !== "all" || searchQuery.trim() !== "";

  const clearFilters = () => {
    setFilterPhase("all");
    setFilterStatus("all");
    setFilterType("all");
    setSearchQuery("");
  };

  useEffect(() => {
    const savedRoadmapId = localStorage.getItem("roadmap-selected-roadmap");
    if (savedRoadmapId && roadmaps.some(r => r.id === savedRoadmapId)) {
      setSelectedRoadmapId(savedRoadmapId);
    } else {
      setSelectedRoadmapId(null);
    }
  }, [selectedProjectId, roadmaps]);

  const createRoadmapMutation = useMutation({
    mutationFn: async (data: { name: string; horizon?: string; type?: string; importEpics?: boolean; importTickets?: boolean }) => {
      const res = await apiRequest('/api/roadmaps', 'POST', {
        accountId,
        projectId: isUnlinkedMode ? null : selectedProjectId,
        name: data.name,
        type: data.type || "feature_based",
        horizon: data.horizon || null,
        importEpics: data.importEpics || false,
        importTickets: data.importTickets || false,
      });
      return await res.json();
    },
    onMutate: async () => {
      setIsCreateDialogOpen(false);
      setNewRoadmapName("");
      setNewRoadmapHorizon("");
      setNewRoadmapType("feature_based");
      setCreateStep(1);
      setImportEpics(false);
      setImportTickets(false);
    },
    onSuccess: (newRoadmap: Roadmap) => {
      if (isUnlinkedMode) {
        queryClient.invalidateQueries({ queryKey: ['/api/roadmaps', { unlinked: true }] });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/roadmaps`] });
      }
      setSelectedRoadmapId(newRoadmap.id);
      toast({
        title: "Roadmap créée",
        description: `La roadmap "${newRoadmap.name}" a été créée avec succès.`,
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la roadmap.",
        variant: "destructive",
      });
    },
  });

  const renameRoadmapMutation = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      return apiRequest(`/api/roadmaps/${id}`, 'PATCH', { name });
    },
    onSuccess: () => {
      if (isUnlinkedMode) {
        queryClient.invalidateQueries({ queryKey: ['/api/roadmaps', { unlinked: true }] });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/roadmaps`] });
      }
      setIsRenameDialogOpen(false);
      setRoadmapToManage(null);
      toast({
        title: "Roadmap renommée",
        description: "Le nom a été mis à jour.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de renommer la roadmap.",
        variant: "destructive",
      });
    },
  });

  const updateRoadmapStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest(`/api/roadmaps/${id}`, 'PATCH', { status });
    },
    onMutate: async ({ id, status }) => {
      const qk = isUnlinkedMode ? ['/api/roadmaps', { unlinked: true }] : [`/api/projects/${selectedProjectId}/roadmaps`];
      await queryClient.cancelQueries({ queryKey: qk });
      const previous = queryClient.getQueryData<Roadmap[]>(qk);
      queryClient.setQueryData<Roadmap[]>(qk, (old) =>
        old?.map(r => r.id === id ? { ...r, status } as Roadmap : r) || []
      );
      return { previous, qk };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(context.qk, context.previous);
      }
      toast({
        title: "Erreur",
        description: "Impossible de modifier le statut.",
        variant: "destructive",
      });
    },
    onSettled: (_data, _err, _vars, context) => {
      if (context?.qk) {
        queryClient.invalidateQueries({ queryKey: context.qk });
      }
      toast({
        title: "Statut mis à jour",
        description: "Le statut de la roadmap a été modifié.",
        variant: "success",
      });
    },
  });

  const deleteRoadmapMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest(`/api/roadmaps/${id}`, 'DELETE');
    },
    onSuccess: () => {
      if (isUnlinkedMode) {
        queryClient.invalidateQueries({ queryKey: ['/api/roadmaps', { unlinked: true }] });
      } else {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/roadmaps`] });
      }
      setIsDeleteDialogOpen(false);
      setRoadmapToManage(null);
      if (selectedRoadmapId === roadmapToManage?.id) {
        setSelectedRoadmapId(null);
      }
      toast({
        title: "Roadmap supprimée",
        description: "La roadmap a été supprimée.",
        variant: "success",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la roadmap.",
        variant: "destructive",
      });
    },
  });

  const handleCreateRoadmap = () => {
    if (!newRoadmapName.trim()) return;
    createRoadmapMutation.mutate({
      name: newRoadmapName.trim(),
      type: newRoadmapType,
      horizon: newRoadmapHorizon.trim() || undefined,
      importEpics: newRoadmapType === "feature_based" ? importEpics : false,
      importTickets: newRoadmapType === "feature_based" ? importTickets : false,
    });
  };

  const handleOpenRename = (roadmap: Roadmap) => {
    setRoadmapToManage(roadmap);
    setRenameValue(roadmap.name);
    setIsRenameDialogOpen(true);
  };

  const handleOpenDelete = (roadmap: Roadmap) => {
    setRoadmapToManage(roadmap);
    setIsDeleteDialogOpen(true);
  };

  const importCdcMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/projects/${selectedProjectId}/roadmap/import-cdc`, 'POST', {
        roadmapId: activeRoadmapId,
      });
      return response.json();
    },
    onSuccess: (result: { message: string; importedCount: number; skippedCount: number }) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${selectedProjectId}/roadmaps`] });
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      toast({
        title: "Import CDC terminé",
        description: result.message,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur d'import",
        description: error.message || "Impossible d'importer les éléments du CDC.",
        variant: "destructive",
      });
    },
  });

  const resetCdcMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/projects/${selectedProjectId}/roadmap/reset-cdc`, 'POST', {});
      return response.json();
    },
    onSuccess: (result: { message: string; resetCount: number; diagnostic: any }) => {
      toast({
        title: "Réinitialisation terminée",
        description: `${result.message}. Vous pouvez maintenant réimporter les éléments CDC.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur de réinitialisation",
        description: error.message || "Impossible de réinitialiser les éléments CDC.",
        variant: "destructive",
      });
    },
  });

  const createItemMutation = useMutation({
    mutationFn: async (data: typeof itemForm) => {
      return apiRequest('/api/roadmap-items', 'POST', {
        roadmapId: activeRoadmapId,
        projectId: isUnlinkedMode ? null : selectedProjectId,
        title: data.title,
        type: data.type,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate ? format(data.startDate, "yyyy-MM-dd") : null,
        endDate: data.endDate ? format(data.endDate, "yyyy-MM-dd") : null,
        description: data.description || null,
        releaseTag: data.releaseTag || null,
        phase: data.phase || null,
        orderIndex: roadmapItems.length,
        epicId: data.linkedType === "epic" ? data.linkedId : null,
      });
    },
    onMutate: async () => {
      setIsItemDialogOpen(false);
      resetItemForm();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      toast({
        title: "Élément créé",
        description: "L'élément a été ajouté à la roadmap.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'élément.",
        variant: "destructive",
      });
    },
  });

  const updateItemMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<typeof itemForm> }) => {
      return apiRequest(`/api/roadmap-items/${id}`, 'PATCH', {
        title: data.title,
        type: data.type,
        priority: data.priority,
        status: data.status,
        startDate: data.startDate ? format(data.startDate, "yyyy-MM-dd") : null,
        endDate: data.endDate ? format(data.endDate, "yyyy-MM-dd") : null,
        description: data.description || null,
        releaseTag: data.releaseTag || null,
        phase: data.phase || null,
        epicId: data.linkedType === "epic" ? data.linkedId : null,
      });
    },
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      const previousItems = queryClient.getQueryData<RoadmapItem[]>([`/api/roadmaps/${activeRoadmapId}/items`]);
      if (previousItems) {
        queryClient.setQueryData<RoadmapItem[]>(
          [`/api/roadmaps/${activeRoadmapId}/items`],
          previousItems.map(item => item.id === id ? { ...item, ...data } : item)
        );
      }
      setIsItemDialogOpen(false);
      setEditingItem(null);
      resetItemForm();
      return { previousItems };
    },
    onError: (_error, _variables, context) => {
      if (context?.previousItems) {
        queryClient.setQueryData([`/api/roadmaps/${activeRoadmapId}/items`], context.previousItems);
      }
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'élément.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
    },
    onSuccess: () => {
      toast({
        title: "Élément mis à jour",
        description: "Les modifications ont été enregistrées.",
      });
    },
  });

  const addDependencyMutation = useMutation({
    mutationFn: async ({ itemId, dependsOnId }: { itemId: string; dependsOnId: string }) => {
      return apiRequest(`/api/roadmap-items/${itemId}/dependencies`, 'POST', {
        dependsOnRoadmapItemId: dependsOnId,
        type: "finish_to_start",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/dependencies`] });
      toast({
        title: "Dépendance ajoutée",
        description: "La dépendance a été créée.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la dépendance.",
        variant: "destructive",
      });
    },
  });

  const removeDependencyMutation = useMutation({
    mutationFn: async (dependencyId: string) => {
      return apiRequest(`/api/roadmap-dependencies/${dependencyId}`, 'DELETE');
    },
    onMutate: async (dependencyId: string) => {
      await queryClient.cancelQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/dependencies`] });
      const previousDependencies = queryClient.getQueryData<RoadmapDependency[]>([`/api/roadmaps/${activeRoadmapId}/dependencies`]);
      if (previousDependencies) {
        queryClient.setQueryData<RoadmapDependency[]>(
          [`/api/roadmaps/${activeRoadmapId}/dependencies`],
          previousDependencies.filter(d => d.id !== dependencyId)
        );
      }
      return { previousDependencies };
    },
    onError: (_error, _id, context) => {
      if (context?.previousDependencies) {
        queryClient.setQueryData([`/api/roadmaps/${activeRoadmapId}/dependencies`], context.previousDependencies);
      }
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la dépendance.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/dependencies`] });
    },
    onSuccess: () => {
      toast({
        title: "Dépendance supprimée",
        description: "La dépendance a été retirée.",
      });
    },
  });

  // Bulk update mutation
  const bulkUpdateMutation = useMutation({
    mutationFn: async ({ itemIds, data }: { itemIds: string[]; data: Record<string, any> }) => {
      const response = await apiRequest('/api/roadmap-items/bulk', 'PATCH', { itemIds, data });
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      toast({
        title: "Éléments mis à jour",
        description: `${result.updated} élément(s) ont été modifiés.`,
        className: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour les éléments.",
        variant: "destructive",
      });
    },
  });

  // Bulk delete mutation - using POST for reliable body parsing
  const bulkDeleteMutation = useMutation({
    mutationFn: async (itemIds: string[]) => {
      const response = await apiRequest('/api/roadmap-items/bulk-delete', 'POST', { itemIds });
      return response.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      setSelectedItemIds(new Set()); // Clear selection after delete
      toast({
        title: "Éléments supprimés",
        description: `${result.deleted} élément(s) ont été supprimés.`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer les éléments.",
        variant: "destructive",
      });
    },
  });

  // Handlers for bulk actions
  const handleBulkDelete = (itemIds: string[]) => {
    bulkDeleteMutation.mutate(itemIds);
  };

  const handleBulkUpdate = (itemIds: string[], data: Record<string, any>) => {
    bulkUpdateMutation.mutate({ itemIds, data });
  };

  const resetItemForm = () => {
    setItemForm({
      title: "",
      type: "deliverable",
      priority: "normal",
      status: "planned",
      startDate: null,
      endDate: null,
      description: "",
      releaseTag: "",
      phase: "",
      linkedType: "free",
      linkedId: null,
      linkedTitle: "",
    });
  };

  const handleOpenAddItem = (defaultLane?: string) => {
    resetItemForm();
    setEditingItem(null);
    if (defaultLane) {
      setItemForm(prev => ({ ...prev, linkedType: "free" as LinkedType }));
    }
    setIsItemDialogOpen(true);
  };

  const handleOpenDetailItem = (item: RoadmapItem) => {
    setDetailItem(item);
    setIsDetailOpen(true);
  };

  const handleOpenEditItem = (item: RoadmapItem) => {
    setEditingItem(item);
    let linkedType: LinkedType = "free";
    let linkedId: string | null = null;
    let linkedTitle = "";
    
    if (item.epicId) {
      linkedType = "epic";
      linkedId = item.epicId;
      const epic = epics.find(e => e.id === item.epicId);
      linkedTitle = epic?.title || "";
    }
    
    setItemForm({
      title: item.title,
      type: item.type,
      priority: item.priority,
      status: item.status,
      startDate: item.startDate ? new Date(item.startDate) : null,
      endDate: item.endDate ? new Date(item.endDate) : null,
      description: item.description || "",
      releaseTag: item.releaseTag || "",
      phase: item.phase || "",
      linkedType,
      linkedId,
      linkedTitle,
    });
    setIsItemDialogOpen(true);
  };

  const handleSubmitItem = () => {
    if (!itemForm.title.trim()) return;
    
    if (editingItem) {
      updateItemMutation.mutate({ id: editingItem.id, data: itemForm });
    } else {
      createItemMutation.mutate(itemForm);
    }
  };

  const handleItemMove = async (itemId: string, newStatus: string, newOrderIndex: number) => {
    try {
      await apiRequest(`/api/roadmap-items/${itemId}`, 'PATCH', {
        status: newStatus,
        orderIndex: newOrderIndex,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/items`] });
      toast({
        title: "Élément déplacé",
        description: "Le statut a été mis à jour avec succès.",
        className: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de déplacer l'élément.",
        variant: "destructive",
      });
    }
  };

  const handleCreateAtDate = (startDate: Date, endDate: Date) => {
    resetItemForm();
    setEditingItem(null);
    setItemForm(prev => ({
      ...prev,
      startDate,
      endDate,
    }));
    setIsItemDialogOpen(true);
  };

  const handleUpdateItemDates = async (itemId: string, startDate: Date, endDate: Date) => {
    const queryKey = [`/api/roadmaps/${activeRoadmapId}/items`];
    const previousItems = queryClient.getQueryData<RoadmapItem[]>(queryKey);

    queryClient.setQueryData<RoadmapItem[]>(queryKey, (old) => {
      if (!old) return old;
      return old.map(item => 
        item.id === itemId 
          ? { ...item, startDate: format(startDate, 'yyyy-MM-dd'), endDate: format(endDate, 'yyyy-MM-dd') }
          : item
      );
    });

    try {
      await apiRequest(`/api/roadmap-items/${itemId}`, 'PATCH', {
        startDate: format(startDate, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
      });
    } catch (error: any) {
      console.error("Roadmap drag error:", error?.message || error);
      if (previousItems) {
        queryClient.setQueryData(queryKey, previousItems);
      }
      toast({
        title: "Erreur",
        description: error?.message || "Impossible de mettre à jour les dates.",
        variant: "destructive",
      });
    } finally {
      queryClient.invalidateQueries({ queryKey });
    }
  };

  const handleCreateDependency = async (fromItemId: string, toItemId: string, type: string = "finish_to_start") => {
    try {
      // When dragging from A to B: "B depends on A" - arrow goes from A to B
      // roadmapItemId = B (the item that depends), dependsOnRoadmapItemId = A (the item it depends on)
      await apiRequest(`/api/roadmap-items/${toItemId}/dependencies`, 'POST', {
        dependsOnRoadmapItemId: fromItemId,
        type,
      });
      queryClient.invalidateQueries({ queryKey: [`/api/roadmaps/${activeRoadmapId}/dependencies`] });
      toast({
        title: "Dépendance créée",
        description: "La liaison entre les éléments a été créée.",
        className: "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Impossible de créer la dépendance.",
        variant: "destructive",
      });
    }
  };

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const filteredProjects = useMemo(() => {
    if (!projectSearchValue.trim()) return projects;
    const searchLower = projectSearchValue.toLowerCase();
    return projects.filter(p => p.name.toLowerCase().includes(searchLower));
  }, [projects, projectSearchValue]);

  if (isLoadingProjects) {
    return (
      <div className="h-full overflow-auto p-6">
        <div className="flex items-center justify-center py-12">
          <Loader />
        </div>
      </div>
    );
  }

  return (
    <PermissionGuard module="roadmap" fallbackPath="/">
    <div className="h-full overflow-auto p-6 bg-[#F8FAFC] dark:bg-background" data-testid="roadmap-view">
      <div className="flex flex-col gap-4">
        <ReadOnlyBanner module="roadmap" />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <Rocket className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Roadmap</h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
              <Popover open={projectSearchOpen} onOpenChange={setProjectSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={projectSearchOpen}
                    className="w-[280px] justify-between"
                    data-testid="select-project"
                  >
                    {isUnlinkedMode ? "Sans projet" : selectedProject ? selectedProject.name : "Sélectionner un projet..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0">
                  <Command shouldFilter={false}>
                    <CommandInput 
                      placeholder="Rechercher un projet..." 
                      value={projectSearchValue}
                      onValueChange={setProjectSearchValue}
                      data-testid="input-project-search"
                    />
                    <CommandList>
                      <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          key="__unlinked__"
                          value="__unlinked__"
                          onSelect={() => {
                            setSelectedProjectId("__unlinked__");
                            setSelectedRoadmapId(null);
                            setProjectSearchOpen(false);
                            setProjectSearchValue("");
                          }}
                          data-testid="select-project-unlinked"
                        >
                          <Check
                            className={`mr-2 h-4 w-4 ${
                              isUnlinkedMode ? "opacity-100" : "opacity-0"
                            }`}
                          />
                          Sans projet
                        </CommandItem>
                        {filteredProjects.map((project) => (
                          <CommandItem
                            key={project.id}
                            value={project.id}
                            onSelect={() => {
                              setSelectedProjectId(project.id);
                              setSelectedRoadmapId(null);
                              setProjectSearchOpen(false);
                              setProjectSearchValue("");
                            }}
                            data-testid={`select-project-${project.id}`}
                          >
                            <Check
                              className={`mr-2 h-4 w-4 ${
                                selectedProjectId === project.id ? "opacity-100" : "opacity-0"
                              }`}
                            />
                            {project.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="roadmap" className="gap-1.5 text-[12px]" data-testid="tab-roadmap-main">
              <Map className="h-4 w-4" />
              Roadmap
            </TabsTrigger>
            <TabsTrigger value="okr" className="gap-1.5 text-[12px]" data-testid="tab-okr-main">
              <Target className="h-4 w-4" />
              OKR
            </TabsTrigger>
          </TabsList>

          <TabsContent value="roadmap" className="mt-0">
            {!selectedProjectId ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FolderKanban className="h-16 w-16 text-muted-foreground mb-6" />
                <h3 className="text-xl font-semibold mb-2">Sélectionnez un projet</h3>
                <p className="text-muted-foreground max-w-md">
                  Choisissez un projet dans le menu déroulant ci-dessus pour afficher et gérer ses roadmaps.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : isLoadingRoadmaps ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-center py-12">
                <Loader />
              </div>
            </CardContent>
          </Card>
        ) : roadmaps.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Map className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-base font-semibold mb-2">Aucune roadmap pour ce projet</h3>
                <p className="text-xs text-muted-foreground mb-6 max-w-md">
                  Créez une roadmap pour planifier et suivre les livrables, milestones et initiatives de "{selectedProject?.name}".
                </p>
                {canCreate && (
                  <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-create-roadmap">
                    <Plus className="h-4 w-4 mr-2" />
                    Créer une roadmap
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Roadmap Indicators */}
            {selectedProjectId && (
              <div className="my-[10px]">
                <RoadmapIndicators projectId={selectedProjectId} />
              </div>
            )}

            {/* Milestones Zone + Recommendations side by side */}
            {selectedProjectId && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 my-[10px]">
                <MilestonesZone projectId={selectedProjectId} />
                <RoadmapRecommendations projectId={selectedProjectId} />
              </div>
            )}

            <Card className="mt-[10px]">
              <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <Select value={activeRoadmapId || ""} onValueChange={setSelectedRoadmapId}>
                    <SelectTrigger className="w-[200px] text-xs" data-testid="select-roadmap">
                      <SelectValue placeholder="Sélectionner une roadmap" />
                    </SelectTrigger>
                    <SelectContent>
                      {roadmaps.map((roadmap) => (
                        <SelectItem key={roadmap.id} value={roadmap.id}>
                          <span className="flex items-center gap-2">
                            {roadmap.name}
                            {(roadmap as any).type === "now_next_later" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">NNL</Badge>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {activeRoadmap && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" data-testid="button-roadmap-menu">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        {canUpdate && (
                          <DropdownMenuItem onClick={() => handleOpenRename(activeRoadmap)} data-testid="button-rename-roadmap">
                            <Pencil className="h-4 w-4 mr-2" />
                            Renommer
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => {
                          navigator.clipboard.writeText(activeRoadmap.id);
                          toast({ title: "ID copié", variant: "success" });
                        }}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copier l'ID
                        </DropdownMenuItem>
                        {canDelete && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => handleOpenDelete(activeRoadmap)} className="text-destructive" data-testid="button-delete-roadmap">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {activeRoadmap?.horizon && (
                    <Badge variant="outline" className="text-xs">
                      {activeRoadmap.horizon}
                    </Badge>
                  )}
                  {activeRoadmap && (
                    <Select
                      value={(activeRoadmap as any).status || "planned"}
                      onValueChange={(v) => {
                        if (canUpdate) {
                          updateRoadmapStatusMutation.mutate({ id: activeRoadmap.id, status: v });
                        }
                      }}
                    >
                      <SelectTrigger className="w-auto h-7 text-xs gap-1 border-0 px-2" data-testid="select-roadmap-status">
                        <Badge className={`text-xs ${ROADMAP_STATUS_LABELS[(activeRoadmap as any).status || "planned"]?.color || ""}`}>
                          {ROADMAP_STATUS_LABELS[(activeRoadmap as any).status || "planned"]?.label || "Planifiée"}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planifiée</SelectItem>
                        <SelectItem value="in_progress">En cours</SelectItem>
                        <SelectItem value="closed">Clôturée</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeRoadmap?.type !== "now_next_later" && (
                    <div className="flex items-center border rounded-md p-1">
                      <Button
                        variant={viewMode === "gantt" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("gantt")}
                        className="h-7 px-3"
                        data-testid="button-view-gantt"
                      >
                        <CalendarIcon className="h-4 w-4 mr-1" />
                        Gantt
                      </Button>
                      <Button
                        variant={viewMode === "output" ? "default" : "ghost"}
                        size="sm"
                        onClick={() => setViewMode("output")}
                        className="h-7 px-3"
                        data-testid="button-view-output"
                      >
                        <LayoutGrid className="h-4 w-4 mr-1" />
                        Étapes
                      </Button>
                    </div>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={(importCdcMutation.isPending || resetCdcMutation.isPending) || !selectedProjectId}
                        data-testid="button-import-cdc"
                      >
                        <FileUp className="h-4 w-4 mr-1" />
                        {importCdcMutation.isPending ? "Import..." : resetCdcMutation.isPending ? "Reset..." : "CDC"}
                        <ChevronsUpDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem 
                        onClick={() => importCdcMutation.mutate()}
                        disabled={importCdcMutation.isPending}
                      >
                        <FileUp className="h-4 w-4 mr-2" />
                        Importer CDC
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem 
                        onClick={() => resetCdcMutation.mutate()}
                        disabled={resetCdcMutation.isPending}
                        className="text-orange-600"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Réinitialiser import CDC
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  {canCreate && (
                    <Button size="sm" onClick={() => setIsCreateDialogOpen(true)} data-testid="button-add-roadmap">
                      <Plus className="h-4 w-4 mr-1" />
                      Nouvelle
                    </Button>
                  )}
                </div>
              </div>

              {/* Filters Bar - inside card */}
              <div className="flex flex-wrap items-center gap-3 pt-4 border-t mt-4">
                <div className="relative flex-1 min-w-[200px] max-w-[300px]">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                    data-testid="input-search-roadmap"
                  />
                </div>
                
                <Button
                  variant={showFilters ? "secondary" : "outline"}
                  size="sm"
                  onClick={() => setShowFilters(!showFilters)}
                  data-testid="button-toggle-filters"
                >
                  <Filter className="h-4 w-4 mr-1" />
                  Filtres
                  {hasActiveFilters && (
                    <Badge variant="secondary" className="ml-1.5">
                      {[filterPhase !== "all", filterStatus !== "all", filterType !== "all"].filter(Boolean).length}
                    </Badge>
                  )}
                </Button>

                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearFilters}
                    data-testid="button-clear-filters"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Effacer
                  </Button>
                )}

                {showFilters && (
                  <div className="flex flex-wrap items-center gap-2 w-full pt-2 border-t mt-2">
                    <Select value={filterPhase} onValueChange={setFilterPhase}>
                      <SelectTrigger className="w-[160px] text-xs" data-testid="select-filter-phase">
                        <SelectValue placeholder="Phase" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(PHASE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="w-[160px] text-xs" data-testid="select-filter-status">
                        <SelectValue placeholder="Statut" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="w-[160px] text-xs" data-testid="select-filter-type">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([value, label]) => (
                          <SelectItem key={value} value={value}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </CardHeader>

            <CardContent>
              {isLoadingItems ? (
                <div className="flex items-center justify-center py-12">
                  <Loader />
                </div>
              ) : filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed rounded-lg">
                  <CalendarIcon className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-4">
                    {hasActiveFilters 
                      ? "Aucun élément ne correspond aux filtres sélectionnés."
                      : "Cette roadmap est vide. Ajoutez des éléments pour commencer."}
                  </p>
                  {hasActiveFilters ? (
                    <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters-empty">
                      <X className="h-4 w-4 mr-1" />
                      Effacer les filtres
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" onClick={handleOpenAddItem} data-testid="button-add-first-item">
                      <Plus className="h-4 w-4 mr-1" />
                      Ajouter un élément
                    </Button>
                  )}
                </div>
              ) : (
                <div className="min-h-[400px]">
                  {viewMode === "gantt" ? (
                    <GanttView 
                      items={filteredItems} 
                      dependencies={roadmapDependencies}
                      roadmapId={activeRoadmapId || undefined}
                      onItemClick={handleOpenDetailItem}
                      onAddItem={handleOpenAddItem}
                      onCreateAtDate={handleCreateAtDate}
                      onUpdateItemDates={handleUpdateItemDates}
                      onCreateDependency={handleCreateDependency}
                      onBulkDelete={handleBulkDelete}
                      onBulkUpdate={handleBulkUpdate}
                    />
                  ) : viewMode === "nnl" ? (
                    <NowNextLaterView
                      items={filteredItems}
                      roadmapId={activeRoadmapId || undefined}
                      onItemClick={handleOpenDetailItem}
                      onAddItem={handleOpenAddItem}
                      onUpdateItem={handleItemMove}
                      epics={epics}
                      backlogId={backlogId}
                      userStories={userStories}
                    />
                  ) : (
                    <OutputView 
                      items={filteredItems}
                      roadmapId={activeRoadmapId || undefined}
                      onItemClick={handleOpenDetailItem}
                      onAddItem={handleOpenAddItem}
                      onItemMove={handleItemMove}
                    />
                  )}
                </div>
              )}
            </CardContent>
          </Card>
          </>
            )}
          </TabsContent>

          <TabsContent value="okr" className="mt-0">
            {selectedProjectId ? (
              <OkrTreeView projectId={selectedProjectId} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Target className="h-16 w-16 text-muted-foreground mb-6" />
                    <h3 className="text-xl font-semibold mb-2">Sélectionnez un projet</h3>
                    <p className="text-muted-foreground max-w-md">
                      Choisissez un projet dans le menu déroulant ci-dessus pour afficher et gérer ses OKR.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <Sheet open={isCreateDialogOpen} onOpenChange={(open) => {
        setIsCreateDialogOpen(open);
        if (!open) {
          setCreateStep(1);
          setNewRoadmapName("");
          setNewRoadmapHorizon("");
          setNewRoadmapType("feature_based");
          setImportEpics(false);
          setImportTickets(false);
        }
      }}>
        <SheetContent className="w-[450px] sm:max-w-[450px] overflow-y-auto bg-white dark:bg-slate-900">
          <SheetHeader>
            <SheetTitle>
              {createStep === 1 ? "Créer une roadmap" : "Importer des éléments"}
            </SheetTitle>
            <SheetDescription>
              {createStep === 1 
                ? "Choisissez le type de roadmap et donnez-lui un nom."
                : "Importez automatiquement les Epics et Tickets depuis votre backlog."}
            </SheetDescription>
          </SheetHeader>
          
          <div className="py-4">
            {createStep === 1 ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Type de roadmap</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setNewRoadmapType("feature_based")}
                      className={`rounded-lg border p-3 text-left hover-elevate active-elevate-2 transition-colors ${newRoadmapType === "feature_based" ? "border-primary bg-primary/5" : ""}`}
                      data-testid="button-type-feature-based"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <CalendarIcon className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">Feature-based</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Vue Gantt et étapes pour planifier les livrables</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewRoadmapType("now_next_later")}
                      className={`rounded-lg border p-3 text-left hover-elevate active-elevate-2 transition-colors ${newRoadmapType === "now_next_later" ? "border-primary bg-primary/5" : ""}`}
                      data-testid="button-type-nnl"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Columns className="h-4 w-4 text-emerald-600" />
                        <span className="text-sm font-medium">Now / Next / Later</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">Vue Kanban par priorité temporelle</p>
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roadmap-name">Nom de la roadmap</Label>
                  <Input
                    id="roadmap-name"
                    value={newRoadmapName}
                    onChange={(e) => setNewRoadmapName(e.target.value)}
                    placeholder={newRoadmapType === "now_next_later" ? "Ex: Priorités produit 2025" : "Ex: Roadmap Q1 2025"}
                    data-testid="input-roadmap-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="roadmap-horizon">Horizon (optionnel)</Label>
                  <Input
                    id="roadmap-horizon"
                    value={newRoadmapHorizon}
                    onChange={(e) => setNewRoadmapHorizon(e.target.value)}
                    placeholder="Ex: 2025-Q1"
                    data-testid="input-roadmap-horizon"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg border p-4 space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="import-epics" 
                      checked={importEpics} 
                      onCheckedChange={(checked) => setImportEpics(!!checked)}
                      data-testid="checkbox-import-epics"
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-epics" className="flex items-center gap-2 cursor-pointer">
                        <Package className="h-4 w-4 text-primary" />
                        Importer les Epics
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {epics.length} epic(s) disponible(s)
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox 
                      id="import-tickets" 
                      checked={importTickets} 
                      onCheckedChange={(checked) => setImportTickets(!!checked)}
                      data-testid="checkbox-import-tickets"
                    />
                    <div className="flex-1">
                      <Label htmlFor="import-tickets" className="flex items-center gap-2 cursor-pointer">
                        <ListTodo className="h-4 w-4 text-accent" />
                        Importer les User Stories
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {userStories.length} user story(ies) disponible(s)
                      </p>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Les éléments importés seront ajoutés comme livrables à la roadmap.
                </p>
              </div>
            )}
          </div>
          
          <SheetFooter className="flex-row gap-2 sm:justify-end">
            {createStep === 1 ? (
              <>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Annuler
                </Button>
                {newRoadmapType === "feature_based" ? (
                  <Button 
                    onClick={() => setCreateStep(2)} 
                    disabled={!newRoadmapName.trim()}
                    data-testid="button-next-step"
                  >
                    Suivant
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCreateRoadmap}
                    disabled={!newRoadmapName.trim() || createRoadmapMutation.isPending}
                    data-testid="button-confirm-create-roadmap"
                  >
                    {createRoadmapMutation.isPending ? "Création..." : "Créer la roadmap"}
                  </Button>
                )}
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setCreateStep(1)}>
                  Retour
                </Button>
                <Button 
                  onClick={handleCreateRoadmap} 
                  disabled={createRoadmapMutation.isPending}
                  data-testid="button-confirm-create-roadmap"
                >
                  {createRoadmapMutation.isPending ? "Création..." : "Créer la roadmap"}
                </Button>
              </>
            )}
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={isItemDialogOpen} onOpenChange={setIsItemDialogOpen}>
        <SheetContent className="w-[450px] sm:max-w-[450px] overflow-y-auto bg-white dark:bg-slate-900">
          <SheetHeader>
            <SheetTitle>{editingItem ? "Modifier l'élément" : "Ajouter un élément"}</SheetTitle>
            <SheetDescription>
              {editingItem 
                ? "Modifiez les informations de cet élément de la roadmap."
                : "Créez un nouvel élément pour votre roadmap."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="item-title">Titre</Label>
              <Input
                id="item-title"
                value={itemForm.title}
                onChange={(e) => setItemForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Livraison MVP"
                data-testid="input-item-title"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item-type">Type</Label>
                <Select value={itemForm.type} onValueChange={(v) => setItemForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger id="item-type" data-testid="select-item-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deliverable">Livrable</SelectItem>
                    <SelectItem value="milestone">Milestone</SelectItem>
                    <SelectItem value="initiative">Initiative</SelectItem>
                    <SelectItem value="free_block">Bloc libre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-priority">Priorité</Label>
                <Select value={itemForm.priority} onValueChange={(v) => setItemForm(prev => ({ ...prev, priority: v }))}>
                  <SelectTrigger id="item-priority" data-testid="select-item-priority">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Basse</SelectItem>
                    <SelectItem value="normal">Normale</SelectItem>
                    <SelectItem value="high">Haute</SelectItem>
                    <SelectItem value="strategic">Stratégique</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-status">Statut</Label>
              <Select value={itemForm.status} onValueChange={(v) => setItemForm(prev => ({ ...prev, status: v }))}>
                <SelectTrigger id="item-status" data-testid="select-item-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planned">Planifié</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="done">Terminé</SelectItem>
                  <SelectItem value="blocked">Bloqué</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Version
              </Label>
              <Select 
                value={itemForm.releaseTag || "none"} 
                onValueChange={(v) => setItemForm(prev => ({ ...prev, releaseTag: v === "none" ? "" : v }))}
              >
                <SelectTrigger data-testid="select-version">
                  <SelectValue placeholder="Sélectionner une version..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune version</SelectItem>
                  <SelectItem value="MVP">MVP</SelectItem>
                  <SelectItem value="V1">V1</SelectItem>
                  <SelectItem value="V2">V2</SelectItem>
                  <SelectItem value="V3">V3</SelectItem>
                  <SelectItem value="Hotfix">Hotfix</SelectItem>
                  <SelectItem value="Soon">Soon</SelectItem>
                </SelectContent>
              </Select>
              {itemForm.releaseTag && (
                <Badge variant="outline" className="text-xs w-fit">
                  <Tag className="h-3 w-3 mr-1" />
                  {itemForm.releaseTag}
                </Badge>
              )}
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                Lier à un élément du backlog
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Select 
                  value={itemForm.linkedType} 
                  onValueChange={(v) => setItemForm(prev => ({ 
                    ...prev, 
                    linkedType: v as LinkedType, 
                    linkedId: null,
                    linkedTitle: "" 
                  }))}
                >
                  <SelectTrigger data-testid="select-linked-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">Libre (non lié)</SelectItem>
                    <SelectItem value="epic">Epic</SelectItem>
                    <SelectItem value="ticket">User Story / Ticket</SelectItem>
                    <SelectItem value="cdc">Tâche (CDC)</SelectItem>
                  </SelectContent>
                </Select>
                {itemForm.linkedType === "epic" && (
                  <Select 
                    value={itemForm.linkedId || ""} 
                    onValueChange={(v) => {
                      const epic = epics.find(e => e.id === v);
                      setItemForm(prev => ({ 
                        ...prev, 
                        linkedId: v,
                        linkedTitle: epic?.title || ""
                      }));
                    }}
                  >
                    <SelectTrigger data-testid="select-linked-epic">
                      <SelectValue placeholder="Choisir un epic..." />
                    </SelectTrigger>
                    <SelectContent>
                      {epics.length === 0 ? (
                        <div className="py-2 px-3 text-sm text-muted-foreground">Aucun epic disponible</div>
                      ) : (
                        epics.map(epic => (
                          <SelectItem key={epic.id} value={epic.id}>
                            {epic.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {itemForm.linkedType === "ticket" && (
                  <Select 
                    value={itemForm.linkedId || ""} 
                    onValueChange={(v) => {
                      const story = userStories.find(s => s.id === v);
                      setItemForm(prev => ({ 
                        ...prev, 
                        linkedId: v,
                        linkedTitle: story?.title || ""
                      }));
                    }}
                  >
                    <SelectTrigger data-testid="select-linked-ticket">
                      <SelectValue placeholder="Choisir une user story..." />
                    </SelectTrigger>
                    <SelectContent>
                      {userStories.length === 0 ? (
                        <div className="py-2 px-3 text-sm text-muted-foreground">Aucune user story disponible</div>
                      ) : (
                        userStories.map(story => (
                          <SelectItem key={story.id} value={story.id}>
                            {story.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {itemForm.linkedType === "cdc" && (
                  <Select 
                    value={itemForm.linkedId || ""} 
                    onValueChange={(v) => {
                      const task = cdcTasks.find(t => t.id === v);
                      setItemForm(prev => ({ 
                        ...prev, 
                        linkedId: v,
                        linkedTitle: task?.title || ""
                      }));
                    }}
                  >
                    <SelectTrigger data-testid="select-linked-cdc">
                      <SelectValue placeholder="Choisir une tâche CDC..." />
                    </SelectTrigger>
                    <SelectContent>
                      {cdcTasks.length === 0 ? (
                        <div className="py-2 px-3 text-sm text-muted-foreground">Aucune tâche CDC disponible</div>
                      ) : (
                        cdcTasks.map(task => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
              </div>
              {itemForm.linkedId && (
                <Badge variant="outline" className="text-xs w-fit">
                  {itemForm.linkedType === "epic" && <Package className="h-3 w-3 mr-1" />}
                  {itemForm.linkedType === "ticket" && <Ticket className="h-3 w-3 mr-1" />}
                  {itemForm.linkedType === "cdc" && <ListTodo className="h-3 w-3 mr-1" />}
                  Lié à: {itemForm.linkedTitle || itemForm.linkedId}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="input-item-start-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {itemForm.startDate ? format(itemForm.startDate, "dd/MM/yyyy", { locale: fr }) : "Sélectionner..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={itemForm.startDate || undefined}
                      onSelect={(date) => setItemForm(prev => ({ ...prev, startDate: date || null }))}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="input-item-end-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {itemForm.endDate ? format(itemForm.endDate, "dd/MM/yyyy", { locale: fr }) : "Sélectionner..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={itemForm.endDate || undefined}
                      onSelect={(date) => setItemForm(prev => ({ ...prev, endDate: date || null }))}
                      locale={fr}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-phase">Phase</Label>
              <Select 
                value={itemForm.phase} 
                onValueChange={(v) => setItemForm(prev => ({ ...prev, phase: v === "none" ? "" : v }))}
              >
                <SelectTrigger id="item-phase" data-testid="select-item-phase">
                  <SelectValue placeholder="Aucune phase" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Aucune phase</SelectItem>
                  <SelectItem value="T1">T1</SelectItem>
                  <SelectItem value="T2">T2</SelectItem>
                  <SelectItem value="T3">T3</SelectItem>
                  <SelectItem value="T4">T4</SelectItem>
                  <SelectItem value="LT">LT (Long terme)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="item-description">Description (optionnel)</Label>
              <Textarea
                id="item-description"
                value={itemForm.description}
                onChange={(e) => setItemForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Décrivez cet élément..."
                rows={3}
                data-testid="input-item-description"
              />
            </div>

            {editingItem && (
              <div className="space-y-4 pt-2 border-t">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Bloqué par (dépendances)
                  </Label>
                  <div className="space-y-1.5">
                    {roadmapDependencies
                      .filter(d => d.roadmapItemId === editingItem.id)
                      .map(dep => {
                        const blockedByItem = roadmapItems.find(i => i.id === dep.dependsOnRoadmapItemId);
                        return blockedByItem ? (
                          <div key={dep.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <span className="text-sm">{blockedByItem.title}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeDependencyMutation.mutate(dep.id)}
                              disabled={removeDependencyMutation.isPending}
                              data-testid={`button-remove-dep-${dep.id}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null;
                      })}
                    <Select
                      value=""
                      onValueChange={(itemId) => {
                        if (itemId && editingItem) {
                          addDependencyMutation.mutate({ itemId: editingItem.id, dependsOnId: itemId });
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-sm" data-testid="select-add-blocked-by">
                        <SelectValue placeholder="Ajouter une dépendance..." />
                      </SelectTrigger>
                      <SelectContent>
                        {roadmapItems
                          .filter(i => i.id !== editingItem.id && 
                            !roadmapDependencies.some(d => d.roadmapItemId === editingItem.id && d.dependsOnRoadmapItemId === i.id))
                          .map(item => (
                            <SelectItem key={item.id} value={item.id}>
                              {item.title}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Bloque (éléments dépendants)
                  </Label>
                  <div className="space-y-1.5">
                    {roadmapDependencies
                      .filter(d => d.dependsOnRoadmapItemId === editingItem.id)
                      .map(dep => {
                        const blocksItem = roadmapItems.find(i => i.id === dep.roadmapItemId);
                        return blocksItem ? (
                          <div key={dep.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                            <span className="text-sm">{blocksItem.title}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeDependencyMutation.mutate(dep.id)}
                              disabled={removeDependencyMutation.isPending}
                              data-testid={`button-remove-blocks-${dep.id}`}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : null;
                      })}
                    <p className="text-xs text-muted-foreground">
                      Pour ajouter un élément dépendant, ouvrez cet élément et ajoutez cette tâche dans "Bloqué par".
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <SheetFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsItemDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleSubmitItem} 
              disabled={!itemForm.title.trim() || createItemMutation.isPending || updateItemMutation.isPending}
              data-testid="button-confirm-item"
            >
              {(createItemMutation.isPending || updateItemMutation.isPending) 
                ? "Enregistrement..." 
                : editingItem ? "Mettre à jour" : "Créer"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={isRenameDialogOpen} onOpenChange={setIsRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la roadmap</DialogTitle>
            <DialogDescription>
              Entrez un nouveau nom pour cette roadmap.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="rename-roadmap">Nouveau nom</Label>
            <Input
              id="rename-roadmap"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Nom de la roadmap"
              data-testid="input-rename-roadmap"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button 
              onClick={() => {
                if (roadmapToManage && renameValue.trim()) {
                  renameRoadmapMutation.mutate({ id: roadmapToManage.id, name: renameValue.trim() });
                }
              }}
              disabled={!renameValue.trim() || renameRoadmapMutation.isPending}
              data-testid="button-confirm-rename"
            >
              {renameRoadmapMutation.isPending ? "Enregistrement..." : "Renommer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RoadmapItemDetailPanel
        item={detailItem}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onEdit={handleOpenEditItem}
        epics={epics}
        backlogId={backlogId}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer la roadmap</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer la roadmap "{roadmapToManage?.name}" ?
              Cette action est irréversible et tous les éléments seront perdus.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (roadmapToManage) {
                  deleteRoadmapMutation.mutate(roadmapToManage.id);
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteRoadmapMutation.isPending ? "Suppression..." : "Supprimer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </PermissionGuard>
  );
}
