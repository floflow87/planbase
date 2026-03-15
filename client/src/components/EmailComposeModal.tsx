import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Minus, Maximize2, Send } from "lucide-react";

interface Contact {
  id: string;
  fullName: string;
  email: string | null;
}

interface ComposeData {
  to: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  threadId?: string;
}

interface EmailComposeModalProps {
  open: boolean;
  onClose: () => void;
  contacts: Contact[];
  senderEmail?: string;
  initialData?: Partial<ComposeData>;
  onSend: (data: ComposeData) => void;
  isSending?: boolean;
}

export function EmailComposeModal({
  open,
  onClose,
  contacts,
  senderEmail,
  initialData,
  onSend,
  isSending,
}: EmailComposeModalProps) {
  const [minimized, setMinimized] = useState(false);
  const [data, setData] = useState<ComposeData>({
    to: initialData?.to || "",
    subject: initialData?.subject || "",
    body: initialData?.body || "",
    replyToMessageId: initialData?.replyToMessageId,
    threadId: initialData?.threadId,
  });

  useEffect(() => {
    if (open && initialData) {
      setData({
        to: initialData.to || "",
        subject: initialData.subject || "",
        body: initialData.body || "",
        replyToMessageId: initialData.replyToMessageId,
        threadId: initialData.threadId,
      });
      setMinimized(false);
    }
  }, [open, initialData?.to, initialData?.subject, initialData?.body]);

  const handleSend = () => {
    if (data.to && data.subject && data.body) {
      onSend(data);
    }
  };

  if (!open) return null;

  if (minimized) {
    return (
      <div
        className="fixed bottom-0 right-6 z-50 w-72 bg-primary text-primary-foreground rounded-t-lg shadow-lg cursor-pointer"
        onClick={() => setMinimized(false)}
        data-testid="compose-email-minimized"
      >
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-sm font-medium truncate">
            {data.subject || "Nouveau message"}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 text-primary-foreground no-default-hover-elevate no-default-active-elevate"
              onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
              data-testid="button-expand-compose"
            >
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-5 w-5 text-primary-foreground no-default-hover-elevate no-default-active-elevate"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              data-testid="button-close-compose-minimized"
            >
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed bottom-0 right-6 z-50 w-[480px] max-w-[calc(100vw-2rem)] bg-background border rounded-t-lg shadow-2xl flex flex-col"
      style={{ maxHeight: "calc(100vh - 4rem)" }}
      data-testid="compose-email-modal"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground rounded-t-lg">
        <span className="text-sm font-medium">Nouveau message</span>
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-primary-foreground no-default-hover-elevate no-default-active-elevate"
            onClick={() => setMinimized(true)}
            data-testid="button-minimize-compose"
          >
            <Minus className="w-3 h-3" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 text-primary-foreground no-default-hover-elevate no-default-active-elevate"
            onClick={onClose}
            data-testid="button-close-compose"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="px-3 py-1.5 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">{"\u00C0"}</span>
            {data.to && !contacts.some(c => c.email === data.to) ? (
              <div className="flex items-center gap-2 flex-1">
                <span className="text-xs text-foreground">{data.to}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-4 w-4 shrink-0"
                  onClick={() => setData(d => ({ ...d, to: "" }))}
                  data-testid="button-clear-compose-to"
                >
                  <X className="w-2.5 h-2.5" />
                </Button>
              </div>
            ) : (
              <Select
                value={data.to}
                onValueChange={(val) => setData(d => ({ ...d, to: val }))}
              >
                <SelectTrigger className="border-0 shadow-none h-7 text-xs p-0 focus:ring-0" data-testid="select-compose-to">
                  <SelectValue placeholder="Destinataire" />
                </SelectTrigger>
                <SelectContent>
                  {contacts.filter(c => c.email).map(c => (
                    <SelectItem key={c.id} value={c.email!} data-testid={`select-compose-contact-${c.id}`}>
                      {c.fullName} ({c.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        <div className="px-3 py-1.5 border-b">
          <Input
            value={data.subject}
            onChange={(e) => setData(d => ({ ...d, subject: e.target.value }))}
            placeholder="Objet"
            className="border-0 shadow-none h-7 text-xs p-0 focus-visible:ring-0"
            data-testid="input-compose-subject"
          />
        </div>

        <div className="flex-1 px-3 py-2">
          <Textarea
            value={data.body}
            onChange={(e) => setData(d => ({ ...d, body: e.target.value }))}
            placeholder="Contenu de l'email..."
            className="border-0 shadow-none text-xs resize-none min-h-[200px] h-full focus-visible:ring-0"
            data-testid="input-compose-body"
          />
        </div>

        <div className="flex items-center justify-between px-3 py-2 border-t gap-2">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleSend}
              disabled={!data.to || !data.subject || !data.body || isSending}
              data-testid="button-send-compose"
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {isSending ? "Envoi..." : "Envoyer"}
            </Button>
          </div>
          {senderEmail && (
            <span className="text-[10px] text-muted-foreground truncate">
              depuis {senderEmail}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
