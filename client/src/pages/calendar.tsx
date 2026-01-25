import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AppointmentPanel } from "@/components/appointment-panel";
import { TaskDetailModal } from "@/components/TaskDetailModal";
import { supabase } from "@/lib/supabase";
import googleLogo from "@assets/png-clipart-google-logo-google-search-google-s-g-suite-google-text-trademark_1763028333519.png";
import { getTaskPriorityColorWithBorder } from "@shared/config";
import type { Task as FullTask, AppUser, Project, TaskColumn } from "@shared/schema";

type ViewMode = "month" | "week" | "day";

interface Appointment {
  id: string;
  title: string;
  type: string | null;
  startDateTime: string;
  endDateTime: string | null;
  clientId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  location?: string | null;
  htmlLink?: string | null;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }> | null;
  organizer?: { email: string; displayName?: string } | null;
}

interface GoogleEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
}

interface Task {
  id: string;
  title: string;
  dueDate: string | null;
  priority: string | null;
  status: string | null;
}

// Helper to get auth headers from Supabase session
async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
    };
  }
  
  return {};
}

export default function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem("planbase-calendar-view");
    return (saved as ViewMode) || "month";
  });
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [selectedAppointmentDate, setSelectedAppointmentDate] = useState<Date | undefined>(undefined);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [appointmentMode, setAppointmentMode] = useState<"create" | "view" | "edit">("create");
  const [appointmentReadOnly, setAppointmentReadOnly] = useState(false);
  const [appointmentSource, setAppointmentSource] = useState<"planbase" | "google">("planbase");
  const [showTasks, setShowTasks] = useState(true);
  const [selectedTask, setSelectedTask] = useState<FullTask | null>(null);
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const { toast } = useToast();

  // Fetch appointments for the current month
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", firstDayOfMonth.toISOString(), lastDayOfMonth.toISOString()],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const params = new URLSearchParams({
        startDate: firstDayOfMonth.toISOString(),
        endDate: lastDayOfMonth.toISOString(),
      });
      const response = await fetch(`/api/appointments?${params}`, { headers: authHeaders });
      if (!response.ok) throw new Error("Failed to fetch appointments");
      return response.json();
    },
  });

  // Fetch tasks with due dates for the current month
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/tasks", { headers: authHeaders });
      if (!response.ok) return [];
      const allTasks = await response.json();
      // Filter only tasks with due dates
      return allTasks.filter((task: Task) => task.dueDate);
    },
  });

  // Fetch full tasks for task detail modal
  const { data: fullTasks = [] } = useQuery<FullTask[]>({
    queryKey: ["/api/tasks"],
  });

  // Fetch users for task detail modal
  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  // Fetch projects for task detail modal
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch task columns for task detail modal
  const { data: taskColumns = [] } = useQuery<TaskColumn[]>({
    queryKey: ["/api/task-columns"],
  });

  // Check Google Calendar connection status
  const { data: googleStatus } = useQuery<{ connected: boolean; email: string | null; configured: boolean }>({
    queryKey: ["/api/google/status"],
    queryFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/google/status", { headers: authHeaders });
      if (!response.ok) return { connected: false, email: null, configured: false };
      return response.json();
    },
  });

  // Fetch Google Calendar events if connected
  const { data: googleEvents = [] } = useQuery<GoogleEvent[]>({
    queryKey: ["/api/google/events", firstDayOfMonth.toISOString(), lastDayOfMonth.toISOString()],
    queryFn: async () => {
      if (!googleStatus?.connected) return [];
      
      const authHeaders = await getAuthHeaders();
      const params = new URLSearchParams({
        startDate: firstDayOfMonth.toISOString(),
        endDate: lastDayOfMonth.toISOString(),
      });
      const response = await fetch(`/api/google/events?${params}`, { headers: authHeaders });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!googleStatus?.connected,
  });

  // Update task mutation
  const updateTaskMutation = useMutation({
    mutationFn: async (task: Partial<FullTask> & { id: string }) => {
      const response = await apiRequest(`/api/tasks/${task.id}`, "PATCH", task);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setTaskModalOpen(false);
      setSelectedTask(null);
    },
  });

  // Update appointment mutation (for drag & drop and resize)
  const updateAppointmentMutation = useMutation({
    mutationFn: async (data: { id: string; startDateTime?: string; endDateTime?: string }) => {
      const response = await apiRequest(`/api/appointments/${data.id}`, "PATCH", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/appointments" });
      toast({
        title: "Rendez-vous mis à jour",
        variant: "success",
      });
    },
  });

  // Delete task mutation
  const deleteTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      await apiRequest(`/api/tasks/${taskId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      setTaskModalOpen(false);
      setSelectedTask(null);
    },
  });

  // Handle task click to open detail modal
  const handleTaskClick = (taskId: string) => {
    const fullTask = fullTasks.find(t => t.id === taskId);
    if (fullTask) {
      setSelectedTask(fullTask);
      setTaskModalOpen(true);
    }
  };

  // Disconnect Google Calendar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/google/disconnect", { 
        method: "DELETE",
        headers: authHeaders 
      });
      if (!response.ok) throw new Error("Failed to disconnect");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google/status"] });
      toast({
        title: "Déconnexion réussie",
        description: "Votre Google Calendar a été déconnecté.",
        variant: "success",
      });
    },
  });

  const handleConnectGoogle = async () => {
    try {
      const authHeaders = await getAuthHeaders();
      const response = await fetch("/api/google/auth/start", { headers: authHeaders });
      const data = await response.json();
      
      if (response.ok && data.authUrl) {
        window.open(data.authUrl, "_blank", "width=600,height=700");
        
        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const authHeaders = await getAuthHeaders();
          const statusResponse = await fetch("/api/google/status", { headers: authHeaders });
          const status = await statusResponse.json();
          
          if (status.connected) {
            clearInterval(pollInterval);
            queryClient.invalidateQueries({ queryKey: ["/api/google/status"] });
            toast({
              title: "✅ Google Calendar connecté !",
              description: "Vos événements seront synchronisés.",
              variant: "success",
            });
          }
        }, 2000);

        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000);
      } else {
        toast({
          title: "Configuration requise",
          description: data.error || "Veuillez configurer vos credentials Google OAuth dans les paramètres.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de se connecter à Google Calendar.",
        variant: "destructive",
      });
    }
  };

  const monthNames = [
    "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
    "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
  ];

  const goToPrevious = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setDate(newDate.getDate() - 1);
    }
    setCurrentDate(newDate);
  };

  const goToNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === "month") {
      newDate.setMonth(newDate.getMonth() + 1);
    } else if (viewMode === "week") {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setDate(newDate.getDate() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getDisplayTitle = () => {
    if (viewMode === "month") {
      return `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    } else if (viewMode === "week") {
      return `Semaine du ${currentDate.toLocaleDateString("fr-FR")}`;
    } else {
      return currentDate.toLocaleDateString("fr-FR", { 
        weekday: "long", 
        year: "numeric", 
        month: "long", 
        day: "numeric" 
      });
    }
  };

  // Generate calendar grid for month view
  const generateMonthGrid = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    
    // Start from Monday of the week containing the first day
    startDate.setDate(firstDay.getDate() - (firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1));
    
    const days: Date[] = [];
    const current = new Date(startDate);
    
    // Generate 6 weeks (42 days)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.startDateTime);
      return aptDate.toDateString() === date.toDateString();
    });
  };

  const getGoogleEventsForDay = (date: Date) => {
    return googleEvents.filter(event => {
      const eventDate = new Date(event.start.dateTime || event.start.date || "");
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getTasksForDay = (date: Date) => {
    return tasks.filter(task => {
      if (!task.dueDate) return false;
      const taskDate = new Date(task.dueDate);
      return taskDate.toDateString() === date.toDateString();
    });
  };

  // Generate week view grid (7 days starting from Monday)
  const generateWeekGrid = () => {
    const startOfWeek = new Date(currentDate);
    const dayOfWeek = startOfWeek.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust to Monday
    startOfWeek.setDate(startOfWeek.getDate() + diff);
    
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  // Calendar layout constants
  const SLOT_HEIGHT = 80; // h-20 = 5rem = 80px
  const START_HOUR = 7;
  const END_HOUR = 24; // Midnight (00:00)
  const TOTAL_HOURS = END_HOUR - START_HOUR; // 17 hours (7:00 to 00:00)
  
  // State for drag & drop visual feedback
  const [dragOverSlot, setDragOverSlot] = useState<{ date: string; hour: number } | null>(null);
  
  // State for resize time display
  const [resizePreview, setResizePreview] = useState<{ id: string; endTime: string } | null>(null);
  
  // State to track if we just finished resizing (to prevent click after resize)
  const [justResized, setJustResized] = useState(false);

  // Generate time slots for day/week views (7am to midnight in 1-hour slots)
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
  };

  // Calculate position and height for an appointment with clamping
  const calculateEventPosition = (startDateTime: string, endDateTime: string | null) => {
    const start = new Date(startDateTime);
    const startHour = start.getHours();
    const startMinutes = start.getMinutes();
    
    // Clamp start hour to visible range
    const clampedStartHour = Math.max(START_HOUR, Math.min(END_HOUR, startHour));
    const clampedStartMinutes = startHour < START_HOUR ? 0 : (startHour >= END_HOUR ? 0 : startMinutes);
    
    // Default duration 1 hour if no end time
    let durationMinutes = 60;
    if (endDateTime) {
      const end = new Date(endDateTime);
      durationMinutes = (end.getTime() - start.getTime()) / (1000 * 60);
    }
    // Ensure minimum duration of 15 minutes
    durationMinutes = Math.max(15, durationMinutes);
    
    // Calculate top position (pixels from top of container)
    const topMinutes = (clampedStartHour - START_HOUR) * 60 + clampedStartMinutes;
    const top = Math.max(0, (topMinutes / 60) * SLOT_HEIGHT);
    
    // Calculate height based on duration
    const height = Math.max((durationMinutes / 60) * SLOT_HEIGHT, 20); // Minimum 20px height
    
    return { top, height };
  };

  // Convert pixel position to datetime with clamping
  const pixelToDateTime = (pixelY: number, baseDate: Date) => {
    // Clamp pixel position to valid range
    const clampedPixelY = Math.max(0, Math.min(pixelY, TOTAL_HOURS * SLOT_HEIGHT));
    const totalMinutes = (clampedPixelY / SLOT_HEIGHT) * 60;
    const rawHour = START_HOUR + Math.floor(totalMinutes / 60);
    const rawMinutes = Math.round((totalMinutes % 60) / 15) * 15;
    
    // Clamp hour to visible range
    const hour = Math.max(START_HOUR, Math.min(END_HOUR, rawHour));
    const minutes = hour === END_HOUR ? 0 : rawMinutes;
    
    const result = new Date(baseDate);
    result.setHours(hour, minutes, 0, 0);
    return result;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        {/* Left side: View selectors + Date */}
        <div className="flex items-center gap-2">
          {/* View Mode Toggles */}
          <div className="flex border border-border rounded-md">
            <Button
              variant={viewMode === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setViewMode("month");
                localStorage.setItem("planbase-calendar-view", "month");
              }}
              className={`rounded-r-none ${viewMode !== "month" ? "bg-white dark:bg-gray-900" : ""}`}
              data-testid="button-view-month"
            >
              Mois
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setViewMode("week");
                localStorage.setItem("planbase-calendar-view", "week");
              }}
              className={`rounded-none border-x border-border ${viewMode !== "week" ? "bg-white dark:bg-gray-900" : ""}`}
              data-testid="button-view-week"
            >
              Semaine
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setViewMode("day");
                localStorage.setItem("planbase-calendar-view", "day");
              }}
              className={`rounded-l-none ${viewMode !== "day" ? "bg-white dark:bg-gray-900" : ""}`}
              data-testid="button-view-day"
            >
              Jour
            </Button>
          </div>

          {/* Navigation */}
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToPrevious}
            className="bg-white dark:bg-gray-900"
            data-testid="button-previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            className="bg-white dark:bg-gray-900"
            data-testid="button-today"
          >
            Aujourd'hui
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToNext}
            className="bg-white dark:bg-gray-900"
            data-testid="button-next"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>

          <div className="text-base font-semibold text-foreground ml-2">
            {getDisplayTitle()}
          </div>
        </div>

        {/* Right side: New appointment + Google button + Tasks toggle */}
        <div className="flex items-center gap-2">
          {/* 1. New appointment */}
          <Button 
            variant="default" 
            size="sm"
            onClick={() => {
              setSelectedAppointment(null);
              setAppointmentMode("create");
              setAppointmentReadOnly(false);
              setAppointmentSource("planbase");
              setAppointmentDialogOpen(true);
            }}
            data-testid="button-new-appointment"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau rdv
          </Button>
          
          {/* 2. Google Calendar */}
          {googleStatus?.connected ? (
            <Button 
              variant="outline" 
              size="icon"
              onClick={() => disconnectMutation.mutate()}
              className="bg-white dark:bg-gray-900 relative group"
              title={`Connecté: ${googleStatus.email} - Cliquer pour déconnecter`}
              data-testid="button-disconnect-google"
            >
              <img src={googleLogo} alt="Google" className="w-5 h-5" />
              <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></span>
              <div className="absolute top-full mt-2 left-1/2 transform -translate-x-1/2 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                {googleStatus.email}
              </div>
            </Button>
          ) : (
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleConnectGoogle}
              disabled={!googleStatus?.configured}
              className="bg-white dark:bg-gray-900"
              title={googleStatus?.configured ? "Connecter Google Calendar" : "Configurer Google OAuth"}
              data-testid="button-google-calendar"
            >
              <img src={googleLogo} alt="Google" className="w-5 h-5" />
            </Button>
          )}
          
          {/* 3. Tasks Toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card">
            <CheckSquare className="w-4 h-4 text-muted-foreground" />
            <Label htmlFor="tasks-toggle" className="text-sm text-muted-foreground cursor-pointer">
              Tâches
            </Label>
            <Switch
              id="tasks-toggle"
              checked={showTasks}
              onCheckedChange={setShowTasks}
              data-testid="switch-toggle-tasks"
            />
          </div>
        </div>
      </div>

      {/* Calendar View */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === "month" && (
          <div className="bg-card rounded-lg border border-border">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-border">
              {["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground border-r border-border last:border-r-0">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7">
              {generateMonthGrid().map((date, index) => {
                const isCurrentMonth = date.getMonth() === currentDate.getMonth();
                const isToday = date.toDateString() === new Date().toDateString();
                const dayAppointments = getAppointmentsForDay(date);
                const dayGoogleEvents = getGoogleEventsForDay(date);
                const dayTasks = getTasksForDay(date);

                const handleCellClick = (e: React.MouseEvent) => {
                  // Don't trigger if clicking on an appointment/event/task
                  if ((e.target as HTMLElement).closest('[data-testid^="appointment-"], [data-testid^="google-event-"], [data-testid^="task-"]')) {
                    return;
                  }
                  // Set the date to 9:00 AM by default
                  const selectedDate = new Date(date);
                  selectedDate.setHours(9, 0, 0, 0);
                  setSelectedAppointmentDate(selectedDate);
                  setSelectedAppointment(null);
                  setAppointmentMode("create");
                  setAppointmentReadOnly(false);
                  setAppointmentSource("planbase");
                  setAppointmentDialogOpen(true);
                };

                return (
                  <div
                    key={index}
                    onClick={handleCellClick}
                    className={`min-h-24 p-2 border-r border-b border-border last:border-r-0 cursor-pointer hover-elevate ${
                      !isCurrentMonth ? "bg-muted/30" : "bg-card"
                    } ${isToday ? "bg-violet-50 dark:bg-violet-950/20" : ""}`}
                    data-testid={`calendar-cell-${date.toISOString().split('T')[0]}`}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      const appointmentId = e.dataTransfer.getData("appointmentId");
                      const type = e.dataTransfer.getData("type");
                      
                      if (type === "appointment" && appointmentId) {
                        const apt = appointments.find(a => a.id === appointmentId);
                        if (apt) {
                          const oldStart = new Date(apt.startDateTime);
                          const newStart = new Date(date);
                          newStart.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
                          
                          const duration = apt.endDateTime 
                            ? new Date(apt.endDateTime).getTime() - oldStart.getTime()
                            : 60 * 60 * 1000;
                          const newEnd = new Date(newStart.getTime() + duration);
                          
                          updateAppointmentMutation.mutate({
                            id: appointmentId,
                            startDateTime: newStart.toISOString(),
                            endDateTime: newEnd.toISOString(),
                          });
                        }
                      }
                    }}
                  >
                    <div className={`text-sm font-medium mb-1 ${
                      isCurrentMonth ? "text-foreground" : "text-muted-foreground"
                    } ${isToday ? "text-violet-600 dark:text-violet-400 font-bold" : ""}`}>
                      {date.getDate()}
                    </div>
                    
                    {/* Events */}
                    <div className="space-y-1">
                      {/* Planbase Appointments */}
                      {dayAppointments.map(apt => {
                        const startTime = new Date(apt.startDateTime).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <div
                            key={apt.id}
                            className="text-xs p-1 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 truncate cursor-grab hover-elevate"
                            title={`${startTime} - ${apt.title}`}
                            data-testid={`appointment-${apt.id}`}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("appointmentId", apt.id);
                              e.dataTransfer.setData("type", "appointment");
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedAppointment(apt);
                              setAppointmentMode("view");
                              setAppointmentReadOnly(false);
                              setAppointmentSource("planbase");
                              setAppointmentDialogOpen(true);
                            }}
                          >
                            <span className="font-medium">{startTime}</span> {apt.title}
                          </div>
                        );
                      })}
                      
                      {/* Google Calendar Events */}
                      {dayGoogleEvents.map(event => {
                        const startTime = event.start.dateTime 
                          ? new Date(event.start.dateTime).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "Toute la journée";
                        return (
                          <div
                            key={event.id}
                            className="text-xs p-1 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 truncate cursor-pointer hover-elevate border-l-2 border-cyan-500"
                            title={`Google: ${startTime} - ${event.summary}`}
                            data-testid={`google-event-${event.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              const googleAppointment: Appointment = {
                                id: event.id,
                                title: event.summary,
                                type: null,
                                startDateTime: event.start.dateTime || event.start.date || "",
                                endDateTime: event.end?.dateTime || event.end?.date || null,
                                clientId: null,
                                contactEmail: null,
                                contactPhone: null,
                                notes: event.description || null,
                                location: event.location || null,
                                htmlLink: event.htmlLink || null,
                                attendees: event.attendees?.map((a: any) => ({
                                  email: a.email,
                                  displayName: a.displayName,
                                  responseStatus: a.responseStatus
                                })) || null,
                                organizer: event.organizer ? {
                                  email: event.organizer.email,
                                  displayName: event.organizer.displayName
                                } : null,
                              };
                              setSelectedAppointment(googleAppointment);
                              setAppointmentMode("view");
                              setAppointmentReadOnly(true);
                              setAppointmentSource("google");
                              setAppointmentDialogOpen(true);
                            }}
                          >
                            <span className="font-medium">{startTime}</span> {event.summary}
                          </div>
                        );
                      })}
                      
                      {/* Tasks with Due Dates */}
                      {showTasks && dayTasks.map(task => {
                        return (
                          <div
                            key={task.id}
                            className={`text-xs p-1 rounded truncate cursor-pointer hover-elevate ${getTaskPriorityColorWithBorder(task.priority)}`}
                            title={`Tâche: ${task.title}`}
                            data-testid={`task-${task.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleTaskClick(task.id);
                            }}
                          >
                            <CheckSquare className="w-3 h-3 inline mr-1" />
                            {task.title}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (() => {
          const totalHeight = TOTAL_HOURS * SLOT_HEIGHT;
          const weekDays = generateWeekGrid();

          return (
            <div className="bg-card rounded-lg border border-border overflow-auto">
              <div className="min-w-[800px]">
                {/* Header row */}
                <div className="grid grid-cols-8">
                  <div className="h-12 border-b border-r border-border"></div>
                  {weekDays.map((date, dayIndex) => {
                    const isToday = date.toDateString() === new Date().toDateString();
                    return (
                      <div key={dayIndex} className={`h-12 border-b border-r border-border last:border-r-0 p-2 text-center ${isToday ? "bg-violet-100 dark:bg-violet-900/30" : ""}`}>
                        <div className="text-xs text-muted-foreground">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][dayIndex]}</div>
                        <div className={`text-sm font-semibold ${isToday ? "text-violet-600 dark:text-violet-400" : "text-foreground"}`}>
                          {date.getDate()}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Time grid rows */}
                {generateTimeSlots().map((time, timeIndex) => {
                  const slotHour = parseInt(time.split(':')[0]);
                  
                  return (
                    <div key={timeIndex} className="grid grid-cols-8 border-b border-border" style={{ height: SLOT_HEIGHT }}>
                      {/* Time label */}
                      <div className="border-r border-border p-2 text-xs text-muted-foreground">
                        {time}
                      </div>
                      
                      {/* Day cells */}
                      {weekDays.map((date, dayIndex) => {
                        const slotDateTime = new Date(date);
                        slotDateTime.setHours(slotHour, 0, 0, 0);
                        const isDragTarget = dragOverSlot?.date === date.toISOString().split('T')[0] && dragOverSlot?.hour === slotHour;
                        const dayAppointments = getAppointmentsForDay(date);
                        const dayGoogleEvents = getGoogleEventsForDay(date);
                        const dayTasks = getTasksForDay(date);
                        
                        // Get appointments that start in this specific hour
                        const appointmentsInSlot = dayAppointments.filter(apt => {
                          const startHour = new Date(apt.startDateTime).getHours();
                          return startHour === slotHour;
                        });
                        
                        // Get Google events that start in this specific hour
                        const googleEventsInSlot = dayGoogleEvents.filter(event => {
                          if (!event.start.dateTime) return false;
                          const startHour = new Date(event.start.dateTime).getHours();
                          return startHour === slotHour;
                        });

                        return (
                          <div
                            key={dayIndex}
                            className={`relative border-r border-border last:border-r-0 cursor-pointer hover-elevate transition-colors duration-150 ${
                              isDragTarget ? 'bg-violet-200/50 dark:bg-violet-800/30 ring-2 ring-violet-400 ring-inset' : ''
                            }`}
                            onClick={() => {
                              setSelectedAppointmentDate(slotDateTime);
                              setSelectedAppointment(null);
                              setAppointmentMode("create");
                              setAppointmentSource("planbase");
                              setAppointmentReadOnly(false);
                              setAppointmentDialogOpen(true);
                            }}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              setDragOverSlot({ date: date.toISOString().split('T')[0], hour: slotHour });
                            }}
                            onDragLeave={() => setDragOverSlot(null)}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverSlot(null);
                              const appointmentId = e.dataTransfer.getData("appointmentId");
                              const type = e.dataTransfer.getData("type");
                              
                              if (type === "appointment" && appointmentId) {
                                const apt = appointments.find(a => a.id === appointmentId);
                                if (apt) {
                                  const duration = apt.endDateTime 
                                    ? new Date(apt.endDateTime).getTime() - new Date(apt.startDateTime).getTime()
                                    : 60 * 60 * 1000;
                                  const newStartDateTime = new Date(slotDateTime);
                                  const newEndDateTime = new Date(newStartDateTime.getTime() + duration);
                                  
                                  updateAppointmentMutation.mutate({
                                    id: appointmentId,
                                    startDateTime: newStartDateTime.toISOString(),
                                    endDateTime: newEndDateTime.toISOString(),
                                  });
                                }
                              }
                            }}
                            data-testid={`week-slot-${dayIndex}-${timeIndex}`}
                          >
                            {/* Appointments that start in this slot */}
                            {appointmentsInSlot.map(apt => {
                              const startTime = new Date(apt.startDateTime);
                              const endTime = apt.endDateTime ? new Date(apt.endDateTime) : null;
                              const durationMinutes = endTime 
                                ? (endTime.getTime() - startTime.getTime()) / (1000 * 60)
                                : 60;
                              const heightPx = Math.max((durationMinutes / 60) * SLOT_HEIGHT, 20);
                              const offsetMinutes = startTime.getMinutes();
                              const offsetPx = (offsetMinutes / 60) * SLOT_HEIGHT;
                              
                              return (
                                <div
                                  key={apt.id}
                                  className="absolute left-0.5 right-0.5 z-20 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 cursor-pointer border-l-2 border-violet-500 text-xs overflow-hidden group"
                                  style={{ top: offsetPx, height: heightPx }}
                                  draggable
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData("appointmentId", apt.id);
                                    e.dataTransfer.setData("type", "appointment");
                                    e.dataTransfer.effectAllowed = "move";
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (justResized) {
                                      setJustResized(false);
                                      return;
                                    }
                                    setSelectedAppointment(apt);
                                    setAppointmentMode("view");
                                    setAppointmentDialogOpen(true);
                                  }}
                                >
                                  <div className="p-0.5">
                                    <div className="font-semibold">
                                      {startTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                      {resizePreview?.id === apt.id && ` - ${resizePreview.endTime}`}
                                    </div>
                                    <div className="truncate">{apt.title}</div>
                                  </div>
                                  {/* Resize handle */}
                                  <div
                                    className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize bg-violet-300/50 opacity-0 group-hover:opacity-100 transition-opacity"
                                    onMouseDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      const startY = e.clientY;
                                      const startHeight = heightPx;
                                      const parentEl = (e.target as HTMLElement).parentElement!;

                                      const handleMouseMove = (moveEvent: MouseEvent) => {
                                        const deltaY = moveEvent.clientY - startY;
                                        const newHeight = Math.max(20, startHeight + deltaY);
                                        const durationMins = (newHeight / SLOT_HEIGHT) * 60;
                                        const roundedMinutes = Math.round(durationMins / 15) * 15;
                                        const newEndDateTime = new Date(apt.startDateTime);
                                        newEndDateTime.setMinutes(newEndDateTime.getMinutes() + roundedMinutes);
                                        
                                        parentEl.style.height = `${newHeight}px`;
                                        
                                        setResizePreview({
                                          id: apt.id,
                                          endTime: newEndDateTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                                        });
                                      };

                                      const handleMouseUp = (upEvent: MouseEvent) => {
                                        document.removeEventListener("mousemove", handleMouseMove);
                                        document.removeEventListener("mouseup", handleMouseUp);
                                        setResizePreview(null);
                                        setJustResized(true);
                                        setTimeout(() => setJustResized(false), 100);
                                        
                                        const deltaY = upEvent.clientY - startY;
                                        const newHeight = Math.max(20, startHeight + deltaY);
                                        const durationMins = (newHeight / SLOT_HEIGHT) * 60;
                                        const roundedMinutes = Math.round(durationMins / 15) * 15;
                                        const newEndDateTime = new Date(apt.startDateTime);
                                        newEndDateTime.setMinutes(newEndDateTime.getMinutes() + roundedMinutes);
                                        
                                        parentEl.style.height = `${(roundedMinutes / 60) * SLOT_HEIGHT}px`;
                                        
                                        updateAppointmentMutation.mutate({
                                          id: apt.id,
                                          endDateTime: newEndDateTime.toISOString(),
                                        });
                                      };

                                      document.addEventListener("mousemove", handleMouseMove);
                                      document.addEventListener("mouseup", handleMouseUp);
                                    }}
                                  />
                                </div>
                              );
                            })}
                            
                            {/* Google events that start in this slot */}
                            {googleEventsInSlot.map(event => {
                              const startTime = new Date(event.start.dateTime!);
                              const endTime = event.end?.dateTime ? new Date(event.end.dateTime) : null;
                              const durationMinutes = endTime 
                                ? (endTime.getTime() - startTime.getTime()) / (1000 * 60)
                                : 60;
                              const heightPx = Math.max((durationMinutes / 60) * SLOT_HEIGHT, 20);
                              const offsetMinutes = startTime.getMinutes();
                              const offsetPx = (offsetMinutes / 60) * SLOT_HEIGHT;
                              
                              return (
                                <div
                                  key={event.id}
                                  className="absolute left-0.5 right-0.5 z-20 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 cursor-pointer border-l-2 border-cyan-500 text-xs overflow-hidden"
                                  style={{ top: offsetPx, height: heightPx }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const googleApt = {
                                      id: event.id,
                                      title: event.summary || "Sans titre",
                                      type: null,
                                      startDateTime: event.start.dateTime,
                                      endDateTime: event.end?.dateTime || null,
                                      clientId: null,
                                      contactEmail: null,
                                      contactPhone: null,
                                      notes: event.description || null,
                                      location: event.location || null,
                                      htmlLink: event.htmlLink || null,
                                      attendees: event.attendees?.map((a: any) => ({
                                        email: a.email,
                                        displayName: a.displayName,
                                        responseStatus: a.responseStatus
                                      })) || null,
                                      organizer: event.organizer ? {
                                        email: event.organizer.email,
                                        displayName: event.organizer.displayName,
                                        self: event.organizer.self
                                      } : null,
                                      accountId: "",
                                    };
                                    setSelectedAppointment(googleApt as any);
                                    setAppointmentMode("view");
                                    setAppointmentSource("google");
                                    setAppointmentReadOnly(true);
                                    setAppointmentDialogOpen(true);
                                  }}
                                >
                                  <div className="p-0.5">
                                    <div className="font-semibold truncate">
                                      {startTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                    <div className="truncate">{event.summary}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {viewMode === "day" && (() => {
          const dayAppointments = getAppointmentsForDay(currentDate);
          const dayGoogleEvents = getGoogleEventsForDay(currentDate);
          const dayTasks = getTasksForDay(currentDate);
          const totalHeight = TOTAL_HOURS * SLOT_HEIGHT;

          return (
            <div className="bg-card rounded-lg border border-border overflow-auto max-w-4xl mx-auto">
              {/* Day header */}
              <div className="h-16 border-b border-border p-4 bg-violet-50 dark:bg-violet-950/20">
                <div className="text-sm text-muted-foreground">
                  {["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][currentDate.getDay()]}
                </div>
                <div className="text-lg font-bold text-violet-600 dark:text-violet-400">
                  {currentDate.getDate()} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                </div>
              </div>

              {/* Time grid rows */}
              <div>
                {generateTimeSlots().map((time, timeIndex) => {
                  const slotHour = parseInt(time.split(':')[0]);
                  const slotDateTime = new Date(currentDate);
                  slotDateTime.setHours(slotHour, 0, 0, 0);
                  const isDragTarget = dragOverSlot?.date === currentDate.toISOString().split('T')[0] && dragOverSlot?.hour === slotHour;
                  
                  // Get appointments that start in this specific hour
                  const appointmentsInSlot = dayAppointments.filter(apt => {
                    const startHour = new Date(apt.startDateTime).getHours();
                    return startHour === slotHour;
                  });
                  
                  // Get Google events that start in this specific hour
                  const googleEventsInSlot = dayGoogleEvents.filter(event => {
                    if (!event.start.dateTime) return false;
                    const startHour = new Date(event.start.dateTime).getHours();
                    return startHour === slotHour;
                  });
                  
                  // Get tasks for first slot only
                  const showTasksInSlot = timeIndex === 0 && showTasks && dayTasks.length > 0;

                  return (
                    <div key={timeIndex} className="flex border-b border-border" style={{ height: SLOT_HEIGHT }}>
                      {/* Time label */}
                      <div className="w-16 flex-shrink-0 border-r border-border p-2 text-sm text-muted-foreground font-medium">
                        {time}
                      </div>
                      
                      {/* Event cell */}
                      <div
                        className={`flex-1 relative cursor-pointer hover-elevate transition-colors duration-150 ${
                          isDragTarget ? 'bg-violet-200/50 dark:bg-violet-800/30 ring-2 ring-violet-400 ring-inset' : ''
                        }`}
                        onClick={() => {
                          setSelectedAppointmentDate(slotDateTime);
                          setSelectedAppointment(null);
                          setAppointmentMode("create");
                          setAppointmentSource("planbase");
                          setAppointmentReadOnly(false);
                          setAppointmentDialogOpen(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverSlot({ date: currentDate.toISOString().split('T')[0], hour: slotHour });
                        }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverSlot(null);
                          const appointmentId = e.dataTransfer.getData("appointmentId");
                          const type = e.dataTransfer.getData("type");
                          
                          if (type === "appointment" && appointmentId) {
                            const apt = appointments.find(a => a.id === appointmentId);
                            if (apt) {
                              const duration = apt.endDateTime 
                                ? new Date(apt.endDateTime).getTime() - new Date(apt.startDateTime).getTime()
                                : 60 * 60 * 1000;
                              const newStartDateTime = new Date(slotDateTime);
                              const newEndDateTime = new Date(newStartDateTime.getTime() + duration);
                              
                              updateAppointmentMutation.mutate({
                                id: appointmentId,
                                startDateTime: newStartDateTime.toISOString(),
                                endDateTime: newEndDateTime.toISOString(),
                              });
                            }
                          }
                        }}
                        data-testid={`day-slot-${timeIndex}`}
                      >
                        {/* Tasks (shown in first slot) */}
                        {showTasksInSlot && (
                          <div className="absolute left-1 right-1 top-1 z-10 space-y-1">
                            {dayTasks.map(task => (
                              <div
                                key={task.id}
                                className={`text-sm p-2 rounded cursor-pointer hover-elevate ${getTaskPriorityColorWithBorder(task.priority)}`}
                                title={task.title}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTaskClick(task.id);
                                }}
                              >
                                <div className="flex items-center gap-2">
                                  <CheckSquare className="w-4 h-4" />
                                  <span className="font-semibold truncate">{task.title}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        
                        {/* Appointments that start in this slot */}
                        {appointmentsInSlot.map(apt => {
                          const startTime = new Date(apt.startDateTime);
                          const endTime = apt.endDateTime ? new Date(apt.endDateTime) : null;
                          const durationMinutes = endTime 
                            ? (endTime.getTime() - startTime.getTime()) / (1000 * 60)
                            : 60;
                          const heightPx = Math.max((durationMinutes / 60) * SLOT_HEIGHT, 24);
                          const offsetMinutes = startTime.getMinutes();
                          const offsetPx = (offsetMinutes / 60) * SLOT_HEIGHT;

                          return (
                            <div
                              key={apt.id}
                              className="absolute left-1 right-1 z-20 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 cursor-pointer border-l-4 border-violet-500 overflow-hidden group"
                              style={{ top: offsetPx, height: heightPx }}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("appointmentId", apt.id);
                                e.dataTransfer.setData("type", "appointment");
                                e.dataTransfer.effectAllowed = "move";
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (justResized) {
                                  setJustResized(false);
                                  return;
                                }
                                setSelectedAppointment(apt);
                                setAppointmentMode("view");
                                setAppointmentDialogOpen(true);
                              }}
                            >
                              <div className="p-2 h-full flex flex-col">
                                <div className="font-semibold text-sm">
                                  {startTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                  {resizePreview?.id === apt.id 
                                    ? ` - ${resizePreview.endTime}`
                                    : endTime && ` - ${endTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
                                  }
                                </div>
                                <div className="text-sm truncate">{apt.title}</div>
                              </div>
                              {/* Resize handle */}
                              <div
                                className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize bg-violet-300/50 opacity-0 group-hover:opacity-100 transition-opacity"
                                onMouseDown={(e) => {
                                  e.stopPropagation();
                                  e.preventDefault();
                                  const startY = e.clientY;
                                  const startHeight = heightPx;
                                  const parentEl = (e.target as HTMLElement).parentElement!;

                                  const handleMouseMove = (moveEvent: MouseEvent) => {
                                    const deltaY = moveEvent.clientY - startY;
                                    const newHeight = Math.max(20, startHeight + deltaY);
                                    const durationMins = (newHeight / SLOT_HEIGHT) * 60;
                                    const roundedMinutes = Math.round(durationMins / 15) * 15;
                                    const newEndDateTime = new Date(apt.startDateTime);
                                    newEndDateTime.setMinutes(newEndDateTime.getMinutes() + roundedMinutes);
                                    
                                    parentEl.style.height = `${newHeight}px`;
                                    
                                    setResizePreview({
                                      id: apt.id,
                                      endTime: newEndDateTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
                                    });
                                  };

                                  const handleMouseUp = (upEvent: MouseEvent) => {
                                    document.removeEventListener("mousemove", handleMouseMove);
                                    document.removeEventListener("mouseup", handleMouseUp);
                                    setResizePreview(null);
                                    setJustResized(true);
                                    setTimeout(() => setJustResized(false), 100);
                                    
                                    const deltaY = upEvent.clientY - startY;
                                    const newHeight = Math.max(20, startHeight + deltaY);
                                    const durationMins = (newHeight / SLOT_HEIGHT) * 60;
                                    const roundedMinutes = Math.round(durationMins / 15) * 15;
                                    const newEndDateTime = new Date(apt.startDateTime);
                                    newEndDateTime.setMinutes(newEndDateTime.getMinutes() + roundedMinutes);
                                    
                                    parentEl.style.height = `${(roundedMinutes / 60) * SLOT_HEIGHT}px`;
                                    
                                    updateAppointmentMutation.mutate({
                                      id: apt.id,
                                      endDateTime: newEndDateTime.toISOString(),
                                    });
                                  };

                                  document.addEventListener("mousemove", handleMouseMove);
                                  document.addEventListener("mouseup", handleMouseUp);
                                }}
                              />
                            </div>
                          );
                        })}
                        
                        {/* Google events that start in this slot */}
                        {googleEventsInSlot.map(event => {
                          const startTimeG = new Date(event.start.dateTime!);
                          const endTimeG = event.end?.dateTime ? new Date(event.end.dateTime) : null;
                          const durationMinutesG = endTimeG 
                            ? (endTimeG.getTime() - startTimeG.getTime()) / (1000 * 60)
                            : 60;
                          const heightPxG = Math.max((durationMinutesG / 60) * SLOT_HEIGHT, 24);
                          const offsetMinutesG = startTimeG.getMinutes();
                          const offsetPxG = (offsetMinutesG / 60) * SLOT_HEIGHT;

                          return (
                            <div
                              key={event.id}
                              className="absolute left-1 right-1 z-20 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 cursor-pointer border-l-4 border-cyan-500 overflow-hidden"
                              style={{ top: offsetPxG, height: heightPxG }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const googleApt = {
                                  id: event.id,
                                  title: event.summary || "Sans titre",
                                  type: null,
                                  startDateTime: event.start.dateTime,
                                  endDateTime: event.end?.dateTime || null,
                                  clientId: null,
                                  contactEmail: null,
                                  contactPhone: null,
                                  notes: event.description || null,
                                  location: event.location || null,
                                  htmlLink: event.htmlLink || null,
                                  attendees: event.attendees?.map((a: any) => ({
                                    email: a.email,
                                    displayName: a.displayName,
                                    responseStatus: a.responseStatus
                                  })) || null,
                                  organizer: event.organizer ? {
                                    email: event.organizer.email,
                                    displayName: event.organizer.displayName
                                  } : null,
                                };
                                setSelectedAppointment(googleApt as any);
                                setAppointmentMode("view");
                                setAppointmentSource("google");
                                setAppointmentReadOnly(true);
                                setAppointmentDialogOpen(true);
                              }}
                            >
                              <div className="p-2 h-full flex flex-col">
                                <div className="font-semibold text-sm">
                                  {startTimeG.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                                  {endTimeG && ` - ${endTimeG.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
                                </div>
                                <div className="text-sm truncate">{event.summary}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </div>

      {/* Appointment Panel */}
      <AppointmentPanel
        open={appointmentDialogOpen}
        onClose={() => {
          setAppointmentDialogOpen(false);
          setSelectedAppointmentDate(undefined);
          setSelectedAppointment(null);
          setAppointmentMode("create");
          setAppointmentReadOnly(false);
          setAppointmentSource("planbase");
        }}
        selectedDate={selectedAppointmentDate || currentDate}
        appointment={selectedAppointment}
        mode={appointmentMode}
        isReadOnly={appointmentReadOnly}
        source={appointmentSource}
      />

      {/* Task Detail Modal */}
      <TaskDetailModal
        task={selectedTask}
        users={users}
        projects={projects}
        columns={taskColumns}
        isOpen={taskModalOpen}
        onClose={() => {
          setTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onSave={(taskData) => {
          if (selectedTask) {
            updateTaskMutation.mutate({ ...taskData, id: selectedTask.id } as Partial<FullTask> & { id: string });
          }
        }}
        onDelete={(task) => {
          deleteTaskMutation.mutate(task.id);
        }}
      />
    </div>
  );
}
