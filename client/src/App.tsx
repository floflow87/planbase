import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import Dashboard from "@/pages/dashboard";
import CRM from "@/pages/crm";
import Projects from "@/pages/projects";
import Notes from "@/pages/notes";
import Documents from "@/pages/documents";
import Init from "@/pages/init";
import Roadmap from "@/pages/roadmap";
import Product from "@/pages/product";
import Marketing from "@/pages/marketing";
import Finance from "@/pages/finance";
import Commercial from "@/pages/commercial";
import Legal from "@/pages/legal";
import NotFound from "@/pages/not-found";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";

function Router() {
  return (
    <Switch>
      <Route path="/init" component={Init} />
      <Route path="/" component={Dashboard} />
      <Route path="/crm" component={CRM} />
      <Route path="/projects" component={Projects} />
      <Route path="/notes" component={Notes} />
      <Route path="/documents" component={Documents} />
      <Route path="/roadmap" component={Roadmap} />
      <Route path="/product" component={Product} />
      <Route path="/marketing" component={Marketing} />
      <Route path="/finance" component={Finance} />
      <Route path="/commercial" component={Commercial} />
      <Route path="/legal" component={Legal} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between h-14 px-4 border-b border-border bg-background sticky top-0 z-10">
                <div className="flex items-center gap-2">
                  <SidebarTrigger data-testid="button-sidebar-toggle" />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" className="relative" data-testid="button-notifications">
                    <Bell className="w-5 h-5" />
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                  </Button>
                </div>
              </header>
              <main className="flex-1 overflow-hidden">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
