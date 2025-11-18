import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Edit, Trash2, Plus, Mail, Phone, MapPin, Building2, User, Briefcase, MessageSquare, Clock, CheckCircle2, UserPlus, FileText, Pencil, FolderKanban, Calendar as CalendarIcon, Save, Check } from "lucide-react";
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
import { apiRequest, queryClient, formatDateForStorage } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader } from "@/components/Loader";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
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
  const [isEditClientDialogOpen, setIsEditClientDialogOpen] = useState(false);
  const [isEditingClientInfo, setIsEditingClientInfo] = useState(false);
  const [isStatusPopoverOpen, setIsStatusPopoverOpen] = useState(false);
  const [clientInfoForm, setClientInfoForm] = useState({
    type: "company" as "company" | "person",
    name: "",
    civility: "",
    firstName: "",
    company: "",
    address: "",
    postalCode: "",
    city: "",
    country: "",
    nationality: "",
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

  // Fetch current user to get accountId
  const { data: currentUser } = useQuery<AppUser>({
    queryKey: ["/api/me"],
  });

  const accountId = currentUser?.accountId;

  const { data: client, isLoading: clientLoading } = useQuery<Client>({
    queryKey: ['/api/clients', id],
    enabled: !!accountId && !!id,
  });

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

  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/activities'],
    select: (data) => data.filter((a: Activity) => a.subjectType === 'client' && a.subjectId === id),
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
        company: client.company || "",
        address: client.address || "",
        postalCode: client.postalCode || "",
        city: client.city || "",
        country: client.country || "",
        nationality: client.nationality || "",
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id] });
      setIsEditClientDialogOpen(false);
      toast({ title: "Client mis à jour", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    },
  });

  const deleteClientMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/clients/${id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      toast({ title: "Client supprimé avec succès", variant: "success" });
      setLocation("/crm");
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression", variant: "destructive" });
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (data: any) => {
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom';
      return await apiRequest("/api/contacts", "POST", { 
        ...data, 
        clientId: id,
        fullName,
        accountId
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsContactDialogOpen(false);
      setContactFormData({ firstName: "", lastName: "", email: "", phone: "", position: "" });
      toast({ title: "Contact créé avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id: contactId, data }: { id: string; data: any }) => {
      const fullName = `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'Sans nom';
      return await apiRequest(`/api/contacts/${contactId}`, "PATCH", { ...data, fullName });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsContactDialogOpen(false);
      setEditingContact(null);
      setContactFormData({ firstName: "", lastName: "", email: "", phone: "", position: "" });
      toast({ title: "Contact mis à jour", variant: "success" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest(`/api/contacts/${contactId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsDeleteContactDialogOpen(false);
      setContactToDelete(null);
      toast({ title: "Contact supprimé", variant: "default" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression du contact", variant: "destructive" });
    },
  });

  const createCommentMutation = useMutation({
    mutationFn: async (content: string) => {
      return await apiRequest("POST", `/api/clients/${id}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      setNewComment("");
      toast({ title: "Commentaire ajouté", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de l'ajout du commentaire", variant: "destructive" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      await apiRequest("DELETE", `/api/clients/${id}/comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'comments'] });
      queryClient.invalidateQueries({ queryKey: ['/api/activities'] });
      setIsDeleteCommentDialogOpen(false);
      setCommentToDelete(null);
      toast({ title: "Commentaire supprimé", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression du commentaire", variant: "destructive" });
    },
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: any) => {
      // Prepare task data
      const taskData: any = {
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
      };
      
      return await apiRequest("POST", "/api/tasks", taskData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tasks'] });
      setIsTaskDialogOpen(false);
      setTaskFormData({
        title: "",
        description: "",
        priority: "medium",
        status: "todo",
        projectId: "",
        dueDate: "",
      });
      toast({ title: "Tâche créée avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création de la tâche", variant: "destructive" });
    },
  });

  const createCustomTabMutation = useMutation({
    mutationFn: async (data: { name: string; icon?: string }) => {
      const maxOrder = customTabs.length > 0 ? Math.max(...customTabs.map(t => t.order)) : -1;
      return await apiRequest("POST", "/api/client-custom-tabs", {
        name: data.name,
        icon: data.icon || null,
        order: maxOrder + 1,
        accountId,
        createdBy: currentUser?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-tabs'] });
      setIsCreateTabDialogOpen(false);
      setNewTabName("");
      setNewTabIcon("");
      toast({ title: "Onglet personnalisé créé", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création de l'onglet", variant: "destructive" });
    },
  });

  const deleteCustomTabMutation = useMutation({
    mutationFn: async (tabId: string) => {
      return await apiRequest(`/api/client-custom-tabs/${tabId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-tabs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-fields'] });
      toast({ title: "Onglet personnalisé supprimé", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression de l'onglet", variant: "destructive" });
    },
  });

  const updateCustomTabMutation = useMutation({
    mutationFn: async (data: { tabId: string; name: string }) => {
      return await apiRequest(`/api/client-custom-tabs/${data.tabId}`, "PATCH", {
        name: data.name,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-tabs'] });
      setEditingTabId(null);
      setEditingTabName("");
      toast({ title: "Onglet personnalisé modifié", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la modification de l'onglet", variant: "destructive" });
    },
  });

  const createCustomFieldMutation = useMutation({
    mutationFn: async (data: { tabId: string; name: string; fieldType: string; options?: string }) => {
      const tabFields = customFields.filter(f => f.tabId === data.tabId);
      const maxOrder = tabFields.length > 0 ? Math.max(...tabFields.map(f => f.order)) : -1;
      return await apiRequest("/api/client-custom-fields", "POST", {
        tabId: data.tabId,
        name: data.name,
        fieldType: data.fieldType,
        options: data.options && data.options.trim() ? data.options.split(',').map(o => o.trim()) : [],
        order: maxOrder + 1,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-fields'] });
      setIsCreateFieldDialogOpen(false);
      setNewFieldData({ name: "", fieldType: "text", options: "" });
      toast({ title: "Champ personnalisé créé", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création du champ", variant: "destructive" });
    },
  });

  const deleteCustomFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      return await apiRequest(`/api/client-custom-fields/${fieldId}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-custom-fields'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id, 'field-values'] });
      setIsDeleteFieldDialogOpen(false);
      setDeleteFieldId(null);
      toast({ title: "Champ supprimé avec succès", variant: "success" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la suppression du champ", variant: "destructive" });
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

  const handleCommentSubmit = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment);
  };

  const handleTaskSubmit = () => {
    if (!taskFormData.title.trim()) return;
    createTaskMutation.mutate(taskFormData);
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
      setIsEditingClientInfo(false);
      toast({ title: "Informations mises à jour", variant: "success" });
    } catch (error) {
      toast({ title: "Erreur lors de la mise à jour", variant: "destructive" });
    }
  };

  const updateClientStatus = async (newStatus: string) => {
    try {
      await apiRequest(`/api/clients/${id}`, "PATCH", { status: newStatus });
      queryClient.invalidateQueries({ queryKey: ['/api/clients'] });
      queryClient.invalidateQueries({ queryKey: ['/api/clients', id] });
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

  return (
    <div className="h-full overflow-auto">
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-w-full overflow-x-hidden">
        {/* Edit Client Dialog */}
        <Dialog open={isEditClientDialogOpen} onOpenChange={setIsEditClientDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Modifier le client</DialogTitle>
            </DialogHeader>
            <Form {...clientForm}>
              <form onSubmit={clientForm.handleSubmit((data) => updateClientMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={clientForm.control}
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
                    control={clientForm.control}
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
                    control={clientForm.control}
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
                  control={clientForm.control}
                  name="budget"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Budget (€)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value)}
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
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsEditClientDialogOpen(false)}
                    data-testid="button-cancel"
                  >
                    Annuler
                  </Button>
                  <Button type="submit" disabled={updateClientMutation.isPending} data-testid="button-submit-client">
                    Mettre à jour
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
            <Link href="/crm">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
              <Avatar className="w-12 h-12 sm:w-16 sm:h-16 shrink-0">
                <AvatarFallback className="text-lg sm:text-xl">{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-3xl font-heading font-bold text-foreground truncate">{client.company || client.name}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Popover open={isStatusPopoverOpen} onOpenChange={setIsStatusPopoverOpen}>
                    <PopoverTrigger asChild>
                      <button data-testid="button-edit-status">
                        <Badge className={`shrink-0 cursor-pointer hover-elevate ${client.status === "won" ? "bg-green-600 hover:bg-green-700" : ""}`}>
                          {client.status === "prospecting" ? "Prospection" :
                           client.status === "qualified" ? "Qualifié" :
                           client.status === "negotiation" ? "Négociation" :
                           client.status === "won" ? "Gagné" :
                           client.status === "lost" ? "Perdu" : client.status}
                        </Badge>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-48 p-0 bg-white" align="start">
                      <Command>
                        <CommandList>
                          <CommandGroup>
                            {[
                              { value: "prospecting", label: "Prospection" },
                              { value: "qualified", label: "Qualifié" },
                              { value: "negotiation", label: "Négociation" },
                              { value: "won", label: "Gagné" },
                              { value: "lost", label: "Perdu" }
                            ].map((status) => (
                              <CommandItem
                                key={status.value}
                                onSelect={() => updateClientStatus(status.value)}
                                data-testid={`status-option-${status.value}`}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    client.status === status.value ? 'opacity-100' : 'opacity-0'
                                  }`}
                                />
                                {status.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  <Badge variant="outline" className="shrink-0">{client.type === "company" ? "Entreprise" : "Personne"}</Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              data-testid="button-delete"
              className="flex-1 sm:flex-none"
            >
              <Trash2 className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Supprimer</span>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="informations" className="w-full">
          <div className="flex items-center gap-2 overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
            <TabsList className="w-full sm:w-auto inline-flex h-auto">
              <TabsTrigger value="informations" data-testid="tab-informations" className="text-xs sm:text-sm">Infos</TabsTrigger>
              <TabsTrigger value="notes" data-testid="tab-notes" className="text-xs sm:text-sm">Notes</TabsTrigger>
              <TabsTrigger value="taches" data-testid="tab-taches" className="text-xs sm:text-sm">Tâches</TabsTrigger>
              <TabsTrigger value="projets" data-testid="tab-projets" className="text-xs sm:text-sm">Projets</TabsTrigger>
              <TabsTrigger value="activites" data-testid="tab-activites" className="text-xs sm:text-sm">Activités</TabsTrigger>
              <TabsTrigger value="documents" data-testid="tab-documents" className="text-xs sm:text-sm">Docs</TabsTrigger>
              {customTabs.map((tab) => (
                <TabsTrigger 
                  key={tab.id} 
                  value={`custom-${tab.id}`} 
                  data-testid={`tab-custom-${tab.id}`} 
                  className="text-xs sm:text-sm group relative pr-7"
                >
                  {tab.name}
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
            </TabsList>
            <Button 
              size="icon"
              variant="outline" 
              onClick={() => setIsCreateTabDialogOpen(true)}
              data-testid="button-add-tab"
              className="shrink-0"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {/* Informations */}
          <TabsContent value="informations" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="font-semibold tracking-tight text-[18px]">Informations du client</CardTitle>
                {!isEditingClientInfo ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setIsEditingClientInfo(true)}
                    data-testid="button-edit-client-info"
                  >
                    <Edit className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Modifier</span>
                  </Button>
                ) : (
                  <Button 
                    variant="default"
                    size="sm"
                    onClick={saveClientInfo}
                    data-testid="button-save-client-info"
                  >
                    <Save className="w-4 h-4 sm:mr-2" />
                    <span className="hidden sm:inline">Enregistrer</span>
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    {/* Société */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Société</p>
                      {isEditingClientInfo ? (
                        <Input
                          value={clientInfoForm.company}
                          onChange={(e) => setClientInfoForm({ ...clientInfoForm, company: e.target.value })}
                          placeholder="Nom de la société"
                          data-testid="input-company"
                        />
                      ) : (
                        <p className="text-foreground">{client.company || "—"}</p>
                      )}
                    </div>
                    {/* Prénom */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Prénom</p>
                      {isEditingClientInfo ? (
                        <Input
                          value={clientInfoForm.firstName}
                          onChange={(e) => setClientInfoForm({ ...clientInfoForm, firstName: e.target.value })}
                          placeholder="Prénom"
                          data-testid="input-firstName"
                        />
                      ) : (
                        <p className="text-foreground">{client.firstName || "—"}</p>
                      )}
                    </div>
                    {/* Civilité */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Civilité</p>
                      {isEditingClientInfo ? (
                        <Select value={clientInfoForm.civility} onValueChange={(value) => setClientInfoForm({ ...clientInfoForm, civility: value })}>
                          <SelectTrigger className="bg-white" data-testid="select-civility">
                            <SelectValue placeholder="Sélectionner" />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="M">M</SelectItem>
                            <SelectItem value="Mme">Mme</SelectItem>
                            <SelectItem value="Mlle">Mlle</SelectItem>
                            <SelectItem value="Dr">Dr</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <p className="text-foreground">{client.civility || "—"}</p>
                      )}
                    </div>
                    {/* Adresse */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Adresse</p>
                      {isEditingClientInfo ? (
                        <Input
                          value={clientInfoForm.address}
                          onChange={(e) => setClientInfoForm({ ...clientInfoForm, address: e.target.value })}
                          placeholder="Adresse"
                          data-testid="input-address"
                        />
                      ) : (
                        <p className="text-foreground">{client.address || "—"}</p>
                      )}
                    </div>
                    {/* Ville */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Ville</p>
                      {isEditingClientInfo ? (
                        <Input
                          value={clientInfoForm.city}
                          onChange={(e) => setClientInfoForm({ ...clientInfoForm, city: e.target.value })}
                          placeholder="Ville"
                          data-testid="input-city"
                        />
                      ) : (
                        <p className="text-foreground">{client.city || "—"}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-4">
                    {/* Type de client */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Type de client</p>
                      {isEditingClientInfo ? (
                        <Select value={clientInfoForm.type} onValueChange={(value: "company" | "person") => setClientInfoForm({ ...clientInfoForm, type: value })}>
                          <SelectTrigger className="bg-white" data-testid="select-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-white">
                            <SelectItem value="company">Entreprise</SelectItem>
                            <SelectItem value="person">Personne</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge>{client.type === "company" ? "Entreprise" : "Personne"}</Badge>
                      )}
                    </div>
                    {/* Nom */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Nom</p>
                      {isEditingClientInfo ? (
                        <Input
                          value={clientInfoForm.name}
                          onChange={(e) => setClientInfoForm({ ...clientInfoForm, name: e.target.value })}
                          placeholder="Nom"
                          data-testid="input-name"
                        />
                      ) : (
                        <p className="text-foreground">{client.name}</p>
                      )}
                    </div>
                    {/* Nationalité */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Nationalité</p>
                      {isEditingClientInfo ? (
                        <Input
                          value={clientInfoForm.nationality}
                          onChange={(e) => setClientInfoForm({ ...clientInfoForm, nationality: e.target.value })}
                          placeholder="Nationalité"
                          data-testid="input-nationality"
                        />
                      ) : (
                        <p className="text-foreground">{client.nationality || "—"}</p>
                      )}
                    </div>
                    {/* Code postal */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Code postal</p>
                      {isEditingClientInfo ? (
                        <Input
                          value={clientInfoForm.postalCode}
                          onChange={(e) => setClientInfoForm({ ...clientInfoForm, postalCode: e.target.value })}
                          placeholder="Code postal"
                          data-testid="input-postalCode"
                        />
                      ) : (
                        <p className="text-foreground">{client.postalCode || "—"}</p>
                      )}
                    </div>
                    {/* Pays */}
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Pays</p>
                      {isEditingClientInfo ? (
                        <Input
                          value={clientInfoForm.country}
                          onChange={(e) => setClientInfoForm({ ...clientInfoForm, country: e.target.value })}
                          placeholder="Pays"
                          data-testid="input-country"
                        />
                      ) : (
                        <p className="text-foreground">{client.country || "—"}</p>
                      )}
                    </div>
                  </div>
                </div>
                {client.notes && (
                  <div className="pt-6 border-t mt-6">
                    <p className="text-sm text-muted-foreground mb-2">Notes</p>
                    <p className="text-foreground whitespace-pre-wrap">{client.notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
                <CardTitle className="font-semibold tracking-tight text-[18px]">Contacts</CardTitle>
                <Button onClick={() => openContactDialog()} data-testid="button-add-contact" className="w-full sm:w-auto">
                  <Plus className="w-4 h-4 sm:mr-2" />
                  <span className="hidden sm:inline">Ajouter un contact</span>
                </Button>
              </CardHeader>
              <CardContent>
                {contacts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucun contact pour ce client
                  </div>
                ) : (
                  <div className="space-y-3">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                        data-testid={`contact-item-${contact.id}`}
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarFallback>
                              {contact.firstName?.[0]}{contact.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-foreground">
                              {contact.firstName} {contact.lastName}
                            </p>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              {contact.position && (
                                <span className="flex items-center gap-1">
                                  <Briefcase className="w-3 h-3" />
                                  {contact.position}
                                </span>
                              )}
                              {contact.email && (
                                <span className="flex items-center gap-1">
                                  <Mail className="w-3 h-3" />
                                  {contact.email}
                                </span>
                              )}
                              {contact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3" />
                                  {contact.phone}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openContactDialog(contact)}
                            data-testid={`button-edit-contact-${contact.id}`}
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Modifier
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              setContactToDelete(contact.id);
                              setIsDeleteContactDialogOpen(true);
                            }}
                            data-testid={`button-delete-contact-${contact.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes */}
          <TabsContent value="notes" className="space-y-4">
            {/* Section commentaire */}
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight flex items-center gap-2 text-[18px]">
                  <MessageSquare className="w-5 h-5" />
                  Ajouter un commentaire
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  placeholder="Écrivez votre commentaire..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  rows={4}
                  data-testid="input-new-comment"
                />
                <div className="flex justify-end">
                  <Button
                    onClick={handleCommentSubmit}
                    disabled={createCommentMutation.isPending || !newComment.trim()}
                    data-testid="button-submit-comment"
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Ajouter le commentaire
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Liste des commentaires */}
            {comments.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="font-semibold tracking-tight text-[18px]">Commentaires ({comments.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {comments.map((comment) => {
                      const author = users.find((u) => u.id === comment.createdBy);
                      return (
                        <div key={comment.id} className="flex gap-4 p-4 border rounded-lg" data-testid={`comment-${comment.id}`}>
                          <Avatar>
                            <AvatarFallback>
                              {author?.firstName?.[0]}{author?.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground">
                                {author?.firstName} {author?.lastName}
                              </p>
                              <span className="text-sm text-muted-foreground">•</span>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(comment.createdAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                              </p>
                            </div>
                            <p className="text-sm text-foreground whitespace-pre-wrap">{comment.content}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setCommentToDelete(comment.id);
                              setIsDeleteCommentDialogOpen(true);
                            }}
                            data-testid={`button-delete-comment-${comment.id}`}
                          >
                            <Trash2 className="w-4 h-4 text-muted-foreground hover:text-red-600" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Activités */}
          <TabsContent value="activites" className="space-y-4">
            {/* Timeline des activités */}
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight text-[18px]">Historique des activités</CardTitle>
              </CardHeader>
              <CardContent>
                {[...activities, ...comments.map((c) => ({ ...c, type: 'comment' as const })), ...contacts.map((c) => ({ ...c, type: 'contact' as const })), ...projects.map((p) => ({ ...p, type: 'project' as const })), ...tasks.map((t) => ({ ...t, type: 'task' as const }))].length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucune activité pour le moment
                  </div>
                )}
                
                {[...activities, ...comments.map((c) => ({ ...c, type: 'comment' as const })), ...contacts.map((c) => ({ ...c, type: 'contact' as const })), ...projects.map((p) => ({ ...p, type: 'project' as const })), ...tasks.map((t) => ({ ...t, type: 'task' as const }))].length > 0 && (
                  <div className="relative space-y-6 pl-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {/* Toutes les activités triées par ordre décroissant chronologique (plus récentes en premier, création du client en bas) */}
                    {[
                      // Ajouter la création du client
                      ...(client ? [{ ...client, _date: new Date(client.createdAt), _type: 'client_created' as const }] : []),
                      // Ajouter les autres activités
                      ...projects.map((p) => ({ ...p, _date: new Date(p.createdAt), _type: 'project' as const })),
                      ...tasks.map((t) => ({ ...t, _date: new Date(t.createdAt), _type: 'task' as const })),
                      ...contacts.map((c) => ({ ...c, _date: new Date(c.createdAt), _type: 'contact' as const })),
                      ...comments.map((c) => ({ ...c, _date: new Date(c.createdAt), _type: 'comment' as const })),
                    ]
                      .sort((a, b) => b._date.getTime() - a._date.getTime())
                      .map((item, index) => {
                        const author = users.find((u) => u.id === item.createdBy);
                        
                        if (item._type === 'client_created') {
                          return (
                            <div key="client-created" className="relative" data-testid="activity-client-created">
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                                <User className="w-3 h-3 text-primary-foreground" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">
                                    {author?.firstName} {author?.lastName}
                                  </span>{" "}
                                  a créé le compte
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'project') {
                          return (
                            <div key={`project-${item.id}`} className="relative" data-testid={`activity-project-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
                                <Briefcase className="w-3 h-3 text-accent-foreground" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé un projet : {(item as Project).name}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'task') {
                          return (
                            <div key={`task-${item.id}`} className="relative" data-testid={`activity-task-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                                <CheckCircle2 className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé une tâche : {(item as Task).title}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'contact') {
                          return (
                            <div key={`contact-${item.id}`} className="relative" data-testid={`activity-contact-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-cyan-500 flex items-center justify-center">
                                <UserPlus className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a créé le contact {(item as Contact).fullName}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        if (item._type === 'comment') {
                          return (
                            <div key={`comment-activity-${item.id}`} className="relative" data-testid={`activity-comment-${item.id}`}>
                              <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                                <MessageSquare className="w-3 h-3 text-white" />
                              </div>
                              <div className="space-y-1">
                                <p className="text-foreground">
                                  <span className="font-medium">{author?.firstName} {author?.lastName}</span> a ajouté un commentaire
                                </p>
                                <p className="text-sm text-muted-foreground">
                                  {format(item._date, "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                                </p>
                              </div>
                            </div>
                          );
                        }

                        return null;
                      })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Tâches & RDV */}
          <TabsContent value="taches" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="font-semibold tracking-tight text-[18px]">Tâches du client</CardTitle>
                <Button onClick={() => setIsTaskDialogOpen(true)} data-testid="button-add-task">
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle tâche
                </Button>
              </CardHeader>
              <CardContent>
                {tasks.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucune tâche pour ce client
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tasks.map((task) => {
                      const assignee = users.find((u) => u.id === task.assignedToId);
                      const project = projects.find((p) => p.id === task.projectId);
                      
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-4 border rounded-lg hover-elevate"
                          data-testid={`task-item-${task.id}`}
                        >
                          <div className="flex items-center gap-4 flex-1">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-foreground">{task.title}</p>
                                <Badge variant={
                                  task.priority === "high" ? "destructive" :
                                  task.priority === "medium" ? "default" : "secondary"
                                }>
                                  {task.priority === "high" ? "Haute" :
                                   task.priority === "medium" ? "Moyenne" : "Basse"}
                                </Badge>
                                <Badge variant="outline">
                                  {task.status === "todo" ? "À faire" :
                                   task.status === "in_progress" ? "En cours" :
                                   task.status === "review" ? "En revue" : "Terminé"}
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                {project && (
                                  <span className="flex items-center gap-1">
                                    <Briefcase className="w-3 h-3" />
                                    {project.name}
                                  </span>
                                )}
                                {assignee && (
                                  <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {assignee.firstName} {assignee.lastName}
                                  </span>
                                )}
                                {task.dueDate && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {format(new Date(task.dueDate), "d MMM yyyy", { locale: fr })}
                                  </span>
                                )}
                              </div>
                              {task.description && (
                                <p className="text-sm text-muted-foreground mt-2">{task.description}</p>
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

          {/* Projets */}
          <TabsContent value="projets" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="font-semibold tracking-tight text-[18px]">Projets du client</CardTitle>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    Aucun projet rattaché à ce client
                  </div>
                ) : (
                  <div className="space-y-3">
                    {projects.map((project) => {
                      const getStageColor = (stage: string | null) => {
                        switch (stage) {
                          case "prospection":
                            return "bg-yellow-100 text-yellow-700 border-yellow-200";
                          case "signe":
                            return "bg-purple-100 text-purple-700 border-purple-200";
                          case "en_cours":
                            return "bg-blue-100 text-blue-700 border-blue-200";
                          case "termine":
                            return "bg-green-100 text-green-700 border-green-200";
                          default:
                            return "bg-gray-100 text-gray-700 border-gray-200";
                        }
                      };

                      const getStageLabel = (stage: string | null) => {
                        switch (stage) {
                          case "prospection":
                            return "Prospection";
                          case "signe":
                            return "Signé";
                          case "en_cours":
                            return "En cours";
                          case "termine":
                            return "Terminé";
                          default:
                            return stage || "Non défini";
                        }
                      };

                      return (
                        <Link href={`/projects/${project.id}`} key={project.id}>
                          <div
                            className="p-4 border rounded-md hover-elevate active-elevate-2 cursor-pointer"
                            data-testid={`project-item-${project.id}`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <FolderKanban className="w-4 h-4 text-primary flex-shrink-0" />
                                  <h4 className="font-medium truncate">{project.name}</h4>
                                </div>
                                {project.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                                    {project.description}
                                  </p>
                                )}
                                <div className="flex flex-wrap items-center gap-2 text-xs">
                                  <Badge className={getStageColor(project.stage)}>
                                    {getStageLabel(project.stage)}
                                  </Badge>
                                  {project.category && (
                                    <Badge variant="outline">{project.category}</Badge>
                                  )}
                                  {project.startDate && (
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <CalendarIcon className="w-3 h-3" />
                                      {format(new Date(project.startDate), "dd MMM yyyy", { locale: fr })}
                                    </span>
                                  )}
                                  {project.budget && (
                                    <span className="font-medium">
                                      {parseFloat(project.budget).toLocaleString("fr-FR", {
                                        style: "currency",
                                        currency: "EUR",
                                        minimumFractionDigits: 0,
                                      })}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1">
                <CardTitle className="font-semibold tracking-tight text-[18px]">Documents</CardTitle>
                <Badge variant="secondary">{clientDocuments.length}</Badge>
              </CardHeader>
              <CardContent>
                {clientDocuments.length === 0 ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">
                    Aucun document lié à ce client ou ses projets.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {clientDocuments.map((document) => (
                      <Link key={document.id} href={`/documents/${document.id}`}>
                        <div className="p-4 border rounded-md hover-elevate cursor-pointer" data-testid={`document-${document.id}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <h4 className="text-sm font-medium mb-1" data-testid={`title-document-${document.id}`}>
                                {document.name || "Sans titre"}
                              </h4>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge 
                                  variant={document.status === "draft" ? "outline" : "default"}
                                  className={document.status === "draft" ? "text-muted-foreground" : "bg-green-600 dark:bg-green-700 text-white"}
                                  data-testid={`status-${document.id}`}
                                >
                                  {document.status === "draft" ? "Brouillon" : 
                                   document.status === "published" ? "Publié" : "Archivé"}
                                </Badge>
                                {document.updatedAt && (
                                  <span className="text-[11px] text-muted-foreground">
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
          <SheetContent className="sm:max-w-2xl w-full overflow-y-auto flex flex-col" data-testid="dialog-create-contact">
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
        <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Nouvelle tâche pour {client?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Titre *</Label>
                <Input
                  value={taskFormData.title}
                  onChange={(e) => setTaskFormData({ ...taskFormData, title: e.target.value })}
                  placeholder="Titre de la tâche"
                  data-testid="input-task-title"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={taskFormData.description}
                  onChange={(e) => setTaskFormData({ ...taskFormData, description: e.target.value })}
                  placeholder="Description de la tâche"
                  rows={3}
                  data-testid="input-task-description"
                />
              </div>
              <div>
                <Label>Projet (optionnel)</Label>
                <Select
                  value={taskFormData.projectId || "none"}
                  onValueChange={(value) => setTaskFormData({ ...taskFormData, projectId: value === "none" ? "" : value })}
                >
                  <SelectTrigger data-testid="select-task-project">
                    <SelectValue placeholder="Sélectionner un projet" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun projet</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                  <Label>Statut</Label>
                  <Select
                    value={taskFormData.status}
                    onValueChange={(value) => setTaskFormData({ ...taskFormData, status: value })}
                  >
                    <SelectTrigger data-testid="select-task-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">À faire</SelectItem>
                      <SelectItem value="in_progress">En cours</SelectItem>
                      <SelectItem value="review">En revue</SelectItem>
                      <SelectItem value="done">Terminé</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Date d'échéance</Label>
                <Input
                  type="date"
                  value={taskFormData.dueDate}
                  onChange={(e) => setTaskFormData({ ...taskFormData, dueDate: e.target.value })}
                  data-testid="input-task-duedate"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
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
            </div>
          </DialogContent>
        </Dialog>

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
      </div>
    </div>
  );
}
