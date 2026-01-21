import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
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
import BacklogNew from "@/pages/backlog-new";
import BacklogDetail from "@/pages/backlog-detail";
import Marketing from "@/pages/marketing";
import Finance from "@/pages/finance";
import Commercial from "@/pages/commercial";
import Legal from "@/pages/legal";
import CalendarPage from "@/pages/calendar";
import Settings from "@/pages/settings";
import SharePublicPage from "@/pages/share-public";
import ProjectDecisions from "@/pages/project-decisions";
import ProjectExecutive from "@/pages/project-executive";
import AcceptInvitation from "@/pages/accept-invitation";
import NotFound from "@/pages/not-found";
import { LogOut, Mail, Calendar, Plus, X, User, Moon, Sun, Users, FolderKanban, CheckSquare, StickyNote } from "lucide-react";
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
import { UnifiedAvatar } from "@/onboarding/UnifiedAvatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/accept-invitation" component={AcceptInvitation} />
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
      <Route path="/projects/:projectId/decisions">
        <ProtectedRoute><ProjectDecisions /></ProtectedRoute>
      </Route>
      <Route path="/projects/:projectId/executive">
        <ProtectedRoute><ProjectExecutive /></ProtectedRoute>
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
      <Route path="/product/backlog/new">
        <ProtectedRoute><BacklogNew /></ProtectedRoute>
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
      <Route path="/calendar">
        <ProtectedRoute><CalendarPage /></ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute><Settings /></ProtectedRoute>
      </Route>
      <Route path="/share/:token" component={SharePublicPage} />
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
    setLocation("/settings");
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

// Schemas for quick create forms
const clientSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  type: z.enum(["company", "individual"]),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
});

const projectSchema = z.object({
  name: z.string().min(1, "Le nom est requis"),
  description: z.string().optional(),
  clientId: z.string().optional(),
  stage: z.enum(["prospection", "proposal", "negotiation", "signed", "in_progress", "completed", "lost"]),
});

const taskSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  projectId: z.string().optional(),
});

const noteSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
});

function QuickCreateMenu() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  
  const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
  const [isProjectSheetOpen, setIsProjectSheetOpen] = useState(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);

  // Get account ID from user metadata
  const accountId = user?.user_metadata?.account_id;

  // Fetch clients for project form
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: !!accountId,
  });

  // Fetch projects for task form
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ["/api/projects"],
    enabled: !!accountId,
  });

  // Forms
  const clientForm = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: "", type: "company" as const, email: "", phone: "" },
  });

  const projectForm = useForm({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", description: "", clientId: "", stage: "prospection" as const },
  });

  const taskForm = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", description: "", priority: "medium" as const, projectId: "" },
  });

  const noteForm = useForm({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "" },
  });

  // Mutations - Server adds accountId and createdBy from auth context
  const createClientMutation = useMutation({
    mutationFn: async (data: z.infer<typeof clientSchema>) => {
      return apiRequest("/api/clients", {
        method: "POST",
        body: JSON.stringify({ 
          name: data.name,
          type: data.type,
          contacts: data.email || data.phone ? [{ name: "", email: data.email || "", phone: data.phone || "", role: "" }] : [],
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Client créé avec succès" });
      setIsClientSheetOpen(false);
      clientForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async (data: z.infer<typeof projectSchema>) => {
      return apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify({ 
          name: data.name,
          description: data.description || null,
          stage: data.stage,
          clientId: data.clientId || null,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Projet créé avec succès" });
      setIsProjectSheetOpen(false);
      projectForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: z.infer<typeof taskSchema>) => {
      return apiRequest("/api/tasks", {
        method: "POST",
        body: JSON.stringify({ 
          title: data.title,
          description: data.description || null,
          priority: data.priority,
          projectId: data.projectId || null,
        }),
      });
    },
    onSuccess: () => {
      toast({ title: "Tâche créée avec succès" });
      setIsTaskSheetOpen(false);
      taskForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (data: z.infer<typeof noteSchema>) => {
      return apiRequest("/api/notes", "POST", { 
        title: data.title,
        content: [],
      });
    },
    onSuccess: (newNote: any) => {
      toast({ title: "Note créée avec succès" });
      setIsNoteSheetOpen(false);
      noteForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      if (newNote?.id) {
        setLocation(`/notes/${newNote.id}`);
      }
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  if (!user) return null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1" data-testid="button-quick-create">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Nouveau</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48 bg-card" data-testid="dropdown-quick-create">
          <DropdownMenuItem onClick={() => setIsClientSheetOpen(true)} className="cursor-pointer" data-testid="dropdown-new-client">
            <Users className="w-4 h-4 mr-2" />
            Nouveau client
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsProjectSheetOpen(true)} className="cursor-pointer" data-testid="dropdown-new-project">
            <FolderKanban className="w-4 h-4 mr-2" />
            Nouveau projet
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsTaskSheetOpen(true)} className="cursor-pointer" data-testid="dropdown-new-task">
            <CheckSquare className="w-4 h-4 mr-2" />
            Nouvelle tâche
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsNoteSheetOpen(true)} className="cursor-pointer" data-testid="dropdown-new-note">
            <StickyNote className="w-4 h-4 mr-2" />
            Nouvelle note
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Client Sheet */}
      <Sheet open={isClientSheetOpen} onOpenChange={setIsClientSheetOpen}>
        <SheetContent className="sm:max-w-md" data-testid="sheet-create-client">
          <SheetHeader>
            <SheetTitle>Nouveau client</SheetTitle>
          </SheetHeader>
          <Form {...clientForm}>
            <form onSubmit={clientForm.handleSubmit((data) => createClientMutation.mutate(data))} className="space-y-4 mt-4">
              <FormField
                control={clientForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-client-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={clientForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-client-type">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="company">Entreprise</SelectItem>
                        <SelectItem value="individual">Particulier</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={clientForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" data-testid="input-client-email" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={clientForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Téléphone</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-client-phone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsClientSheetOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" disabled={createClientMutation.isPending} className="flex-1" data-testid="button-submit-client">
                  Créer
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Project Sheet */}
      <Sheet open={isProjectSheetOpen} onOpenChange={setIsProjectSheetOpen}>
        <SheetContent className="sm:max-w-md" data-testid="sheet-create-project">
          <SheetHeader>
            <SheetTitle>Nouveau projet</SheetTitle>
          </SheetHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit((data) => createProjectMutation.mutate(data))} className="space-y-4 mt-4">
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nom</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-project-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-project-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project-client">
                          <SelectValue placeholder="Sélectionner un client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clients.map((client: any) => (
                          <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={projectForm.control}
                name="stage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Étape</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project-stage">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="prospection">Prospection</SelectItem>
                        <SelectItem value="proposal">Proposition</SelectItem>
                        <SelectItem value="negotiation">Négociation</SelectItem>
                        <SelectItem value="signed">Signé</SelectItem>
                        <SelectItem value="in_progress">En cours</SelectItem>
                        <SelectItem value="completed">Terminé</SelectItem>
                        <SelectItem value="lost">Perdu</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsProjectSheetOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending} className="flex-1" data-testid="button-submit-project">
                  Créer
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Task Sheet */}
      <Sheet open={isTaskSheetOpen} onOpenChange={setIsTaskSheetOpen}>
        <SheetContent className="sm:max-w-md" data-testid="sheet-create-task">
          <SheetHeader>
            <SheetTitle>Nouvelle tâche</SheetTitle>
          </SheetHeader>
          <Form {...taskForm}>
            <form onSubmit={taskForm.handleSubmit((data) => createTaskMutation.mutate(data))} className="space-y-4 mt-4">
              <FormField
                control={taskForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-task-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={taskForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea {...field} data-testid="input-task-description" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={taskForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projet</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-task-project">
                          <SelectValue placeholder="Sélectionner un projet" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((project: any) => (
                          <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={taskForm.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Priorité</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-task-priority">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="low">Basse</SelectItem>
                        <SelectItem value="medium">Moyenne</SelectItem>
                        <SelectItem value="high">Haute</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsTaskSheetOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" disabled={createTaskMutation.isPending} className="flex-1" data-testid="button-submit-task">
                  Créer
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Note Sheet */}
      <Sheet open={isNoteSheetOpen} onOpenChange={setIsNoteSheetOpen}>
        <SheetContent className="sm:max-w-md" data-testid="sheet-create-note">
          <SheetHeader>
            <SheetTitle>Nouvelle note</SheetTitle>
          </SheetHeader>
          <Form {...noteForm}>
            <form onSubmit={noteForm.handleSubmit((data) => createNoteMutation.mutate(data))} className="space-y-4 mt-4">
              <FormField
                control={noteForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titre</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-note-title" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsNoteSheetOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" disabled={createNoteMutation.isPending} className="flex-1" data-testid="button-submit-note">
                  Créer
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>
    </>
  );
}

interface Tab {
  id: string;
  path: string;
  title: string;
}

function AppLayout() {
  const [location, setLocation] = useLocation();
  const isAuthPage = location === "/login" || location === "/signup" || location.startsWith("/accept-invitation");
  const isStandalone = useIsStandalone();
  const { user } = useAuth();
  
  // Get account ID for multi-tenant tab storage
  const accountId = user?.user_metadata?.account_id;
  
  // Default tabs state
  const defaultTabs: Tab[] = [{ id: '1', path: '/', title: 'Tableau de bord' }];
  
  // Tab system state - initialize to default, load from localStorage when accountId is known
  const [tabs, setTabs] = useState<Tab[]>(defaultTabs);
  const [activeTabId, setActiveTabId] = useState<string>('1');
  const [prevAccountId, setPrevAccountId] = useState<string | undefined>(undefined);
  
  // Load/reset tabs when account changes
  useEffect(() => {
    if (accountId && accountId !== prevAccountId) {
      setPrevAccountId(accountId);
      const tabsKey = `headerTabs_${accountId}`;
      const activeKey = `activeTabId_${accountId}`;
      
      const savedTabs = localStorage.getItem(tabsKey);
      if (savedTabs) {
        try {
          setTabs(JSON.parse(savedTabs));
        } catch {
          setTabs(defaultTabs);
        }
      } else {
        setTabs(defaultTabs);
      }
      
      const savedActiveTab = localStorage.getItem(activeKey);
      setActiveTabId(savedActiveTab || '1');
    } else if (!accountId && prevAccountId) {
      // User logged out - reset to default
      setPrevAccountId(undefined);
      setTabs(defaultTabs);
      setActiveTabId('1');
    }
  }, [accountId, prevAccountId]);
  
  // Helper to get storage keys (only valid when accountId exists)
  const tabsStorageKey = accountId ? `headerTabs_${accountId}` : null;
  const activeTabStorageKey = accountId ? `activeTabId_${accountId}` : null;

  const style = {
    "--sidebar-width": "15.375rem",
    "--sidebar-width-icon": "4.25rem",
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
        if (tabsStorageKey) {
          localStorage.setItem(tabsStorageKey, JSON.stringify(updatedTabs));
        }
        return updatedTabs;
      });
    }
  }, [location, isAuthPage, tabsStorageKey]);

  // Save active tab ID to localStorage
  useEffect(() => {
    if (activeTabStorageKey) {
      localStorage.setItem(activeTabStorageKey, activeTabId);
    }
  }, [activeTabId, activeTabStorageKey]);

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
    if (tabsStorageKey) {
      localStorage.setItem(tabsStorageKey, JSON.stringify(newTabs));
    }
    setActiveTabId(newTab.id);
    // Don't navigate - new tab starts at current location, user can then navigate elsewhere
  };

  const handleCloseTab = (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    
    if (tabs.length <= 1) return;
    
    const tabIndex = tabs.findIndex(t => t.id === tabId);
    const newTabs = tabs.filter(t => t.id !== tabId);
    setTabs(newTabs);
    if (tabsStorageKey) {
      localStorage.setItem(tabsStorageKey, JSON.stringify(newTabs));
    }
    
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
                      group flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium 
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
              <QuickCreateMenu />
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
          <OnboardingProvider>
            <TooltipProvider>
              <AppLayout />
              <UnifiedAvatar />
              <Toaster />
            </TooltipProvider>
          </OnboardingProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
