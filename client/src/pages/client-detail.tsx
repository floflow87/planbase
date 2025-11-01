import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { ArrowLeft, Edit, Trash2, Plus, Mail, Phone, MapPin, Building2, User, Briefcase, MessageSquare, Clock, CheckCircle2, UserPlus, FileText, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import type { Client, Contact, Project, AppUser, ClientComment, Activity, Task } from "@shared/schema";
import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [isDeleteContactDialogOpen, setIsDeleteContactDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [contactFormData, setContactFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    position: "",
  });
  const [newComment, setNewComment] = useState("");

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

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
    select: (data) => data.filter((p: Project) => p.clientId === id),
    enabled: !!accountId,
  });

  const { data: allTasks = [] } = useQuery<Task[]>({
    queryKey: ['/api/tasks'],
    enabled: !!accountId,
  });

  // Filter tasks that belong to this client's projects
  const tasks = useMemo(() => {
    const projectIds = projects.map(p => p.id);
    return allTasks.filter(t => t.projectId && projectIds.includes(t.projectId));
  }, [allTasks, projects]);

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

  const deleteClientMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", `/api/clients/${id}`);
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
      return await apiRequest("POST", "/api/contacts", { ...data, clientId: id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsContactDialogOpen(false);
      setContactFormData({ firstName: "", lastName: "", email: "", phone: "", position: "" });
      toast({ title: "Contact créé avec succès" });
    },
    onError: () => {
      toast({ title: "Erreur lors de la création", variant: "destructive" });
    },
  });

  const updateContactMutation = useMutation({
    mutationFn: async ({ id: contactId, data }: { id: string; data: any }) => {
      return await apiRequest("PATCH", `/api/contacts/${contactId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/contacts'] });
      setIsContactDialogOpen(false);
      setEditingContact(null);
      setContactFormData({ firstName: "", lastName: "", email: "", phone: "", position: "" });
      toast({ title: "Contact mis à jour" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (contactId: string) => {
      await apiRequest("DELETE", `/api/contacts/${contactId}`);
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

  const handleCommentSubmit = () => {
    if (!newComment.trim()) return;
    createCommentMutation.mutate(newComment);
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

  if (clientLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-muted-foreground">Chargement...</div>
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
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/crm">
              <Button variant="ghost" size="icon" data-testid="button-back">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="text-xl">{client.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-3xl font-heading font-bold text-foreground">{client.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge>
                    {client.status === "prospecting" ? "Prospection" :
                     client.status === "qualified" ? "Qualifié" :
                     client.status === "negotiation" ? "Négociation" :
                     client.status === "won" ? "Gagné" :
                     client.status === "lost" ? "Perdu" : client.status}
                  </Badge>
                  <Badge variant="outline">{client.type === "company" ? "Entreprise" : "Personne"}</Badge>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href={`/crm/${id}/edit`}>
              <Button variant="outline" data-testid="button-edit">
                <Edit className="w-4 h-4 mr-2" />
                Modifier
              </Button>
            </Link>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteDialogOpen(true)}
              data-testid="button-delete"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="informations" className="w-full">
          <TabsList>
            <TabsTrigger value="informations" data-testid="tab-informations">Informations</TabsTrigger>
            <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
            <TabsTrigger value="activites" data-testid="tab-activites">Activités</TabsTrigger>
            <TabsTrigger value="taches" data-testid="tab-taches">Tâches & RDV</TabsTrigger>
            <TabsTrigger value="documents" data-testid="tab-documents">Documents</TabsTrigger>
          </TabsList>

          {/* Informations */}
          <TabsContent value="informations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informations du client</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Civilité</p>
                      <p className="text-foreground">-</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Prénom</p>
                      <p className="text-foreground">-</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Date de naissance</p>
                      <p className="text-foreground">-</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Nationalité</p>
                      <p className="text-foreground">-</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Type de client</p>
                      <Badge>{client.type === "company" ? "Entreprise" : "Personne"}</Badge>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Nom</p>
                      <p className="text-foreground">{client.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Lieu de naissance</p>
                      <p className="text-foreground">-</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Société</p>
                      <p className="text-foreground">-</p>
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
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Contacts</CardTitle>
                <Button onClick={() => openContactDialog()} data-testid="button-add-contact">
                  <Plus className="w-4 h-4 mr-2" />
                  Ajouter un contact
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
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-12 text-center text-muted-foreground">
                  Section notes à implémenter
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activités */}
          <TabsContent value="activites" className="space-y-4">
            {/* Section commentaire */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
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
                  <CardTitle>Commentaires ({comments.length})</CardTitle>
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
                            <p className="text-foreground whitespace-pre-wrap">{comment.content}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Timeline des activités */}
            <Card>
              <CardHeader>
                <CardTitle>Historique des activités</CardTitle>
              </CardHeader>
              <CardContent>
                {[...activities, ...comments.map((c) => ({ ...c, type: 'comment' as const })), ...contacts.map((c) => ({ ...c, type: 'contact' as const })), ...projects.map((p) => ({ ...p, type: 'project' as const })), ...tasks.map((t) => ({ ...t, type: 'task' as const }))].length === 0 && (
                  <div className="py-12 text-center text-muted-foreground">
                    Aucune activité pour le moment
                  </div>
                )}
                
                {[...activities, ...comments.map((c) => ({ ...c, type: 'comment' as const })), ...contacts.map((c) => ({ ...c, type: 'contact' as const })), ...projects.map((p) => ({ ...p, type: 'project' as const })), ...tasks.map((t) => ({ ...t, type: 'task' as const }))].length > 0 && (
                  <div className="relative space-y-6 pl-8 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
                    {/* Création du client */}
                    {client && (
                      <div className="relative" data-testid="activity-client-created">
                        <div className="absolute left-[-2rem] top-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                          <User className="w-3 h-3 text-primary-foreground" />
                        </div>
                        <div className="space-y-1">
                          <p className="text-foreground">
                            <span className="font-medium">
                              {users.find((u) => u.id === client.createdBy)?.firstName} {users.find((u) => u.id === client.createdBy)?.lastName}
                            </span>{" "}
                            a créé le compte
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(client.createdAt), "d MMMM yyyy 'à' HH:mm", { locale: fr })}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Autres activités triées par date décroissante */}
                    {[
                      ...projects.map((p) => ({ ...p, _date: new Date(p.createdAt), _type: 'project' as const })),
                      ...tasks.map((t) => ({ ...t, _date: new Date(t.createdAt), _type: 'task' as const })),
                      ...contacts.map((c) => ({ ...c, _date: new Date(c.createdAt), _type: 'contact' as const })),
                      ...comments.map((c) => ({ ...c, _date: new Date(c.createdAt), _type: 'comment' as const })),
                    ]
                      .sort((a, b) => b._date.getTime() - a._date.getTime())
                      .map((item, index) => {
                        const author = users.find((u) => u.id === item.createdBy);
                        
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
              <CardHeader>
                <CardTitle>Tâches & RDV</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-12 text-center text-muted-foreground">
                  Section tâches & RDV à implémenter
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Documents */}
          <TabsContent value="documents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="py-12 text-center text-muted-foreground">
                  Section documents à implémenter
                </div>
              </CardContent>
            </Card>
          </TabsContent>
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

        {/* Contact Form Dialog */}
        <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingContact ? "Modifier le contact" : "Nouveau contact"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
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
              <div className="flex justify-end gap-2">
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
          </DialogContent>
        </Dialog>

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
      </div>
    </div>
  );
}
