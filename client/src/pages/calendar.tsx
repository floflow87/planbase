import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { AppointmentDialog } from "@/components/appointment-dialog";

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

export default function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointmentDialogOpen, setAppointmentDialogOpen] = useState(false);
  const { toast } = useToast();

  // Fetch appointments for the current month
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const { data: appointments = [] } = useQuery<Appointment[]>({
    queryKey: ["/api/appointments", firstDayOfMonth.toISOString(), lastDayOfMonth.toISOString()],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate: firstDayOfMonth.toISOString(),
        endDate: lastDayOfMonth.toISOString(),
      });
      const response = await fetch(`/api/appointments?${params}`);
      if (!response.ok) throw new Error("Failed to fetch appointments");
      return response.json();
    },
  });

  // Check Google Calendar connection status
  const { data: googleStatus } = useQuery<{ connected: boolean; email: string | null; configured: boolean }>({
    queryKey: ["/api/google/status"],
  });

  // Fetch Google Calendar events if connected
  const { data: googleEvents = [] } = useQuery<GoogleEvent[]>({
    queryKey: ["/api/google/events", firstDayOfMonth.toISOString(), lastDayOfMonth.toISOString()],
    queryFn: async () => {
      if (!googleStatus?.connected) return [];
      
      const params = new URLSearchParams({
        startDate: firstDayOfMonth.toISOString(),
        endDate: lastDayOfMonth.toISOString(),
      });
      const response = await fetch(`/api/google/events?${params}`);
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!googleStatus?.connected,
  });

  // Disconnect Google Calendar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/google/disconnect", { method: "DELETE" });
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
      const response = await fetch("/api/google/auth/start");
      const data = await response.json();
      
      if (response.ok && data.authUrl) {
        window.open(data.authUrl, "_blank", "width=600,height=700");
        
        // Poll for connection status
        const pollInterval = setInterval(async () => {
          const statusResponse = await fetch("/api/google/status");
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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            size="sm"
            onClick={() => setAppointmentDialogOpen(true)}
            data-testid="button-new-appointment"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau rendez-vous
          </Button>
          
          <AppointmentDialog
            open={appointmentDialogOpen}
            onOpenChange={setAppointmentDialogOpen}
            selectedDate={currentDate}
          />
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
              size="sm"
              onClick={handleConnectGoogle}
              disabled={!googleStatus?.configured}
              data-testid="button-google-calendar"
            >
              <CalendarIcon className="w-4 h-4 mr-2" />
              {googleStatus?.configured ? "Connecter Google Calendar" : "Configurer Google OAuth"}
            </Button>
          )}
        </div>

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
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {viewMode === "week" && (
          <Card className="p-4">
            <div className="text-center text-muted-foreground">
              <p>Vue Semaine - À venir</p>
            </div>
          </Card>
        )}

        {viewMode === "day" && (
          <Card className="p-4">
            <div className="text-center text-muted-foreground">
              <p>Vue Jour - À venir</p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
