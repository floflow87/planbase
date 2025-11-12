import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from "lucide-react";

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

export default function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Button 
            variant="default" 
            size="sm"
            data-testid="button-new-appointment"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau rendez-vous
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            data-testid="button-google-calendar"
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Connecter Google Calendar
          </Button>
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
                    
                    {/* Appointments */}
                    <div className="space-y-1">
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
                          >
                            <span className="font-medium">{startTime}</span> {apt.title}
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
