import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, ChevronsUpDown, Check, X, Trash2, Edit, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, AppointmentType } from "@shared/schema";
import { appointmentTypes } from "@shared/schema";

interface Appointment {
  id: string;
  title: string;
  type: AppointmentType | null;
  startDateTime: string;
  endDateTime: string | null;
  clientId: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  location?: string | null;
  htmlLink?: string | null;
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }> | null;
  organizer?: { email: string; displayName?: string } | null;
}

interface AppointmentPanelProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date;
  appointment?: Appointment | null;
  mode?: "create" | "view" | "edit";
  isReadOnly?: boolean;
  source?: "planbase" | "google";
}

const appointmentTypeLabels: Record<AppointmentType, string> = {
  KICKOFF: "Kickoff",
  MEETING: "Réunion",
  CALL: "Appel",
  WORKSHOP: "Atelier",
  REVIEW: "Revue",
  RETROSPECTIVE: "Rétrospective",
  DEMO: "Démo",
  DELIVERY: "Livraison",
  OTHER: "Autre",
};

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function AppointmentPanel({ open, onClose, selectedDate, appointment, mode: initialMode = "create", isReadOnly = false, source = "planbase" }: AppointmentPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"create" | "view" | "edit">(initialMode);
  const [modeJustChanged, setModeJustChanged] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AppointmentType>("MEETING");
  const [startDateTime, setStartDateTime] = useState(
    selectedDate ? formatDateTimeLocal(selectedDate) : formatDateTimeLocal(new Date())
  );
  const [endDateTime, setEndDateTime] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [clientSearchValue, setClientSearchValue] = useState("");

  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: open,
  });

  const filteredClients = useMemo(() => {
    if (!clientSearchValue) return clients;
    const search = clientSearchValue.toLowerCase();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(search) ||
        client.email?.toLowerCase().includes(search) ||
        client.company?.toLowerCase().includes(search)
    );
  }, [clients, clientSearchValue]);

  const selectedClient = useMemo(() => 
    clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  useEffect(() => {
    if (open) {
      if (appointment) {
        setTitle(appointment.title);
        setType(appointment.type || "MEETING");
        setStartDateTime(formatDateTimeLocal(new Date(appointment.startDateTime)));
        setEndDateTime(appointment.endDateTime ? formatDateTimeLocal(new Date(appointment.endDateTime)) : "");
        setSelectedClientId(appointment.clientId);
        setContactEmail(appointment.contactEmail || "");
        setContactPhone(appointment.contactPhone || "");
        setNotes(appointment.notes || "");
        setMode(initialMode);
      } else {
        setMode("create");
        if (selectedDate) {
          setStartDateTime(formatDateTimeLocal(selectedDate));
        }
      }
    }
  }, [open, appointment, selectedDate, initialMode]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/appointments", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/appointments" });
      toast({
        title: "Rendez-vous créé",
        description: "Votre rendez-vous a été ajouté au calendrier.",
        className: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer le rendez-vous.",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest(`/api/appointments/${appointment?.id}`, "PATCH", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/appointments" });
      toast({
        title: "Rendez-vous modifié",
        description: "Les modifications ont été enregistrées.",
        className: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier le rendez-vous.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest(`/api/appointments/${appointment?.id}`, "DELETE");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === "/api/appointments" });
      toast({
        title: "Rendez-vous supprimé",
        description: "Le rendez-vous a été supprimé du calendrier.",
        className: "bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800",
      });
      handleClose();
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le rendez-vous.",
        variant: "destructive",
      });
    },
  });

  const handleSwitchToEdit = () => {
    setModeJustChanged(true);
    setMode("edit");
    setTimeout(() => setModeJustChanged(false), 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (modeJustChanged) {
      return;
    }
    
    if (!title.trim() || !startDateTime) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir au minimum le titre et la date de début.",
        variant: "destructive",
      });
      return;
    }

    const startDateTimeISO = new Date(startDateTime).toISOString();
    const endDateTimeISO = endDateTime ? new Date(endDateTime).toISOString() : null;
    
    const data = {
      title: title.trim(),
      type,
      startDateTime: startDateTimeISO,
      endDateTime: endDateTimeISO,
      clientId: selectedClientId,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      notes: notes.trim() || null,
    };

    if (mode === "edit" && appointment) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const handleClose = () => {
    setTitle("");
    setType("MEETING");
    setStartDateTime(formatDateTimeLocal(new Date()));
    setEndDateTime("");
    setSelectedClientId(null);
    setClientSearchValue("");
    setContactEmail("");
    setContactPhone("");
    setNotes("");
    setMode("create");
    onClose();
  };

  const isViewMode = mode === "view";
  const isLoading = createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  const getTitle = () => {
    if (mode === "create") return "Nouveau rendez-vous";
    if (mode === "edit") return "Modifier le rendez-vous";
    return "Détails du rendez-vous";
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto flex flex-col bg-white dark:bg-gray-950" data-testid="sheet-appointment">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {isViewMode ? <Eye className="h-5 w-5" /> : <Edit className="h-5 w-5" />}
            {getTitle()}
          </SheetTitle>
          <SheetDescription>
            {mode === "create" 
              ? "Créez un nouveau rendez-vous dans votre calendrier."
              : mode === "edit" 
                ? "Modifiez les informations du rendez-vous."
                : "Consultez les détails du rendez-vous."}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              placeholder="Réunion client"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isViewMode}
              data-testid="input-appointment-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as AppointmentType)} disabled={isViewMode}>
              <SelectTrigger data-testid="select-appointment-type">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {appointmentTypes.map((t) => (
                  <SelectItem key={t} value={t} data-testid={`type-option-${t}`}>
                    {appointmentTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Client</Label>
            {isViewMode ? (
              <div className="p-2 border rounded-md bg-muted/50">
                {selectedClient ? (
                  <span>
                    {selectedClient.name}
                    {selectedClient.company && (
                      <span className="text-muted-foreground ml-1">({selectedClient.company})</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Aucun client associé</span>
                )}
              </div>
            ) : (
              <>
                <Popover open={clientSearchOpen} onOpenChange={setClientSearchOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={clientSearchOpen}
                      className="w-full justify-between font-normal"
                      data-testid="button-select-client"
                    >
                      {selectedClient ? (
                        <span className="truncate text-sm">
                          {selectedClient.name}
                          {selectedClient.company && (
                            <span className="text-muted-foreground ml-1 text-xs">
                              ({selectedClient.company})
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Sélectionner un client...</span>
                      )}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput 
                        placeholder="Rechercher un client..." 
                        value={clientSearchValue}
                        onValueChange={setClientSearchValue}
                        data-testid="input-search-client"
                      />
                      <CommandList>
                        <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                        <CommandGroup>
                          {filteredClients.slice(0, 10).map((client) => (
                            <CommandItem
                              key={client.id}
                              value={client.id}
                              onSelect={() => {
                                setSelectedClientId(client.id);
                                setClientSearchOpen(false);
                                setClientSearchValue("");
                                if (client.email && !contactEmail) {
                                  setContactEmail(client.email);
                                }
                                if (client.phone && !contactPhone) {
                                  setContactPhone(client.phone);
                                }
                              }}
                              data-testid={`client-option-${client.id}`}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedClientId === client.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              <div className="flex flex-col">
                                <span>{client.name}</span>
                                {client.company && (
                                  <span className="text-xs text-muted-foreground">{client.company}</span>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                {selectedClient && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedClientId(null);
                      setContactEmail("");
                      setContactPhone("");
                    }}
                    data-testid="button-clear-client"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Retirer le client
                  </Button>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDateTime">Début *</Label>
              <Input
                id="startDateTime"
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
                disabled={isViewMode}
                data-testid="input-appointment-start"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDateTime">Fin</Label>
              <Input
                id="endDateTime"
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
                disabled={isViewMode}
                data-testid="input-appointment-end"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactEmail">Email contact</Label>
            <Input
              id="contactEmail"
              type="email"
              placeholder="contact@example.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              disabled={isViewMode}
              data-testid="input-appointment-email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPhone">Téléphone</Label>
            <Input
              id="contactPhone"
              type="tel"
              placeholder="+33 6 12 34 56 78"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              disabled={isViewMode}
              data-testid="input-appointment-phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Détails du rendez-vous..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={isViewMode}
              className="min-h-24"
              data-testid="textarea-appointment-notes"
            />
          </div>

          {source === "google" && appointment && (
            <div className="space-y-4 p-4 bg-cyan-50 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800">
              <div className="flex items-center gap-2 text-cyan-700 dark:text-cyan-300 font-medium">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Événement Google Calendar
              </div>
              
              {appointment.location && (
                <div className="space-y-1">
                  <Label className="text-cyan-700 dark:text-cyan-300">Lieu</Label>
                  <div className="p-2 bg-white dark:bg-gray-900 rounded border text-sm">
                    {appointment.location}
                  </div>
                </div>
              )}

              {appointment.organizer && (
                <div className="space-y-1">
                  <Label className="text-cyan-700 dark:text-cyan-300">Organisateur</Label>
                  <div className="p-2 bg-white dark:bg-gray-900 rounded border text-sm">
                    {appointment.organizer.displayName || appointment.organizer.email}
                    {appointment.organizer.displayName && (
                      <span className="text-muted-foreground ml-2">({appointment.organizer.email})</span>
                    )}
                  </div>
                </div>
              )}

              {appointment.attendees && appointment.attendees.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-cyan-700 dark:text-cyan-300">Participants ({appointment.attendees.length})</Label>
                  <div className="p-2 bg-white dark:bg-gray-900 rounded border space-y-1 max-h-40 overflow-y-auto">
                    {appointment.attendees.map((attendee, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span>
                          {attendee.displayName || attendee.email}
                          {attendee.displayName && (
                            <span className="text-muted-foreground ml-1 text-xs">({attendee.email})</span>
                          )}
                        </span>
                        <span className={cn(
                          "text-xs px-2 py-0.5 rounded-full",
                          attendee.responseStatus === "accepted" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                          attendee.responseStatus === "declined" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
                          attendee.responseStatus === "tentative" && "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
                          attendee.responseStatus === "needsAction" && "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        )}>
                          {attendee.responseStatus === "accepted" && "Accepté"}
                          {attendee.responseStatus === "declined" && "Refusé"}
                          {attendee.responseStatus === "tentative" && "Peut-être"}
                          {attendee.responseStatus === "needsAction" && "En attente"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {appointment.htmlLink && (
                <a
                  href={appointment.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-cyan-600 dark:text-cyan-400 hover:underline"
                  data-testid="link-google-calendar"
                >
                  Ouvrir dans Google Calendar
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          )}

          <div className="flex justify-between gap-2 pt-4 border-t">
            {isViewMode && appointment ? (
              <>
                {!isReadOnly && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isLoading}
                        data-testid="button-delete-appointment"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Supprimer le rendez-vous ?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Cette action est irréversible. Le rendez-vous sera définitivement supprimé.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => deleteMutation.mutate()}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Supprimer
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
                {isReadOnly && <div />}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    data-testid="button-close-appointment"
                  >
                    Fermer
                  </Button>
                  <Button
                    type="button"
                    onClick={handleSwitchToEdit}
                    disabled={isReadOnly}
                    data-testid="button-edit-appointment"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Modifier
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div></div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClose}
                    data-testid="button-cancel-appointment"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    data-testid="button-save-appointment"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {mode === "edit" ? "Enregistrement..." : "Création..."}
                      </>
                    ) : (
                      mode === "edit" ? "Enregistrer" : "Créer"
                    )}
                  </Button>
                </div>
              </>
            )}
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
