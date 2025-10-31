import { Home, FolderKanban, Rocket, Package, FileText, FolderOpen, Users, TrendingUp, DollarSign, Briefcase, Scale, Settings } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import defaultAvatar from "@/assets/default-avatar.png";

export function AppSidebar() {
  const [location] = useLocation();
  const { userProfile, user } = useAuth();

  const mainNav = [
    { title: "Tableau de bord", url: "/", icon: Home },
  ];

  const projectsNav = [
    { title: "To-Do & Projects", url: "/projects", icon: FolderKanban },
    { title: "Roadmap", url: "/roadmap", icon: Rocket },
    { title: "Product", url: "/product", icon: Package },
  ];

  const contentNav = [
    { title: "Notes", url: "/notes", icon: FileText },
    { title: "Documents", url: "/documents", icon: FolderOpen },
  ];

  const businessNav = [
    { title: "CRM", url: "/crm", icon: Users },
    { title: "Marketing", url: "/marketing", icon: TrendingUp },
    { title: "Finance", url: "/finance", icon: DollarSign },
    { title: "Commercial", url: "/commercial", icon: Briefcase },
    { title: "Legal", url: "/legal", icon: Scale },
  ];

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <Link href="/">
          <div className="flex items-center gap-2 cursor-pointer hover-elevate active-elevate-2 rounded-md p-2" data-testid="link-logo">
            <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
              <span className="text-white font-heading font-bold text-sm">PB</span>
            </div>
            <span className="font-heading font-semibold text-lg text-sidebar-foreground">PlanBase</span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
            Projects
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {projectsNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {contentNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground uppercase tracking-wider px-2">
            Business
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {businessNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={location === item.url} data-testid={`link-${item.title.toLowerCase()}`}>
                    <Link href={item.url}>
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <Link href="/profile">
          <div className="flex items-center gap-3 hover-elevate rounded-md p-2 cursor-pointer" data-testid="button-user-profile">
            <Avatar className="w-8 h-8">
              <AvatarImage src={userProfile?.avatar || defaultAvatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                {userProfile?.firstName?.[0] || user?.email?.[0].toUpperCase() || 'U'}
                {userProfile?.lastName?.[0] || ''}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {userProfile?.firstName && userProfile?.lastName 
                  ? `${userProfile.firstName} ${userProfile.lastName}`
                  : user?.email || 'Utilisateur'}
              </p>
              <Badge variant="secondary" className="text-xs mt-0.5">
                {userProfile?.position || 'Membre'}
              </Badge>
            </div>
            <Settings className="w-4 h-4 text-muted-foreground" />
          </div>
        </Link>
      </SidebarFooter>
    </Sidebar>
  );
}
