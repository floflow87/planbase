import { Home, FolderKanban, CheckSquare, Rocket, Package, FileText, FolderOpen, Users, TrendingUp, DollarSign, Scale, Settings, Network } from "lucide-react";
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
import defaultAvatar from "@/assets/default-avatar.png";
import planbaseLogo from "@assets/planbase-logo.png";

export function AppSidebar() {
  const [location] = useLocation();
  const { userProfile, user } = useAuth();
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

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
    { title: "Finance", url: "/finance", icon: DollarSign },
    { title: "Légal", url: "/legal", icon: Scale },
  ];

  return (
    <Sidebar collapsible="icon">
      {!isCollapsed && (
        <SidebarHeader className="p-4 border-b border-sidebar-border">
          <Link href="/">
            <div className="flex items-center cursor-pointer hover-elevate active-elevate-2 rounded-md p-2 gap-2" data-testid="link-logo">
              <img src={planbaseLogo} alt="PlanBase" className="w-8 h-8 rounded-md flex-shrink-0 transition-all" />
              <span className="font-heading font-semibold text-base text-sidebar-foreground" style={{ fontFamily: 'Futura, "Century Gothic", CenturyGothic, AppleGothic, sans-serif', fontStyle: 'italic' }}>PlanBase</span>
            </div>
          </Link>
        </SidebarHeader>
      )}

      <SidebarContent className={isCollapsed ? 'pt-4' : ''}>
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
                            isActive={location === item.url} 
                            disabled={restricted}
                            className={`${restricted ? "opacity-50 cursor-not-allowed" : ""} justify-center`}
                            data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                          >
                            {restricted ? (
                              <div className="flex justify-center">
                                <item.icon className="w-4 h-4" />
                              </div>
                            ) : (
                              <Link href={item.url} className="flex justify-center w-full">
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
                        isActive={location === item.url} 
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
                          <Link href={item.url}>
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

      <SidebarFooter className={`border-t border-sidebar-border ${isCollapsed ? 'p-2' : 'p-4'}`}>
        <Link href="/profile">
          {isCollapsed ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center justify-center hover-elevate rounded-md p-2 cursor-pointer" data-testid="button-user-profile">
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={userProfile?.avatarUrl || defaultAvatar} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
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
            <div className="flex items-center gap-3 hover-elevate rounded-md p-2 cursor-pointer" data-testid="button-user-profile">
              <Avatar className="w-8 h-8">
                <AvatarImage src={userProfile?.avatarUrl || defaultAvatar} />
                <AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-medium">
                  {userProfile?.firstName?.[0] || user?.email?.[0].toUpperCase() || 'U'}
                  {userProfile?.lastName?.[0] || ''}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">
                  {userProfile?.firstName && userProfile?.lastName 
                    ? `${userProfile.firstName} ${userProfile.lastName}`
                    : user?.email || 'Utilisateur'}
                </p>
                <Badge variant="secondary" className="text-[10px] mt-0.5">
                  {userProfile?.position || 'Membre'}
                </Badge>
              </div>
              <Settings className="w-4 h-4 text-muted-foreground flex-shrink-0" data-testid="icon-settings" />
            </div>
          )}
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
