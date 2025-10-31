import { useState, useEffect } from "react";
import { Search, Filter, Download, LayoutGrid, Table2, Plus, MoreVertical, Edit, MessageSquare, Trash2, TrendingUp, Users as UsersIcon, Target, Euro, X, GripVertical } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type InsertClient, type Client, type Contact, type Project, type AppUser } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Type pour les colonnes
type ColumnId = "client" | "contacts" | "type" | "projets" | "budget";

interface Column {
  id: ColumnId;
  label: string;
  width: number;
  className: string;
}

// Composant pour une colonne draggable
function DraggableColumnHeader({ id, label }: { id: string; label: string }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1 cursor-move"
      {...attributes}
      {...listeners}
    >
      <GripVertical className="w-3 h-3 text-muted-foreground" />
      <span>{label}</span>
    </div>
  );
}

export default function CRM() {
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = useState<"table" | "card">("table");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());
  
  // Colonnes configurables
  const [columns, setColumns] = useState<Column[]>([
    { id: "client", label: "Client", width: 3, className: "col-span-3" },
    { id: "contacts", label: "Contacts", width: 2, className: "col-span-2" },
    { id: "type", label: "Type", width: 2, className: "col-span-2" },
    { id: "projets", label: "Projets", width: 2, className: "col-span-2" },
    { id: "budget", label: "Budget", width: 2, className: "col-span-2" },
  ]);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setColumns((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  // Fetch current user to get accountId
  const { data: currentUser } = useQuery<AppUser>({
    queryKey: ["/api/me"],
  });

  const accountId = currentUser?.accountId;

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

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest("DELETE", `/api/clients/${id}`)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
      setSelectedClients(new Set());
      toast({ title: "Clients supprimés", variant: "success" });
    },
  });

  // Bulk update status mutation
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map(id => apiRequest("PATCH", `/api/clients/${id}`, { status })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
      setSelectedClients(new Set());
      toast({ title: "Statuts mis à jour", variant: "success" });
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
      createdBy: currentUser?.id || "",
    },
  });

  // Update form default values when accountId and currentUser become available
  useEffect(() => {
    if (accountId && currentUser && !editingClient) {
      form.reset({
        accountId: accountId,
        name: "",
        type: "company",
        status: "prospecting",
        budget: "0",
        tags: [],
        contacts: [],
        notes: "",
        createdBy: currentUser.id,
      });
    }
  }, [accountId, currentUser, editingClient, form]);

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
        createdBy: currentUser?.id || "",
      });
    }
  }, [editingClient, accountId, currentUser, form]);

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
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-fit">
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
                    <SelectItem value="prospecting">Prospection</SelectItem>
                    <SelectItem value="qualified">Qualifié</SelectItem>
                    <SelectItem value="negotiation">Négociation</SelectItem>
                    <SelectItem value="won">Gagné</SelectItem>
                    <SelectItem value="lost">Perdu</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                {selectedClients.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{selectedClients.size} sélectionné{selectedClients.size > 1 ? 's' : ''}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-bulk-actions">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            if (confirm(`Supprimer ${selectedClients.size} client(s) ?`)) {
                              bulkDeleteMutation.mutate(Array.from(selectedClients));
                            }
                          }}
                          className="text-red-600"
                          data-testid="button-bulk-delete"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedClients), status: "prospecting" })}
                          data-testid="button-bulk-prospecting"
                        >
                          Marquer comme prospection
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedClients), status: "won" })}
                          data-testid="button-bulk-won"
                        >
                          Marquer comme gagné
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => bulkUpdateStatusMutation.mutate({ ids: Array.from(selectedClients), status: "lost" })}
                          data-testid="button-bulk-lost"
                        >
                          Marquer comme perdu
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
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
                    variant={viewMode === "card" ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("card")}
                    data-testid="button-view-card"
                  >
                    <LayoutGrid className="w-4 h-4" />
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
            ) : viewMode === "table" ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <div className="space-y-2">
                  {/* Table Header with drag and drop */}
                  <SortableContext
                    items={columns.map(col => col.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-sm font-medium text-muted-foreground border-b">
                      <div className="col-span-1 flex items-center">
                        <Checkbox
                          checked={selectedClients.size === filteredClients.length && filteredClients.length > 0}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedClients(new Set(filteredClients.map(c => c.id)));
                            } else {
                              setSelectedClients(new Set());
                            }
                          }}
                          data-testid="checkbox-select-all"
                        />
                      </div>
                      {columns.map((column) => (
                        <div key={column.id} className={column.className}>
                          <DraggableColumnHeader id={column.id} label={column.label} />
                        </div>
                      ))}
                      <div className="col-span-1">Actions</div>
                    </div>
                  </SortableContext>
                  
                  {/* Table Rows */}
                  {filteredClients.map((client) => {
                    const clientContacts = contacts.filter((c: any) => c.clientId === client.id);
                    const clientProjects = projects.filter((p: any) => p.clientId === client.id);
                    const isSelected = selectedClients.has(client.id);

                    return (
                      <div
                        key={client.id}
                        className={`grid grid-cols-12 gap-4 px-4 py-3 hover-elevate active-elevate-2 rounded-md border border-border ${isSelected ? 'bg-muted/50' : ''}`}
                        data-testid={`row-client-${client.id}`}
                      >
                        <div className="col-span-1 flex items-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => {
                              const newSelected = new Set(selectedClients);
                              if (checked) {
                                newSelected.add(client.id);
                              } else {
                                newSelected.delete(client.id);
                              }
                              setSelectedClients(newSelected);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`checkbox-select-${client.id}`}
                          />
                        </div>
                        {columns.map((column) => {
                          const content = (() => {
                            switch (column.id) {
                              case "client":
                                return (
                                  <div className="flex items-center gap-2">
                                    <div>
                                      <p className="text-sm font-medium text-foreground">{client.name}</p>
                                      <p className="text-xs text-muted-foreground capitalize">
                                        {client.type === 'company' ? 'Entreprise' : 'Personne'}
                                      </p>
                                    </div>
                                  </div>
                                );
                              case "contacts":
                                return <Badge variant="outline">{clientContacts.length} contact{clientContacts.length > 1 ? 's' : ''}</Badge>;
                              case "type":
                                return (
                                  <Badge variant="secondary">
                                    {client.status === "prospecting" ? "Prospection" :
                                     client.status === "qualified" ? "Qualifié" :
                                     client.status === "negotiation" ? "Négociation" :
                                     client.status === "won" ? "Gagné" :
                                     client.status === "lost" ? "Perdu" : client.status}
                                  </Badge>
                                );
                              case "projets":
                                return <p className="text-sm text-foreground">{clientProjects.length} projet{clientProjects.length > 1 ? 's' : ''}</p>;
                              case "budget":
                                return (
                                  <p className="text-sm font-medium text-foreground">
                                    €{client.budget ? parseFloat(client.budget).toLocaleString() : "0"}
                                  </p>
                                );
                              default:
                                return null;
                            }
                          })();

                          if (column.id === "client") {
                            return (
                              <Link key={column.id} href={`/crm/${client.id}`} className={column.className}>
                                <div className="flex items-center cursor-pointer">
                                  {content}
                                </div>
                              </Link>
                            );
                          }

                          return (
                            <div key={column.id} className={`${column.className} flex items-center`}>
                              {content}
                            </div>
                          );
                        })}
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
                                onClick={(e) => {
                                  e.stopPropagation();
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
                    );
                  })}
                </div>
              </DndContext>
            ) : (
              /* Card View */
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClients.map((client) => {
                  const clientContacts = contacts.filter((c: any) => c.clientId === client.id);
                  const clientProjects = projects.filter((p: any) => p.clientId === client.id);
                  const isSelected = selectedClients.has(client.id);

                  return (
                    <Card
                      key={client.id}
                      className={`hover-elevate cursor-pointer ${isSelected ? 'ring-2 ring-primary' : ''}`}
                      data-testid={`card-client-${client.id}`}
                    >
                      <CardHeader className="flex flex-row items-start gap-4 space-y-0 pb-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            const newSelected = new Set(selectedClients);
                            if (checked) {
                              newSelected.add(client.id);
                            } else {
                              newSelected.delete(client.id);
                            }
                            setSelectedClients(newSelected);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          data-testid={`checkbox-card-select-${client.id}`}
                        />
                        <Link href={`/crm/${client.id}`} className="flex-1">
                          <div>
                            <CardTitle className="text-base">{client.name}</CardTitle>
                            <p className="text-xs text-muted-foreground capitalize mt-1">
                              {client.type === 'company' ? 'Entreprise' : 'Personne'}
                            </p>
                          </div>
                        </Link>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" data-testid={`button-card-actions-${client.id}`}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setEditingClient(client)} data-testid={`button-card-edit-${client.id}`}>
                              <Edit className="w-4 h-4 mr-2" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem data-testid={`button-card-message-${client.id}`}>
                              <MessageSquare className="w-4 h-4 mr-2" />
                              Message
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm("Êtes-vous sûr de vouloir supprimer ce client ?")) {
                                  deleteMutation.mutate(client.id);
                                }
                              }}
                              data-testid={`button-card-delete-${client.id}`}
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </CardHeader>
                      <Link href={`/crm/${client.id}`}>
                        <CardContent className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Statut</span>
                            <Badge variant="secondary">
                              {client.status === "prospecting" ? "Prospection" :
                               client.status === "qualified" ? "Qualifié" :
                               client.status === "negotiation" ? "Négociation" :
                               client.status === "won" ? "Gagné" :
                               client.status === "lost" ? "Perdu" : client.status}
                            </Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Contacts</span>
                            <Badge variant="outline">{clientContacts.length}</Badge>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Projets</span>
                            <span className="text-sm text-foreground">{clientProjects.length}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Budget</span>
                            <span className="text-sm font-medium text-foreground">
                              €{client.budget ? parseFloat(client.budget).toLocaleString() : "0"}
                            </span>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
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
