import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Loader2, X } from "lucide-react";

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

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to create appointment");
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

    createMutation.mutate({
      title: title.trim(),
      startDateTime,
      endDateTime: endDateTime || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      notes: notes.trim() || null,
    });
  };

  const handleClose = () => {
    setTitle("");
    setStartDateTime(new Date().toISOString().slice(0, 16));
    setEndDateTime("");
    setContactEmail("");
    setContactPhone("");
    setNotes("");
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-background border-l border-border shadow-lg z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Nouveau rendez-vous</h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleClose}
          data-testid="button-close-appointment-panel"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
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
        </form>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={handleClose}
          data-testid="button-cancel-appointment"
        >
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
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
    </div>
  );
}
