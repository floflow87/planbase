import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { X, Minus, Maximize2, Send, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  fullName: string;
  email: string | null;
}

interface ComposeData {
  to: string;
  cc?: string;
  bcc?: string;
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

function EmailAutocomplete({
  value,
  onChange,
  placeholder,
  contacts,
  "data-testid": testId,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  contacts: Contact[];
  "data-testid"?: string;
}) {
  const [inputVal, setInputVal] = useState(value);
  const [suggestions, setSuggestions] = useState<Contact[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setInputVal(value);
  }, [value]);

  function handleInput(v: string) {
    setInputVal(v);
    onChange(v);
    if (v.length >= 1) {
      const lower = v.toLowerCase();
      const filtered = contacts
        .filter(c => c.email && (
          c.fullName.toLowerCase().includes(lower) ||
          (c.email || "").toLowerCase().includes(lower)
        ))
        .slice(0, 6);
      setSuggestions(filtered);
      setOpen(filtered.length > 0);
    } else {
      setSuggestions([]);
      setOpen(false);
    }
  }

  function selectContact(c: Contact) {
    const val = c.email || "";
    setInputVal(val);
    onChange(val);
    setSuggestions([]);
    setOpen(false);
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative flex-1">
      <Input
        value={inputVal}
        onChange={(e) => handleInput(e.target.value)}
        placeholder={placeholder}
        className="border-0 shadow-none h-7 text-xs p-0 focus-visible:ring-0"
        data-testid={testId}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 z-[200] w-64 bg-white dark:bg-popover border rounded-md shadow-lg py-1 mt-0.5">
          {suggestions.map(c => (
            <button
              key={c.id}
              type="button"
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-muted/60 flex flex-col"
              onMouseDown={() => selectContact(c)}
            >
              <span className="font-medium text-foreground">{c.fullName}</span>
              <span className="text-muted-foreground">{c.email}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [data, setData] = useState<ComposeData>({
    to: initialData?.to || "",
    cc: initialData?.cc || "",
    bcc: initialData?.bcc || "",
    subject: initialData?.subject || "",
    body: initialData?.body || "",
    replyToMessageId: initialData?.replyToMessageId,
    threadId: initialData?.threadId,
  });

  useEffect(() => {
    if (open && initialData) {
      setData({
        to: initialData.to || "",
        cc: initialData.cc || "",
        bcc: initialData.bcc || "",
        subject: initialData.subject || "",
        body: initialData.body || "",
        replyToMessageId: initialData.replyToMessageId,
        threadId: initialData.threadId,
      });
      setMinimized(false);
      setShowCcBcc(false);
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
        {/* To */}
        <div className="px-3 py-1.5 border-b">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0 w-6">À</span>
            <EmailAutocomplete
              value={data.to}
              onChange={(v) => setData(d => ({ ...d, to: v }))}
              placeholder="Destinataire"
              contacts={contacts}
              data-testid="input-compose-to"
            />
            <button
              type="button"
              onClick={() => setShowCcBcc(s => !s)}
              className="text-[10px] text-muted-foreground shrink-0 hover:text-foreground transition-colors flex items-center gap-0.5"
              data-testid="button-toggle-cc-bcc"
            >
              Cc/Cci <ChevronDown className={cn("w-3 h-3 transition-transform", showCcBcc && "rotate-180")} />
            </button>
          </div>
        </div>

        {/* CC */}
        {showCcBcc && (
          <div className="px-3 py-1.5 border-b">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-6">Cc</span>
              <EmailAutocomplete
                value={data.cc || ""}
                onChange={(v) => setData(d => ({ ...d, cc: v }))}
                placeholder="Copie"
                contacts={contacts}
                data-testid="input-compose-cc"
              />
            </div>
          </div>
        )}

        {/* BCC */}
        {showCcBcc && (
          <div className="px-3 py-1.5 border-b">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground shrink-0 w-6">Cci</span>
              <EmailAutocomplete
                value={data.bcc || ""}
                onChange={(v) => setData(d => ({ ...d, bcc: v }))}
                placeholder="Copie cachée"
                contacts={contacts}
                data-testid="input-compose-bcc"
              />
            </div>
          </div>
        )}

        {/* Subject */}
        <div className="px-3 py-1.5 border-b">
          <Input
            value={data.subject}
            onChange={(e) => setData(d => ({ ...d, subject: e.target.value }))}
            placeholder="Objet"
            className="border-0 shadow-none h-7 text-xs p-0 focus-visible:ring-0"
            data-testid="input-compose-subject"
          />
        </div>

        {/* Body */}
        <div className="flex-1 px-3 py-2 overflow-hidden">
          <Textarea
            value={data.body}
            onChange={(e) => setData(d => ({ ...d, body: e.target.value }))}
            placeholder="Contenu de l'email..."
            className="border-0 shadow-none text-xs resize-none min-h-[200px] h-full focus-visible:ring-0"
            data-testid="input-compose-body"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-3 py-2 border-t gap-2">
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!data.to || !data.subject || !data.body || isSending}
            data-testid="button-send-compose"
          >
            <Send className="w-3.5 h-3.5 mr-1.5" />
            {isSending ? "Envoi..." : "Envoyer"}
          </Button>
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
