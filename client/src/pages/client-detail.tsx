import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Edit, Trash2, Plus, Mail, Phone, MapPin, Building2, User, Briefcase, MessageSquare, Clock, CheckCircle2, UserPlus, FileText, Pencil, FolderKanban, Calendar as CalendarIcon, Save, Check, ChevronLeft, ChevronRight, Star, TrendingUp, ChevronsUpDown, DollarSign, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Client, Contact, Project, AppUser, ClientComment, Activity, Task, InsertClient, ClientCustomTab, InsertClientCustomTab, ClientCustomField, InsertClientCustomField, ClientCustomFieldValue, InsertClientCustomFieldValue, Document, DocumentLink } from "@shared/schema";
import { insertClientSchema } from "@shared/schema";
import { useState, useMemo, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient, formatDateForStorage, optimisticAdd, optimisticUpdate, optimisticUpdateSingle, optimisticDelete, rollbackOptimistic } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "@/components/Loader";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useProjectStagesUI } from "@/hooks/useProjectStagesUI";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { getLabel: getStageLabel, getColor: getStageColor } = useProjectStagesUI();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isDeleteContactDialogOpen, setIsDeleteContactDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [isDeleteCommentDialogOpen, setIsDeleteCommentDialogOpen] = useState(false);
  const [commentToDelete, setCommentToDelete] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactFormData, setContactFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
  });
  const [newComment, setNewComment] = useState("");
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [taskFormData, setTaskFormData] = useState({
    title: "",
    description: "",
    priority: "medium",
    status: "todo",
    projectId: "",
    dueDate: "",
  });
  const [newTaskEffort, setNewTaskEffort] = useState<number | null>(null);
  const [newTaskAssignedTo, setNewTaskAssignedTo] = useState<string | undefined>(undefined);
  const [newTaskDueDate, setNewTaskDueDate] = useState<Date | undefined>(undefined);
  const [taskProjectComboboxOpen, setTaskProjectComboboxOpen] = useState(false);
  const [isEditClientSidebarOpen, setIsEditClientSidebarOpen] = useState(false);
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const [clientInfoForm, setClientInfoForm] = useState({
    type: "company" as "company" | "person",
    name: "",
    civility: "",
    firstName: "",
    lastName: "",
    company: "",
    email: "",
    phone: "",
    address: "",
    postalCode: "",
    city: "",
    country: "",
    nationality: "",
    budget: "",
    notes: "",
  });
  const [isCreateTabDialogOpen, setIsCreateTabDialogOpen] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [newTabIcon, setNewTabIcon] = useState("");
  const [isCreateFieldDialogOpen, setIsCreateFieldDialogOpen] = useState(false);
  const [selectedTabForField, setSelectedTabForField] = useState<string | null>(null);
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);
  const [isDeleteFieldDialogOpen, setIsDeleteFieldDialogOpen] = useState(false);
  const [newFieldData, setNewFieldData] = useState({
    name: "",
    fieldType: "text",
    options: "",
  });
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabName, setEditingTabName] = useState("");
  const [deleteTabDialogOpen, setDeleteTabDialogOpen] = useState(false);
  const [tabToDelete, setTabToDelete] = useState<{ id: string; name: string } | null>(null);
  const [localFieldValues, setLocalFieldValues] = useState<Record<string, any>>({});
  const savedFieldValuesRef = useRef<Record<string, any>>({});
  
  // Activity management state
  const [isActivityDialogOpen, setIsActivityDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [deleteActivityId, setDeleteActivityId] = useState<string | null>(null);
  const [isDeleteActivityDialogOpen, setIsDeleteActivityDialogOpen] = useState(false);
  const [activityFormData, setActivityFormData] = useState({
    kind: "custom" as string,
    description: "",
    occurredAt: "",
  });
  const [isActivityDatePickerOpen, setIsActivityDatePickerOpen] = useState(false);

  // Fetch current user to get accountId
  const { data: currentUser } = useQuery<AppUser>({
    queryKey: ["/api/me"],
  });

  const accountId = currentUser?.accountId;

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['/api/clients', id],
    enabled: !!accountId && !!id,
  });

  // Fetch all clients for prev/next navigation
  const { data: allClients = [] } = useQuery<Client[]>({
    queryKey: ['/api/clients'],
    enabled: !!accountId,
  });

  // Memoized navigation for prev/next clients (sorted alphabetically)
  const clientNavigation = useMemo(() => {
    if (!id || allClients.length === 0) {
      return { prevClient: null, nextClient: null, isReady: false };
    }
    const sortedClients = [...allClients].sort((a, b) => a.name.localeCompare(b.name));
    const currentIndex = sortedClients.findIndex(c => c.id === id);
    if (currentIndex === -1) {
      return { prevClient: null, nextClient: null, isReady: false };
    }
    return {
      prevClient: currentIndex > 0 ? sortedClients[currentIndex - 1] : null,
      nextClient: currentIndex < sortedClients.length - 1 ? sortedClients[currentIndex + 1] : null,
      isReady: true
    };
  }, [allClients, id]);

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['/api/contacts'],
    select: (data) => data.filter((c: Contact) => c.clientId === id),
    enabled: !!accountId,
  });

  const { data: allProjects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    enabled: !!accountId,
  });

  // Filter projects for this client
  const projects = useMemo(() => {
    return allProjects.filter((p: Project) => p.clientId === id);
  }, [allProjects, id]);

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    enabled: !!accountId,
  });

  // Filter tasks that belong to this client (either directly or via projects)
  const tasks = useMemo(() => {
    const projectIds = projects.map(p => p.id);
    return allTasks.filter(t => 
      t.clientId === id || // Direct client link
      (t.projectId && projectIds.includes(t.projectId)) // Or via project
    );
  }, [allTasks, projects, id]);

  const { data: comments = [] } = useQuery<ClientComment[]>({
    queryKey: ['/api/clients', id, 'comments'],
    enabled: !!accountId && !!id,
  });

  const { data: clientActivities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/clients', id, 'activities'],
    enabled: !!accountId && !!id,
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ['/api/accounts', accountId, 'users'],
    enabled: !!accountId,
  });

  const { data: customTabs = [] } = useQuery<ClientCustomTab[]>({
    queryKey: ['/api/client-custom-tabs'],
    enabled: !!accountId,
  });

  const { data: customFields = [] } = useQuery<ClientCustomField[]>({
    queryKey: ['/api/client-custom-fields'],
    enabled: !!accountId,
  });

  const { data: fieldValues = [] } = useQuery<ClientCustomFieldValue[]>({
    queryKey: ['/api/clients', id, 'field-values'],
    enabled: !!accountId && !!id,
  });

  const { data: allDocuments = [] } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
    enabled: !!accountId,
  });

  const { data: documentLinks = [] } = useQuery<DocumentLink[]>({
    queryKey: ['/api/document-links'],
    enabled: !!accountId,
  });

  // Filter documents for this client and its projects
  const clientDocuments = useMemo(() => {
    const projectIds = new Set(projects.map(p => p.id));
    
    const relevantDocIds = new Set(
      documentLinks
        .filter(link => 
          (link.targetType === "client" && link.targetId === id) ||
          (link.targetType === "project" && projectIds.has(link.targetId))
        )
        .map(link => link.documentId)
    );
    
    return allDocuments.filter(doc => relevantDocIds.has(doc.id));
  }, [allDocuments, documentLinks, projects, id]);

  // Form for client edit
  const clientForm = useForm<InsertClient>({
    resolver: zodResolver(insertClientSchema),
    defaultValues: {
      name: "",
      type: "company",
      status: "prospecting",
      budget: "",
      accountId: accountId || "",
      createdBy: currentUser?.id || "",
    },
  });

  // Update form when client data loads
  useEffect(() => {
    if (client && accountId && currentUser) {
      clientForm.reset({
        name: client.name,
        type: client.type || "company",
        status: client.status || "prospecting",
        budget: client.budget || "",
        accountId,
        createdBy: client.createdBy || currentUser.id,
      });
      // Initialize client info form with current values
      setClientInfoForm({
        type: (client.type as "company" | "person") || "company",
        name: client.name || "",
        civility: client.civility || "",
        firstName: client.firstName || "",
        lastName: (client as any).lastName || "",
        company: client.company || "",
        email: (client as any).email || "",
        phone: (client as any).phone || "",
        address: client.address || "",
        postalCode: client.postalCode || "",
        city: client.city || "",
        country: client.country || "",
        nationality: client.nationality || "",
        budget: client.budget || "",
        notes: client.notes || "",
      });
    }
  }, [client, accountId, currentUser, clientForm]);

  // Initialize local field values from server data
  useEffect(() => {
    const initialValues: Record<string, any> = {};
    fieldValues.forEach(fv => {
      initialValues[fv.fieldId] = fv.value;
    });
    
    // Only update if server data is different from saved ref
    // This prevents overwriting unsaved local edits
    const serverSnapshot = JSON.stringify(initialValues);
    const savedSnapshot = JSON.stringify(savedFieldValuesRef.current);
    
    if (serverSnapshot !== savedSnapshot) {
      // Deep clone to avoid reference sharing
      const clonedValues = JSON.parse(JSON.stringify(initialValues));
      setLocalFieldValues(clonedValues);
      savedFieldValuesRef.current = JSON.parse(JSON.stringify(initialValues));
    }
  }, [fieldValues]);

  // Debounce field value updates
  useEffect(() => {
    const timers: Record<string, NodeJS.Timeout> = {};
    
    Object.entries(localFieldValues).forEach(([fieldId, value]) => {
      const savedValue = savedFieldValuesRef.current[fieldId];
      
      // Only save if value has changed from last saved value
      if (JSON.stringify(value) !== JSON.stringify(savedValue)) {
        timers[fieldId] = setTimeout(() => {
          upsertFieldValueMutation.mutate({ fieldId, value });
        }, 500);
      }
    });

    return () => {
      Object.values(timers).forEach(timer => clearTimeout(timer));
    };
  }, [localFieldValues]);

  const updateClientMutation = useMutation({
    mutationFn: async (data: InsertClient) => {
      return await apiRequest(`/api/clients/${id}`, "PATCH", data);
    },
    onMutate: async (data: InsertClient) => {
      const { previousData: prevList } = optimisticUpdate<Client>(['/api/clients'], id!, data);
      const { previousData: prevSingle } = optimisticUpdateSingle<Client>(['/api/clients', id!], data);
      return { prevList, prevSingle };
    },
    onSuccess: () => {
      setIsEditClientSidebarOpen(false);
      toast({ title: "Client mis à jour", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.prevList) rollbackOptimistic(['/api/clients'], context.prevList);
      if (context?.prevSingle) rollbackOptimistic(['/api/clients', id!], context.prevSingle);
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id] });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/clients/${id}`, "DELETE");
    },
    onMutate: async () => {
      const { previousData } = optimisticDelete<Client>(['/api/clients'], id!);
      return { previousData };
    },
    onSuccess: () => {
      toast({ title: "Client supprimé avec succès", variant: "success" });
      setLocation("/crm");
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/clients'], context.previousData);
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom';
      const response = await apiRequest("/api/contacts", "POST", { 
        ...data, 
        clientId: id,
        fullName,
        accountId
      });
      return response.json();
    },
    onMutate: async (data: any) => {
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom';
      const tempContact = {
        id: `temp-${Date.now()}`,
        ...data,
        clientId: id,
        fullName,
        accountId,
      } as Contact;
      const { previousData } = optimisticAdd<Contact>(['/api/contacts'], tempContact);
      return { previousData };
    },
    onSuccess: () => {
      setIsContactDialogOpen(false);
      setContactFormData({ firstName: "", lastName: "", email: "", phone: "", position: "" });
      toast({ title: "Contact créé avec succès", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/contacts'], context.previousData);
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id: contactId, data }: { id: string; data: any }) => {
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom';
      return await apiRequest(`/api/contacts/${contactId}`, "PATCH", { ...data, fullName });
    },
    onMutate: async ({ id: contactId, data }) => {
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom';
      const { previousData } = optimisticUpdate<Contact>(['/api/contacts'], contactId, { ...data, fullName });
      return { previousData };
    },
    onSuccess: () => {
      setIsContactDialogOpen(false);
      setEditingContact(null);
      setContactFormData({ firstName: "", lastName: "", email: "", phone: "", position: "" });
      toast({ title: "Contact mis à jour", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/contacts'], context.previousData);
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest(`/api/contacts/${contactId}`, "DELETE");
    },
    onMutate: async (contactId: string) => {
      const { previousData } = optimisticDelete<Contact>(['/api/contacts'], contactId);
      return { previousData };
    },
    onSuccess: () => {
      setIsDeleteContactDialogOpen(false);
      setContactToDelete(null);
      toast({ title: "Contact supprimé", variant: "default" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/contacts'], context.previousData);
      toast({ title: "Erreur lors de la suppression du contact", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest(`/api/clients/${id}/comments`, "POST", { content });
      return response.json();
    },
    onMutate: async (content: string) => {
      const tempComment = {
        id: `temp-${Date.now()}`,
        clientId: id,
        content,
        createdAt: new Date().toISOString(),
      } as ClientComment;
      const { previousData } = optimisticAdd<ClientComment>(['/api/clients', id!, 'comments'], tempComment);
      return { previousData };
    },
    onSuccess: () => {
      setNewComment("");
      toast({ title: "Commentaire ajouté", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/clients', id!, 'comments'], context.previousData);
      toast({ title: "Erreur lors de l'ajout du commentaire", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest(`/api/clients/${id}/comments/${commentId}`, "DELETE");
    },
    onMutate: async (commentId: string) => {
      const { previousData } = optimisticDelete<ClientComment>(['/api/clients', id!, 'comments'], commentId);
      return { previousData };
    },
    onSuccess: () => {
      setIsDeleteCommentDialogOpen(false);
      setCommentToDelete(null);
      toast({ title: "Commentaire supprimé", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/clients', id!, 'comments'], context.previousData);
      toast({ title: "Erreur lors de la suppression du commentaire", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      const taskData: any = {
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: data.status,
        clientId: id,
        accountId,
        projectId: data.projectId || null,
        assignedToId: data.assignedToId || null,
        effort: data.effort || null,
        dueDate: data.dueDate 
          ? (typeof data.dueDate === 'string' ? data.dueDate : formatDateForStorage(new Date(data.dueDate)))
          : null,
      };
      const response = await apiRequest("/api/tasks", "POST", taskData);
      return response.json();
    },
    onMutate: async (data: any) => {
      const tempTask = {
        id: `temp-${Date.now()}`,
        title: data.title,
        description: data.description || null,
        priority: data.priority,
        status: data.status,
        clientId: id,
        accountId,
        projectId: data.projectId || null,
        dueDate: data.dueDate 
          ? (typeof data.dueDate === 'string' ? data.dueDate : formatDateForStorage(new Date(data.dueDate)))
          : null,
      } as Task;
      const { previousData } = optimisticAdd<Task>(['/api/tasks'], tempTask);
      return { previousData };
    },
    onSuccess: () => {
      setIsTaskDialogOpen(false);
      setTaskFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "todo",
        projectId: "",
        dueDate: "",
      });
      setNewTaskEffort(null);
      setNewTaskAssignedTo(undefined);
      setNewTaskDueDate(undefined);
      toast({ title: "Tâche créée avec succès", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/tasks'], context.previousData);
      toast({ title: "Erreur lors de la création de la tâche", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
    },
  });

  const createCustomTabMutation = useMutation({
    mutationFn: async (data: { name: string; icon?: string }) => {
      const maxOrder = customTabs.length > 0 ? Math.max(...customTabs.map(t => t.order)) : -1;
      const response = await apiRequest("/api/client-custom-tabs", "POST", {
        name: data.name,
        icon: data.icon || null,
        order: maxOrder + 1,
      });
      return response.json();
    },
    onMutate: async (data: { name: string; icon?: string }) => {
      const maxOrder = customTabs.length > 0 ? Math.max(...customTabs.map(t => t.order)) : -1;
      const tempTab = {
        id: `temp-${Date.now()}`,
        name: data.name,
        icon: data.icon || null,
        order: maxOrder + 1,
        accountId,
      } as ClientCustomTab;
      const { previousData } = optimisticAdd<ClientCustomTab>(['/api/client-custom-tabs'], tempTab);
      return { previousData };
    },
    onSuccess: () => {
      setIsCreateTabDialogOpen(false);
      setNewTabName("");
      setNewTabIcon("");
      toast({ title: "Onglet personnalisé créé", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/client-custom-tabs'], context.previousData);
      toast({ title: "Erreur lors de la création de l'onglet", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-tabs'] });
    },
  });

  const deleteCustomTabMutation = useMutation({
    mutationFn: async (tabId: string) => {
      return await apiRequest(`/api/client-custom-tabs/${tabId}`, "DELETE");
    },
    onMutate: async (tabId: string) => {
      const { previousData } = optimisticDelete<ClientCustomTab>(['/api/client-custom-tabs'], tabId);
      return { previousData };
    },
    onSuccess: () => {
      toast({ title: "Onglet personnalisé supprimé", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/client-custom-tabs'], context.previousData);
      toast({ title: "Erreur lors de la suppression de l'onglet", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-fields'] });
    },
  });

  const updateCustomTabMutation = useMutation({
    mutationFn: async (data: { tabId: string; name: string }) => {
      return await apiRequest(`/api/client-custom-tabs/${data.tabId}`, "PATCH", {
        name: data.name,
      });
    },
    onMutate: async (data: { tabId: string; name: string }) => {
      const { previousData } = optimisticUpdate<ClientCustomTab>(['/api/client-custom-tabs'], data.tabId, { name: data.name });
      return { previousData };
    },
    onSuccess: () => {
      setEditingTabId(null);
      setEditingTabName("");
      toast({ title: "Onglet personnalisé modifié", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/client-custom-tabs'], context.previousData);
      toast({ title: "Erreur lors de la modification de l'onglet", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-tabs'] });
    },
  });

  const createCustomFieldMutation = useMutation({
    mutationFn: async (data: { tabId: string; name: string; fieldType: string; options?: string }) => {
      const tabFields = customFields.filter(f => f.tabId === data.tabId);
      const maxOrder = tabFields.length > 0 ? Math.max(...tabFields.map(f => f.order)) : -1;
      const response = await apiRequest("/api/client-custom-fields", "POST", {
        tabId: data.tabId,
        name: data.name,
        fieldType: data.fieldType,
        options: data.options && data.options.trim() ? data.options.split(',').map(o => o.trim()) : [],
        order: maxOrder + 1,
      });
      return response.json();
    },
    onMutate: async (data: { tabId: string; name: string; fieldType: string; options?: string }) => {
      const tabFields = customFields.filter(f => f.tabId === data.tabId);
      const maxOrder = tabFields.length > 0 ? Math.max(...tabFields.map(f => f.order)) : -1;
      const tempField = {
        id: `temp-${Date.now()}`,
        tabId: data.tabId,
        name: data.name,
        fieldType: data.fieldType,
        options: data.options && data.options.trim() ? data.options.split(',').map(o => o.trim()) : [],
        order: maxOrder + 1,
        accountId,
      } as ClientCustomField;
      const { previousData } = optimisticAdd<ClientCustomField>(['/api/client-custom-fields'], tempField);
      return { previousData };
    },
    onSuccess: () => {
      setIsCreateFieldDialogOpen(false);
      setNewFieldData({ name: "", fieldType: "text", options: "" });
      toast({ title: "Champ personnalisé créé", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/client-custom-fields'], context.previousData);
      toast({ title: "Erreur lors de la création du champ", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-fields'] });
    },
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      return await apiRequest(`/api/client-custom-fields/${fieldId}`, "DELETE");
    },
    onMutate: async (fieldId: string) => {
      const { previousData } = optimisticDelete<ClientCustomField>(['/api/client-custom-fields'], fieldId);
      return { previousData };
    },
    onSuccess: () => {
      setIsDeleteFieldDialogOpen(false);
      setDeleteFieldId(null);
      toast({ title: "Champ supprimé avec succès", variant: "success" });
    },
    onError: (error, variables, context) => {
      if (context?.previousData) rollbackOptimistic(['/api/client-custom-fields'], context.previousData);
      toast({ title: "Erreur lors de la suppression du champ", variant: "destructive" });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'field-values'] });
    },
  });

  const upsertFieldValueMutation = useMutation<ClientCustomFieldValue, Error, { fieldId: string; value: any }>({
    mutationFn: async (data: { fieldId: string; value: any }) => {
      const response = await apiRequest(`/api/clients/${id}/field-values`, "POST", {
        fieldId: data.fieldId,
        value: data.value,
      });
      return await response.json();
    },
    onSuccess: (response, variables) => {
      // Sync local state with normalized value from server to prevent re-trigger loops
      // The backend may normalize values (trim, coerce, etc.), so we need to update
      // both savedFieldValuesRef and localFieldValues to match the server response
      setLocalFieldValues(prev => ({
        ...prev,
        [variables.fieldId]: response.value
      }));
      
      savedFieldValuesRef.current = {
        ...savedFieldValuesRef.current,
        [variables.fieldId]: response.value
      };
      
      // Update the cache directly instead of invalidating to avoid refetch
      queryClient.setQueryData<ClientCustomFieldValue[]>(
        ['/api/clients', id, 'field-values'],
        (oldData) => {
          // Handle empty cache by creating new array with response
          if (!oldData) return [response];
          
          const existingIndex = oldData.findIndex(v => v.fieldId === variables.fieldId);
          if (existingIndex >= 0) {
            // Update existing value with full response
            const newData = [...oldData];
            newData[existingIndex] = response;
            return newData;
          } else {
            // Add new value
            return [...oldData, response];
          }
        }
      );
    },
    onError: () => {
      toast({ title: "Erreur lors de la modification du champ", variant: "destructive" });
    },
  });

  // Activity mutations
  const createActivityMutation = useMutation({
    mutationFn: async (data: { kind: string; description: string; occurredAt: string }) => {
      return await apiRequest("/api/activities", "POST", {
        subjectType: "client",
        subjectId: id,
        kind: data.kind,
        description: data.description,
        occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'activities'] });
      setIsActivityDialogOpen(false);
      setActivityFormData({ kind: "custom", description: "", occurredAt: "" });
      toast({ title: "Activité créée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création de l'activité", variant: "destructive" });
    },
  });

  const updateActivityMutation = useMutation({
    mutationFn: async (data: { id: string; kind: string; description: string; occurredAt: string }) => {
      return await apiRequest(`/api/activities/${data.id}`, "PATCH", {
        kind: data.kind,
        description: data.description,
        occurredAt: data.occurredAt ? new Date(data.occurredAt).toISOString() : null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'activities'] });
      setIsActivityDialogOpen(false);
      setEditingActivity(null);
      setActivityFormData({ kind: "custom", description: "", occurredAt: "" });
      toast({ title: "Activité modifiée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la modification de l'activité", variant: "destructive" });
    },
  });

  const deleteActivityMutation = useMutation({
    mutationFn: async (activityId: string) => {
      return await apiRequest(`/api/activities/${activityId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'activities'] });
      setIsDeleteActivityDialogOpen(false);
      setDeleteActivityId(null);
      toast({ title: "Activité supprimée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression de l'activité", variant: "destructive" });
    },
  });

  const handleActivitySubmit = () => {
    if (!activityFormData.description.trim()) return;
    if (editingActivity) {
      updateActivityMutation.mutate({
        id: editingActivity.id,
        ...activityFormData,
      });
    } else {
      createActivityMutation.mutate(activityFormData);
    }
  };

  const openActivityDialog = (activity?: Activity) => {
    if (activity) {
      setEditingActivity(activity);
      setActivityFormData({
        kind: activity.kind,
        description: activity.description || "",
        occurredAt: activity.occurredAt ? format(new Date(activity.occurredAt), "yyyy-MM-dd") : "",
      });
    } else {
      setEditingActivity(null);
      setActivityFormData({ kind: "custom", description: "", occurredAt: format(new Date(), "yyyy-MM-dd") });
    }
    setIsActivityDialogOpen(true);
  };

  const handleCommentSubmit = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment);
  };

  const handleTaskSubmit = () => {
    if (!taskFormData.title.trim()) return;
    createTaskMutation.mutate({
      ...taskFormData,
      dueDate: newTaskDueDate ? formatDateForStorage(newTaskDueDate) : "",
      assignedToId: newTaskAssignedTo || null,
      effort: newTaskEffort,
    });
  };

  const handleContactSubmit = () => {
    if (editingContact) {
      updateContactMutation.mutate({ id: editingContact.id, data: contactFormData });
    } else {
      createContactMutation.mutate(contactFormData);
    }
  };

  const openContactDialog = (contact?: Contact) => {
    if (contact) {
      setEditingContact(contact);
      setContactFormData({
        firstName: contact.firstName || "",
        lastName: contact.lastName || "",
        email: contact.email || "",
        phone: contact.phone || "",
        position: contact.position || "",
      });
    } else {
      setEditingContact(null);
      setContactFormData({ firstName: "", lastName: "", email: "", phone: "", position: "" });
    }
    setIsContactDialogOpen(true);
  };

  const saveClientInfo = async () => {
    try {
      await apiRequest(`/api/clients/${id}`, "PATCH", clientInfoForm);
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id] });
      setIsEditClientSidebarOpen(false);
      toast({ title: "Informations mises à jour", variant: "success" });
    } catch (error) {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  const updateClientStatus = async (newStatus: string) => {
    try {
      const oldStatus = client?.status;
      await apiRequest(`/api/clients/${id}`, "PATCH", { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id] });
      if (oldStatus && oldStatus !== newStatus) {
        const statusLabels: Record<string, string> = {
          prospecting: "Prospect", qualified: "Qualifié", negotiation: "Négociation",
          quote_sent: "Devis envoyé", quote_approved: "Devis validé", won: "Gagné", lost: "Perdu",
        };
        await apiRequest("/api/activities", "POST", {
          clientId: id,
          accountId,
          kind: "note",
          description: `Étape modifiée : ${statusLabels[oldStatus] || oldStatus} → ${statusLabels[newStatus] || newStatus}`,
          occurredAt: new Date().toISOString(),
        });
        queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'activities'] });
      }
      setIsStatusPopoverOpen(false);
      toast({ title: "Statut mis à jour", variant: "success" });
    } catch (error) {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader size="lg" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Client non trouvé</div>
      </div>
    );
  }

  const statusConfig: Record<string, { label: string; color: string }> = {
    prospecting: { label: "Prospect", color: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400" },
    qualified: { label: "Qualifié", color: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-400" },
    negotiation: { label: "Négociation", color: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400" },
    quote_sent: { label: "Devis envoyé", color: "bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-400" },
    quote_approved: { label: "Devis validé", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-400" },
    won: { label: "Gagné", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400" },
    lost: { label: "Perdu", color: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400" },
  };
  const currentStatus = statusConfig[client.status] || { label: client.status, color: "" };

  const lastActivityDate = (() => {
    const allDates = [
      ...clientActivities.map(a => a.occurredAt ? new Date(a.occurredAt) : new Date(a.createdAt || 0)),
      ...comments.map(c => new Date(c.createdAt)),
      ...tasks.map(t => new Date(t.createdAt)),
    ].filter(d => !isNaN(d.getTime()));
    if (allDates.length === 0) return null;
    return new Date(Math.max(...allDates.map(d => d.getTime())));
  })();

  const daysSinceLastActivity = lastActivityDate
    ? Math.floor((Date.now() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="h-full overflow-auto bg-[#F8FAFC] dark:bg-background">
      <div className="p-4 sm:p-6 max-w-full overflow-x-hidden">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/crm">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-heading font-bold text-foreground truncate">{client.company || client.name}</h1>
              {client.type === "person" && (client.firstName || (client as any).lastName) && (
                <p className="text-xs text-muted-foreground truncate">{client.firstName} {(client as any).lastName}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                disabled={!clientNavigation.isReady || !clientNavigation.prevClient}
                onClick={() => clientNavigation.prevClient && setLocation(`/crm/${clientNavigation.prevClient.id}`)}
                data-testid="button-prev-client"
                title={clientNavigation.prevClient ? `Client précédent : ${clientNavigation.prevClient.name}` : "Pas de client précédent"}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                disabled={!clientNavigation.isReady || !clientNavigation.nextClient}
                onClick={() => clientNavigation.nextClient && setLocation(`/crm/${clientNavigation.nextClient.id}`)}
                data-testid="button-next-client"
                title={clientNavigation.nextClient ? `Client suivant : ${clientNavigation.nextClient.name}` : "Pas de client suivant"}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="destructive"
              size="icon"
              onClick={() => setIsDeleteDialogOpen(true)}
              data-testid="button-delete"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Main layout: Info sidebar + Tabs */}
        <div className="flex gap-5 items-start">

          {/* ── Info Sidebar ── */}
          <Card className="w-52 shrink-0 bg-white dark:bg-card shadow-sm">
            <CardContent className="p-3 space-y-3">
            {/* Avatar + name */}
            <div className="flex flex-col items-center gap-2 py-2">
              <Avatar className="w-14 h-14">
                <AvatarFallback className="text-base font-semibold">{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  <p className="text-sm font-semibold text-foreground leading-tight">{client.company || client.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 shrink-0"
                    onClick={() => setIsEditClientSidebarOpen(true)}
                    data-testid="button-edit-client-sidebar"
                  >
                    <Pencil className="w-3 h-3" />
                  </Button>
                </div>
                {client.type === "person" && (client.firstName || (client as any).lastName) && (
                  <p className="text-xs text-muted-foreground mt-0.5">{client.firstName} {(client as any).lastName}</p>
                )}
              </div>
            </div>

            {/* Status (clickable) + type */}
            <div className="flex flex-col gap-1.5">
              <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
                <PopoverTrigger asChild>
                  <button data-testid="button-edit-status" className="w-full">
                    <Badge className={`w-full justify-center cursor-pointer hover-elevate text-[11px] ${currentStatus.color}`}>
                      {currentStatus.label}
                    </Badge>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 p-0 bg-white dark:bg-gray-900" align="start">
                  <Command>
                    <CommandList>
                      <CommandGroup className="bg-white dark:bg-gray-900">
                        {Object.entries(statusConfig).map(([value, cfg]) => (
                          <CommandItem
                            key={value}
                            onSelect={() => updateClientStatus(value)}
                            data-testid={`status-option-${value}`}
                            className="cursor-pointer"
                          >
                            <Check className={`mr-2 h-4 w-4 ${client.status === value ? 'opacity-100' : 'opacity-0'}`} />
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <Badge variant="outline" className="justify-center text-[11px]">
                {client.type === "company" ? "Entreprise" : "Personne"}
              </Badge>
            </div>

            {/* Info fields */}
            <div className="space-y-2 pt-1 border-t">
              {(client as any).email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground truncate">{(client as any).email}</span>
                </div>
              )}
              {(client as any).phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">{(client as any).phone}</span>
                </div>
              )}
              {(client.address || client.city) && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-tight">
                    {[client.address, client.city, client.postalCode, client.country].filter(Boolean).join(', ')}
                  </span>
                </div>
              )}
              {client.budget && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-foreground">
                    {parseFloat(client.budget).toLocaleString("fr-FR", { style: "currency", currency: "EUR", minimumFractionDigits: 0 })}
                  </span>
                </div>
              )}
              {(client as any).notes && (
                <div className="flex items-start gap-2">
                  <StickyNote className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="text-xs text-muted-foreground leading-tight line-clamp-3">{(client as any).notes}</span>
                </div>
              )}
              {client.createdAt && (
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Depuis le {format(new Date(client.createdAt), "dd/MM/yyyy", { locale: fr })}
                  </span>
                </div>
              )}
            </div>
            </CardContent>
          </Card>

          {/* ── Tabs ── */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="vue_ensemble" className="w-full">
              <TabsList className="w-full justify-start mb-3 overflow-x-auto overflow-y-hidden flex-nowrap h-9 p-0.5">
                <TabsTrigger value="vue_ensemble" data-testid="tab-vue-ensemble" className="gap-1.5 text-xs h-8 px-3">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Vue d'ensemble</span>
                </TabsTrigger>
                <TabsTrigger value="contacts" data-testid="tab-contacts" className="gap-1.5 text-xs h-8 px-3">
                  <UserPlus className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Contacts</span>
                  {contacts.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 text-[10px] h-4 px-1">{contacts.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="commentaires" data-testid="tab-commentaires" className="gap-1.5 text-xs h-8 px-3">
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Commentaires</span>
                  {comments.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 text-[10px] h-4 px-1">{comments.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="taches" data-testid="tab-taches" className="gap-1.5 text-xs h-8 px-3">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tâches</span>
                  {tasks.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 text-[10px] h-4 px-1">{tasks.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="projets" data-testid="tab-projets" className="gap-1.5 text-xs h-8 px-3">
                  <FolderKanban className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Projets</span>
                  {projects.length > 0 && (
                    <Badge variant="secondary" className="ml-0.5 text-[10px] h-4 px-1">{projects.length}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="documents" data-testid="tab-documents" className="gap-1.5 text-xs h-8 px-3">
                  <FileText className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Docs</span>
                </TabsTrigger>
                {customTabs.map((tab) => (
                  <TabsTrigger
                    key={tab.id}
                    value={`custom-${tab.id}`}
                    data-testid={`tab-custom-${tab.id}`}
                    className="gap-1.5 text-xs h-8 px-3 group relative pr-7"
                  >
                    <span className="hidden sm:inline">{tab.name}</span>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setTabToDelete({ id: tab.id, name: tab.name });
                        setDeleteTabDialogOpen(true);
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.stopPropagation();
                          e.preventDefault();
                          setTabToDelete({ id: tab.id, name: tab.name });
                          setDeleteTabDialogOpen(true);
                        }
                      }}
                      aria-label={`Supprimer l'onglet ${tab.name}`}
                      data-testid={`button-delete-tab-${tab.id}`}
                      className="absolute right-1 top-1/2 -translate-y-1/2 opacity-50 group-hover:opacity-100 focus:opacity-100 transition-opacity cursor-pointer rounded p-0.5"
                    >
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </span>
                  </TabsTrigger>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsCreateTabDialogOpen(true)}
                  data-testid="button-add-tab"
                  className="ml-1 h-7 w-7 p-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </TabsList>

              {/* ── Vue d'ensemble ── */}
              <TabsContent value="vue_ensemble" className="space-y-4">
                {/* KPI Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-blue-100 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                        <CalendarIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Client depuis</p>
                        <p className="text-sm font-semibold text-foreground leading-tight">
                          {format(new Date(client.createdAt), "dd MMM yyyy", { locale: fr })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-violet-100 dark:bg-violet-950/50 flex items-center justify-center shrink-0">
                        <FolderKanban className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Projet(s)</p>
                        <p className="text-sm font-semibold text-foreground">{projects.length}</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-md bg-emerald-100 dark:bg-emerald-950/50 flex items-center justify-center shrink-0">
                        <Clock className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground">Dernière activité</p>
                        <p className="text-sm font-semibold text-foreground">
                          {daysSinceLastActivity === null
                            ? "—"
                            : daysSinceLastActivity === 0
                            ? "Aujourd'hui"
                            : `il y a ${daysSinceLastActivity}j`}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Unified Activities */}
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight">Activités</CardTitle>
                    <Button onClick={() => openActivityDialog()} data-testid="button-add-activity" size="sm" className="text-[11px] h-7 px-2">
                      <Plus className="w-3 h-3 mr-1" />
                      Nouvelle activité
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {clientActivities.length === 0 && ([...comments, ...contacts, ...projects, ...tasks].length === 0) ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Aucune activité enregistrée pour ce client
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientActivities.map((activity) => {
                          const author = users.find((u) => u.id === activity.createdBy);
                          const activityKindLabels: Record<string, string> = {
                            email: "Email", call: "Appel", meeting: "Réunion", note: "Note", task: "Tâche", custom: "Autre",
                          };
                          return (
                            <div
                              key={activity.id}
                              className="flex items-start justify-between p-3 border rounded-md hover-elevate"
                              data-testid={`activity-item-${activity.id}`}
                            >
                              <div className="flex items-start gap-3 flex-1">
                                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                  <Clock className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                      {activityKindLabels[activity.kind] || activity.kind}
                                    </Badge>
                                    {activity.occurredAt && (
                                      <span className="text-[10px] text-muted-foreground">
                                        {format(new Date(activity.occurredAt), "d MMM yyyy", { locale: fr })}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-foreground whitespace-pre-wrap">{activity.description}</p>
                                  {author && (
                                    <p className="text-[10px] text-muted-foreground mt-0.5">
                                      Par {author.firstName} {author.lastName}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                <Button variant="ghost" size="icon" onClick={() => openActivityDialog(activity)} data-testid={`button-edit-activity-${activity.id}`} className="h-6 w-6">
                                  <Pencil className="w-3 h-3 text-muted-foreground" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => { setDeleteActivityId(activity.id); setIsDeleteActivityDialogOpen(true); }} data-testid={`button-delete-activity-${activity.id}`} className="h-6 w-6">
                                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Auto history timeline */}
                        {([...comments, ...contacts, ...projects, ...tasks].length > 0 || client) && (
                          <div className="pt-2">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3 font-medium">Historique automatique</p>
                            <div className="relative space-y-4 pl-7 before:absolute before:left-2.5 before:top-1 before:bottom-1 before:w-0.5 before:bg-border">
                              {[
                                ...(client ? [{ ...client, _date: new Date(client.createdAt), _type: 'client_created' as const }] : []),
                                ...projects.map((p) => ({ ...p, _date: new Date(p.createdAt), _type: 'project' as const })),
                                ...tasks.map((t) => ({ ...t, _date: new Date(t.createdAt), _type: 'task' as const })),
                                ...contacts.map((c) => ({ ...c, _date: new Date(c.createdAt), _type: 'contact' as const })),
                                ...comments.map((c) => ({ ...c, _date: new Date(c.createdAt), _type: 'comment' as const })),
                              ]
                                .sort((a, b) => b._date.getTime() - a._date.getTime())
                                .map((item) => {
                                  const author = users.find((u) => u.id === item.createdBy);
                                  if (item._type === 'client_created') {
                                    return (
                                      <div key="client-created" className="relative" data-testid="activity-client-created">
                                        <div className="absolute left-[-1.75rem] top-0.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                          <User className="w-2.5 h-2.5 text-primary-foreground" />
                                        </div>
                                        <p className="text-xs text-foreground"><span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé le compte</p>
                                        <p className="text-[10px] text-muted-foreground">{format(item._date, "d MMM yyyy 'à' HH:mm", { locale: fr })}</p>
                                      </div>
                                    );
                                  }
                                  if (item._type === 'project') {
                                    return (
                                      <div key={`project-${item.id}`} className="relative" data-testid={`activity-project-${item.id}`}>
                                        <div className="absolute left-[-1.75rem] top-0.5 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                                          <Briefcase className="w-2.5 h-2.5 text-accent-foreground" />
                                        </div>
                                        <p className="text-xs text-foreground"><span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé le projet <span className="font-medium">{(item as Project).name}</span></p>
                                        <p className="text-[10px] text-muted-foreground">{format(item._date, "d MMM yyyy 'à' HH:mm", { locale: fr })}</p>
                                      </div>
                                    );
                                  }
                                  if (item._type === 'task') {
                                    return (
                                      <div key={`task-${item.id}`} className="relative" data-testid={`activity-task-${item.id}`}>
                                        <div className="absolute left-[-1.75rem] top-0.5 w-4 h-4 rounded-full bg-violet-500 flex items-center justify-center">
                                          <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                        </div>
                                        <p className="text-xs text-foreground"><span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé la tâche <span className="font-medium">{(item as Task).title}</span></p>
                                        <p className="text-[10px] text-muted-foreground">{format(item._date, "d MMM yyyy 'à' HH:mm", { locale: fr })}</p>
                                      </div>
                                    );
                                  }
                                  if (item._type === 'contact') {
                                    return (
                                      <div key={`contact-${item.id}`} className="relative" data-testid={`activity-contact-${item.id}`}>
                                        <div className="absolute left-[-1.75rem] top-0.5 w-4 h-4 rounded-full bg-cyan-500 flex items-center justify-center">
                                          <UserPlus className="w-2.5 h-2.5 text-white" />
                                        </div>
                                        <p className="text-xs text-foreground"><span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé le contact <span className="font-medium">{(item as Contact).fullName}</span></p>
                                        <p className="text-[10px] text-muted-foreground">{format(item._date, "d MMM yyyy 'à' HH:mm", { locale: fr })}</p>
                                      </div>
                                    );
                                  }
                                  if (item._type === 'comment') {
                                    return (
                                      <div key={`comment-activity-${item.id}`} className="relative" data-testid={`activity-comment-${item.id}`}>
                                        <div className="absolute left-[-1.75rem] top-0.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
                                          <MessageSquare className="w-2.5 h-2.5 text-white" />
                                        </div>
                                        <p className="text-xs text-foreground"><span className="font-medium">{author?.firstName} {author?.lastName}</span> a ajouté un commentaire</p>
                                        <p className="text-[10px] text-muted-foreground">{format(item._date, "d MMM yyyy 'à' HH:mm", { locale: fr })}</p>
                                      </div>
                                    );
                                  }
                                  return null;
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Contacts ── */}
              <TabsContent value="contacts" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight">Contacts</CardTitle>
                    <Button onClick={() => openContactDialog()} data-testid="button-add-contact" size="sm" className="text-[11px] h-7 px-2">
                      <Plus className="w-3 h-3 mr-1" />
                      Ajouter
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {contacts.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Aucun contact pour ce client
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {contacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center justify-between p-3 border-l-2 border-l-primary border border-border rounded-md hover-elevate"
                            data-testid={`contact-item-${contact.id}`}
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="w-8 h-8">
                                <AvatarFallback className="text-xs">
                                  {contact.firstName?.[0]}{contact.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs font-medium text-foreground">
                                  {contact.firstName} {contact.lastName}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                  {contact.position && (
                                    <span className="flex items-center gap-1">
                                      <Briefcase className="w-2.5 h-2.5" />
                                      {contact.position}
                                    </span>
                                  )}
                                  {contact.email && (
                                    <span className="flex items-center gap-1">
                                      <Mail className="w-2.5 h-2.5" />
                                      {contact.email}
                                    </span>
                                  )}
                                  {contact.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="w-2.5 h-2.5" />
                                      {contact.phone}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openContactDialog(contact)} data-testid={`button-edit-contact-${contact.id}`} className="h-7 w-7">
                                <Pencil className="w-3 h-3 text-muted-foreground" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => { setContactToDelete(contact.id); setIsDeleteContactDialogOpen(true); }} data-testid={`button-delete-contact-${contact.id}`} className="h-7 w-7">
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Commentaires ── */}
              <TabsContent value="commentaires" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Ajouter un commentaire
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Textarea
                      placeholder="Écrivez votre commentaire..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      rows={3}
                      data-testid="input-new-comment"
                      className="text-xs"
                    />
                    <div className="flex justify-end">
                      <Button
                        onClick={handleCommentSubmit}
                        disabled={createCommentMutation.isPending || !newComment.trim()}
                        data-testid="button-submit-comment"
                        size="sm"
                        className="text-[11px] h-7 px-3"
                      >
                        <MessageSquare className="w-3 h-3 mr-1.5" />
                        Ajouter
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                {comments.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold tracking-tight">Commentaires ({comments.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {comments.map((comment) => {
                          const author = users.find((u) => u.id === comment.createdBy);
                          return (
                            <div key={comment.id} className="flex gap-3 p-3 border rounded-md" data-testid={`comment-${comment.id}`}>
                              <Avatar className="w-7 h-7 shrink-0">
                                <AvatarFallback className="text-[10px]">
                                  {author?.firstName?.[0]}{author?.lastName?.[0]}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-xs font-medium text-foreground">
                                    {author?.firstName} {author?.lastName}
                                  </p>
                                  <span className="text-[10px] text-muted-foreground">•</span>
                                  <p className="text-[10px] text-muted-foreground">
                                    {format(new Date(comment.createdAt), "d MMM yyyy 'à' HH:mm", { locale: fr })}
                                  </p>
                                </div>
                                <p className="text-xs text-foreground whitespace-pre-wrap">{comment.content}</p>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => { setCommentToDelete(comment.id); setIsDeleteCommentDialogOpen(true); }}
                                data-testid={`button-delete-comment-${comment.id}`}
                                className="h-6 w-6 shrink-0"
                              >
                                <Trash2 className="w-3 h-3 text-muted-foreground" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── Tâches ── */}
              <TabsContent value="taches" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight">Tâches du client</CardTitle>
                    <Button onClick={() => setIsTaskDialogOpen(true)} data-testid="button-add-task" size="sm" className="text-[11px] h-7 px-2">
                      <Plus className="w-3 h-3 mr-1" />
                      Nouvelle tâche
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {tasks.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Aucune tâche pour ce client
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {tasks.map((task) => {
                          const assignee = users.find((u) => u.id === task.assignedToId);
                          const project = projects.find((p) => p.id === task.projectId);
                          return (
                            <div
                              key={task.id}
                              className="flex items-center justify-between p-3 border rounded-md hover-elevate"
                              data-testid={`task-item-${task.id}`}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                  <p className="text-xs font-medium text-foreground">{task.title}</p>
                                  <Badge variant={task.priority === "high" ? "destructive" : task.priority === "medium" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                                    {task.priority === "high" ? "Haute" : task.priority === "medium" ? "Moyenne" : "Basse"}
                                  </Badge>
                                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                                    {task.status === "todo" ? "À faire" : task.status === "in_progress" ? "En cours" : task.status === "review" ? "En revue" : "Terminé"}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                                  {project && (
                                    <span className="flex items-center gap-1">
                                      <Briefcase className="w-2.5 h-2.5" />
                                      {project.name}
                                    </span>
                                  )}
                                  {assignee && (
                                    <span className="flex items-center gap-1">
                                      <User className="w-2.5 h-2.5" />
                                      {assignee.firstName} {assignee.lastName}
                                    </span>
                                  )}
                                  {task.dueDate && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-2.5 h-2.5" />
                                      {format(new Date(task.dueDate), "d MMM yyyy", { locale: fr })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Projets ── */}
              <TabsContent value="projets" className="space-y-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight">Projets du client</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {projects.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Aucun projet rattaché à ce client
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {projects.map((project) => (
                          <Link href={`/projects/${project.id}`} key={project.id}>
                            <div
                              className="p-3 border rounded-md hover-elevate active-elevate-2 cursor-pointer"
                              data-testid={`project-item-${project.id}`}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <FolderKanban className="w-3.5 h-3.5 text-primary shrink-0" />
                                    <h4 className="text-xs font-medium truncate">{project.name}</h4>
                                  </div>
                                  {project.description && (
                                    <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2">
                                      {project.description}
                                    </p>
                                  )}
                                  <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                                    <Badge className={`text-[10px] h-4 px-1.5 ${getStageColor(project.stage)}`}>
                                      {getStageLabel(project.stage)}
                                    </Badge>
                                    {project.category && (
                                      <Badge variant="outline" className="text-[10px] h-4 px-1.5">{project.category}</Badge>
                                    )}
                                    {project.startDate && (
                                      <span className="flex items-center gap-1 text-muted-foreground">
                                        <CalendarIcon className="w-2.5 h-2.5" />
                                        {format(new Date(project.startDate), "dd MMM yyyy", { locale: fr })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ── Documents ── */}
              <TabsContent value="documents" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
                    <CardTitle className="text-sm font-semibold tracking-tight">Documents</CardTitle>
                    <Badge variant="secondary" className="text-[10px]">{clientDocuments.length}</Badge>
                  </CardHeader>
                  <CardContent>
                    {clientDocuments.length === 0 ? (
                      <div className="text-center py-8 text-xs text-muted-foreground">
                        Aucun document lié à ce client ou ses projets.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {clientDocuments.map((document) => (
                          <Link key={document.id} href={`/documents/${document.id}`}>
                            <div className="p-3 border rounded-md hover-elevate cursor-pointer" data-testid={`document-${document.id}`}>
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                  <h4 className="text-xs font-medium truncate" data-testid={`title-document-${document.id}`}>
                                    {document.name || "Sans titre"}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge
                                      variant={document.status === "draft" ? "outline" : "default"}
                                      className={`text-[10px] h-4 px-1.5 ${document.status !== "draft" ? "bg-green-600 dark:bg-green-700 text-white" : "text-muted-foreground"}`}
                                      data-testid={`status-${document.id}`}
                                    >
                                      {document.status === "draft" ? "Brouillon" : document.status === "published" ? "Publié" : "Archivé"}
                                    </Badge>
                                    {document.updatedAt && (
                                      <span className="text-[10px] text-muted-foreground">
                                        Modifié {format(new Date(document.updatedAt), "dd MMM yyyy", { locale: fr })}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

          {/* Custom Tabs Content */}
          {customTabs.map((tab) => {
            const tabFields = customFields.filter(f => f.tabId === tab.id).sort((a, b) => a.order - b.order);
            
            const renderFieldInput = (field: ClientCustomField) => {
              const value = localFieldValues[field.id] ?? fieldValues.find(v => v.fieldId === field.id)?.value;

              const handleFieldChange = (newValue: any) => {
                setLocalFieldValues(prev => ({
                  ...prev,
                  [field.id]: newValue
                }));
              };

              switch (field.fieldType) {
                case 'text':
                  return (
                    <Input
                      value={(value as string) || ""}
                      onChange={(e) => handleFieldChange(e.target.value)}
                      placeholder={`Entrer ${field.name.toLowerCase()}`}
                      data-testid={`input-field-${field.id}`}
                    />
                  );
                case 'date':
                  return (
                    <Input
                      type="date"
                      value={(value as string) || ""}
                      onChange={(e) => handleFieldChange(e.target.value)}
                      data-testid={`input-field-${field.id}`}
                    />
                  );
                case 'number':
                  return (
                    <Input
                      type="number"
                      value={(value as string) || ""}
                      onChange={(e) => handleFieldChange(e.target.value)}
                      placeholder={`Entrer ${field.name.toLowerCase()}`}
                      data-testid={`input-field-${field.id}`}
                    />
                  );
                case 'link':
                  return (
                    <Input
                      type="url"
                      value={(value as string) || ""}
                      onChange={(e) => handleFieldChange(e.target.value)}
                      placeholder={`https://...`}
                      data-testid={`input-field-${field.id}`}
                    />
                  );
                case 'boolean':
                  return (
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={(value as boolean) || false}
                        onChange={(e) => handleFieldChange(e.target.checked)}
                        className="h-4 w-4"
                        data-testid={`input-field-${field.id}`}
                      />
                      <span className="text-sm text-muted-foreground">
                        {value ? "Oui" : "Non"}
                      </span>
                    </div>
                  );
                case 'checkbox':
                  const options = (field.options as string[]) || [];
                  const selectedValues = (value as string[]) || [];
                  return (
                    <div className="space-y-2">
                      {options.map((option: string, idx: number) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selectedValues.includes(option)}
                            onChange={(e) => {
                              const newValues = e.target.checked
                                ? [...selectedValues, option]
                                : selectedValues.filter(v => v !== option);
                              handleFieldChange(newValues);
                            }}
                            className="h-4 w-4"
                            data-testid={`checkbox-${field.id}-${idx}`}
                          />
                          <span className="text-sm">{option}</span>
                        </div>
                      ))}
                    </div>
                  );
                case 'select':
                  const selectOptions = (field.options as string[]) || [];
                  return (
                    <Select
                      value={(value as string) || ""}
                      onValueChange={handleFieldChange}
                    >
                      <SelectTrigger data-testid={`select-field-${field.id}`}>
                        <SelectValue placeholder={`Sélectionner ${field.name.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {selectOptions.map((option: string, idx: number) => (
                          <SelectItem key={idx} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                default:
                  return <span className="text-muted-foreground">Type non supporté</span>;
              }
            };

            return (
              <TabsContent key={tab.id} value={`custom-${tab.id}`} className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                    {editingTabId === tab.id ? (
                      <div className="flex items-center gap-2 flex-1">
                        <Input
                          value={editingTabName}
                          onChange={(e) => setEditingTabName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && editingTabName.trim()) {
                              updateCustomTabMutation.mutate({ tabId: tab.id, name: editingTabName });
                            } else if (e.key === 'Escape') {
                              setEditingTabId(null);
                              setEditingTabName("");
                            }
                          }}
                          autoFocus
                          data-testid={`input-edit-tab-${tab.id}`}
                          className="max-w-xs"
                        />
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => {
                            if (editingTabName.trim()) {
                              updateCustomTabMutation.mutate({ tabId: tab.id, name: editingTabName });
                            }
                          }}
                          data-testid={`button-save-tab-${tab.id}`}
                        >
                          <Save className="w-4 h-4 mr-2" />
                          Enregistrer
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingTabId(null);
                            setEditingTabName("");
                          }}
                          data-testid={`button-cancel-edit-tab-${tab.id}`}
                        >
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CardTitle className="font-semibold tracking-tight text-[18px]">{tab.name}</CardTitle>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            setEditingTabId(tab.id);
                            setEditingTabName(tab.name);
                          }}
                          data-testid={`button-edit-tab-${tab.id}`}
                          className="h-8 w-8"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedTabForField(tab.id);
                        setIsCreateFieldDialogOpen(true);
                      }}
                      data-testid={`button-add-field-${tab.id}`}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Ajouter un champ
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {tabFields.length === 0 ? (
                      <div className="py-12 text-center text-muted-foreground">
                        Aucun champ personnalisé. Cliquez sur "Ajouter un champ" pour commencer.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {tabFields.map((field) => (
                          <div key={field.id} className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`field-${field.id}`}>{field.name}</Label>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => {
                                  setDeleteFieldId(field.id);
                                  setIsDeleteFieldDialogOpen(true);
                                }}
                                data-testid={`button-delete-field-${field.id}`}
                              >
                                <Trash2 className="h-3 w-3 text-destructive" />
                              </Button>
                            </div>
                            {renderFieldInput(field)}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
            </Tabs>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmer la suppression</DialogTitle>
            </DialogHeader>
            <p>Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteClientMutation.mutate()}
                disabled={deleteClientMutation.isPending}
              >
                Supprimer
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Contact Form Sheet */}
        <Sheet open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
          <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col bg-white dark:bg-card" data-testid="dialog-create-contact">
            <SheetHeader>
              <SheetTitle>{editingContact ? "Modifier le contact" : "Nouveau contact"}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 flex-1 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Prénom *</Label>
                  <Input
                    value={contactFormData.firstName}
                    onChange={(e) => setContactFormData({ ...contactFormData, firstName: e.target.value })}
                    data-testid="input-contact-firstname"
                  />
                </div>
                <div>
                  <Label>Nom *</Label>
                  <Input
                    value={contactFormData.lastName}
                    onChange={(e) => setContactFormData({ ...contactFormData, lastName: e.target.value })}
                    data-testid="input-contact-lastname"
                  />
                </div>
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={contactFormData.email}
                  onChange={(e) => setContactFormData({ ...contactFormData, email: e.target.value })}
                  data-testid="input-contact-email"
                />
              </div>
              <div>
                <Label>Téléphone</Label>
                <Input
                  type="tel"
                  value={contactFormData.phone}
                  onChange={(e) => setContactFormData({ ...contactFormData, phone: e.target.value })}
                  data-testid="input-contact-phone"
                />
              </div>
              <div>
                <Label>Fonction</Label>
                <Input
                  value={contactFormData.position}
                  onChange={(e) => setContactFormData({ ...contactFormData, position: e.target.value })}
                  data-testid="input-contact-position"
                />
              </div>
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button variant="outline" onClick={() => setIsContactDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={handleContactSubmit}
                  disabled={createContactMutation.isPending || updateContactMutation.isPending}
                  data-testid="button-submit-contact"
                >
                  {editingContact ? "Mettre à jour" : "Créer"}
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Delete Contact Confirmation Dialog */}
        <Dialog open={isDeleteContactDialogOpen} onOpenChange={setIsDeleteContactDialogOpen}>
          <DialogContent data-testid="dialog-delete-contact">
            <DialogHeader>
              <DialogTitle>Confirmer la suppression</DialogTitle>
            </DialogHeader>
            <p>Êtes-vous sûr de vouloir supprimer ce contact ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteContactDialogOpen(false);
                  setContactToDelete(null);
                }}
                data-testid="button-cancel-delete-contact"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (contactToDelete) {
                    deleteContactMutation.mutate(contactToDelete);
                  }
                }}
                disabled={deleteContactMutation.isPending}
                data-testid="button-confirm-delete-contact"
              >
                Supprimer
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Comment Confirmation Dialog */}
        <Dialog open={isDeleteCommentDialogOpen} onOpenChange={setIsDeleteCommentDialogOpen}>
          <DialogContent data-testid="dialog-delete-comment">
            <DialogHeader>
              <DialogTitle>Confirmer la suppression</DialogTitle>
            </DialogHeader>
            <p>Êtes-vous sûr de vouloir supprimer ce commentaire ? Cette action est irréversible.</p>
            <div className="flex justify-end gap-2 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsDeleteCommentDialogOpen(false);
                  setCommentToDelete(null);
                }}
                data-testid="button-cancel-delete-comment"
              >
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (commentToDelete) {
                    deleteCommentMutation.mutate(commentToDelete);
                  }
                }}
                disabled={deleteCommentMutation.isPending}
                data-testid="button-confirm-delete-comment"
              >
                Supprimer
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Task Creation Dialog */}
        <Sheet open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col bg-white dark:bg-card" data-testid="sheet-create-task">
            <SheetHeader>
              <SheetTitle>Nouvelle tâche</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 flex-1 py-4">
              <div>
                <Label>Projet (optionnel)</Label>
                <Popover open={taskProjectComboboxOpen} onOpenChange={setTaskProjectComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={taskProjectComboboxOpen}
                      className="w-full justify-between"
                      data-testid="button-select-task-project"
                    >
                      {taskFormData.projectId && taskFormData.projectId !== "none"
                        ? projects.find((p) => p.id === taskFormData.projectId)?.name
                        : "Aucun projet"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-full p-0">
                    <Command>
                      <CommandInput placeholder="Rechercher un projet..." />
                      <CommandList>
                        <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="Aucun projet"
                            onSelect={() => { setTaskFormData({ ...taskFormData, projectId: "" }); setTaskProjectComboboxOpen(false); }}
                            data-testid="task-project-option-none"
                          >
                            <Check className={`mr-2 h-4 w-4 ${!taskFormData.projectId ? "opacity-100" : "opacity-0"}`} />
                            Aucun projet
                          </CommandItem>
                          {projects.map((project) => (
                            <CommandItem
                              key={project.id}
                              value={project.name}
                              onSelect={() => { setTaskFormData({ ...taskFormData, projectId: project.id }); setTaskProjectComboboxOpen(false); }}
                              data-testid={`task-project-option-${project.id}`}
                            >
                              <Check className={`mr-2 h-4 w-4 ${taskFormData.projectId === project.id ? "opacity-100" : "opacity-0"}`} />
                              {project.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="task-title">Titre *</Label>
                <Input
                  id="task-title"
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  placeholder="Titre de la tâche"
                  data-testid="input-task-title"
                />
              </div>
              <div>
                <Label htmlFor="task-description">Description</Label>
                <Textarea
                  id="task-description"
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  placeholder="Description de la tâche"
                  rows={3}
                  data-testid="input-task-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Priorité</Label>
                  <Select
                    value={taskFormData.priority}
                    onValueChange={(value) => setTaskFormData({ ...taskFormData, priority: value })}
                  >
                    <SelectTrigger data-testid="select-task-priority">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Basse</SelectItem>
                      <SelectItem value="medium">Moyenne</SelectItem>
                      <SelectItem value="high">Haute</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Assigné à</Label>
                  <Select
                    value={newTaskAssignedTo || "unassigned"}
                    onValueChange={(value) => setNewTaskAssignedTo(value === "unassigned" ? undefined : value)}
                  >
                    <SelectTrigger data-testid="select-task-assigned">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Non assigné</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Effort / Complexité</Label>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((rating) => (
                    <button
                      key={rating}
                      type="button"
                      onClick={() => setNewTaskEffort(rating)}
                      className="focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded"
                      data-testid={`button-task-effort-${rating}`}
                    >
                      <Star
                        className={`h-6 w-6 transition-colors ${(newTaskEffort ?? 0) >= rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300 hover:text-yellow-200"}`}
                      />
                    </button>
                  ))}
                  {newTaskEffort !== null && (
                    <button
                      type="button"
                      onClick={() => setNewTaskEffort(null)}
                      className="ml-2 text-xs text-muted-foreground hover:text-foreground"
                      data-testid="button-clear-task-effort"
                    >
                      Effacer
                    </button>
                  )}
                </div>
              </div>
              <div>
                <Label>Date d'échéance</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                      data-testid="button-task-due-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newTaskDueDate
                        ? format(newTaskDueDate, "PPP", { locale: fr })
                        : <span className="text-muted-foreground">Choisir une date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={newTaskDueDate}
                      onSelect={setNewTaskDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex gap-2 justify-end border-t pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setIsTaskDialogOpen(false);
                  setTaskFormData({ title: "", description: "", priority: "medium", status: "todo", projectId: "", dueDate: "" });
                  setNewTaskEffort(null);
                  setNewTaskAssignedTo(undefined);
                  setNewTaskDueDate(undefined);
                }}
                data-testid="button-cancel-task"
              >
                Annuler
              </Button>
              <Button
                onClick={handleTaskSubmit}
                disabled={createTaskMutation.isPending || !taskFormData.title.trim()}
                data-testid="button-submit-task"
              >
                Créer la tâche
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Create Custom Tab Dialog */}
        <Dialog open={isCreateTabDialogOpen} onOpenChange={setIsCreateTabDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un onglet personnalisé</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tab-name">Nom de l'onglet</Label>
                <Input
                  id="tab-name"
                  value={newTabName}
                  onChange={(e) => setNewTabName(e.target.value)}
                  placeholder="Ex: Informations contractuelles"
                  data-testid="input-tab-name"
                />
              </div>
              <div>
                <Label htmlFor="tab-icon">Icône (optionnel)</Label>
                <Input
                  id="tab-icon"
                  value={newTabIcon}
                  onChange={(e) => setNewTabIcon(e.target.value)}
                  placeholder="Ex: FileText, Calendar, Settings"
                  data-testid="input-tab-icon"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateTabDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={() => createCustomTabMutation.mutate({ name: newTabName, icon: newTabIcon })}
                  disabled={createCustomTabMutation.isPending || !newTabName.trim()}
                  data-testid="button-submit-tab"
                >
                  Créer l'onglet
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Tab Confirmation Dialog */}
        <AlertDialog open={deleteTabDialogOpen} onOpenChange={setDeleteTabDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-tab-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer l'onglet "{tabToDelete?.name}" ? 
                Tous les champs personnalisés et les données associées à cet onglet seront définitivement supprimés. 
                Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-tab">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (tabToDelete) {
                    deleteCustomTabMutation.mutate(tabToDelete.id);
                    setDeleteTabDialogOpen(false);
                    setTabToDelete(null);
                  }
                }}
                data-testid="button-confirm-delete-tab"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create Custom Field Dialog */}
        <Dialog open={isCreateFieldDialogOpen} onOpenChange={setIsCreateFieldDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ajouter un champ personnalisé</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="field-name">Nom du champ</Label>
                <Input
                  id="field-name"
                  value={newFieldData.name}
                  onChange={(e) => setNewFieldData({ ...newFieldData, name: e.target.value })}
                  placeholder="Ex: Budget annuel"
                  data-testid="input-field-name"
                />
              </div>
              <div>
                <Label htmlFor="field-type">Type de champ</Label>
                <Select
                  value={newFieldData.fieldType}
                  onValueChange={(value) => setNewFieldData({ ...newFieldData, fieldType: value })}
                >
                  <SelectTrigger data-testid="select-field-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Texte</SelectItem>
                    <SelectItem value="number">Nombre</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="link">Lien</SelectItem>
                    <SelectItem value="boolean">Booléen (Oui/Non)</SelectItem>
                    <SelectItem value="checkbox">Cases à cocher</SelectItem>
                    <SelectItem value="select">Sélecteur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(newFieldData.fieldType === 'checkbox' || newFieldData.fieldType === 'select') && (
                <div>
                  <Label htmlFor="field-options">Options (séparées par des virgules)</Label>
                  <Input
                    id="field-options"
                    value={newFieldData.options}
                    onChange={(e) => setNewFieldData({ ...newFieldData, options: e.target.value })}
                    placeholder="Ex: Option 1, Option 2, Option 3"
                    data-testid="input-field-options"
                  />
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateFieldDialogOpen(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={() => {
                    if (selectedTabForField) {
                      createCustomFieldMutation.mutate({
                        tabId: selectedTabForField,
                        name: newFieldData.name,
                        fieldType: newFieldData.fieldType,
                        options: newFieldData.options,
                      });
                    }
                  }}
                  disabled={createCustomFieldMutation.isPending || !newFieldData.name.trim()}
                  data-testid="button-submit-field"
                >
                  Créer le champ
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Delete Field Confirmation Dialog */}
        <AlertDialog open={isDeleteFieldDialogOpen} onOpenChange={setIsDeleteFieldDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-field-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer le champ</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer ce champ personnalisé ? Cette action est irréversible et toutes les données associées seront perdues.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-field">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteFieldId && deleteCustomFieldMutation.mutate(deleteFieldId)}
                data-testid="button-confirm-delete-field"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Create/Edit Activity Sheet (Side Panel) */}
        <Sheet open={isActivityDialogOpen} onOpenChange={setIsActivityDialogOpen}>
          <SheetContent className="sm:max-w-md w-full bg-white dark:bg-card" data-testid="sheet-activity">
            <SheetHeader>
              <SheetTitle>{editingActivity ? "Modifier l'activité" : "Nouvelle activité"}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="activity-kind">Type d'activité</Label>
                <Select
                  value={activityFormData.kind}
                  onValueChange={(value) => setActivityFormData({ ...activityFormData, kind: value })}
                >
                  <SelectTrigger className="cursor-pointer" data-testid="select-activity-kind">
                    <SelectValue placeholder="Sélectionner un type" />
                  </SelectTrigger>
                  <SelectContent className="bg-card">
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="call">Appel</SelectItem>
                    <SelectItem value="meeting">Réunion</SelectItem>
                    <SelectItem value="note">Note</SelectItem>
                    <SelectItem value="custom">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="activity-date">Date</Label>
                <Popover open={isActivityDatePickerOpen} onOpenChange={setIsActivityDatePickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !activityFormData.occurredAt && "text-muted-foreground"
                      )}
                      data-testid="input-activity-date"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {activityFormData.occurredAt 
                        ? format(new Date(activityFormData.occurredAt), "dd/MM/yyyy", { locale: fr }) 
                        : "Sélectionner une date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={activityFormData.occurredAt ? new Date(activityFormData.occurredAt) : undefined}
                      onSelect={(date) => {
                        setActivityFormData({ 
                          ...activityFormData, 
                          occurredAt: date ? format(date, "yyyy-MM-dd") : "" 
                        });
                        setIsActivityDatePickerOpen(false);
                      }}
                      initialFocus
                      locale={fr}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="activity-description">Description</Label>
                <Textarea
                  id="activity-description"
                  value={activityFormData.description}
                  onChange={(e) => setActivityFormData({ ...activityFormData, description: e.target.value })}
                  placeholder="Décrivez l'activité..."
                  rows={4}
                  data-testid="input-activity-description"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setIsActivityDialogOpen(false);
                setEditingActivity(null);
              }}>
                Annuler
              </Button>
              <Button
                onClick={handleActivitySubmit}
                disabled={createActivityMutation.isPending || updateActivityMutation.isPending || !activityFormData.description.trim()}
                data-testid="button-submit-activity"
              >
                {editingActivity ? "Modifier" : "Créer"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Delete Activity Confirmation Dialog */}
        <AlertDialog open={isDeleteActivityDialogOpen} onOpenChange={setIsDeleteActivityDialogOpen}>
          <AlertDialogContent data-testid="dialog-delete-activity-confirm">
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer l'activité</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer cette activité ? Cette action est irréversible.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-delete-activity">Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteActivityId && deleteActivityMutation.mutate(deleteActivityId)}
                data-testid="button-confirm-delete-activity"
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Client Info Sheet */}
        <Sheet open={isEditClientSidebarOpen} onOpenChange={setIsEditClientSidebarOpen}>
          <SheetContent className="sm:max-w-xl w-full overflow-y-auto bg-white dark:bg-card" data-testid="sheet-edit-client">
            <SheetHeader>
              <SheetTitle>Modifier le client</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Type</Label>
                  <Select value={clientInfoForm.type} onValueChange={(v: "company" | "person") => setClientInfoForm({ ...clientInfoForm, type: v })}>
                    <SelectTrigger data-testid="select-edit-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="company">Entreprise</SelectItem>
                      <SelectItem value="person">Personne</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Civilité</Label>
                  <Select value={clientInfoForm.civility} onValueChange={(v) => setClientInfoForm({ ...clientInfoForm, civility: v })}>
                    <SelectTrigger data-testid="select-edit-civility"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="M">M</SelectItem>
                      <SelectItem value="Mme">Mme</SelectItem>
                      <SelectItem value="Dr">Dr</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {clientInfoForm.type === "person" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Prénom</Label>
                    <Input value={clientInfoForm.firstName} onChange={(e) => setClientInfoForm({ ...clientInfoForm, firstName: e.target.value })} data-testid="input-edit-firstName" />
                  </div>
                  <div>
                    <Label>Nom</Label>
                    <Input value={clientInfoForm.lastName} onChange={(e) => setClientInfoForm({ ...clientInfoForm, lastName: e.target.value })} data-testid="input-edit-lastName" />
                  </div>
                </div>
              )}
              <div>
                <Label>Nom / Raison sociale *</Label>
                <Input value={clientInfoForm.name} onChange={(e) => setClientInfoForm({ ...clientInfoForm, name: e.target.value })} data-testid="input-edit-name" />
              </div>
              {clientInfoForm.type === "company" && (
                <div>
                  <Label>Société</Label>
                  <Input value={clientInfoForm.company} onChange={(e) => setClientInfoForm({ ...clientInfoForm, company: e.target.value })} data-testid="input-edit-company" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={clientInfoForm.email} onChange={(e) => setClientInfoForm({ ...clientInfoForm, email: e.target.value })} data-testid="input-edit-email" />
                </div>
                <div>
                  <Label>Téléphone</Label>
                  <Input type="tel" value={clientInfoForm.phone} onChange={(e) => setClientInfoForm({ ...clientInfoForm, phone: e.target.value })} data-testid="input-edit-phone" />
                </div>
              </div>
              <div>
                <Label>Adresse</Label>
                <Input value={clientInfoForm.address} onChange={(e) => setClientInfoForm({ ...clientInfoForm, address: e.target.value })} data-testid="input-edit-address" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Code postal</Label>
                  <Input value={clientInfoForm.postalCode} onChange={(e) => setClientInfoForm({ ...clientInfoForm, postalCode: e.target.value })} data-testid="input-edit-postalCode" />
                </div>
                <div className="col-span-2">
                  <Label>Ville</Label>
                  <Input value={clientInfoForm.city} onChange={(e) => setClientInfoForm({ ...clientInfoForm, city: e.target.value })} data-testid="input-edit-city" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Pays</Label>
                  <Input value={clientInfoForm.country} onChange={(e) => setClientInfoForm({ ...clientInfoForm, country: e.target.value })} data-testid="input-edit-country" />
                </div>
                <div>
                  <Label>Nationalité</Label>
                  <Input value={clientInfoForm.nationality} onChange={(e) => setClientInfoForm({ ...clientInfoForm, nationality: e.target.value })} data-testid="input-edit-nationality" />
                </div>
              </div>
              <div>
                <Label>Budget (€)</Label>
                <Input type="number" value={clientInfoForm.budget} onChange={(e) => setClientInfoForm({ ...clientInfoForm, budget: e.target.value })} data-testid="input-edit-budget" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={clientInfoForm.notes} onChange={(e) => setClientInfoForm({ ...clientInfoForm, notes: e.target.value })} rows={3} data-testid="input-edit-notes" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button variant="outline" onClick={() => setIsEditClientSidebarOpen(false)} data-testid="button-cancel-edit-client">
                  Annuler
                </Button>
                <Button onClick={saveClientInfo} data-testid="button-save-client-info">
                  Enregistrer
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
