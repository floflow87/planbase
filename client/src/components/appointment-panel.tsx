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

export function AppointmentPanel({ open, onClose, selectedDate, appointment, mode: initialMode = "create", isReadOnly = false, source = "planbase" }: AppointmentPanelProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"create" | "view" | "edit">(initialMode);
  const [modeJustChanged, setModeJustChanged] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AppointmentType>("MEETING");
  const [startDateTime, setStartDateTime] = useState(
    selectedDate ? selectedDate.toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16)
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
        setStartDateTime(new Date(appointment.startDateTime).toISOString().slice(0, 16));
        setEndDateTime(appointment.endDateTime ? new Date(appointment.endDateTime).toISOString().slice(0, 16) : "");
        setSelectedClientId(appointment.clientId);
        setContactEmail(appointment.contactEmail || "");
        setContactPhone(appointment.contactPhone || "");
        setNotes(appointment.notes || "");
        setMode(initialMode);
      } else {
        setMode("create");
        if (selectedDate) {
          setStartDateTime(selectedDate.toISOString().slice(0, 16));
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
    setStartDateTime(new Date().toISOString().slice(0, 16));
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
                        <span className="truncate">
                          {selectedClient.name}
                          {selectedClient.company && (
                            <span className="text-muted-foreground ml-1">
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
