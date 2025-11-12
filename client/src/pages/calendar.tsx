import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus } from "lucide-react";

type ViewMode = "month" | "week" | "day";

export default function Calendar() {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentDate, setCurrentDate] = useState(new Date());

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
        <Card className="p-4">
          <div className="text-center text-muted-foreground">
            {viewMode === "month" && <p>Vue Mois - À implémenter</p>}
            {viewMode === "week" && <p>Vue Semaine - À implémenter</p>}
            {viewMode === "day" && <p>Vue Jour - À implémenter</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
