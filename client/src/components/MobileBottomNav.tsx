import { useState } from "react";
import { useLocation } from "wouter";
import {
  CheckSquare,
  FileText,
  Users,
  MoreHorizontal,
  Plus,
  FolderKanban,
  StickyNote,
  UserPlus,
  ListTodo,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";

interface MobileBottomNavProps {
  onOpenMore: () => void;
}

export function MobileBottomNav({ onOpenMore }: MobileBottomNavProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (!user) return null;
  if (location === "/login" || location === "/signup") return null;

  const isActive = (path: string) =>
    location === path || location.startsWith(path + "/");

  const navTo = (path: string) => () => setLocation(path);

  const createActions: { label: string; icon: typeof Plus; onClick: () => void }[] = [
    {
      label: "Nouvelle note",
      icon: StickyNote,
      onClick: () => {
        setIsCreateOpen(false);
        setLocation("/notes/new");
      },
    },
    {
      label: "Nouvelle tâche",
      icon: ListTodo,
      onClick: () => {
        setIsCreateOpen(false);
        setLocation("/tasks");
      },
    },
    {
      label: "Nouveau projet",
      icon: FolderKanban,
      onClick: () => {
        setIsCreateOpen(false);
        setLocation("/projects");
      },
    },
    {
      label: "Nouveau client",
      icon: UserPlus,
      onClick: () => {
        setIsCreateOpen(false);
        setLocation("/crm");
      },
    },
  ];

  return (
    <div
      className="md:hidden fixed left-1/2 -translate-x-1/2 z-50 pointer-events-none"
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
    >
      <div
        className="pointer-events-auto flex items-center gap-1 rounded-full border bg-background/95 backdrop-blur-md px-2 py-2"
        style={{
          boxShadow:
            "0 8px 24px -8px rgba(0,0,0,0.18), 0 2px 6px -2px rgba(0,0,0,0.08)",
        }}
        data-testid="mobile-bottom-nav"
      >
        <NavButton
          label="Tâches"
          icon={CheckSquare}
          active={isActive("/tasks")}
          onClick={navTo("/tasks")}
          testId="button-mobile-nav-tasks"
        />
        <NavButton
          label="Notes"
          icon={FileText}
          active={isActive("/notes")}
          onClick={navTo("/notes")}
          testId="button-mobile-nav-notes"
        />

        <Popover open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label="Nouveau"
              data-testid="button-mobile-nav-create"
              className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground hover-elevate active-elevate-2"
            >
              <Plus className="h-6 w-6" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="center"
            sideOffset={12}
            className="w-56 p-1"
          >
            <div className="flex flex-col">
              {createActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    data-testid={`button-mobile-create-${action.label}`}
                    className="flex items-center gap-3 rounded-md px-3 py-2 text-left text-sm hover-elevate active-elevate-2"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </PopoverContent>
        </Popover>

        <NavButton
          label="CRM"
          icon={Users}
          active={isActive("/crm")}
          onClick={navTo("/crm")}
          testId="button-mobile-nav-crm"
        />
        <NavButton
          label="Plus"
          icon={MoreHorizontal}
          active={false}
          onClick={onOpenMore}
          testId="button-mobile-nav-more"
        />
      </div>
    </div>
  );
}

function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
  testId,
}: {
  label: string;
  icon: typeof Plus;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      data-testid={testId}
      className={`flex h-10 w-10 items-center justify-center rounded-full hover-elevate active-elevate-2 ${
        active ? "text-foreground" : "text-muted-foreground"
      }`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}
