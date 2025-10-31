import { useState, useEffect } from "react";
import { Search, Filter, Download, LayoutGrid, List, Table2, Plus, MoreVertical, Edit, MessageSquare, Trash2, TrendingUp, Users as UsersIcon, Target, Euro, X } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type InsertClient, type Client, type Contact, type Project } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function CRM() {
  const accountId = localStorage.getItem("demo_account_id");
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = useState<"table" | "kanban" | "list">("table");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Fetch clients
  const { data: clients = [], isLoading } = useQuery<Client[]>({
    queryKey: ["/api/accounts", accountId, "clients"],
    enabled: !!accountId,
  });

  // Create client mutation
  const createMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      return await apiRequest("POST", "/api/clients", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
      setIsCreateDialogOpen(false);
      toast({ title: "Client créé avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  // Update client mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertClient> }) => {
      return await apiRequest("PATCH", `/api/clients/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
      setEditingClient(null);
      toast({ title: "Client mis à jour", variant: "success" });
    },
  });

  // Delete client mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest("DELETE", `/api/clients/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
      toast({ title: "Client supprimé", variant: "success" });
    },
  });

  // Form for create/edit
  const form = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      accountId: accountId || "",
      name: "",
      type: "company",
      status: "prospecting",
      budget: "0",
      tags: [],
      contacts: [],
      notes: "",
      createdBy: localStorage.getItem("demo_user_id") || "",
    },
  });

  // Update form when editing
  useEffect(() => {
    if (editingClient) {
      form.reset({
        accountId: editingClient.accountId,
        name: editingClient.name,
        type: editingClient.type,
        status: editingClient.status,
        budget: editingClient.budget?.toString() || "0",
        tags: editingClient.tags as string[] || [],
        contacts: editingClient.contacts || [],
        notes: editingClient.notes || "",
        createdBy: editingClient.createdBy,
      });
    } else {
      form.reset({
        accountId: accountId || "",
        name: "",
        type: "company",
        status: "prospecting",
        budget: "0",
        tags: [],
        contacts: [],
        notes: "",
        createdBy: localStorage.getItem("demo_user_id") || "",
      });
    }
  }, [editingClient, accountId, form]);

  const onSubmit = (data: InsertClient) => {
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Fetch projects for project counts
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/accounts", accountId, "projects"],
    enabled: !!accountId,
  });

  // Fetch contacts for contact counts  
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/accounts", accountId, "contacts"],
    enabled: !!accountId,
  });

  // Filter and search clients
  const filteredClients = clients.filter((client) => {
    const matchesStatus = filterStatus === "all" || client.status === filterStatus;
    const matchesSearch = searchQuery === "" || 
      client.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Calculate KPIs
  const totalContacts = clients.length;
  const activeProspects = clients.filter(c => c.status === "prospect" || c.status === "in_progress").length;
  const wonClients = clients.filter(c => c.status === "signed").length;
  const conversionRate = totalContacts > 0 ? Math.round((wonClients / totalContacts) * 100) : 0;
  const totalOpportunities = clients.reduce((sum, c) => sum + (Number(c.budget) || 0), 0);

  const kpis = [
    {
      title: "Total Contacts",
      value: totalContacts.toString(),
      change: "+12",
      changeLabel: "ce mois",
      icon: UsersIcon,
      iconBg: "bg-violet-100",
      iconColor: "text-violet-600",
    },
    {
      title: "Prospects Actifs",
      value: activeProspects.toString(),
      change: "+8",
      changeLabel: "ce mois",
      icon: Target,
      iconBg: "bg-yellow-100",
      iconColor: "text-yellow-600",
    },
    {
      title: "Taux de Conversion",
      value: `${conversionRate}%`,
      change: "+5%",
      changeLabel: "ce mois",
      icon: TrendingUp,
      iconBg: "bg-green-100",
      iconColor: "text-green-600",
    },
    {
      title: "Opportunités",
      value: `€${totalOpportunities.toLocaleString()}`,
      change: "+15K",
      changeLabel: "ce mois",
      icon: Euro,
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
    },
  ];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "in_progress":
        return "default";
      case "prospect":
        return "secondary";
      case "signed":
        return "outline";
      case "inactive":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "in_progress":
        return "En négociation";
      case "prospect":
        return "Prospect";
      case "signed":
        return "Gagné";
      case "inactive":
        return "Inactif";
      default:
        return status;
    }
  };

  if (!accountId) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <Dialog open={isCreateDialogOpen || !!editingClient} onOpenChange={(open) => {
            if (!open) {
              setIsCreateDialogOpen(false);
              setEditingClient(null);
            }
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-new-client">
                <Plus className="w-4 h-4 mr-2" />
                Nouveau Client
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Modifier le client" : "Nouveau client"}</DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom *</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-client-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
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
                              <SelectItem value="person">Personne</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Statut</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-client-status">
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="prospecting">Prospection</SelectItem>
                              <SelectItem value="qualified">Qualifié</SelectItem>
                              <SelectItem value="negotiation">Négociation</SelectItem>
                              <SelectItem value="won">Gagné</SelectItem>
                              <SelectItem value="lost">Perdu</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Budget (€)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            value={field.value || 0}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            onBlur={field.onBlur}
                            name={field.name}
                            ref={field.ref}
                            disabled={field.disabled}
                            data-testid="input-client-budget"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setIsCreateDialogOpen(false);
                        setEditingClient(null);
                      }}
                      data-testid="button-cancel"
                    >
                      Annuler
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending} data-testid="button-submit-client">
                      {editingClient ? "Mettre à jour" : "Créer"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <Card key={index} data-testid={`card-kpi-${index}`}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground font-medium">{kpi.title}</p>
                      <h3 className="text-2xl font-heading font-bold mt-2 text-foreground">{kpi.value}</h3>
                      <p className="text-xs text-green-600 mt-2">
                        {kpi.change} {kpi.changeLabel}
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

        {/* Filters and Actions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Rechercher un contact..."
                    className="pl-9"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="input-search-clients"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[180px]" data-testid="select-filter-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="in_progress">En négociation</SelectItem>
                    <SelectItem value="signed">Gagné</SelectItem>
                    <SelectItem value="inactive">Inactif</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" data-testid="button-export">
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
                <div className="flex border rounded-md">
                  <Button
                    variant={viewMode === "table" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("table")}
                    data-testid="button-view-table"
                  >
                    <Table2 className="w-4 h-4" />
                  </Button>
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
                    data-testid="button-view-list"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredClients.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Aucun client trouvé
              </div>
            ) : (
              <div className="space-y-2">
                {/* Table Header */}
                <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
                  <div className="col-span-4">Client</div>
                  <div className="col-span-2">Contacts</div>
                  <div className="col-span-2">Type</div>
                  <div className="col-span-2">Projets</div>
                  <div className="col-span-1">Budget</div>
                  <div className="col-span-1">Actions</div>
                </div>
                {/* Table Rows */}
                {filteredClients.map((client) => {
                  const clientContacts = contacts.filter((c: any) => c.clientId === client.id);
                  const clientProjects = projects.filter((p: any) => p.clientId === client.id);
                  
                  return (
                    <Link key={client.id} href={`/crm/${client.id}`}>
                      <div
                        className="grid grid-cols-12 gap-4 px-4 py-3 hover-elevate active-elevate-2 rounded-md border border-border cursor-pointer"
                        data-testid={`row-client-${client.id}`}
                      >
                      <div className="col-span-4 flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${client.name}`} />
                          <AvatarFallback>{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-sm font-medium text-foreground">{client.name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{client.type === 'company' ? 'Entreprise' : 'Personne'}</p>
                        </div>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <Badge variant="outline">{clientContacts.length} contact{clientContacts.length > 1 ? 's' : ''}</Badge>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <Badge variant={client.type === "client" ? "default" : "secondary"}>
                          {client.type === "client" ? "Client" : "Prospect"}
                        </Badge>
                      </div>
                      <div className="col-span-2 flex items-center">
                        <p className="text-sm text-foreground">{clientProjects.length} projet{clientProjects.length > 1 ? 's' : ''}</p>
                      </div>
                      <div className="col-span-1 flex items-center">
                        <p className="text-sm font-medium text-foreground">
                          €{client.budget ? parseFloat(client.budget).toLocaleString() : "0"}
                        </p>
                      </div>
                      <div className="col-span-1 flex items-center">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-actions-${client.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingClient(client)} data-testid={`button-edit-${client.id}`}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`button-message-${client.id}`}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Message
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => {
                                if (confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
                                  deleteMutation.mutate(client.id);
                                }
                              }}
                              data-testid={`button-delete-${client.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </Link>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
