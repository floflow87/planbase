import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import CRM from "@/pages/crm";
import ClientDetail from "@/pages/client-detail";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Tasks from "@/pages/tasks";
import Notes from "@/pages/notes";
import NoteNew from "@/pages/note-new";
import NoteDetail from "@/pages/note-detail";
import Documents from "@/pages/documents";
import DocumentTemplates from "@/pages/documents-templates";
import DocumentTemplateForm from "@/pages/documents-template-form";
import DocumentDetail from "@/pages/document-detail";
import Mindmaps from "@/pages/mindmaps";
import MindmapDetail from "@/pages/mindmap-detail";
import Roadmap from "@/pages/roadmap";
import Product from "@/pages/product";
import BacklogDetail from "@/pages/backlog-detail";
import Marketing from "@/pages/marketing";
import Finance from "@/pages/finance";
import Commercial from "@/pages/commercial";
import Legal from "@/pages/legal";
import Profile from "@/pages/profile";
import CalendarPage from "@/pages/calendar";
import Settings from "@/pages/settings";
import NotFound from "@/pages/not-found";
import { LogOut, Mail, Calendar, Plus, X, User, Moon, Sun } from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { SafeAreaTopBar, useIsStandalone } from "@/design-system/primitives/SafeAreaTopBar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TimeTracker } from "@/components/TimeTracker";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/home">
        <ProtectedRoute><Dashboard /></ProtectedRoute>
      </Route>
      <Route path="/crm/:id">
        <ProtectedRoute><ClientDetail /></ProtectedRoute>
      </Route>
      <Route path="/crm">
        <ProtectedRoute><CRM /></ProtectedRoute>
      </Route>
      <Route path="/projects/:id">
        <ProtectedRoute><ProjectDetail /></ProtectedRoute>
      </Route>
      <Route path="/projects">
        <ProtectedRoute><Projects /></ProtectedRoute>
      </Route>
      <Route path="/tasks">
        <ProtectedRoute><Tasks /></ProtectedRoute>
      </Route>
      <Route path="/notes/new">
        <ProtectedRoute><NoteNew /></ProtectedRoute>
      </Route>
      <Route path="/notes/:id">
        <ProtectedRoute><NoteDetail /></ProtectedRoute>
      </Route>
      <Route path="/notes">
        <ProtectedRoute><Notes /></ProtectedRoute>
      </Route>
      <Route path="/documents/templates/:id">
        <ProtectedRoute><DocumentTemplateForm /></ProtectedRoute>
      </Route>
      <Route path="/documents/templates">
        <ProtectedRoute><DocumentTemplates /></ProtectedRoute>
      </Route>
      <Route path="/documents/:id">
        <ProtectedRoute><DocumentDetail /></ProtectedRoute>
      </Route>
      <Route path="/documents">
        <ProtectedRoute><Documents /></ProtectedRoute>
      </Route>
      <Route path="/mindmaps/:id">
        <ProtectedRoute><MindmapDetail /></ProtectedRoute>
      </Route>
      <Route path="/mindmaps">
        <ProtectedRoute><Mindmaps /></ProtectedRoute>
      </Route>
      <Route path="/roadmap">
        <ProtectedRoute><Roadmap /></ProtectedRoute>
      </Route>
      <Route path="/product/backlog/:id">
        <ProtectedRoute><BacklogDetail /></ProtectedRoute>
      </Route>
      <Route path="/product">
        <ProtectedRoute><Product /></ProtectedRoute>
      </Route>
      <Route path="/marketing">
        <ProtectedRoute><Marketing /></ProtectedRoute>
      </Route>
      <Route path="/finance">
        <ProtectedRoute><Finance /></ProtectedRoute>
      </Route>
      <Route path="/commercial">
        <ProtectedRoute><Commercial /></ProtectedRoute>
      </Route>
      <Route path="/legal">
        <ProtectedRoute><Legal /></ProtectedRoute>
      </Route>
      <Route path="/profile">
        <ProtectedRoute><Profile /></ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <ProtectedRoute><CalendarPage /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><Settings /></ProtectedRoute>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await signOut();
    setLocation("/login");
  };

  const handleProfile = () => {
    setLocation("/profile");
  };

  if (!user) return null;

  const userInitials = user.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full cursor-pointer" data-testid="button-user-menu">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-xs">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={handleProfile} className="cursor-pointer" data-testid="dropdown-profile">
          <User className="w-4 h-4 mr-2" />
          Mon profil
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer" data-testid="dropdown-theme-toggle">
          {theme === "dark" ? (
            <>
              <Sun className="w-4 h-4 mr-2" />
              Mode clair
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 mr-2" />
              Mode sombre
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer" data-testid="dropdown-logout">
          <LogOut className="w-4 h-4 mr-2" />
          Déconnexion
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface Tab {
  id: string;
  path: string;
  title: string;
}

function AppLayout() {
  const [location, setLocation] = useLocation();
  const isAuthPage = location === "/login" || location === "/signup";
  const isStandalone = useIsStandalone();
  
  // Tab system state with localStorage persistence
  const [tabs, setTabs] = useState<Tab[]>(() => {
    const saved = localStorage.getItem('headerTabs');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return [{ id: '1', path: '/', title: 'Tableau de bord' }];
      }
    }
    return [{ id: '1', path: '/', title: 'Tableau de bord' }];
  });
  const [activeTabId, setActiveTabId] = useState<string>(() => {
    const saved = localStorage.getItem('activeTabId');
    return saved || '1';
  });

  const style = {
    "--sidebar-width": "15.375rem",
    "--sidebar-width-icon": "3.5rem",
  };

  const getPageTitle = (path: string) => {
    if (path === "/" || path === "/home") return "Tableau de bord";
    if (path === "/crm") return "CRM";
    if (path === "/projects" || path.startsWith("/projects/")) return "Projets";
    if (path === "/tasks") return "Tâches";
    if (path === "/notes/new") return "Nouvelle note";
    if (path.startsWith("/notes/")) return "Note";
    if (path === "/notes") return "Notes";
    if (path === "/documents") return "Documents";
    if (path.startsWith("/documents/templates")) return "Modèles";
    if (path.startsWith("/documents/")) return "Document";
    if (path.startsWith("/mindmaps/")) return "Mindmap";
    if (path === "/mindmaps") return "Mindmaps";
    if (path === "/roadmap") return "Roadmap";
    if (path === "/product") return "Produits";
    if (path === "/marketing") return "Marketing";
    if (path === "/finance") return "Finance";
    if (path === "/commercial") return "Commercial";
    if (path === "/legal") return "Légal";
    if (path === "/profile") return "Profil";
    if (path === "/calendar") return "Calendrier";
    if (path === "/settings") return "Paramètres";
    return "Page";
  };

  // Sync tabs with navigation - update active tab's content when location changes
  useEffect(() => {
    if (isAuthPage) return;
    
    const title = getPageTitle(location);
    
    // Check if this path already exists in another tab
    const existingTab = tabs.find(tab => tab.path === location);
    
    if (existingTab && existingTab.id !== activeTabId) {
      // Path already open in another tab - switch to that tab
      setActiveTabId(existingTab.id);
    } else {
      // Update the active tab's path and title
      setTabs(prevTabs => {
        const updatedTabs = prevTabs.map(tab => 
          tab.id === activeTabId 
            ? { ...tab, path: location, title }
            : tab
        );
        localStorage.setItem('headerTabs', JSON.stringify(updatedTabs));
        return updatedTabs;
      });
    }
  }, [location, isAuthPage]);

  // Save active tab ID to localStorage
  useEffect(() => {
    localStorage.setItem('activeTabId', activeTabId);
  }, [activeTabId]);

  const handleTabClick = (tab: Tab) => {
    setActiveTabId(tab.id);
    setLocation(tab.path);
  };

  const handleAddTab = () => {
    if (tabs.length >= 5) return;
    
    // Create new tab with current location (so user can navigate from it)
    const newTab: Tab = {
      id: Date.now().toString(),
      path: location,
      title: getPageTitle(location)
    };
    
    const newTabs = [...tabs, newTab];
    setTabs(newTabs);
    localStorage.setItem('headerTabs', JSON.stringify(newTabs));
    setActiveTabId(newTab.id);
    // Don't navigate - new tab starts at current location, user can then navigate elsewhere
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    
    if (tabs.length <= 1) return;
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    localStorage.setItem('headerTabs', JSON.stringify(newTabs));
    
    // If closing active tab, switch to adjacent tab
    if (activeTabId === tabId) {
      const newActiveTab = newTabs[Math.min(tabIndex, newTabs.length - 1)];
      setActiveTabId(newActiveTab.id);
      setLocation(newActiveTab.path);
    }
  };

  if (isAuthPage) {
    return (
      <>
        <SafeAreaTopBar />
        <div 
          className="min-h-screen"
          style={isStandalone ? { paddingTop: "var(--safe-top, 0px)" } : undefined}
        >
          <Router />
        </div>
      </>
    );
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <SafeAreaTopBar />
      <div 
        className="flex h-screen w-full bg-background"
        style={isStandalone ? { paddingTop: "var(--safe-top, 0px)" } : undefined}
      >
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden bg-card">
          <header className="flex items-center justify-between h-14 px-2 sm:px-4 border-b border-border bg-card shrink-0">
            <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" className="flex-shrink-0" />
              
              {/* Tab System */}
              <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => (
                  <div
                    key={tab.id}
                    onClick={() => handleTabClick(tab)}
                    className={`
                      group flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-xs sm:text-sm font-medium 
                      transition-colors min-w-0 max-w-[120px] sm:max-w-[160px] flex-shrink-0 cursor-pointer
                      ${activeTabId === tab.id 
                        ? 'bg-primary/10 text-primary border border-primary/20' 
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      }
                    `}
                    data-testid={`tab-${tab.id}`}
                  >
                    <span className="truncate">{tab.title}</span>
                    {tabs.length > 1 && (
                      <button
                        onClick={(e) => handleCloseTab(e, tab.id)}
                        className={`
                          flex-shrink-0 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive
                          ${activeTabId === tab.id ? 'visible' : 'invisible group-hover:visible'}
                        `}
                        data-testid={`close-tab-${tab.id}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Add Tab Button */}
                {tabs.length < 5 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleAddTab}
                    className="h-7 w-7 p-0 flex-shrink-0"
                    data-testid="button-add-tab"
                    title="Nouvel onglet"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <TimeTracker />
              <Button variant="ghost" size="icon" data-testid="button-mail">
                <Mail className="w-4 h-4 text-primary" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setLocation("/calendar")}
                data-testid="button-calendar"
              >
                <Calendar className="w-4 h-4 text-primary" />
              </Button>
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-hidden">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <AppLayout />
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
