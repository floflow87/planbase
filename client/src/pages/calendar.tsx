import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X, CheckSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AppointmentPanel } from "@/components/appointment-panel";
import { supabase } from "@/lib/supabase";
import googleLogo from "@assets/png-clipart-google-logo-google-search-google-s-g-suite-google-text-trademark_1763028333519.png";
import { getTaskPriorityColorWithBorder } from "@shared/config";

type ViewMode = "month" | "week" | "day";

interface Appointment {
  id: string;
  title: string;
  startDateTime: string;
  endDateTime: string | null;
  clientId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
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
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const [showTasks, setShowTasks] = useState(true);
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

  // Generate time slots for day/week views (7am to 9pm in 1-hour slots)
  const generateTimeSlots = () => {
    const slots: string[] = [];
    for (let hour = 7; hour <= 21; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
    }
    return slots;
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
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className="rounded-r-none"
              data-testid="button-view-month"
            >
              Mois
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className="rounded-none border-x border-border"
              data-testid="button-view-week"
            >
              Semaine
            </Button>
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className="rounded-l-none"
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
            data-testid="button-previous"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToToday}
            data-testid="button-today"
          >
            Aujourd'hui
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={goToNext}
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
            onClick={() => setAppointmentDialogOpen(true)}
            data-testid="button-new-appointment"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau rdv
          </Button>
          
          {/* 2. Google Calendar */}
          {googleStatus?.connected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card">
              <CalendarIcon className="w-4 h-4 text-green-600" />
              <span className="text-sm text-muted-foreground">{googleStatus.email}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => disconnectMutation.mutate()}
                data-testid="button-disconnect-google"
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          ) : (
            <Button 
              variant="outline" 
              size="icon"
              onClick={handleConnectGoogle}
              disabled={!googleStatus?.configured}
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

                return (
                  <div
                    key={index}
                    className={`min-h-24 p-2 border-r border-b border-border last:border-r-0 ${
                      !isCurrentMonth ? "bg-muted/30" : "bg-card"
                    } ${isToday ? "bg-violet-50 dark:bg-violet-950/20" : ""}`}
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
                            className="text-xs p-1 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 truncate cursor-pointer hover:bg-violet-200 dark:hover:bg-violet-900/50"
                            title={`${startTime} - ${apt.title}`}
                            data-testid={`appointment-${apt.id}`}
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
                            className="text-xs p-1 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 truncate cursor-pointer hover:bg-cyan-200 dark:hover:bg-cyan-900/50 border-l-2 border-cyan-500"
                            title={`Google: ${startTime} - ${event.summary}`}
                            data-testid={`google-event-${event.id}`}
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

        {viewMode === "week" && (
          <div className="bg-card rounded-lg border border-border overflow-auto">
            <div className="grid grid-cols-8 min-w-[800px]">
              {/* Time column */}
              <div className="border-r border-border">
                <div className="h-12 border-b border-border"></div>
                {generateTimeSlots().map(time => (
                  <div key={time} className="h-20 border-b border-border p-2 text-xs text-muted-foreground">
                    {time}
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {generateWeekGrid().map((date, dayIndex) => {
                const isToday = date.toDateString() === new Date().toDateString();
                const dayAppointments = getAppointmentsForDay(date);
                const dayGoogleEvents = getGoogleEventsForDay(date);
                const dayTasks = getTasksForDay(date);

                return (
                  <div key={dayIndex} className="border-r border-border last:border-r-0">
                    {/* Day header */}
                    <div className={`h-12 border-b border-border p-2 text-center ${isToday ? "bg-violet-100 dark:bg-violet-900/30" : ""}`}>
                      <div className="text-xs text-muted-foreground">{["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"][dayIndex]}</div>
                      <div className={`text-sm font-semibold ${isToday ? "text-violet-600 dark:text-violet-400" : "text-foreground"}`}>
                        {date.getDate()}
                      </div>
                    </div>

                    {/* Time slots */}
                    {generateTimeSlots().map((time, timeIndex) => (
                      <div key={timeIndex} className="h-20 border-b border-border p-1 relative">
                        {/* Render appointments/events in this time slot */}
                        {dayAppointments.map(apt => {
                          const aptTime = new Date(apt.startDateTime);
                          const aptHour = aptTime.getHours();
                          const slotHour = parseInt(time.split(':')[0]);
                          
                          if (aptHour === slotHour) {
                            return (
                              <div
                                key={apt.id}
                                className="text-xs p-1 mb-1 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 truncate cursor-pointer"
                                title={apt.title}
                              >
                                {aptTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} {apt.title}
                              </div>
                            );
                          }
                          return null;
                        })}
                        
                        {dayGoogleEvents.map(event => {
                          if (!event.start.dateTime) {
                            // All-day events: show only in first time slot
                            if (timeIndex === 0) {
                              return (
                                <div
                                  key={event.id}
                                  className="text-xs p-1 mb-1 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 truncate cursor-pointer border-l-2 border-cyan-500"
                                  title={event.summary}
                                >
                                  Toute la journée: {event.summary}
                                </div>
                              );
                            }
                            return null;
                          }
                          
                          const eventTime = new Date(event.start.dateTime);
                          const eventHour = eventTime.getHours();
                          const slotHour = parseInt(time.split(':')[0]);
                          
                          if (eventHour === slotHour) {
                            return (
                              <div
                                key={event.id}
                                className="text-xs p-1 mb-1 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 truncate cursor-pointer border-l-2 border-cyan-500"
                                title={event.summary}
                              >
                                {eventTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })} {event.summary}
                              </div>
                            );
                          }
                          return null;
                        })}

                        {/* Tasks: show only in first time slot since they have no specific time */}
                        {showTasks && timeIndex === 0 && dayTasks.map(task => (
                          <div
                            key={task.id}
                            className={`text-xs p-1 mb-1 rounded truncate cursor-pointer ${
                              task.priority === "high" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-l-2 border-red-500" :
                              task.priority === "medium" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-l-2 border-yellow-500" :
                              "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-l-2 border-green-500"
                            }`}
                            title={task.title}
                          >
                            <CheckSquare className="w-3 h-3 inline mr-1" /> {task.title}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "day" && (
          <div className="bg-card rounded-lg border border-border overflow-auto max-w-4xl mx-auto">
            <div className="grid grid-cols-2">
              {/* Time column */}
              <div className="border-r border-border col-span-2">
                {/* Day header */}
                <div className="h-16 border-b border-border p-4 bg-violet-50 dark:bg-violet-950/20">
                  <div className="text-sm text-muted-foreground">
                    {["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"][currentDate.getDay()]}
                  </div>
                  <div className="text-lg font-bold text-violet-600 dark:text-violet-400">
                    {currentDate.getDate()} {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                  </div>
                </div>
              </div>

              {/* Time column */}
              <div className="border-r border-border">
                {generateTimeSlots().map(time => (
                  <div key={time} className="h-20 border-b border-border p-2 text-sm text-muted-foreground font-medium">
                    {time}
                  </div>
                ))}
              </div>

              {/* Events column */}
              <div>
                {generateTimeSlots().map((time, timeIndex) => {
                  const dayAppointments = getAppointmentsForDay(currentDate);
                  const dayGoogleEvents = getGoogleEventsForDay(currentDate);
                  const dayTasks = getTasksForDay(currentDate);
                  const slotHour = parseInt(time.split(':')[0]);

                  return (
                    <div key={timeIndex} className="h-20 border-b border-border p-2 space-y-1">
                      {/* Render appointments in this time slot */}
                      {dayAppointments.map(apt => {
                        const aptTime = new Date(apt.startDateTime);
                        const aptHour = aptTime.getHours();
                        
                        if (aptHour === slotHour) {
                          return (
                            <div
                              key={apt.id}
                              className="text-sm p-2 rounded bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 cursor-pointer hover:bg-violet-200 dark:hover:bg-violet-900/50"
                              title={apt.title}
                            >
                              <div className="font-semibold">{aptTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                              <div>{apt.title}</div>
                              {apt.notes && <div className="text-xs mt-1 text-muted-foreground">{apt.notes}</div>}
                            </div>
                          );
                        }
                        return null;
                      })}
                      
                      {dayGoogleEvents.map(event => {
                        if (!event.start.dateTime) {
                          // All-day event: show only in first time slot
                          if (timeIndex === 0) {
                            return (
                              <div
                                key={event.id}
                                className="text-sm p-2 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 cursor-pointer border-l-4 border-cyan-500"
                                title={event.summary}
                              >
                                <div className="font-semibold">Toute la journée</div>
                                <div>{event.summary}</div>
                              </div>
                            );
                          }
                          return null;
                        }
                        
                        const eventTime = new Date(event.start.dateTime);
                        const eventHour = eventTime.getHours();
                        
                        if (eventHour === slotHour) {
                          return (
                            <div
                              key={event.id}
                              className="text-sm p-2 rounded bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 cursor-pointer border-l-4 border-cyan-500"
                              title={event.summary}
                            >
                              <div className="font-semibold">{eventTime.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</div>
                              <div>{event.summary}</div>
                              {event.description && <div className="text-xs mt-1">{event.description}</div>}
                            </div>
                          );
                        }
                        return null;
                      })}

                      {/* Tasks for this day (shown at top of day) */}
                      {showTasks && timeIndex === 0 && dayTasks.map(task => (
                        <div
                          key={task.id}
                          className={`text-sm p-2 rounded cursor-pointer ${
                            task.priority === "high" ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-l-4 border-red-500" :
                            task.priority === "medium" ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-l-4 border-yellow-500" :
                            "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-l-4 border-green-500"
                          }`}
                          title={task.title}
                        >
                          <div className="flex items-center gap-2">
                            <CheckSquare className="w-4 h-4" />
                            <span className="font-semibold">Tâche à faire</span>
                          </div>
                          <div>{task.title}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Appointment Panel */}
      <AppointmentPanel
        open={appointmentDialogOpen}
        onClose={() => setAppointmentDialogOpen(false)}
        selectedDate={currentDate}
      />
    </div>
  );
}
