import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Timer, Play, Square, ChevronDown, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Project = {
  id: string;
  name: string;
  clientId: string | null;
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
  const [open, setOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [stoppedEntryId, setStoppedEntryId] = useState<string | null>(null);

  // Fetch active time entry
  const { data: activeEntry, isLoading: isLoadingActive } = useQuery<TimeEntry | null>({
    queryKey: ["/api/time-entries/active"],
    refetchInterval: 1000, // Refresh every second to update timer
  });

  // Fetch projects for selection
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open, // Only fetch when popover is open
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
      return await apiRequest(`/api/time-entries/${entryId}`, "PATCH", {
        endTime: new Date().toISOString(),
      });
    },
    onSuccess: (data: any) => {
      // Always invalidate active entry query immediately
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries/active"] });
      queryClient.invalidateQueries({ queryKey: ["/api/time-entries"] });
      if (data.projectId) {
        queryClient.invalidateQueries({ queryKey: [`/api/projects/${data.projectId}/time-entries`] });
      }
      
      // If stopped without a project, show project selector
      if (!data.projectId) {
        setStoppedEntryId(data.id);
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
    mutationFn: async ({ entryId, projectId }: { entryId: string; projectId: string | null }) => {
      return await apiRequest(`/api/time-entries/${entryId}`, "PATCH", {
        projectId: projectId || null,
      });
    },
    onSuccess: (data: any) => {
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
    if (stoppedEntryId) {
      const projectId = selectedProjectId === "none" || !selectedProjectId ? null : selectedProjectId;
      assignProjectMutation.mutate({ entryId: stoppedEntryId, projectId });
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
      <PopoverContent className="w-80 bg-background" align="end">
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
                  Sélectionner un projet (optionnel)
                </label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={isLoadingProjects}
                >
                  <SelectTrigger data-testid="select-project-after-stop">
                    <SelectValue placeholder="Aucun projet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" data-testid="option-no-project">
                      Aucun projet
                    </SelectItem>
                    {projects.map((project) => (
                      <SelectItem 
                        key={project.id} 
                        value={project.id}
                        data-testid={`option-project-${project.id}`}
                      >
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleAssignProject}
                disabled={assignProjectMutation.isPending}
                className="w-full gap-2"
                data-testid="button-assign-project"
              >
                Terminer
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

              {/* Project Selection */}
              <div className="space-y-2">
                <label className="text-sm text-muted-foreground">
                  Sélectionner un projet (optionnel)
                </label>
                <Select
                  value={selectedProjectId}
                  onValueChange={setSelectedProjectId}
                  disabled={isLoadingProjects}
                >
                  <SelectTrigger data-testid="select-project">
                    <SelectValue placeholder="Aucun projet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" data-testid="option-no-project">
                      Aucun projet
                    </SelectItem>
                    {projects.map((project) => (
                      <SelectItem 
                        key={project.id} 
                        value={project.id}
                        data-testid={`option-project-${project.id}`}
                      >
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
