import { useState, useEffect } from "react";
import { Search, Filter, Download, LayoutGrid, Table2, Plus, MoreVertical, Edit, MessageSquare, Trash2, TrendingUp, Users as UsersIcon, Target, Euro, X, GripVertical, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertClientSchema, type InsertClient, type Client, type Contact, type Project, type AppUser } from "@shared/schema";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader } from "@/components/Loader";
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
type ColumnId = "client" | "contacts" | "type" | "projets" | "budget" | "creation";

interface Column {
  id: ColumnId;
  label: string;
  width: number;
  className: string;
}

// Composant pour une colonne draggable
function DraggableColumnHeader({ 
  id, 
  label, 
  sortColumn, 
  sortDirection, 
  onSort 
}: { 
  id: string; 
  label: string;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  onSort: (columnId: string) => void;
}) {
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

  const isSorted = sortColumn === id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-1"
    >
      <div className="cursor-move flex items-center gap-1" {...attributes} {...listeners}>
        <GripVertical className="w-3 h-3 text-muted-foreground" />
      </div>
      <button
        onClick={() => onSort(id)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        <span>{label}</span>
        {isSorted ? (
          sortDirection === "asc" ? (
            <ArrowUp className="w-3 h-3" />
          ) : (
            <ArrowDown className="w-3 h-3" />
          )
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-50" />
        )}
      </button>
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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isBulkDeleteDialogOpen, setIsBulkDeleteDialogOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<string | null>(null);
  const [sortColumn, setSortColumn] = useState<ColumnId | null>(() => {
    const saved = localStorage.getItem('crmSortColumn');
    return saved ? (saved as ColumnId) : "creation";
  });
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(() => {
    const saved = localStorage.getItem('crmSortDirection');
    return saved === "asc" || saved === "desc" ? saved : "desc";
  });
  
  // Colonnes configurables
  const [columns, setColumns] = useState<Column[]>([
    { id: "client", label: "Client", width: 2, className: "col-span-2" },
    { id: "contacts", label: "Contacts", width: 2, className: "col-span-2" },
    { id: "type", label: "Type", width: 1, className: "col-span-1" },
    { id: "projets", label: "Projets", width: 1, className: "col-span-1" },
    { id: "budget", label: "Budget", width: 2, className: "col-span-2" },
    { id: "creation", label: "Création", width: 2, className: "col-span-2" },
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
      return await apiRequest("/api/clients", "POST", data);
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
      return await apiRequest(`/api/clients/${id}`, "PATCH", data);
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
      return await apiRequest(`/api/clients/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
      toast({ title: "Client supprimé", variant: "success" });
    },
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest(`/api/clients/${id}`, "DELETE")));
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
      await Promise.all(ids.map(id => apiRequest(`/api/clients/${id}`, "PATCH", { status })));
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

  // Save sort preferences to localStorage
  useEffect(() => {
    if (sortColumn) {
      localStorage.setItem('crmSortColumn', sortColumn);
    }
    localStorage.setItem('crmSortDirection', sortDirection);
  }, [sortColumn, sortDirection]);

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
  let filteredClients = clients.filter((client) => {
    const matchesStatus = filterStatus === "all" || client.status === filterStatus;
    const matchesSearch = searchQuery === "" || 
      client.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Handle sorting
  const handleSort = (columnId: string) => {
    if (sortColumn === columnId) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(columnId as ColumnId);
      setSortDirection("asc");
    }
  };

  // Sort filtered clients
  if (sortColumn) {
    filteredClients = [...filteredClients].sort((a, b) => {
      let compareA: any;
      let compareB: any;

      switch (sortColumn) {
        case "client":
          compareA = a.name.toLowerCase();
          compareB = b.name.toLowerCase();
          break;
        case "contacts":
          const contactsA = contacts.filter((c: any) => c.clientId === a.id).length;
          const contactsB = contacts.filter((c: any) => c.clientId === b.id).length;
          compareA = contactsA;
          compareB = contactsB;
          break;
        case "type":
          compareA = a.status || "";
          compareB = b.status || "";
          break;
        case "projets":
          const projectsA = projects.filter((p: any) => p.clientId === a.id).length;
          const projectsB = projects.filter((p: any) => p.clientId === b.id).length;
          compareA = projectsA;
          compareB = projectsB;
          break;
        case "budget":
          const budgetA = projects
            .filter((p: any) => p.clientId === a.id)
            .reduce((sum, p: Project) => sum + (parseFloat(p.budget || "0")), 0);
          const budgetB = projects
            .filter((p: any) => p.clientId === b.id)
            .reduce((sum, p: Project) => sum + (parseFloat(p.budget || "0")), 0);
          compareA = budgetA;
          compareB = budgetB;
          break;
        case "creation":
          compareA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          compareB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          break;
        default:
          return 0;
      }

      if (typeof compareA === "string") {
        return sortDirection === "asc" 
          ? compareA.localeCompare(compareB)
          : compareB.localeCompare(compareA);
      } else {
        return sortDirection === "asc" 
          ? compareA - compareB
          : compareB - compareA;
      }
    });
  }

  // Calculate KPIs
  const totalContacts = clients.length;
  const activeProspects = clients.filter(c => c.status === "prospect" || c.status === "in_progress").length;
  const wonClients = clients.filter(c => c.status === "signed").length;
  const conversionRate = totalContacts > 0 ? Math.round((wonClients / totalContacts) * 100) : 0;
  const totalOpportunities = clients
    .filter(c => c.status !== "signed") // Exclude won clients
    .reduce((sum, c) => sum + (Number(c.budget) || 0), 0);

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

  // Obtenir les couleurs personnalisées pour les badges de statut
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "won":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "lost":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "prospecting":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      case "negotiation":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "qualified":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  // Obtenir les couleurs personnalisées pour les badges de type
  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "company":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "person":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
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
        <Loader size="lg" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-end">
          <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-new-client">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline text-[12px]">Nouveau Client</span>
          </Button>
        </div>

        {/* Sheet pour création/modification de client */}
        <Sheet open={isCreateDialogOpen || !!editingClient} onOpenChange={(open) => {
          if (!open) {
            setIsCreateDialogOpen(false);
            setEditingClient(null);
          }
        }}>
          <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-create-client">
            <SheetHeader>
              <SheetTitle>{editingClient ? "Modifier le client" : "Nouveau client"}</SheetTitle>
            </SheetHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 flex-1 py-4">
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
                <div className="flex justify-end gap-2 border-t pt-4">
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
          </SheetContent>
        </Sheet>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, index) => {
            const Icon = kpi.icon;
            return (
              <Card key={index} data-testid={`card-kpi-${index}`}>
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground font-medium">{kpi.title}</p>
                      <h3 className="text-[22px] font-heading font-bold mt-2 text-foreground">{kpi.value}</h3>
                      <p className="text-[10px] text-green-600 mt-2">
                        {kpi.change} {kpi.changeLabel}
                      </p>
                    </div>
                    <div className={`${kpi.iconBg} p-3 rounded-md shrink-0`}>
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
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 w-full sm:w-auto">
                <div className="relative flex-1 w-full sm:max-w-sm">
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
                  <SelectTrigger className="w-full sm:w-[180px]" data-testid="select-filter-status">
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
              <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                {selectedClients.size > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{selectedClients.size} sélectionné{selectedClients.size > 1 ? 's' : ''}</span>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" data-testid="button-bulk-actions">
                          Actions
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setIsBulkDeleteDialogOpen(true)}
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
                <Button variant="outline" size="sm" data-testid="button-export" className="hidden sm:flex">
                  <Download className="w-4 h-4 mr-2" />
                  Exporter
                </Button>
                <div className="flex border rounded-md hidden md:flex">
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
            ) : (
              <>
                {/* Table View - Desktop only, shown when viewMode is "table" */}
                {viewMode === "table" && (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <div className="space-y-2 hidden md:block overflow-x-auto">
                  {/* Table Header with drag and drop */}
                  <SortableContext
                    items={columns.map(col => col.id)}
                    strategy={horizontalListSortingStrategy}
                  >
                    <div className="grid grid-cols-12 gap-2 px-4 h-10 items-center text-xs font-medium text-muted-foreground bg-muted/50">
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
                          <DraggableColumnHeader 
                            id={column.id} 
                            label={column.label}
                            sortColumn={sortColumn}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                          />
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
                        className={`grid grid-cols-12 gap-2 px-4 py-2 items-center hover-elevate active-elevate-2 rounded-md border-b border-border ${isSelected ? 'bg-muted/50' : ''}`}
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
                                    <p className="text-xs font-medium text-foreground">
                                      {client.company || client.name}
                                    </p>
                                  </div>
                                );
                              case "contacts":
                                return <Badge variant="outline">{clientContacts.length} contact{clientContacts.length > 1 ? 's' : ''}</Badge>;
                              case "type":
                                return (
                                  <Badge className={getStatusBadgeColor(client.status)}>
                                    {client.status === "prospecting" ? "Prospection" :
                                     client.status === "qualified" ? "Qualifié" :
                                     client.status === "negotiation" ? "Négociation" :
                                     client.status === "won" ? "Gagné" :
                                     client.status === "lost" ? "Perdu" : client.status}
                                  </Badge>
                                );
                              case "projets":
                                return clientProjects.length > 0 ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="text-xs text-foreground cursor-help">{clientProjects.length} projet{clientProjects.length > 1 ? 's' : ''}</p>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      <div className="space-y-1">
                                        {clientProjects.map((p: Project) => (
                                          <div key={p.id} className="text-[10px]">{p.name}</div>
                                        ))}
                                      </div>
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <p className="text-xs text-foreground">0 projet</p>
                                );
                              case "budget":
                                const totalProjectBudget = clientProjects.reduce((sum, p: Project) => {
                                  return sum + (parseFloat(p.budget || "0"));
                                }, 0);
                                return (
                                  <p className="text-xs font-medium text-foreground">
                                    €{totalProjectBudget > 0 ? totalProjectBudget.toLocaleString() : "0"}
                                  </p>
                                );
                              case "creation":
                                return (
                                  <p className="text-xs text-foreground">
                                    {client.createdAt ? new Date(client.createdAt).toLocaleDateString('fr-FR') : "-"}
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
                                  setClientToDelete(client.id);
                                  setIsDeleteDialogOpen(true);
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
                )}
                
                {/* Card View - Always shown on mobile (< md), shown on desktop (>= md) when viewMode === "card" */}
                <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 ${viewMode === "table" ? "md:hidden" : ""}`}>
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
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-base">{client.name}</CardTitle>
                              <Badge variant="outline" className="text-[10px]">
                                {clientProjects.length}
                              </Badge>
                            </div>
                            <Badge className={`${getTypeBadgeColor(client.type)} mt-1 text-[10px]`}>
                              {client.type === 'company' ? 'Entreprise' : 'Personne'}
                            </Badge>
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
                                setClientToDelete(client.id);
                                setIsDeleteDialogOpen(true);
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
                        <CardContent>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-medium text-foreground">
                              €{clientProjects.reduce((sum, p: Project) => sum + parseFloat(p.budget || "0"), 0).toLocaleString()}
                            </span>
                            <Badge className={getStatusBadgeColor(client.status)}>
                              {client.status === "prospecting" ? "Prospection" :
                               client.status === "qualified" ? "Qualifié" :
                               client.status === "negotiation" ? "Négociation" :
                               client.status === "won" ? "Gagné" :
                               client.status === "lost" ? "Perdu" : client.status}
                            </Badge>
                          </div>
                        </CardContent>
                      </Link>
                    </Card>
                  );
                })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Delete Single Client Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) setClientToDelete(null);
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer la suppression</DialogTitle>
            </DialogHeader>
            <p>Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setClientToDelete(null);
                }}
                data-testid="button-cancel-delete"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (clientToDelete) {
                    deleteMutation.mutate(clientToDelete);
                    setIsDeleteDialogOpen(false);
                    setClientToDelete(null);
                  }
                }}
                disabled={deleteMutation.isPending}
                data-testid="button-confirm-delete"
              >
                Supprimer
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bulk Delete Dialog */}
        <Dialog open={isBulkDeleteDialogOpen} onOpenChange={setIsBulkDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer la suppression</DialogTitle>
            </DialogHeader>
            <p>Êtes-vous sûr de vouloir supprimer {selectedClients.size} client(s) ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button 
                variant="outline" 
                onClick={() => setIsBulkDeleteDialogOpen(false)}
                data-testid="button-cancel-bulk-delete"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  bulkDeleteMutation.mutate(Array.from(selectedClients));
                  setIsBulkDeleteDialogOpen(false);
                }}
                disabled={bulkDeleteMutation.isPending}
                data-testid="button-confirm-bulk-delete"
              >
                Supprimer
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
