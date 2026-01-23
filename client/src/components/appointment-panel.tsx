import { useState, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Loader2, ChevronsUpDown, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client } from "@shared/schema";

interface AppointmentPanelProps {
  open: boolean;
  onClose: () => void;
  selectedDate?: Date;
}

export function AppointmentPanel({ open, onClose, selectedDate }: AppointmentPanelProps) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
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

  // Fetch clients for autocomplete
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
    enabled: open,
  });

  // Filter clients based on search
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

  // Get selected client name for display
  const selectedClient = useMemo(() => 
    clients.find((c) => c.id === selectedClientId),
    [clients, selectedClientId]
  );

  // Update start date when panel opens with a selected date
  useEffect(() => {
    if (open && selectedDate) {
      setStartDateTime(selectedDate.toISOString().slice(0, 16));
    }
  }, [open, selectedDate]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("/api/appointments", "POST", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
      toast({
        title: "✅ Rendez-vous créé",
        description: "Votre rendez-vous a été ajouté au calendrier.",
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !startDateTime) {
      toast({
        title: "Champs manquants",
        description: "Veuillez remplir au minimum le titre et la date de début.",
        variant: "destructive",
      });
      return;
    }

    // Convert datetime-local format to ISO string with timezone
    const startDateTimeISO = new Date(startDateTime).toISOString();
    const endDateTimeISO = endDateTime ? new Date(endDateTime).toISOString() : null;
    
    createMutation.mutate({
      title: title.trim(),
      startDateTime: startDateTimeISO,
      endDateTime: endDateTimeISO,
      clientId: selectedClientId,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      notes: notes.trim() || null,
    });
  };

  const handleClose = () => {
    setTitle("");
    setStartDateTime(new Date().toISOString().slice(0, 16));
    setEndDateTime("");
    setSelectedClientId(null);
    setClientSearchValue("");
    setContactEmail("");
    setContactPhone("");
    setNotes("");
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleClose();
      }
    }}>
      <SheetContent className="sm:max-w-xl w-full overflow-y-auto flex flex-col" data-testid="sheet-appointment">
        <SheetHeader>
          <SheetTitle>Nouveau rendez-vous</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 flex-1 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titre *</Label>
            <Input
              id="title"
              placeholder="Réunion client"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              data-testid="input-appointment-title"
            />
          </div>

          <div className="space-y-2">
            <Label>Client</Label>
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
                    <span className="text-muted-foreground">Sélectionner un client...</span>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startDateTime">Début *</Label>
              <Input
                id="startDateTime"
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
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
              className="min-h-24"
              data-testid="textarea-appointment-notes"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t">
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
              disabled={createMutation.isPending}
              data-testid="button-create-appointment"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Création...
                </>
              ) : (
                "Créer"
              )}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
