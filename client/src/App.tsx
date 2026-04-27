import TestEnums from "@/pages/test-enums";
import ConfigDebug from "@/pages/config-debug";
import { useConfigAll } from "@/hooks/useConfigAll";
import { getEnum } from "@/lib/enums";
import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
import { OnboardingProvider } from "@/contexts/OnboardingContext";
import { LanguageProvider, useLanguage } from "@/contexts/LanguageContext";
import { PreferencesProvider } from "@/contexts/PreferencesContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "@/pages/login";
import Signup from "@/pages/signup";
import Dashboard from "@/pages/dashboard";
import CRM from "@/pages/crm";
import ClientDetail from "@/pages/client-detail";
import Projects from "@/pages/projects";
import ProjectDetail from "@/pages/project-detail";
import Tasks from "@/pages/tasks";
import FilesPage from "@/pages/files";
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
import TreasuryPage from "@/pages/treasury";
import Pricing from "@/pages/pricing";
import Commercial from "@/pages/commercial";
import Legal from "@/pages/legal";
import CalendarPage from "@/pages/calendar";
import Settings from "@/pages/settings";
import IntegrationDetailPage from "@/pages/integration-detail";
import SharePublicPage from "@/pages/share-public";
import ProjectDecisions from "@/pages/project-decisions";
import ProjectExecutive from "@/pages/project-executive";
import AcceptInvitation from "@/pages/accept-invitation";
import Emails from "@/pages/emails";
import EmailTemplates from "@/pages/email-templates";
import NotFound from "@/pages/not-found";
import { EmailComposeModal } from "@/components/EmailComposeModal";
import { LogOut, Mail, Calendar, Plus, X, User, Moon, Sun, Users, FolderKanban, CheckSquare, StickyNote, CalendarPlus, MoreVertical, Timer } from "lucide-react";
import { TrialBanner, TrialExpiredGate } from "@/components/billing/PremiumGate";
import { AiAssistant } from "@/components/ai/AiAssistant";
import { AppointmentPanel } from "@/components/appointment-panel";
import { MobileSidebarSheet } from "@/components/MobileSidebarSheet";
import { useState, useEffect } from "react";
import { DndContext, DragEndEvent, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from "@/components/ui/button";
import { SafeAreaTopBar, useIsStandalone } from "@/design-system/primitives/SafeAreaTopBar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TimeTracker } from "@/components/TimeTracker";
import { GlobalSearch } from "@/components/GlobalSearch";
import { CelebrationLayer } from "@/components/CelebrationLayer";
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
import { apiRequest, formatDateForStorage } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useProjectStagesUI } from "@/hooks/useProjectStagesUI";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { format as formatDate } from "date-fns";
import { fr } from "date-fns/locale";
import { Label } from "@/components/ui/label";

type Category = { key: string; label: string };

function RedirectToFiles() {
  const [, setLocation] = useLocation();
  useEffect(() => { setLocation("/files"); }, []);
  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/signup" component={Signup} />
      <Route path="/test-enums">
        <ProtectedRoute><TestEnums /></ProtectedRoute>
      </Route>
      <Route path="/config-debug">
        <ProtectedRoute><ConfigDebug /></ProtectedRoute>
      </Route>
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
      <Route path="/files">
        <ProtectedRoute><FilesPage /></ProtectedRoute>
      </Route>
      <Route path="/notes/new">
        <ProtectedRoute><NoteNew /></ProtectedRoute>
      </Route>
      <Route path="/notes/:id">
        {(params) => <ProtectedRoute><NoteDetail key={(params as any).id} /></ProtectedRoute>}
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
        <ProtectedRoute><RedirectToFiles /></ProtectedRoute>
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
      <Route path="/cashflow">
        <ProtectedRoute><TreasuryPage /></ProtectedRoute>
      </Route>
      <Route path="/commercial">
        <ProtectedRoute><Commercial /></ProtectedRoute>
      </Route>
      <Route path="/legal">
        <ProtectedRoute><Legal /></ProtectedRoute>
      </Route>
      <Route path="/emails">
        <ProtectedRoute><Emails /></ProtectedRoute>
      </Route>
      <Route path="/email-templates">
        <ProtectedRoute><EmailTemplates /></ProtectedRoute>
      </Route>
      <Route path="/calendar">
        <ProtectedRoute><CalendarPage /></ProtectedRoute>
      </Route>
      <Route path="/pricing">
        <Pricing />
      </Route>
      <Route path="/settings">
        <ProtectedRoute><Settings /></ProtectedRoute>
      </Route>
      <Route path="/settings/integrations/:integrationId">
        <ProtectedRoute><IntegrationDetailPage /></ProtectedRoute>
      </Route>
      <Route path="/share/:token" component={SharePublicPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UserMenu() {
  const { user, userProfile, signOut } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();

  const handleLogout = async () => {
    await signOut();
    setLocation("/login");
  };

  const handleProfile = () => {
    setLocation("/settings");
  };

  if (!user) return null;

  // Priority: FirstName + LastName initials, then email first 2 chars
  const userInitials = userProfile?.firstName && userProfile?.lastName
    ? `${userProfile.firstName[0]}${userProfile.lastName[0]}`.toUpperCase()
    : user.email?.substring(0, 2).toUpperCase() || "U";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full cursor-pointer" data-testid="button-user-menu">
          <Avatar className="h-8 w-8">
            <AvatarImage src={userProfile?.avatarUrl || ""} alt={userInitials} />
            <AvatarFallback className="bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300 text-xs">
              {userInitials}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 text-xs">
        <DropdownMenuItem onClick={handleProfile} className="cursor-pointer text-xs" data-testid="dropdown-profile">
          <User className="w-3.5 h-3.5 mr-2" />
          {t.header.myProfile}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={toggleTheme} className="cursor-pointer text-xs" data-testid="dropdown-theme-toggle">
          {resolvedTheme === "dark" ? (
            <>
              <Sun className="w-3.5 h-3.5 mr-2" />
              {t.header.lightMode}
            </>
          ) : (
            <>
              <Moon className="w-3.5 h-3.5 mr-2" />
              {t.header.darkMode}
            </>
          )}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer text-xs" data-testid="dropdown-logout">
          <LogOut className="w-3.5 h-3.5 mr-2" />
          {t.header.logout}
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
  stage: z.string().min(1, "Le stage est requis"),

  type: z.string().optional(),      
  category: z.string().optional(),

  startDate: z.date().optional().nullable(),
  endDate: z.date().optional().nullable(),
  budget: z.string().optional(),
});

const taskSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]),
  projectId: z.string().optional(),
});

const noteSchema = z.object({
  title: z.string().min(1, "Le titre est requis"),
  clientId: z.string().optional().nullable(),
  projectId: z.string().optional().nullable(),
  noteDate: z.date().optional().nullable(),
});

function QuickCreateMenu() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useLanguage();
  const [, setLocation] = useLocation();
  
  const [isClientSheetOpen, setIsClientSheetOpen] = useState(false);
  const [isProjectSheetOpen, setIsProjectSheetOpen] = useState(false);
  const [isTaskSheetOpen, setIsTaskSheetOpen] = useState(false);
  const [isNoteSheetOpen, setIsNoteSheetOpen] = useState(false);
  const [isAppointmentPanelOpen, setIsAppointmentPanelOpen] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [composeInitial, setComposeInitial] = useState<any>({});
  const [isMobileCreateOpen, setIsMobileCreateOpen] = useState(false);

  const { data: gmailStatus } = useQuery<{ connected: boolean; email?: string; canSend?: boolean }>({
    queryKey: ["/api/gmail/status"],
  });

  const { data: crmContacts = [] } = useQuery<{ id: string; fullName: string; email: string | null }[]>({
    queryKey: ["/api/contacts"],
    enabled: isComposeOpen,
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("/api/gmail/send", "POST", data);
      return res.json();
    },
    onSuccess: () => {
      setIsComposeOpen(false);
      toast({
        title: "Email envoyé",
        className: "border-green-500 bg-green-50 text-green-900 dark:bg-green-900/20 dark:text-green-100 dark:border-green-600",
      });
    },
    onError: () => {
      toast({ title: "Erreur", description: "Envoi échoué.", variant: "destructive" });
    },
  });

  // Get account ID from user metadata
  const accountId = user?.user_metadata?.account_id;

  // Fetch clients for project form
  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    enabled: !!accountId,
  });

  // Fetch projects for task form
  const { data: configAll } = useConfigAll();
  const { visibleStages: dynamicProjectStages } = useProjectStagesUI();

  const projectTypes = getEnum<string>(configAll, "project_types", []);
  const projectCategories = getEnum<Category>(configAll, "project_categories", []);
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
    defaultValues: {
      name: "",
      description: "",
      clientId: "",
      stage: "prospection" as const,
      type: "",          
      category: "",
      startDate: null as Date | null,
      endDate: null as Date | null,
      budget: "",
    },
  });

  const taskForm = useForm({
    resolver: zodResolver(taskSchema),
    defaultValues: { title: "", type: "", description: "", priority: "medium" as const, projectId: "" },
  });

  const noteForm = useForm({
    resolver: zodResolver(noteSchema),
    defaultValues: { title: "", clientId: null as string | null, projectId: null as string | null, noteDate: null as Date | null },
  });

  // Mutations - Server adds accountId and createdBy from auth context
  const createClientMutation = useMutation({
    mutationFn: async (data: z.infer<typeof clientSchema>) => {
      return apiRequest("/api/clients", "POST", { 
        name: data.name,
        type: data.type,
        contacts: data.email || data.phone ? [{ name: "", email: data.email || "", phone: data.phone || "", role: "" }] : [],
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
      const res = await apiRequest("/api/projects", "POST", { 
        name: data.name,
        description: data.description || null,
        stage: data.stage,
        clientId: data.clientId || null,
        type: data.type?.trim() || null,
        category: data.category?.trim() || null,
        startDate: data.startDate ? formatDateForStorage(data.startDate) : null,
        endDate: data.endDate ? formatDateForStorage(data.endDate) : null,
        budget: data.budget?.trim() || null,
      });
      return res.json();
    },
    onSuccess: (newProject: any) => {
      toast({ title: "Projet créé avec succès" });
      setIsProjectSheetOpen(false);
      projectForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      if (newProject?.id) {
        setLocation(`/projects/${newProject.id}?openCdc=true`);
      }
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: z.infer<typeof taskSchema>) => {
      return apiRequest("/api/tasks", "POST", { 
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        projectId: data.projectId || null,
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
      const res = await apiRequest("/api/notes", "POST", { 
        title: data.title,
        content: [],
        noteDate: data.noteDate ? formatDate(data.noteDate, "yyyy-MM-dd") : null,
      });
      const newNote = await res.json();
      if (data.clientId) {
        await apiRequest(`/api/notes/${newNote.id}/links`, "POST", { targetType: "client", targetId: data.clientId });
      }
      if (data.projectId) {
        await apiRequest(`/api/notes/${newNote.id}/links`, "POST", { targetType: "project", targetId: data.projectId });
      }
      return newNote;
    },
    onSuccess: (newNote: any) => {
      toast({ title: "Note créée avec succès", variant: "success" });
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

  const gmailConnected = gmailStatus?.canSend === true;

  const quickActions = [
    { label: t.common.client, icon: Users, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400", onClick: () => setIsClientSheetOpen(true), testId: "dropdown-new-client", disabled: false },
    { label: t.nav.projects, icon: FolderKanban, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400", onClick: () => setIsProjectSheetOpen(true), testId: "dropdown-new-project", disabled: false },
    { label: t.nav.tasks, icon: CheckSquare, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400", onClick: () => setIsTaskSheetOpen(true), testId: "dropdown-new-task", disabled: false },
    { label: t.nav.notes, icon: StickyNote, color: "bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400", onClick: () => createNoteMutation.mutate({ title: "", clientId: null, projectId: null, noteDate: null }), testId: "dropdown-new-note", disabled: false },
    { label: t.common.appointment, icon: CalendarPlus, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", onClick: () => setIsAppointmentPanelOpen(true), testId: "dropdown-new-appointment", disabled: false },
    { label: t.nav.emails, icon: Mail, color: gmailConnected ? "bg-sky-100 text-sky-600 dark:bg-sky-900/40 dark:text-sky-400" : "bg-muted text-muted-foreground", onClick: () => { setComposeInitial({ to: "", subject: "", body: "" }); setIsComposeOpen(true); }, testId: "dropdown-new-email", disabled: !gmailConnected },
  ];

  return (
    <>
      {/* Desktop: Popover */}
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" className="hidden sm:flex gap-1" data-testid="button-quick-create">
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">{t.common.new}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-3" data-testid="dropdown-quick-create">
          <p className="text-xs font-medium text-muted-foreground mb-2">{t.common.create}</p>
          <div className="grid grid-cols-3 gap-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.disabled ? undefined : action.onClick}
                disabled={action.disabled}
                title={action.disabled && action.testId === "dropdown-new-email" ? "Gmail non connecté" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-2 rounded-md",
                  action.disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover-elevate active-elevate-2 cursor-pointer"
                )}
                data-testid={action.testId}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center ${action.color}`}>
                  <action.icon className="w-4 h-4" />
                </div>
                <span className="text-[10px] font-medium text-foreground/80 leading-tight text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Mobile: bottom sheet */}
      <Button
        size="icon"
        className="sm:hidden"
        onClick={() => setIsMobileCreateOpen(true)}
        data-testid="button-quick-create-mobile"
      >
        <Plus className="w-4 h-4" />
      </Button>
      <Sheet open={isMobileCreateOpen} onOpenChange={setIsMobileCreateOpen}>
        <SheetContent side="bottom" className="h-auto rounded-t-xl bg-card pb-8" data-testid="sheet-mobile-create">
          <SheetHeader className="pb-2">
            <SheetTitle className="text-base">{t.common.create}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-3 pt-2">
            {quickActions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={action.disabled ? undefined : () => { setIsMobileCreateOpen(false); action.onClick(); }}
                disabled={action.disabled}
                title={action.disabled && action.testId === "dropdown-new-email" ? "Gmail non connecté" : undefined}
                className={cn(
                  "flex flex-col items-center gap-2 p-3 rounded-xl",
                  action.disabled
                    ? "opacity-40 cursor-not-allowed"
                    : "hover-elevate active-elevate-2 cursor-pointer"
                )}
                data-testid={`mobile-${action.testId}`}
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${action.color}`}>
                  <action.icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-medium text-foreground/80 leading-tight text-center">{action.label}</span>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

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
                    <Select onValueChange={field.onChange} value={field.value || ""}>
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
        <SheetContent className="sm:max-w-2xl w-full flex flex-col h-full" data-testid="sheet-create-project">
          <SheetHeader className="shrink-0">
            <SheetTitle>Créer un nouveau projet</SheetTitle>
          </SheetHeader>
          <Form {...projectForm}>
            <form onSubmit={projectForm.handleSubmit((data) => createProjectMutation.mutate(data))} className="flex flex-col flex-1 min-h-0 mt-4">
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              <FormField
                control={projectForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-[12px]">Nom du projet *</Label>
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
                    <Label className="text-[12px]">Description</Label>
                    <FormControl>
                      <Textarea {...field} rows={3} data-testid="input-project-description" />
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
                    <Label className="text-[12px]">Client</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-project-client">
                          <SelectValue placeholder="Sélectionner un client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-popover">
                        {clients.map((client: any) => (
                          <SelectItem key={client.id} value={client.id} className="cursor-pointer">{client.company || client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={projectForm.control}
                  name="stage"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-[12px]">Étape</Label>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project-stage">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="bg-popover">
                          {dynamicProjectStages.map((stage: any) => (
                            <SelectItem key={stage.key} value={stage.key} className="cursor-pointer">
                              {stage.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-[12px]">Type</Label>

                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project-type">
                            <SelectValue placeholder="Choisir un type" />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent className="bg-popover">
                          {projectTypes.map((t) => (
                            <SelectItem key={t} value={t} className="cursor-pointer">
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={projectForm.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <Label className="text-[12px]">Catégorie</Label>

                      <Select onValueChange={field.onChange} value={field.value || ""}>
                        <FormControl>
                          <SelectTrigger data-testid="select-project-category">
                            <SelectValue placeholder="Choisir une catégorie" />
                          </SelectTrigger>
                        </FormControl>

                        <SelectContent className="bg-popover">
                          {projectCategories.map((cat) => (
                            <SelectItem key={cat.key} value={cat.key} className="cursor-pointer">
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-[12px]">Date de début</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-project-start-date"
                        type="button"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {projectForm.watch("startDate") ? (
                          formatDate(projectForm.watch("startDate")!, "PPP", { locale: fr })
                        ) : (
                          <span className="text-muted-foreground">Choisir une date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" style={{ zIndex: 9999 }}>
                      <CalendarWidget
                        mode="single"
                        selected={projectForm.watch("startDate") || undefined}
                        onSelect={(date) => projectForm.setValue("startDate", date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label className="text-[12px]">Date de fin</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="w-full justify-start text-left font-normal"
                        data-testid="button-project-end-date"
                        type="button"
                      >
                        <Calendar className="mr-2 h-4 w-4" />
                        {projectForm.watch("endDate") ? (
                          formatDate(projectForm.watch("endDate")!, "PPP", { locale: fr })
                        ) : (
                          <span className="text-muted-foreground">Choisir une date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" style={{ zIndex: 9999 }}>
                      <CalendarWidget
                        mode="single"
                        selected={projectForm.watch("endDate") || undefined}
                        onSelect={(date) => projectForm.setValue("endDate", date || null)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
              <FormField
                control={projectForm.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <Label className="text-[12px]">Budget (€)</Label>
                    <FormControl>
                      <Input type="number" {...field} data-testid="input-project-budget" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
              <div className="flex gap-2 pt-4 shrink-0">
                <Button type="button" variant="outline" onClick={() => setIsProjectSheetOpen(false)} className="flex-1">
                  Annuler
                </Button>
                <Button type="submit" disabled={createProjectMutation.isPending} className="flex-1" data-testid="button-submit-project">
                  Créer le projet
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
              <FormField
                control={noteForm.control}
                name="clientId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client (optionnel)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "__none__" ? null : v)} value={field.value ?? "__none__"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-note-client">
                          <SelectValue placeholder="Aucun client" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun client</SelectItem>
                        {clients.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={noteForm.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Projet (optionnel)</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "__none__" ? null : v)} value={field.value ?? "__none__"}>
                      <FormControl>
                        <SelectTrigger data-testid="select-note-project">
                          <SelectValue placeholder="Aucun projet" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun projet</SelectItem>
                        {projects.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
              <FormField
                control={noteForm.control}
                name="noteDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date (optionnel)</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button variant="outline" className="w-full justify-start font-normal" data-testid="button-note-date">
                            {field.value ? formatDate(field.value, "dd MMM yyyy", { locale: fr }) : <span className="text-muted-foreground">Choisir une date</span>}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <CalendarWidget
                          mode="single"
                          selected={field.value ?? undefined}
                          onSelect={(date) => field.onChange(date ?? null)}
                          locale={fr}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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

      {/* Appointment Panel */}
      <AppointmentPanel
        open={isAppointmentPanelOpen}
        onClose={() => setIsAppointmentPanelOpen(false)}
        mode="create"
      />

      <EmailComposeModal
        open={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        contacts={crmContacts.filter((c) => c.email).map((c) => ({ id: c.id, fullName: c.fullName, email: c.email! }))}
        senderEmail={gmailStatus?.email}
        initialData={composeInitial}
        onSend={(data: any) => sendEmailMutation.mutate(data)}
        isSending={sendEmailMutation.isPending}
      />
    </>
  );
}

interface Tab {
  id: string;
  path: string;
  title: string;
}

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  showClose: boolean;
  onTabClick: (tab: Tab) => void;
  onCloseTab: (e: React.MouseEvent, tabId: string) => void;
  tooltipContent: string;
}

function SortableTab({ tab, isActive, showClose, onTabClick, onCloseTab, tooltipContent }: SortableTabProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: tab.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          ref={setNodeRef}
          style={style}
          className={`
            group flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-medium 
            transition-colors min-w-0 max-w-[120px] sm:max-w-[160px] flex-shrink-0 select-none
            ${isActive
              ? 'bg-primary/10 text-primary dark:text-white border border-primary/20'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }
            ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
          `}
          onClick={() => onTabClick(tab)}
          data-testid={`tab-${tab.id}`}
          {...attributes}
          {...listeners}
        >
          <span className="truncate">{tab.title}</span>
          {showClose && (
            <button
              onClick={(e) => onCloseTab(e, tab.id)}
              className={`
                flex-shrink-0 p-0.5 rounded hover:bg-destructive/20 hover:text-destructive
                ${isActive ? 'visible' : 'invisible group-hover:visible'}
              `}
              data-testid={`close-tab-${tab.id}`}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent className="bg-white dark:bg-gray-900 text-foreground border">
        {tooltipContent}
      </TooltipContent>
    </Tooltip>
  );
}

function AppLayout() {
  const [location, setLocation] = useLocation();
  const isAuthPage = location === "/login" || location === "/signup" || location.startsWith("/accept-invitation");
  const isStandalone = useIsStandalone();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  
  // Fetch data for dynamic tab titles
  const { data: projects } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/projects"],
    enabled: !isAuthPage,
  });
  
  const { data: notes } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["/api/notes"],
    enabled: !isAuthPage,
  });
  
  const { data: backlogs } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/backlogs"],
    enabled: !isAuthPage,
  });
  
  const { data: clients } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/clients"],
    enabled: !isAuthPage,
  });
  
  const { data: mindmaps } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/mindmaps"],
    enabled: !isAuthPage,
  });
  
  const { data: documents } = useQuery<{ id: string; title: string }[]>({
    queryKey: ["/api/documents"],
    enabled: !isAuthPage,
  });
  
  // Feature flags for conditional rendering
  const { data: configAll } = useConfigAll();
  const featureFlags = configAll?.featureFlagsMap ?? {};
  const isTimeTrackingEnabled = featureFlags["time_tracking_module"] !== false;

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
    "--sidebar-width-icon": "5rem",
  };

  const truncateName = (name: string | undefined | null, maxLength: number = 15) => {
    if (!name || name.length === 0) return null;
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength) + "…";
  };

  const getPageTitle = (path: string) => {
    if (path === "/" || path === "/home") return t.nav.dashboard;
    if (path === "/crm") return t.nav.crm;
    
    // Projects - show project name on detail pages
    if (path === "/projects") return t.nav.projects;
    const projectMatch = path.match(/^\/projects\/([^/]+)/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const project = projects?.find(p => p.id === projectId);
      if (project) return `Pro-${truncateName(project.name) || t.nav.projects}`;
      return `Pro-${t.nav.projects}`;
    }
    
    // Notes - show note title on detail pages
    if (path === "/notes/new") return `Not-${t.nav.newNote}`;
    if (path === "/notes") return t.nav.notes;
    const noteMatch = path.match(/^\/notes\/([^/]+)/);
    if (noteMatch) {
      const noteId = noteMatch[1];
      const note = notes?.find(n => n.id === noteId);
      if (note) return `Not-${truncateName(note.title) || t.nav.notes}`;
      return `Not-${t.nav.notes}`;
    }
    
    // Backlogs - show backlog name on detail pages
    const backlogMatch = path.match(/^\/product\/backlog\/([^/]+)/);
    if (backlogMatch && backlogMatch[1] !== "new") {
      const backlogId = backlogMatch[1];
      const backlog = backlogs?.find(b => b.id === backlogId);
      if (backlog) return `Bac-${truncateName(backlog.name) || "Backlog"}`;
      return "Bac-Backlog";
    }
    if (path === "/product/backlog/new") return `Bac-${t.nav.newBacklog}`;
    if (path === "/product") return t.nav.products;
    
    // Clients - show client name on detail pages
    const clientMatch = path.match(/^\/crm\/([^/]+)/);
    if (clientMatch) {
      const clientId = clientMatch[1];
      const client = clients?.find(c => c.id === clientId);
      if (client) return `Cli-${truncateName(client.name) || t.nav.crm}`;
      return `Cli-${t.nav.crm}`;
    }
    
    // Mindmaps - show mindmap name on detail pages
    if (path === "/mindmaps") return t.nav.mindmaps;
    const mindmapMatch = path.match(/^\/mindmaps\/([^/]+)/);
    if (mindmapMatch) {
      const mindmapId = mindmapMatch[1];
      const mindmap = mindmaps?.find(m => m.id === mindmapId);
      if (mindmap) return `Min-${truncateName(mindmap.name) || t.nav.mindmaps}`;
      return `Min-${t.nav.mindmaps}`;
    }
    
    // Documents - show document title on detail pages
    if (path === "/documents") return t.nav.documents;
    if (path.startsWith("/documents/templates")) return `Doc-${t.nav.documentTemplates}`;
    const documentMatch = path.match(/^\/documents\/([^/]+)/);
    if (documentMatch && !path.includes("/templates")) {
      const documentId = documentMatch[1];
      const document = documents?.find(d => d.id === documentId);
      if (document) return `Doc-${truncateName(document.title) || t.nav.documents}`;
      return `Doc-${t.nav.documents}`;
    }
    
    if (path === "/tasks") return t.nav.tasks;
    if (path === "/files") return t.nav.files;
    if (path === "/roadmap") return t.nav.roadmap;
    if (path === "/marketing") return t.nav.marketing;
    if (path === "/finance") return t.nav.finance;
    if (path === "/cashflow") return t.nav.cashflow;
    if (path === "/commercial") return t.nav.commercial;
    if (path === "/legal") return t.nav.legal;
    if (path === "/calendar") return t.nav.calendar;
    if (path === "/settings") return t.nav.settings;
    if (path === "/emails") return t.nav.emails;
    if (path === "/email-templates") return t.nav.emailTemplates;
    if (path === "/pricing") return "Plans";
    return "Page";
  };

  // Get full page title without truncation for tooltips
  const getFullPageTitle = (path: string): string => {
    if (path === "/" || path === "/home") return t.nav.dashboard;
    if (path === "/crm") return t.nav.crm;
    
    const projectMatch = path.match(/^\/projects\/([^/]+)/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      const project = projects?.find(p => p.id === projectId);
      if (project) return project.name || t.nav.projects;
      return t.nav.projects;
    }
    if (path === "/projects") return t.nav.projects;
    
    if (path === "/notes/new") return t.nav.newNote;
    const noteMatch = path.match(/^\/notes\/([^/]+)/);
    if (noteMatch) {
      const noteId = noteMatch[1];
      const note = notes?.find(n => n.id === noteId);
      if (note) return note.title || t.nav.notes;
      return t.nav.notes;
    }
    if (path === "/notes") return t.nav.notes;
    
    const backlogMatch = path.match(/^\/product\/backlog\/([^/]+)/);
    if (backlogMatch && backlogMatch[1] !== "new") {
      const backlogId = backlogMatch[1];
      const backlog = backlogs?.find(b => b.id === backlogId);
      if (backlog) return backlog.name || "Backlog";
      return "Backlog";
    }
    if (path === "/product/backlog/new") return t.nav.newBacklog;
    if (path === "/product") return t.nav.products;
    
    const clientMatch = path.match(/^\/crm\/([^/]+)/);
    if (clientMatch) {
      const clientId = clientMatch[1];
      const client = clients?.find(c => c.id === clientId);
      if (client) return client.name || t.nav.crm;
      return t.nav.crm;
    }
    
    const mindmapMatch = path.match(/^\/mindmaps\/([^/]+)/);
    if (mindmapMatch) {
      const mindmapId = mindmapMatch[1];
      const mindmap = mindmaps?.find(m => m.id === mindmapId);
      if (mindmap) return mindmap.name || t.nav.mindmaps;
      return t.nav.mindmaps;
    }
    if (path === "/mindmaps") return t.nav.mindmaps;
    
    if (path.startsWith("/documents/templates")) return t.nav.documentTemplates;
    const documentMatch = path.match(/^\/documents\/([^/]+)/);
    if (documentMatch && !path.includes("/templates")) {
      const documentId = documentMatch[1];
      const document = documents?.find(d => d.id === documentId);
      if (document) return document.title || t.nav.documents;
      return t.nav.documents;
    }
    if (path === "/documents") return t.nav.documents;
    
    if (path === "/tasks") return t.nav.tasks;
    if (path === "/files") return t.nav.files;
    if (path === "/roadmap") return t.nav.roadmap;
    if (path === "/marketing") return t.nav.marketing;
    if (path === "/finance") return t.nav.finance;
    if (path === "/cashflow") return t.nav.cashflow;
    if (path === "/commercial") return t.nav.commercial;
    if (path === "/legal") return t.nav.legal;
    if (path === "/calendar") return t.nav.calendar;
    if (path === "/settings") return t.nav.settings;
    if (path === "/emails") return t.nav.emails;
    if (path === "/email-templates") return t.nav.emailTemplates;
    if (path === "/pricing") return "Plans";
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
  }, [location, isAuthPage, tabsStorageKey, projects, notes, backlogs, clients, mindmaps, documents]);

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

  const handleReorderTabs = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tabs.findIndex(t => t.id === active.id);
    const newIndex = tabs.findIndex(t => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(tabs, oldIndex, newIndex);
    setTabs(reordered);
    if (tabsStorageKey) {
      localStorage.setItem(tabsStorageKey, JSON.stringify(reordered));
    }
  };

  const tabSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

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
              {/* Mobile: custom bottom-sheet sidebar trigger */}
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden flex-shrink-0 h-9 w-9"
                onClick={() => setIsMobileSidebarOpen(true)}
                data-testid="button-sidebar-trigger-mobile"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-muted-foreground" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <line x1="2" y1="4.5" x2="16" y2="4.5" />
                  <line x1="2" y1="9" x2="16" y2="9" />
                  <line x1="2" y1="13.5" x2="16" y2="13.5" />
                </svg>
              </Button>
              <GlobalSearch />
              {/* Tab System — drag-and-drop reorderable */}
              <DndContext sensors={tabSensors} collisionDetection={closestCenter} onDragEnd={handleReorderTabs}>
                <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
                  <div className="flex items-center gap-0.5 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                    {tabs.map((tab) => (
                      <SortableTab
                        key={tab.id}
                        tab={tab}
                        isActive={activeTabId === tab.id}
                        showClose={tabs.length > 1}
                        onTabClick={handleTabClick}
                        onCloseTab={handleCloseTab}
                        tooltipContent={getFullPageTitle(tab.path)}
                      />
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
                </SortableContext>
              </DndContext>
            </div>
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <QuickCreateMenu />
              {/* Desktop: individual icons */}
              {/* TimeTracker: visible on desktop, zero-width (but in DOM) on mobile so its popover still works */}
              {isTimeTrackingEnabled && (
                <div className="w-0 overflow-hidden sm:w-auto sm:overflow-visible">
                  <TimeTracker />
                </div>
              )}
              <Button variant="ghost" size="icon" className="hidden sm:flex" onClick={() => setLocation("/emails")} data-testid="button-mail">
                <Mail className="w-4 h-4 text-primary dark:text-white" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden sm:flex"
                onClick={() => setLocation("/calendar")}
                data-testid="button-calendar"
              >
                <Calendar className="w-4 h-4 text-primary dark:text-white" />
              </Button>
              {/* Mobile: bottom sheet */}
              <Button
                variant="ghost"
                size="icon"
                className="sm:hidden"
                onClick={() => setIsMobileMoreOpen(true)}
                data-testid="button-header-more"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
              <Sheet open={isMobileMoreOpen} onOpenChange={setIsMobileMoreOpen}>
                <SheetContent side="bottom" className="h-auto rounded-t-xl bg-card pb-8" data-testid="sheet-mobile-more">
                  <SheetHeader className="pb-2">
                    <SheetTitle className="text-base">Actions</SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-1 pt-1">
                    {isTimeTrackingEnabled && (
                      <button
                        type="button"
                        className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover-elevate active-elevate-2 text-left"
                        onClick={() => {
                          setIsMobileMoreOpen(false);
                          const btn = document.querySelector<HTMLElement>('[data-testid="button-time-tracker"]');
                          btn?.click();
                        }}
                        data-testid="button-time-tracker-mobile"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Timer className="w-4 h-4 text-primary" />
                        </div>
                        <span className="text-sm font-medium">Time tracker</span>
                      </button>
                    )}
                    <button
                      type="button"
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover-elevate active-elevate-2 text-left"
                      onClick={() => { setIsMobileMoreOpen(false); setLocation("/emails"); }}
                      data-testid="button-mail-mobile"
                    >
                      <div className="w-9 h-9 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center flex-shrink-0">
                        <Mail className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      </div>
                      <span className="text-sm font-medium">Mails</span>
                    </button>
                    <button
                      type="button"
                      className="flex items-center gap-3 w-full px-3 py-3 rounded-lg hover-elevate active-elevate-2 text-left"
                      onClick={() => { setIsMobileMoreOpen(false); setLocation("/calendar"); }}
                      data-testid="button-calendar-mobile"
                    >
                      <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <span className="text-sm font-medium">Calendrier</span>
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
              <UserMenu />
            </div>
          </header>
          <main className="flex-1 overflow-hidden flex flex-col">
            <TrialBanner />
            <div className="flex-1 overflow-hidden flex flex-col">
              <TrialExpiredGate>
                <Router />
              </TrialExpiredGate>
            </div>
          </main>
        </div>
      </div>
      {/* Mobile sidebar — bottom sheet with two-step animation */}
      <MobileSidebarSheet
        open={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />
    </SidebarProvider>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <LanguageProvider>
          <PreferencesProvider>
            <AuthProvider>
              <OnboardingProvider>
                <TooltipProvider>
                  <AppLayout />
                  <UnifiedAvatar />
                  <CelebrationLayer />
                  <Toaster />
                </TooltipProvider>
              </OnboardingProvider>
            </AuthProvider>
          </PreferencesProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
