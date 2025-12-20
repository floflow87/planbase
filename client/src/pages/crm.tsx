import { useState, useEffect } from "react";
import { Search, Filter, Download, LayoutGrid, Table2, Plus, MoreVertical, Edit, MessageSquare, Trash2, TrendingUp, Users as UsersIcon, Target, Euro, X, GripVertical, ArrowUpDown, ArrowUp, ArrowDown, Settings2, Phone, Mail, Building2, Columns3 } from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
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
import { apiRequest, queryClient, optimisticAdd, optimisticUpdate, optimisticDelete, rollbackOptimistic } from "@/lib/queryClient";
import { Loader } from "@/components/Loader";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  useDraggable,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';

// Type pour les colonnes
type ColumnId = "client" | "contacts" | "type" | "projets" | "budget" | "creation";

interface Column {
  id: ColumnId;
  label: string;
  width: number;
  className: string;
  style?: React.CSSProperties;
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

// Configuration des colonnes Kanban (couleurs pastel)
const KANBAN_STATUSES = [
  { id: "prospecting", label: "Prospect", color: "bg-orange-100/50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/50", headerBg: "bg-orange-50 dark:bg-orange-950/40", textColor: "text-orange-600 dark:text-orange-400" },
  { id: "qualified", label: "Qualifié", color: "bg-blue-100/50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/50", headerBg: "bg-blue-50 dark:bg-blue-950/40", textColor: "text-blue-600 dark:text-blue-400" },
  { id: "negotiation", label: "Négociation", color: "bg-amber-100/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/50", headerBg: "bg-amber-50 dark:bg-amber-950/40", textColor: "text-amber-600 dark:text-amber-400" },
  { id: "quote_sent", label: "Devis envoyé", color: "bg-purple-100/50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/50", headerBg: "bg-purple-50 dark:bg-purple-950/40", textColor: "text-purple-600 dark:text-purple-400" },
  { id: "quote_approved", label: "Devis validé", color: "bg-cyan-100/50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900/50", headerBg: "bg-cyan-50 dark:bg-cyan-950/40", textColor: "text-cyan-600 dark:text-cyan-400" },
  { id: "won", label: "Gagné", color: "bg-emerald-100/50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50", headerBg: "bg-emerald-50 dark:bg-emerald-950/40", textColor: "text-emerald-600 dark:text-emerald-400" },
  { id: "lost", label: "Perdu", color: "bg-red-100/50 dark:bg-red-950/30 border-red-200 dark:border-red-900/50", headerBg: "bg-red-50 dark:bg-red-950/40", textColor: "text-red-600 dark:text-red-400" },
];

// Composant Kanban Card (draggable)
function DraggableKanbanCard({ 
  client, 
  contact,
  totalBudget,
  onEdit,
  onDelete,
  isDragOverlay = false,
}: { 
  client: Client; 
  contact?: Contact;
  totalBudget: number;
  onEdit: () => void;
  onDelete: () => void;
  isDragOverlay?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `client-${client.id}`,
    data: { client },
  });
  
  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  const cardContent = (
    <Card 
      ref={!isDragOverlay ? setNodeRef : undefined}
      style={!isDragOverlay ? style : undefined}
      className={`hover-elevate cursor-grab bg-card/80 backdrop-blur-sm border-border/50 ${isDragging && !isDragOverlay ? 'opacity-50' : ''}`}
      data-testid={`kanban-card-${client.id}`}
      {...(!isDragOverlay ? { ...attributes, ...listeners } : {})}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <Link href={`/crm/${client.id}`}>
              <h4 
                className="text-sm font-semibold text-foreground truncate hover:text-primary cursor-pointer transition-colors"
                onPointerDown={(e) => e.stopPropagation()}
                data-testid={`link-client-${client.id}`}
              >
                {client.name}
              </h4>
            </Link>
            {client.company && (
              <div className="flex items-center gap-1 mt-1">
                <Building2 className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{client.company}</span>
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 shrink-0" 
                data-testid={`kanban-actions-${client.id}`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-card">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }} data-testid={`kanban-edit-${client.id}`}>
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </DropdownMenuItem>
              <Link href={`/crm/${client.id}`}>
                <DropdownMenuItem data-testid={`kanban-view-${client.id}`}>
                  <Building2 className="w-4 h-4 mr-2" />
                  Voir le client
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem
                className="text-red-600"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                data-testid={`kanban-delete-${client.id}`}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        
        {contact && (
          <div className="space-y-1">
            {contact.email && (
              <div className="flex items-center gap-1.5">
                <Mail className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{contact.email}</span>
              </div>
            )}
            {contact.phone && (
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground">{contact.phone}</span>
              </div>
            )}
          </div>
        )}
        
        <div className="pt-1">
          <span className="text-sm font-bold text-primary">€ {totalBudget.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );

  return cardContent;
}

// Composant Kanban Column (droppable)
function DroppableKanbanColumn({
  status,
  clients,
  contacts,
  projects,
  onEditClient,
  onDeleteClient,
}: {
  status: typeof KANBAN_STATUSES[0];
  clients: Client[];
  contacts: Contact[];
  projects: Project[];
  onEditClient: (client: Client) => void;
  onDeleteClient: (clientId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `column-${status.id}`,
    data: { status: status.id },
  });
  
  const totalBudget = clients.reduce((sum, client) => {
    const clientProjects = projects.filter((p: any) => p.clientId === client.id);
    return sum + clientProjects.reduce((pSum, p: Project) => pSum + parseFloat(p.budget || "0"), 0);
  }, 0);

  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] flex-1" data-testid={`kanban-column-${status.id}`}>
      <div className={`flex items-center justify-between p-3 rounded-t-lg border-b ${status.headerBg} border-border/30`}>
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-semibold ${status.textColor}`}>{status.label}</h3>
          <Badge variant="secondary" className="text-xs h-5 px-1.5">{clients.length}</Badge>
        </div>
        <span className="text-xs font-medium text-muted-foreground">€ {totalBudget.toLocaleString()}</span>
      </div>
      
      <div 
        ref={setNodeRef}
        className={`p-2 space-y-2 rounded-b-lg border ${status.color} min-h-[100px] max-h-[500px] overflow-y-auto transition-all ${isOver ? 'ring-2 ring-primary/50 scale-[1.02]' : ''}`}
      >
        {clients.map((client) => {
          const clientContact = contacts.find((c: any) => c.clientId === client.id);
          const clientProjects = projects.filter((p: any) => p.clientId === client.id);
          const clientBudget = clientProjects.reduce((sum, p: Project) => sum + parseFloat(p.budget || "0"), 0);
          
          return (
            <DraggableKanbanCard
              key={client.id}
              client={client}
              contact={clientContact}
              totalBudget={clientBudget}
              onEdit={() => onEditClient(client)}
              onDelete={() => onDeleteClient(client.id)}
            />
          );
        })}
        
        {clients.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-muted-foreground">
            Aucun client
          </div>
        )}
      </div>
    </div>
  );
}

export default function CRM() {
  const { toast } = useToast();
  
  const [viewMode, setViewMode] = useState<"table" | "kanban">(() => {
    const saved = localStorage.getItem("crm_view_mode");
    return (saved === "table" || saved === "kanban") ? saved : "table";
  });
  
  // Persist view mode
  useEffect(() => {
    localStorage.setItem("crm_view_mode", viewMode);
  }, [viewMode]);
  
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
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  
  // Column visibility state with localStorage persistence
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('crmColumnVisibility');
    return saved ? JSON.parse(saved) : {
      client: true,
      contacts: true,
      type: true,
      projets: true,
      budget: true,
      creation: true,
    };
  });
  
  // Kanban column visibility state with localStorage persistence
  const [kanbanColumnVisibility, setKanbanColumnVisibility] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('crmKanbanColumnVisibility');
    if (saved) return JSON.parse(saved);
    return KANBAN_STATUSES.reduce((acc, s) => ({ ...acc, [s.id]: true }), {} as Record<string, boolean>);
  });
  
  // Persist kanban column visibility
  useEffect(() => {
    localStorage.setItem('crmKanbanColumnVisibility', JSON.stringify(kanbanColumnVisibility));
  }, [kanbanColumnVisibility]);
  
  // Colonnes configurables (flex layout - pas de col-span)
  const [columns, setColumns] = useState<Column[]>([
    { id: "client", label: "Client", width: 1, className: "" },
    { id: "contacts", label: "Contacts", width: 1, className: "" },
    { id: "type", label: "Type", width: 1, className: "" },
    { id: "projets", label: "Projets", width: 1, className: "" },
    { id: "budget", label: "Budget", width: 1, className: "" },
    { id: "creation", label: "Création", width: 1, className: "" },
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

  // Create client mutation with optimistic update
  const createMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      const res = await apiRequest("/api/clients", "POST", data);
      return res.json();
    },
    onMutate: async (data) => {
      const tempId = `temp-${Date.now()}`;
      const tempClient: Client = {
        id: tempId,
        ...data,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Client;
      const { previousData } = optimisticAdd<Client>(["/api/accounts", accountId!, "clients"], tempClient);
      return { previousData };
    },
    onSuccess: () => {
      setIsCreateDialogOpen(false);
      toast({ title: "Client créé avec succès", variant: "success" });
    },
    onError: (error, _, context) => {
      if (context?.previousData) rollbackOptimistic(["/api/accounts", accountId!, "clients"], context.previousData);
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
    },
  });

  // Update client mutation with optimistic update
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertClient> }) => {
      return await apiRequest(`/api/clients/${id}`, "PATCH", data);
    },
    onMutate: async ({ id, data }) => {
      const { previousData } = optimisticUpdate<Client>(["/api/accounts", accountId!, "clients"], id, data as Partial<Client>);
      return { previousData };
    },
    onSuccess: () => {
      setEditingClient(null);
      toast({ title: "Client mis à jour", variant: "success" });
    },
    onError: (error, _, context) => {
      if (context?.previousData) rollbackOptimistic(["/api/accounts", accountId!, "clients"], context.previousData);
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
    },
  });

  // Delete client mutation with optimistic update
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest(`/api/clients/${id}`, "DELETE");
    },
    onMutate: async (id) => {
      const { previousData } = optimisticDelete<Client>(["/api/accounts", accountId!, "clients"], id);
      return { previousData };
    },
    onSuccess: () => {
      toast({ title: "Client supprimé", variant: "success" });
    },
    onError: (error, _, context) => {
      if (context?.previousData) rollbackOptimistic(["/api/accounts", accountId!, "clients"], context.previousData);
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
    },
  });

  // Bulk delete mutation with optimistic update
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map(id => apiRequest(`/api/clients/${id}`, "DELETE")));
    },
    onMutate: async (ids) => {
      queryClient.cancelQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
      const previousData = queryClient.getQueryData<Client[]>(["/api/accounts", accountId!, "clients"]);
      queryClient.setQueryData<Client[]>(["/api/accounts", accountId!, "clients"], (old) => {
        if (!old) return old;
        return old.filter(client => !ids.includes(client.id));
      });
      return { previousData };
    },
    onSuccess: () => {
      setSelectedClients(new Set());
      toast({ title: "Clients supprimés", variant: "success" });
    },
    onError: (error, _, context) => {
      if (context?.previousData) rollbackOptimistic(["/api/accounts", accountId!, "clients"], context.previousData);
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
    },
  });
  
  // Update client status mutation (for Kanban drag and drop) with optimistic update
  const updateClientStatusMutation = useMutation({
    mutationFn: async ({ clientId, status }: { clientId: string; status: string }) => {
      return await apiRequest(`/api/clients/${clientId}`, "PATCH", { status });
    },
    onMutate: async ({ clientId, status }) => {
      const { previousData } = optimisticUpdate<Client>(["/api/accounts", accountId!, "clients"], clientId, { status } as Partial<Client>);
      return { previousData };
    },
    onSuccess: () => {
      toast({ title: "Statut mis à jour", variant: "success" });
    },
    onError: (error: Error, _, context) => {
      if (context?.previousData) rollbackOptimistic(["/api/accounts", accountId!, "clients"], context.previousData);
      toast({ title: "Erreur", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
    },
  });
  
  // Kanban drag and drop state
  const [draggingClient, setDraggingClient] = useState<Client | null>(null);
  
  const handleKanbanDragStart = (event: DragStartEvent) => {
    const { active } = event;
    if (active.data.current?.client) {
      setDraggingClient(active.data.current.client as Client);
    }
  };
  
  const handleKanbanDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingClient(null);
    
    if (!over) return;
    
    const clientId = active.id.toString().replace('client-', '');
    const newStatus = over.data.current?.status;
    
    if (newStatus && active.data.current?.client) {
      const client = active.data.current.client as Client;
      if (client.status !== newStatus) {
        updateClientStatusMutation.mutate({ clientId, status: newStatus });
      }
    }
  };

  // Bulk update status mutation with optimistic update
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: string }) => {
      await Promise.all(ids.map(id => apiRequest(`/api/clients/${id}`, "PATCH", { status })));
    },
    onMutate: async ({ ids, status }) => {
      queryClient.cancelQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
      const previousData = queryClient.getQueryData<Client[]>(["/api/accounts", accountId!, "clients"]);
      queryClient.setQueryData<Client[]>(["/api/accounts", accountId!, "clients"], (old) => {
        if (!old) return old;
        return old.map(client => ids.includes(client.id) ? { ...client, status } : client);
      });
      return { previousData };
    },
    onSuccess: () => {
      setSelectedClients(new Set());
      toast({ title: "Statuts mis à jour", variant: "success" });
    },
    onError: (error, _, context) => {
      if (context?.previousData) rollbackOptimistic(["/api/accounts", accountId!, "clients"], context.previousData);
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts", accountId, "clients"] });
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
      title: "Total Clients",
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
      case "prospecting":
        return "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400";
      case "qualified":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400";
      case "negotiation":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400";
      case "quote_sent":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400";
      case "quote_approved":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400";
      case "won":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400";
      case "lost":
        return "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400";
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

        {/* Filters bar with search, status filter, view toggles, export and new client button */}
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
              <SelectTrigger className="w-full sm:w-[180px] bg-card" data-testid="select-filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card">
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="prospecting">Prospect</SelectItem>
                <SelectItem value="qualified">Qualifié</SelectItem>
                <SelectItem value="negotiation">Négociation</SelectItem>
                <SelectItem value="quote_sent">Devis envoyé</SelectItem>
                <SelectItem value="quote_approved">Devis validé</SelectItem>
                <SelectItem value="won">Gagné</SelectItem>
                <SelectItem value="lost">Perdu</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            <Button variant="outline" size="icon" onClick={() => setViewMode("table")} data-testid="button-view-table">
              <Table2 className={`w-4 h-4 ${viewMode === "table" ? "text-primary" : ""}`} />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setViewMode("kanban")} data-testid="button-view-kanban">
              <Columns3 className={`w-4 h-4 ${viewMode === "kanban" ? "text-primary" : ""}`} />
            </Button>
            {viewMode === "table" && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsColumnSettingsOpen(true)}
                data-testid="button-column-settings"
                className="hidden md:flex"
              >
                <Settings2 className="w-4 h-4" />
              </Button>
            )}
            {viewMode === "kanban" && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-kanban-columns" className="hidden md:flex">
                    <Columns3 className="w-4 h-4 mr-2" />
                    <span>Colonnes</span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 bg-card" align="end">
                  <div className="space-y-2">
                    <p className="text-sm font-medium mb-3">Colonnes visibles</p>
                    {KANBAN_STATUSES.map(status => (
                      <div key={status.id} className="flex items-center gap-2">
                        <Checkbox 
                          id={`kanban-col-${status.id}`}
                          checked={kanbanColumnVisibility[status.id] !== false}
                          onCheckedChange={(checked) => setKanbanColumnVisibility(prev => ({...prev, [status.id]: !!checked}))}
                          data-testid={`checkbox-kanban-column-${status.id}`}
                        />
                        <Label htmlFor={`kanban-col-${status.id}`} className="text-sm cursor-pointer">{status.label}</Label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
            <Button variant="outline" size="sm" data-testid="button-export">
              <Download className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Exporter</span>
            </Button>
            <Button onClick={() => setIsCreateDialogOpen(true)} data-testid="button-new-client">
              <Plus className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline text-[12px]">Nouveau Client</span>
            </Button>
          </div>
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
                            <SelectItem value="prospecting">Prospect</SelectItem>
                            <SelectItem value="qualified">Qualifié</SelectItem>
                            <SelectItem value="negotiation">Négociation</SelectItem>
                            <SelectItem value="quote_sent">Devis envoyé</SelectItem>
                            <SelectItem value="quote_approved">Devis validé</SelectItem>
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

        {/* Clients Table/Cards - No card wrapper for table view */}
        <div className="bg-card rounded-lg">
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
                    <div className="flex items-center gap-3 px-4 h-10 text-xs font-medium text-muted-foreground bg-muted/50">
                      {/* Fixed checkbox column */}
                      <div className="w-8 flex-shrink-0 flex items-center">
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
                      {/* Dynamic columns */}
                      {columns.filter(col => columnVisibility[col.id] !== false).map((column) => (
                        <div key={column.id} className="flex-1 min-w-0">
                          <DraggableColumnHeader 
                            id={column.id} 
                            label={column.label}
                            sortColumn={sortColumn}
                            sortDirection={sortDirection}
                            onSort={handleSort}
                          />
                        </div>
                      ))}
                      {/* Fixed actions column */}
                      <div className="w-20 flex-shrink-0 text-right">Actions</div>
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
                        className={`flex items-center gap-3 px-4 py-2 hover-elevate active-elevate-2 rounded-md border-b border-border ${isSelected ? 'bg-muted/50' : ''}`}
                        data-testid={`row-client-${client.id}`}
                      >
                        {/* Fixed checkbox column */}
                        <div className="w-8 flex-shrink-0 flex items-center">
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
                        {/* Dynamic columns */}
                        {columns.filter(col => columnVisibility[col.id] !== false).map((column) => {
                          const content = (() => {
                            switch (column.id) {
                              case "client":
                                return (
                                  <div className="flex items-center gap-2">
                                    <p className="text-xs font-medium text-foreground truncate">
                                      {client.company || client.name}
                                    </p>
                                  </div>
                                );
                              case "contacts":
                                return <Badge variant="outline">{clientContacts.length} contact{clientContacts.length > 1 ? 's' : ''}</Badge>;
                              case "type":
                                return (
                                  <Badge className={getStatusBadgeColor(client.status)}>
                                    {client.status === "prospecting" ? "Prospect" :
                                     client.status === "qualified" ? "Qualifié" :
                                     client.status === "negotiation" ? "Négociation" :
                                     client.status === "quote_sent" ? "Devis envoyé" :
                                     client.status === "quote_approved" ? "Devis validé" :
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
                              <Link key={column.id} href={`/crm/${client.id}`} className="flex-1 min-w-0">
                                <div className="flex items-center cursor-pointer">
                                  {content}
                                </div>
                              </Link>
                            );
                          }

                          return (
                            <div key={column.id} className="flex-1 min-w-0 flex items-center">
                              {content}
                            </div>
                          );
                        })}
                        {/* Fixed actions column */}
                        <div className="w-20 flex-shrink-0 flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-${client.id}`}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="bg-card">
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
                
                {/* Kanban View - Always shown on mobile (< md), shown on desktop (>= md) when viewMode === "kanban" */}
                <DndContext
                  sensors={sensors}
                  onDragStart={handleKanbanDragStart}
                  onDragEnd={handleKanbanDragEnd}
                >
                  <div className={`${viewMode === "table" ? "md:hidden" : ""}`}>
                    {/* Mobile-only toolbar with column visibility */}
                    <div className="flex items-center justify-between mb-3 md:hidden">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" data-testid="button-kanban-columns-mobile">
                            <Columns3 className="w-4 h-4 mr-2" />
                            Colonnes
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-56 bg-card" align="start">
                          <div className="space-y-2">
                            <p className="text-sm font-medium mb-3">Colonnes visibles</p>
                            {KANBAN_STATUSES.map(status => (
                              <div key={status.id} className="flex items-center gap-2">
                                <Checkbox 
                                  id={`kanban-col-mobile-${status.id}`}
                                  checked={kanbanColumnVisibility[status.id] !== false}
                                  onCheckedChange={(checked) => setKanbanColumnVisibility(prev => ({...prev, [status.id]: !!checked}))}
                                  data-testid={`checkbox-kanban-column-mobile-${status.id}`}
                                />
                                <Label htmlFor={`kanban-col-mobile-${status.id}`} className="text-sm cursor-pointer">{status.label}</Label>
                              </div>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                    
                    {/* Kanban board with visible scrollbar */}
                    <div 
                      className="flex gap-4 pb-4 overflow-x-auto kanban-scrollbar" 
                      data-testid="kanban-board"
                    >
                      {KANBAN_STATUSES.filter(status => kanbanColumnVisibility[status.id] !== false).map((status) => {
                        const statusClients = filteredClients.filter(c => c.status === status.id);
                        return (
                          <DroppableKanbanColumn
                            key={status.id}
                            status={status}
                            clients={statusClients}
                            contacts={contacts}
                            projects={projects}
                            onEditClient={setEditingClient}
                            onDeleteClient={(clientId) => {
                              setClientToDelete(clientId);
                              setIsDeleteDialogOpen(true);
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                  <DragOverlay>
                    {draggingClient && (
                      <DraggableKanbanCard
                        client={draggingClient}
                        contact={contacts.find((c: any) => c.clientId === draggingClient.id)}
                        totalBudget={projects.filter((p: any) => p.clientId === draggingClient.id).reduce((sum, p: Project) => sum + parseFloat(p.budget || "0"), 0)}
                        onEdit={() => {}}
                        onDelete={() => {}}
                        isDragOverlay={true}
                      />
                    )}
                  </DragOverlay>
                </DndContext>
              </>
            )}
        </div>

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
        
        {/* Column Settings Sheet */}
        <Sheet open={isColumnSettingsOpen} onOpenChange={setIsColumnSettingsOpen}>
          <SheetContent className="w-80" data-testid="sheet-column-settings">
            <SheetHeader>
              <SheetTitle>Personnaliser les colonnes</SheetTitle>
            </SheetHeader>
            <div className="py-4 space-y-4">
              {[
                { id: "client", label: "Client", disabled: true },
                { id: "contacts", label: "Contacts" },
                { id: "type", label: "Type" },
                { id: "projets", label: "Projets" },
                { id: "budget", label: "Budget" },
                { id: "creation", label: "Date de création" },
              ].map((column) => (
                <div key={column.id} className="flex items-center justify-between">
                  <Label htmlFor={`toggle-crm-${column.id}`} className="text-sm">
                    {column.label}
                  </Label>
                  <Switch
                    id={`toggle-crm-${column.id}`}
                    checked={columnVisibility[column.id] ?? true}
                    disabled={column.disabled}
                    onCheckedChange={(checked) => {
                      const newVisibility = { ...columnVisibility, [column.id]: checked };
                      setColumnVisibility(newVisibility);
                      localStorage.setItem("crmColumnVisibility", JSON.stringify(newVisibility));
                    }}
                    data-testid={`toggle-column-${column.id}`}
                  />
                </div>
              ))}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
