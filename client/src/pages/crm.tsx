import { useState } from "react";
import { Search, Filter, Download, LayoutGrid, List, Table2, Plus, MoreVertical, Edit, MessageSquare, Trash2, TrendingUp, Users as UsersIcon, Target, Euro } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CRM() {
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "list">("table");

  // Mock data
  const kpis = [
    {
      title: "Total Contacts",
      value: "156",
      change: "+12",
      changeLabel: "ce mois",
      icon: UsersIcon,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      title: "Prospects Actifs",
      value: "42",
      change: "+8",
      changeLabel: "ce mois",
      icon: Target,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
    },
    {
      title: "Taux de Conversion",
      value: "68%",
      change: "+5%",
      changeLabel: "ce mois",
      icon: TrendingUp,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Opportunités",
      value: "€185K",
      change: "+15K",
      changeLabel: "ce mois",
      icon: Euro,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
  ];

  const contacts = [
    {
      id: "1",
      name: "Marie Dubois",
      email: "marie@techstartup.com",
      company: "TechStartup SAS",
      position: "CEO & Founder",
      status: "negotiation",
      statusLabel: "En négociation",
      budget: "€25,000",
      lastActivity: "Il y a 2 heures",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marie",
    },
    {
      id: "2",
      name: "Pierre Martin",
      email: "p.martin@innovcorp.fr",
      company: "InnovCorp",
      position: "Directeur Innovation",
      status: "prospect",
      statusLabel: "Prospect",
      budget: "€15,000",
      lastActivity: "Il y a 1 jour",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Pierre",
    },
    {
      id: "3",
      name: "Sophie Laurent",
      email: "s.laurent@greentech.io",
      company: "GreenTech Solutions",
      position: "CMO",
      status: "won",
      statusLabel: "Gagné",
      budget: "€35,000",
      lastActivity: "Il y a 3 jours",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie",
    },
  ];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "negotiation":
        return "default";
      case "prospect":
        return "secondary";
      case "won":
        return "default";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "negotiation":
        return "bg-yellow-100 text-yellow-700 border-yellow-200";
      case "prospect":
        return "bg-blue-100 text-blue-700 border-blue-200";
      case "won":
        return "bg-green-100 text-green-700 border-green-200";
      default:
        return "bg-gray-100 text-gray-700 border-gray-200";
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background" data-testid="page-crm">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-heading font-semibold text-foreground" data-testid="text-page-title">
            CRM - Gestion Clients
          </h1>
          <Button className="gap-2" data-testid="button-nouveau-client">
            <Plus className="w-4 h-4" />
            Nouveau client
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => (
            <Card key={index} className="hover-elevate transition-shadow" data-testid={`card-kpi-${index}`}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{kpi.title}</CardTitle>
                <div className={`w-10 h-10 rounded-full ${kpi.iconBg} flex items-center justify-center`}>
                  <kpi.icon className={`w-5 h-5 ${kpi.iconColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-heading font-bold text-foreground">{kpi.value}</div>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm font-medium text-green-600">{kpi.change}</span>
                  <span className="text-sm text-muted-foreground">{kpi.changeLabel}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters & View Controls */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <CardTitle className="text-xl font-heading font-semibold">Contacts & Prospects</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher..."
                    className="pl-9 w-64"
                    data-testid="input-search"
                  />
                </div>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-filters">
                  <Filter className="w-4 h-4" />
                  Filtres
                </Button>
                <Button variant="outline" size="sm" className="gap-2" data-testid="button-exporter">
                  <Download className="w-4 h-4" />
                  Exporter
                </Button>
                <div className="flex items-center gap-1 border border-border rounded-md p-1">
                  <Button
                    variant={viewMode === "kanban" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("kanban")}
                    data-testid="button-view-kanban"
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "list" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("list")}
                    data-testid="button-view-liste"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    data-testid="button-view-tableau"
                  >
                    <Table2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            {/* Table View */}
            <div className="rounded-md border border-border overflow-hidden">
              <table className="w-full">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">
                      <input type="checkbox" className="rounded" data-testid="checkbox-select-all" />
                    </th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Contact</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Entreprise</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Statut</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Budget</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Dernière activité</th>
                    <th className="text-left p-4 text-sm font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map((contact, index) => (
                    <tr
                      key={contact.id}
                      className="border-t border-border hover-elevate cursor-pointer"
                      data-testid={`row-contact-${contact.id}`}
                    >
                      <td className="p-4">
                        <input type="checkbox" className="rounded" />
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={contact.avatar} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {contact.name.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">{contact.name}</p>
                            <p className="text-sm text-muted-foreground">{contact.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <div>
                          <p className="font-medium text-foreground">{contact.company}</p>
                          <p className="text-sm text-muted-foreground">{contact.position}</p>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={`border ${getStatusColor(contact.status)}`} variant="outline">
                          {contact.statusLabel}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-foreground">{contact.budget}</span>
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-muted-foreground">{contact.lastActivity}</span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="sm" data-testid={`button-edit-${contact.id}`}>
                            <Edit className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-chat-${contact.id}`}>
                            <MessageSquare className="w-4 h-4 text-muted-foreground" />
                          </Button>
                          <Button variant="ghost" size="sm" data-testid={`button-delete-${contact.id}`}>
                            <Trash2 className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <p className="text-sm text-muted-foreground">
                Affichage de <span className="font-medium">1-3</span> sur <span className="font-medium">156</span> contacts
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled data-testid="button-precedent">
                  Précédent
                </Button>
                <Button variant="outline" size="sm" className="bg-primary text-primary-foreground">1</Button>
                <Button variant="outline" size="sm">2</Button>
                <Button variant="outline" size="sm">3</Button>
                <Button variant="outline" size="sm" data-testid="button-suivant">
                  Suivant
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
