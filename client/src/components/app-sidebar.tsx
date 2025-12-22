import { useState } from "react";
import { Home, FolderKanban, CheckSquare, Rocket, Package, FileText, FolderOpen, Users, TrendingUp, DollarSign, Settings, Network, HelpCircle } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
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
import defaultAvatar from "@/assets/default-avatar.png";
import planbaseLogo from "@assets/planbase-logo.png";

export function AppSidebar() {
  const [location] = useLocation();
  const { userProfile, user } = useAuth();
  const { state, setOpenMobile, isMobile } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [isHelpOpen, setIsHelpOpen] = useState(false);

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

  // Sections restreintes pour le plan "starter"
  const starterRestrictedUrls = ["/roadmap", "/product", "/documents", "/marketing", "/finance", "/legal"];
  const isStarterPlan = false; // TODO: Implement plan checking logic
  
  const isRestricted = (url: string) => {
    return isStarterPlan && starterRestrictedUrls.includes(url);
  };

  const navItems = [
    { title: "Tableau de bord", url: "/", icon: Home },
    { title: "CRM", url: "/crm", icon: Users },
    { title: "Projets", url: "/projects", icon: FolderKanban },
    { title: "Product", url: "/product", icon: Package },
    { title: "Roadmap", url: "/roadmap", icon: Rocket },
    { title: "Tâches", url: "/tasks", icon: CheckSquare },
    { title: "Whiteboards", url: "/mindmaps", icon: Network },
    { title: "Notes", url: "/notes", icon: FileText },
    { title: "Documents", url: "/documents", icon: FolderOpen },
    { title: "Marketing", url: "/marketing", icon: TrendingUp },
    { title: "Rentabilité", url: "/finance", icon: DollarSign },
  ];

  const isActiveRoute = (itemUrl: string) => {
    if (itemUrl === "/") {
      return location === "/";
    }
    return location === itemUrl || location.startsWith(itemUrl + "/");
  };

  return (
    <Sidebar collapsible="icon">
      {!isCollapsed && (
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <Link href="/" onClick={handleNavigation}>
            <div className="flex items-center cursor-pointer hover-elevate active-elevate-2 rounded-md p-2 gap-2" data-testid="link-logo">
              <img src={planbaseLogo} alt="PlanBase" className="w-8 h-8 rounded-md flex-shrink-0 transition-all" />
              <span className="font-semibold text-base italic bg-gradient-to-r from-violet-600 via-purple-600 to-violet-500 bg-clip-text text-transparent" style={{ fontFamily: 'Futura, "Century Gothic", CenturyGothic, AppleGothic, sans-serif' }}>PlanBase</span>
            </div>
          </Link>
        </SidebarHeader>
      )}

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
                          <Link href={item.url} onClick={handleNavigation}>
                            <item.icon className="w-4 h-4" />
                            <span>{item.title}</span>
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

      {/* Aide et support button - above the footer */}
      <div className="border-t border-sidebar-border px-2 py-1">
        <SidebarMenu>
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
                  {userProfile?.position || 'Membre'}
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
    </Sidebar>
  );
}
