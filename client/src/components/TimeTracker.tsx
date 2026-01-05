import { useState, useEffect, useRef, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Timer, Play, Square, ChevronDown, Pause, Check, Search, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

type Project = {
  id: string;
  name: string;
  clientId: string | null;
};

type ScopeItem = {
  id: string;
  label: string;
  scopeType: string | null;
  phase: string | null;
};

type TimeEntry = {
  id: string;
  projectId: string | null;
  userId: string;
  startTime: string;
  endTime: string | null;
  pausedAt: string | null;
  duration: number | null;
  description: string | null;
  accountId: string;
  createdAt: string;
  updatedAt: string;
};

export function TimeTracker() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [stoppedEntryId, setStoppedEntryId] = useState<string | null>(null);
  const [projectSearchQuery, setProjectSearchQuery] = useState("");
  const [selectedScopeItemId, setSelectedScopeItemId] = useState<string>("");
  
  // Use ref to capture latest selected project value for assignment
  const selectedProjectRef = useRef<string>("");
  const selectedScopeItemRef = useRef<string>("");

  // Auto-open popover when project selector is shown
  useEffect(() => {
    if (showProjectSelector) {
      setOpen(true);
    }
  }, [showProjectSelector]);

  // Fetch active time entry - only when user is authenticated
  const { data: activeEntry, isLoading: isLoadingActive } = useQuery<TimeEntry | null>({
    queryKey: ["/api/time-entries/active"],
    refetchInterval: 1000, // Refresh every second to update timer
    enabled: !!user, // Only fetch when user is authenticated
  });

  // Fetch projects for selection (load when popover is open OR when showing project selector)
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: !!user && (open || showProjectSelector), // Only when authenticated AND popover is open
  });

  // Fetch scope items for selected project (CDC lines)
  const actualProjectId = selectedProjectId && selectedProjectId !== "none" ? selectedProjectId : null;
  const { data: scopeItems = [] } = useQuery<ScopeItem[]>({
    queryKey: ['/api/projects', actualProjectId, 'scope-items'],
    enabled: !!user && !!actualProjectId && showProjectSelector,
  });

  // Update elapsed time when active entry changes
  useEffect(() => {
    if (activeEntry?.startTime && !activeEntry.endTime) {
      const startTime = new Date(activeEntry.startTime).getTime();
      const accumulatedDuration = activeEntry.duration || 0;
      
      // If paused, display accumulated duration only (frozen)
      if (activeEntry.pausedAt) {
        setElapsedTime(accumulatedDuration);
        return; // Don't start interval, time is frozen
      }
      
      // Timer is running: display accumulated duration + time since last start/resume
      const updateElapsed = () => {
        const now = Date.now();
        const elapsedSinceStart = Math.floor((now - startTime) / 1000);
        setElapsedTime(accumulatedDuration + elapsedSinceStart);
      };
      
      updateElapsed();
      const interval = setInterval(updateElapsed, 1000);
      
      return () => clearInterval(interval);
    } else {
      setElapsedTime(0);
    }
  }, [activeEntry]);

  // Start timer mutation
  const startMutation = useMutation({
    mutationFn: async (projectId: string | null) => {
      return await apiRequest("/api/time-entries", "POST", {
        projectId: projectId || null,
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      // Invalidate project-specific time entries if projectId exists
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${data.projectId}/time-entries`] });
      }
      toast({
        title: "Chronomètre démarré",
        description: "Le suivi du temps a commencé",
        variant: "success",
      });
      setOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Stop timer mutation
  const stopMutation = useMutation({
    mutationFn: async (entryId: string) => {
      const response = await apiRequest(`/api/time-entries/${entryId}`, "PATCH", {
        endTime: new Date().toISOString(),
      });
      return await response.json();
    },
    onSuccess: (data: any) => {
      console.log('✅ stopMutation.onSuccess', { data, entryId: data.id, projectId: data.projectId });
      // Always invalidate active entry query immediately
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${data.projectId}/time-entries`] });
      }
      
      // If stopped without a project, show project selector
      if (!data.projectId) {
        console.log('🔵 No project - showing selector', { entryId: data.id });
        setStoppedEntryId(data.id);
        setSelectedProjectId("none"); // Reset to "none" option
        selectedProjectRef.current = "none"; // Also reset ref
        setShowProjectSelector(true);
      } else {
        toast({
          title: "Chronomètre arrêté",
          description: "Le suivi du temps a été enregistré",
          variant: "success",
        });
        setElapsedTime(0);
        setOpen(false);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Assign project to stopped entry mutation
  const assignProjectMutation = useMutation({
    mutationFn: async ({ entryId, projectId, scopeItemId }: { entryId: string; projectId: string | null; scopeItemId: string | null }) => {
      console.log('🚀 assignProjectMutation - Starting', { entryId, projectId, scopeItemId });
      const response = await apiRequest(`/api/time-entries/${entryId}`, "PATCH", {
        projectId: projectId || null,
        scopeItemId: scopeItemId || null,
      });
      const data = await response.json();
      console.log('✅ assignProjectMutation - Success', data);
      return data;
    },
    onSuccess: (data: any) => {
      console.log('✅ assignProjectMutation.onSuccess', data);
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${data.projectId}/time-entries`] });
      }
      toast({
        title: "Chronomètre arrêté",
        description: "Le suivi du temps a été enregistré",
        variant: "success",
      });
      setShowProjectSelector(false);
      setStoppedEntryId(null);
      setElapsedTime(0);
      setSelectedScopeItemId("");
      selectedScopeItemRef.current = "";
      setOpen(false);
    },
    onError: (error: Error) => {
      console.error('❌ assignProjectMutation.onError', error);
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Pause timer mutation
  const pauseMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return await apiRequest(`/api/time-entries/${entryId}/pause`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      toast({
        title: "Chronomètre en pause",
        description: "Le chronomètre a été mis en pause",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resume timer mutation
  const resumeMutation = useMutation({
    mutationFn: async (entryId: string) => {
      return await apiRequest(`/api/time-entries/${entryId}/resume`, "PATCH");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      toast({
        title: "Chronomètre relancé",
        description: "Le chronomètre a été relancé",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const handleStart = () => {
    // Convert "none" to null for the backend
    const projectId = selectedProjectId === "none" || !selectedProjectId ? null : selectedProjectId;
    startMutation.mutate(projectId);
  };

  const handleStop = () => {
    if (activeEntry) {
      stopMutation.mutate(activeEntry.id);
    }
  };
  
  const handlePause = () => {
    if (activeEntry) {
      pauseMutation.mutate(activeEntry.id);
    }
  };
  
  const handleResume = () => {
    if (activeEntry) {
      resumeMutation.mutate(activeEntry.id);
    }
  };
  
  const handleAssignProject = () => {
    console.log('🎯 handleAssignProject CALLED', { stoppedEntryId, selectedProjectRef: selectedProjectRef.current, selectedScopeItemRef: selectedScopeItemRef.current });
    if (stoppedEntryId) {
      // Use ref to get the latest value, avoiding stale state
      const projectId = selectedProjectRef.current === "none" || !selectedProjectRef.current ? null : selectedProjectRef.current;
      const scopeItemId = selectedScopeItemRef.current === "none" || !selectedScopeItemRef.current ? null : selectedScopeItemRef.current;
      console.log('🔍 TimeTracker - Assigning project:', { stoppedEntryId, selectedProjectId: selectedProjectRef.current, projectId, scopeItemId });
      assignProjectMutation.mutate({ entryId: stoppedEntryId, projectId, scopeItemId });
    } else {
      console.error('❌ No stoppedEntryId found!');
    }
  };

  const isRunning = !!activeEntry && !activeEntry.endTime && !activeEntry.pausedAt;
  const isPaused = !!activeEntry && !activeEntry.endTime && !!activeEntry.pausedAt;
  const activeProject = projects.find((p) => p.id === activeEntry?.projectId);
  
  const handleOpenChange = (newOpen: boolean) => {
    // If closing while showing project selector, reset the state
    if (!newOpen && showProjectSelector) {
      setShowProjectSelector(false);
      setStoppedEntryId(null);
    }
    // Reset search query when closing popover
    if (!newOpen) {
      setProjectSearchQuery("");
    }
    setOpen(newOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant={isRunning ? "default" : "ghost"}
          size="sm"
          className={isRunning ? "gap-2" : ""}
          data-testid="button-time-tracker"
        >
          <Timer className={`w-5 h-5 ${isRunning ? "text-primary-foreground" : "text-primary"}`} />
          {isRunning && (
            <span className="text-sm font-mono text-primary-foreground" data-testid="text-elapsed-time">
              {formatTime(elapsedTime)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 bg-white dark:bg-white" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-sm text-foreground flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              Time Tracking
            </h4>
          </div>

          {showProjectSelector ? (
            <div className="space-y-4">
              {/* Project Selection After Stop */}
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Le chronomètre est arrêté. Voulez-vous assigner cette session à un projet ?
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Sélectionner un projet
                </label>
                <Command className="border rounded-md" shouldFilter={false}>
                  <CommandInput 
                    placeholder="Rechercher un projet..." 
                    value={projectSearchQuery}
                    onValueChange={setProjectSearchQuery}
                    data-testid="input-project-search-after-stop"
                  />
                  <CommandList className="max-h-48">
                    <CommandEmpty>Aucun projet trouvé</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          setSelectedProjectId("none");
                          selectedProjectRef.current = "none";
                          setSelectedScopeItemId("");
                          selectedScopeItemRef.current = "";
                          setProjectSearchQuery("");
                        }}
                        data-testid="option-no-project"
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedProjectId === "none" ? "opacity-100" : "opacity-0")} />
                        Aucun projet
                      </CommandItem>
                      {projects
                        .filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                        .map((project) => (
                          <CommandItem
                            key={project.id}
                            value={project.id}
                            onSelect={() => {
                              setSelectedProjectId(project.id);
                              selectedProjectRef.current = project.id;
                              setSelectedScopeItemId("");
                              selectedScopeItemRef.current = "";
                              setProjectSearchQuery("");
                            }}
                            data-testid={`option-project-${project.id}`}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedProjectId === project.id ? "opacity-100" : "opacity-0")} />
                            {project.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {selectedProjectId && selectedProjectId !== "none" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Projet sélectionné : {projects.find(p => p.id === selectedProjectId)?.name}
                  </p>
                )}
              </div>

              {/* Scope Item Selection (CDC Lines) - Optional */}
              {selectedProjectId && selectedProjectId !== "none" && scopeItems.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Rattacher à une ligne CDC (optionnel)
                  </Label>
                  <Select
                    value={selectedScopeItemId}
                    onValueChange={(value) => {
                      setSelectedScopeItemId(value);
                      selectedScopeItemRef.current = value;
                    }}
                  >
                    <SelectTrigger data-testid="select-scope-item">
                      <SelectValue placeholder="Aucune ligne sélectionnée" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune ligne</SelectItem>
                      {scopeItems.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="flex items-center gap-2">
                            <span 
                              className={cn(
                                "w-2 h-2 rounded-full",
                                item.scopeType === 'functional' && 'bg-violet-500',
                                item.scopeType === 'technical' && 'bg-cyan-500',
                                item.scopeType === 'design' && 'bg-amber-500',
                                item.scopeType === 'gestion' && 'bg-emerald-500',
                                item.scopeType === 'strategy' && 'bg-blue-500',
                                (!item.scopeType || item.scopeType === 'autre') && 'bg-gray-500'
                              )} 
                            />
                            {item.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedScopeItemId && selectedScopeItemId !== "none" && (
                    <p className="text-xs text-muted-foreground">
                      Ce temps sera comptabilisé pour le suivi KPI de cette ligne
                    </p>
                  )}
                </div>
              )}

              <Button
                onClick={handleAssignProject}
                disabled={assignProjectMutation.isPending}
                className="w-full gap-2"
                data-testid="button-assign-project"
              >
                {assignProjectMutation.isPending ? "Enregistrement..." : "Terminer"}
              </Button>
            </div>
          ) : isRunning ? (
            <div className="space-y-4">
              {/* Circular Timer Display */}
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  {/* Outer Circle */}
                  <div className="absolute inset-0 rounded-full border-8 border-border"></div>
                  {/* Inner Content */}
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-3xl font-mono font-bold text-foreground" data-testid="text-timer-display">
                      {formatTime(elapsedTime)}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                      EN COURS
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Project Info */}
              {activeProject && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Projet</p>
                  <p className="font-medium text-foreground" data-testid="text-active-project">
                    {activeProject.name}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handlePause}
                  disabled={pauseMutation.isPending}
                  variant="outline"
                  className="flex-1 gap-2"
                  data-testid="button-pause-timer"
                >
                  <Pause className="w-4 h-4" />
                  Pause
                </Button>
                <Button
                  onClick={handleStop}
                  disabled={stopMutation.isPending}
                  className="flex-1 gap-2"
                  data-testid="button-stop-timer"
                >
                  <Square className="w-4 h-4" />
                  Arrêter
                </Button>
              </div>
            </div>
          ) : isPaused ? (
            <div className="space-y-4">
              {/* Circular Timer Display (Paused) */}
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  {/* Outer Circle */}
                  <div className="absolute inset-0 rounded-full border-8 border-border"></div>
                  {/* Inner Content */}
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-3xl font-mono font-bold text-foreground" data-testid="text-timer-display">
                      {formatTime(elapsedTime)}
                    </p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                      EN PAUSE
                    </p>
                  </div>
                </div>
              </div>

              {/* Active Project Info */}
              {activeProject && (
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Projet</p>
                  <p className="font-medium text-foreground" data-testid="text-active-project">
                    {activeProject.name}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button
                  onClick={handleResume}
                  disabled={resumeMutation.isPending}
                  variant="default"
                  className="flex-1 gap-2"
                  data-testid="button-resume-timer"
                >
                  <Play className="w-4 h-4" />
                  Relancer
                </Button>
                <Button
                  onClick={handleStop}
                  disabled={stopMutation.isPending}
                  variant="outline"
                  className="flex-1 gap-2"
                  data-testid="button-stop-timer"
                >
                  <Square className="w-4 h-4" />
                  Arrêter
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Circular Timer Display (Stopped) */}
              <div className="flex flex-col items-center justify-center py-4">
                <div className="relative w-40 h-40 flex items-center justify-center">
                  {/* Outer Circle */}
                  <div className="absolute inset-0 rounded-full border-8 border-border"></div>
                  {/* Inner Content */}
                  <div className="flex flex-col items-center justify-center">
                    <p className="text-3xl font-mono font-bold text-foreground" data-testid="text-timer-display">
                      00:00
                    </p>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                      ARRÊTÉ
                    </p>
                  </div>
                </div>
              </div>

              {/* Project Selection with Autocomplete */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Sélectionner un projet
                </label>
                <Command className="border rounded-md" shouldFilter={false}>
                  <CommandInput 
                    placeholder="Rechercher un projet..." 
                    value={projectSearchQuery}
                    onValueChange={setProjectSearchQuery}
                    data-testid="input-project-search"
                  />
                  <CommandList className="max-h-48">
                    <CommandEmpty>Aucun projet trouvé</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        value="none"
                        onSelect={() => {
                          setSelectedProjectId("none");
                          setProjectSearchQuery("");
                        }}
                        data-testid="option-no-project-start"
                      >
                        <Check className={cn("mr-2 h-4 w-4", selectedProjectId === "none" ? "opacity-100" : "opacity-0")} />
                        Aucun projet
                      </CommandItem>
                      {projects
                        .filter(p => p.name.toLowerCase().includes(projectSearchQuery.toLowerCase()))
                        .map((project) => (
                          <CommandItem
                            key={project.id}
                            value={project.id}
                            onSelect={() => {
                              setSelectedProjectId(project.id);
                              setProjectSearchQuery("");
                            }}
                            data-testid={`option-project-start-${project.id}`}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedProjectId === project.id ? "opacity-100" : "opacity-0")} />
                            {project.name}
                          </CommandItem>
                        ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
                {selectedProjectId && selectedProjectId !== "none" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Projet sélectionné : {projects.find(p => p.id === selectedProjectId)?.name}
                  </p>
                )}
              </div>

              {/* Start Button */}
              <Button
                onClick={handleStart}
                disabled={startMutation.isPending}
                className="w-full gap-2"
                data-testid="button-start-timer"
              >
                <Play className="w-4 h-4" />
                Démarrer
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
