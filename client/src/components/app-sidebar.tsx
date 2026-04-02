import { useState } from "react";
import { Home, FolderKanban, CheckSquare, Rocket, Package, FileText, FolderOpen, Users, TrendingUp, DollarSign, Settings, Network, HelpCircle, ChevronsLeft, ChevronsRight, Wallet, Zap, Bot } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useConfigAll } from "@/hooks/useConfigAll";
import { useBilling } from "@/hooks/useBilling";
import type { RbacModule } from "@shared/schema";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpDrawer } from "@/help/HelpDrawer";
import { getModuleIdFromPath, getModuleHelp, MODULE_HELP } from "@/help/faqs";
import { useAiAssistantState, AiAssistantDrawer } from "@/components/ai/AiAssistant";
import defaultAvatar from "@/assets/default-avatar.png";
import planbaseLogo from "@assets/planbase-logo.png";

const URL_TO_MODULE: Record<string, RbacModule | null> = {
  "/": null,
  "/crm": "crm",
  "/projects": "projects",
  "/product": "product",
  "/roadmap": "roadmap",
  "/tasks": "tasks",
  "/mindmaps": "whiteboards",
  "/notes": "notes",
  "/files": "documents",
  "/documents": "documents",
  "/finance": "profitability",
  "/cashflow": "treasury",
};

const URL_TO_FEATURE_FLAG: Record<string, string> = {
  "/crm": "crm_module",
  "/projects": "projects_module",
  "/product": "product_module",
  "/roadmap": "roadmap_module",
  "/tasks": "tasks_module",
  "/mindmaps": "whiteboards_module",
  "/notes": "notes_module",
  "/files": "documents_module",
  "/documents": "documents_module",
  "/finance": "profitability_module",
  "/cashflow": "treasury_module",
};

export function AppSidebar() {
  const [location] = useLocation();
  const { userProfile, user } = useAuth();
  const { isAdmin, role, can } = usePermissions();
  const { data: configData } = useConfigAll();
  const featureFlags = configData?.featureFlagsMap ?? {};
  const { state, setOpenMobile, isMobile, toggleSidebar } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const { billingState } = useBilling();
  const aiAssistant = useAiAssistantState();
  const showUpgradeCTA = billingState !== "loading" && billingState !== "admin" && billingState !== "active" && billingState !== "past_due";

  const moduleId = getModuleIdFromPath(location);
  const moduleHelp = moduleId ? getModuleHelp(moduleId) : MODULE_HELP.dashboard;
  const effectiveModuleHelp = moduleHelp || MODULE_HELP.dashboard;

  const handleNavigation = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleHelpClick = () => {
    setIsHelpOpen(true);
  };

  const starterRestrictedUrls = ["/roadmap", "/product", "/documents", "/finance", "/legal"];
  const isStarterPlan = false;
  
  const isRestricted = (url: string) => {
    return isStarterPlan && starterRestrictedUrls.includes(url);
  };

  const isModuleEnabled = (url: string): boolean => {
    const flagKey = URL_TO_FEATURE_FLAG[url];
    if (!flagKey) return true;
    if (flagKey in featureFlags) return featureFlags[flagKey] !== false;
    return true;
  };

  const canAccessModule = (url: string): boolean => {
    if (!isModuleEnabled(url)) return false;
    if (isAdmin) return true;
    const module = URL_TO_MODULE[url];
    if (module === null) return true;
    return can(module, "read");
  };

  const allNavItems = [
    { title: "Tableau de bord", url: "/", icon: Home },
    { title: "CRM", url: "/crm", icon: Users },
    { title: "Projets", url: "/projects", icon: FolderKanban },
    { title: "Product", url: "/product", icon: Package },
    { title: "Roadmap", url: "/roadmap", icon: Rocket },
    { title: "Notes", url: "/notes", icon: FileText },
    { title: "Tâches", url: "/tasks", icon: CheckSquare },
    { title: "Whiteboards", url: "/mindmaps", icon: Network, badge: "Beta" },
    { title: "Fichiers", url: "/files", icon: FolderOpen },
    { title: "Trésorerie", url: "/cashflow", icon: Wallet },
    { title: "Rentabilité", url: "/finance", icon: DollarSign, badge: "Beta" },
  ];

  const navItems = allNavItems.filter(item => canAccessModule(item.url));

  const isActiveRoute = (itemUrl: string) => {
    if (itemUrl === "/") {
      return location === "/";
    }
    return location === itemUrl || location.startsWith(itemUrl + "/");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="py-2 px-3 border-b border-sidebar-border">
        {!isCollapsed ? (
          <div className="flex items-center justify-between gap-2">
            <Link href="/" onClick={handleNavigation}>
              <div className="flex items-center cursor-pointer hover-elevate active-elevate-2 rounded-md p-1 gap-2" data-testid="link-logo">
                <img src={planbaseLogo} alt="PlanBase" className="w-8 h-8 rounded-md flex-shrink-0 transition-all" />
                <span className="font-semibold text-base italic bg-gradient-to-r from-violet-600 via-purple-600 to-violet-500 bg-clip-text text-transparent" style={{ fontFamily: 'Futura, "Century Gothic", CenturyGothic, AppleGothic, sans-serif' }}>PlanBase</span>
              </div>
            </Link>
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-md hover-elevate active-elevate-2 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
              data-testid="button-sidebar-toggle"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/" onClick={handleNavigation}>
                  <div className="flex items-center justify-center cursor-pointer hover-elevate active-elevate-2 rounded-md p-1" data-testid="link-logo-collapsed">
                    <img src={planbaseLogo} alt="PlanBase" className="w-8 h-8 rounded-md flex-shrink-0" />
                  </div>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">PlanBase</TooltipContent>
            </Tooltip>
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-md hover-elevate active-elevate-2 text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
              data-testid="button-sidebar-toggle-collapsed"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className={isCollapsed ? '' : ''}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const restricted = isRestricted(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    {isCollapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <SidebarMenuButton 
                            asChild={!restricted}
                            isActive={isActiveRoute(item.url)} 
                            disabled={restricted}
                            className={`${restricted ? "opacity-50 cursor-not-allowed" : ""} justify-center`}
                            data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {restricted ? (
                              <div className="flex justify-center">
                                <item.icon className="w-4 h-4" />
                              </div>
                            ) : (
                              <Link href={item.url} className="flex justify-center w-full" onClick={handleNavigation}>
                                <item.icon className="w-4 h-4" />
                              </Link>
                            )}
                          </SidebarMenuButton>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.title}</TooltipContent>
                      </Tooltip>
                    ) : (
                      <SidebarMenuButton 
                        asChild={!restricted}
                        isActive={isActiveRoute(item.url)} 
                        disabled={restricted}
                        className={restricted ? "opacity-50 cursor-not-allowed" : ""}
                        data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {restricted ? (
                          <div>
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                          </div>
                        ) : (
                          <Link href={item.url} onClick={handleNavigation} className="flex items-center gap-2 flex-1">
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
                            {(item as any).badge && (
                              <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0 h-4 bg-violet-100 text-violet-700 border-violet-300">
                                {(item as any).badge}
                              </Badge>
                            )}
                          </Link>
                        )}
                      </SidebarMenuButton>
                    )}
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Assistant IA + Aide et support - above the footer */}
      <div className="border-t border-sidebar-border px-2 py-1">
        <SidebarMenu>
          {aiAssistant.hasAccess && (
            <SidebarMenuItem className="mt-1">
              {isCollapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={aiAssistant.toggle}
                      className="flex items-center justify-center w-full rounded-md min-h-9 bg-gradient-to-r from-primary to-purple-400 dark:from-primary dark:to-purple-500 text-primary-foreground transition-opacity hover:opacity-90"
                      data-testid="button-sidebar-ai-assistant"
                    >
                      <Bot className="w-4 h-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">Assistant IA</TooltipContent>
                </Tooltip>
              ) : (
                <button
                  onClick={aiAssistant.toggle}
                  className="flex items-center gap-2 w-full rounded-md px-3 min-h-9 text-sm font-medium bg-gradient-to-r from-primary to-purple-400 dark:from-primary dark:to-purple-500 text-primary-foreground transition-opacity hover:opacity-90"
                  data-testid="button-sidebar-ai-assistant"
                >
                  <Bot className="w-4 h-4" />
                  <span className="text-xs">Assistant IA</span>
                </button>
              )}
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            {isCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <SidebarMenuButton
                    onClick={handleHelpClick}
                    className="justify-center"
                    data-testid="button-aide-support"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </SidebarMenuButton>
                </TooltipTrigger>
                <TooltipContent side="right">Aide et support</TooltipContent>
              </Tooltip>
            ) : (
              <SidebarMenuButton
                onClick={handleHelpClick}
                data-testid="button-aide-support"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Aide et support</span>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </div>

      {/* Upgrade CTA */}
      {showUpgradeCTA && (
        <div className="border-t border-sidebar-border px-2 py-1">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Link href="/pricing" onClick={handleNavigation}>
                  <SidebarMenuButton className="justify-center text-violet-600 dark:text-violet-400" data-testid="button-upgrade-cta-collapsed">
                    <Zap className="w-4 h-4" />
                  </SidebarMenuButton>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right">Passer à un plan supérieur</TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/pricing" onClick={handleNavigation}>
              <div className="flex items-center gap-2 px-2 py-2 rounded-md hover-elevate cursor-pointer bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800" data-testid="button-upgrade-cta">
                <Zap className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-semibold text-violet-700 dark:text-violet-300">Passer à l'Agence</span>
                  <span className="text-[10px] text-violet-500 dark:text-violet-400">Débloquer tous les modules</span>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      <SidebarFooter className={`border-t border-sidebar-border bg-gradient-to-r from-violet-600 via-purple-600 to-violet-500 ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <Link href="/settings" onClick={handleNavigation}>
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center hover:bg-white/10 rounded-md p-2 cursor-pointer" data-testid="button-user-profile">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={userProfile?.avatarUrl || defaultAvatar} />
                    <AvatarFallback className="bg-white/20 text-white text-[10px] font-medium">
                      {userProfile?.firstName?.[0] || user?.email?.[0].toUpperCase() || 'U'}
                      {userProfile?.lastName?.[0] || ''}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                {userProfile?.firstName && userProfile?.lastName 
                  ? `${userProfile.firstName} ${userProfile.lastName}`
                  : user?.email || 'Utilisateur'}
              </TooltipContent>
            </Tooltip>
          ) : (
            <div className="flex items-center gap-3 hover:bg-white/10 rounded-md p-2 cursor-pointer" data-testid="button-user-profile">
              <Avatar className="w-8 h-8">
                <AvatarImage src={userProfile?.avatarUrl || defaultAvatar} />
                <AvatarFallback className="bg-white/20 text-white text-[10px] font-medium">
                  {userProfile?.firstName?.[0] || user?.email?.[0].toUpperCase() || 'U'}
                  {userProfile?.lastName?.[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-white truncate">
                  {userProfile?.firstName && userProfile?.lastName 
                    ? `${userProfile.firstName} ${userProfile.lastName}`
                    : user?.email || 'Utilisateur'}
                </p>
                <Badge variant="secondary" className="text-[10px] mt-0.5 bg-white/20 text-white border-0">
                  {role === 'admin' ? 'Admin' : 
                   role === 'member' ? 'Membre' : 
                   role === 'guest' ? 'Invité' : 
                   userProfile?.position || 'Membre'}
                </Badge>
              </div>
              <Settings className="w-4 h-4 text-white flex-shrink-0" data-testid="icon-settings" />
            </div>
          )}
        </Link>
      </SidebarFooter>

      <HelpDrawer
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        moduleHelp={effectiveModuleHelp}
      />

      <AiAssistantDrawer
        isOpen={aiAssistant.isOpen}
        onClose={aiAssistant.toggle}
        projectContext={aiAssistant.projectContext}
      />
    </Sidebar>
  );
}
