import { ArrowUp, ArrowDown, FolderKanban, Users, Euro, CheckSquare, Plus, FileText, TrendingUp, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [accountId, setAccountId] = useState<string | null>(localStorage.getItem("demo_account_id"));
  const [isInitializing, setIsInitializing] = useState(false);

  // Auto-initialize demo account if not exists
  useEffect(() => {
    const initializeAccount = async () => {
      if (!accountId && !isInitializing) {
        setIsInitializing(true);
        try {
          const response = await fetch("/api/seed", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (response.ok) {
            const data = await response.json();
            localStorage.setItem("demo_account_id", data.accountId);
            localStorage.setItem("demo_user_id", data.userId);
            setAccountId(data.accountId);
          }
        } catch (error) {
          console.error("Failed to initialize account:", error);
        } finally {
          setIsInitializing(false);
        }
      }
    };

    initializeAccount();
  }, [accountId, isInitializing]);

  // Fetch stats from API
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/accounts", accountId, "stats"],
    enabled: !!accountId,
  });

  const { data: projects, isLoading: projectsLoading } = useQuery({
    queryKey: ["/api/accounts", accountId, "projects"],
    enabled: !!accountId,
  });

  const { data: activities, isLoading: activitiesLoading } = useQuery({
    queryKey: ["/api/accounts", accountId, "activities"],
    enabled: !!accountId,
  });

  if (!accountId || isInitializing || statsLoading || projectsLoading || activitiesLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  // KPI data from API
  const kpis = [
    {
      title: "Active Projects",
      value: stats?.activeProjectsCount?.toString() || "0",
      change: "+2.5%",
      changeType: "positive",
      icon: FolderKanban,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      title: "Clients",
      value: stats?.clientsCount?.toString() || "0",
      change: "+12.5%",
      changeType: "positive",
      icon: Users,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
    {
      title: "Monthly Revenue",
      value: `€${stats?.totalRevenue?.toLocaleString() || "0"}`,
      change: "+8.2%",
      changeType: "positive",
      icon: Euro,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Tasks",
      value: "47",
      change: "-3.1%",
      changeType: "negative",
      icon: CheckSquare,
      iconBg: "bg-orange-100",
      iconColor: "text-orange-600",
    },
  ];

  // Recent projects from API
  const recentProjects = (projects || []).slice(0, 3);

  // Activity feed from API
  const activityFeed = (activities || []).slice(0, 5);

  // Revenue data for chart (mock for now)
  const revenueData = [
    { month: "Jan", revenue: 12000 },
    { month: "Fév", revenue: 15000 },
    { month: "Mar", revenue: 18500 },
    { month: "Avr", revenue: 20000 },
    { month: "Mai", revenue: 22500 },
    { month: "Juin", revenue: 24500 },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-heading font-bold text-foreground">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Bienvenue sur Planbase
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" data-testid="button-filters">
              <FileText className="w-4 h-4 mr-2" />
              Rapports
            </Button>
            <Button size="sm" data-testid="button-new-project">
              <Plus className="w-4 h-4 mr-2" />
              Nouveau Projet
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <Card key={index} data-testid={`card-kpi-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">
                        {kpi.title}
                      </p>
                      <h3 className="text-2xl font-heading font-bold mt-2 text-foreground">
                        {kpi.value}
                      </h3>
                      <p className={`text-xs mt-2 flex items-center gap-1 ${
                        kpi.changeType === "positive" ? "text-green-600" : "text-red-600"
                      }`}>
                        {kpi.changeType === "positive" ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                        {kpi.change} vs dernier mois
                      </p>
                    </div>
                    <div className={`${kpi.iconBg} p-3 rounded-md`}>
                      <Icon className={`w-6 h-6 ${kpi.iconColor}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Revenue Chart - Col Span 2 */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Revenus Mensuels
              </CardTitle>
              <Button variant="ghost" size="sm" data-testid="button-view-all-revenue">
                Voir tout <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity Feed */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-heading font-semibold">
                Activités Récentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {activityFeed.map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3" data-testid={`activity-${activity.id}`}>
                    <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                    <div className="flex-1">
                      <p className="text-sm text-foreground">{activity.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(activity.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-heading font-semibold">
              Projets Récents
            </CardTitle>
            <Button variant="ghost" size="sm" data-testid="button-view-all-projects">
              Voir tout <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentProjects.map((project) => (
                <div
                  key={project.id}
                  className="flex items-center gap-4 p-3 rounded-md hover-elevate active-elevate-2 border border-border"
                  data-testid={`project-${project.id}`}
                >
                  <div className="w-1 h-12 rounded" style={{ backgroundColor: project.color }} />
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-foreground">{project.name}</h4>
                    <p className="text-xs text-muted-foreground mt-1">{project.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Progression</p>
                      <p className="text-sm font-semibold text-foreground">{project.progress}%</p>
                    </div>
                    <Progress value={project.progress} className="w-24" />
                    <Badge variant="secondary" className="capitalize">
                      {project.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
