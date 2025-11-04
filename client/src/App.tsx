import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import CRM from "@/pages/crm";
import ClientDetail from "@/pages/client-detail";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Notes from "@/pages/notes";
import NoteNew from "@/pages/note-new";
import NoteDetail from "@/pages/note-detail";
import Documents from "@/pages/documents";
import Roadmap from "@/pages/roadmap";
import Product from "@/pages/product";
import Marketing from "@/pages/marketing";
import Finance from "@/pages/finance";
import Commercial from "@/pages/commercial";
import Legal from "@/pages/legal";
import Profile from "@/pages/profile";
import NotFound from "@/pages/not-found";
import { Bell, LogOut, Mail, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
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
      <Route path="/notes/new">
        <ProtectedRoute><NoteNew /></ProtectedRoute>
      </Route>
      <Route path="/notes/:id">
        <ProtectedRoute><NoteDetail /></ProtectedRoute>
      </Route>
      <Route path="/notes">
        <ProtectedRoute><Notes /></ProtectedRoute>
      </Route>
      <Route path="/documents">
        <ProtectedRoute><Documents /></ProtectedRoute>
      </Route>
      <Route path="/roadmap">
        <ProtectedRoute><Roadmap /></ProtectedRoute>
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
      <Route component={NotFound} />
    </Switch>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const handleLogout = async () => {
    await signOut();
    toast({
      title: "Déconnexion réussie",
      description: "À bientôt !",
    });
    setLocation("/login");
  };

  if (!user) return null;

  const userInitials = user.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <div className="flex items-center gap-2">
      <Avatar className="h-8 w-8">
        <AvatarFallback className="bg-violet-100 text-violet-700 text-xs">
          {userInitials}
        </AvatarFallback>
      </Avatar>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleLogout}
        data-testid="button-logout"
        title="Se déconnecter"
      >
        <LogOut className="w-4 h-4 text-primary" />
      </Button>
    </div>
  );
}

function AppLayout() {
  const [location] = useLocation();
  const isLoginPage = location === "/login";

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  const getPageTitle = (path: string) => {
    if (path === "/" || path === "/home") return "Tableau de bord";
    if (path === "/crm") return "CRM";
    if (path === "/projects" || path.startsWith("/projects/")) return "Projets et tâches";
    if (path === "/notes/new") return "Nouvelle note";
    if (path.startsWith("/notes/")) return "Note";
    if (path === "/notes") return "Notes";
    if (path === "/documents") return "Documents";
    if (path === "/roadmap") return "Roadmap";
    if (path === "/product") return "Produits";
    if (path === "/marketing") return "Marketing";
    if (path === "/finance") return "Finance";
    if (path === "/commercial") return "Commercial";
    if (path === "/legal") return "Légal";
    if (path === "/profile") return "Profil";
    return "";
  };

  if (isLoginPage) {
    return <Router />;
  }

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-card sticky top-0 z-10">
            <div className="flex items-center gap-2 sm:gap-3">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <h1 className="text-base sm:text-lg font-semibold text-foreground truncate" data-testid="page-title">
                {getPageTitle(location)}
              </h1>
            </div>
            <div className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="sm" data-testid="button-mail">
                <Mail className="w-5 h-5 text-primary" />
              </Button>
              <Button variant="ghost" size="sm" data-testid="button-calendar">
                <Calendar className="w-5 h-5 text-primary" />
              </Button>
              <Button variant="ghost" size="sm" className="relative" data-testid="button-notifications">
                <Bell className="w-5 h-5 text-primary" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
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
      <AuthProvider>
        <TooltipProvider>
          <AppLayout />
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
