import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { X, Minus, Maximize2, Send, ChevronDown, Paperclip, FileText, Trash2, FolderOpen, Search, File, Bold, Italic, Underline, Strikethrough, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

interface Contact {
  id: string;
  fullName: string;
  email: string | null;
}

interface AttachmentFile {
  filename: string;
  content: string;
  mimeType: string;
  size: number;
}

interface ComposeData {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  replyToMessageId?: string;
  threadId?: string;
  attachments?: AttachmentFile[];
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

interface PlanbaseFile {
  id: string;
  name: string;
  kind: string;
  mime?: string | null;
  mimeType?: string | null;
  size?: number | null;
  fileSize?: number | null;
  storagePath?: string | null;
  storageUrl?: string | null;
  createdAt?: string;
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

  useEffect(() => { setInputVal(value); }, [value]);

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
        <div className="absolute top-full left-0 z-[9999] w-72 bg-white dark:bg-popover border rounded-md shadow-xl py-1 mt-0.5">
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`;
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
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [planbaseOpen, setPlanbaseOpen] = useState(false);
  const [planbaseSearch, setPlanbaseSearch] = useState("");
  const [attachingFileId, setAttachingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [toolbarPos, setToolbarPos] = useState<{ x: number; y: number } | null>(null);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, strikethrough: false });
  const [data, setData] = useState<Omit<ComposeData, "attachments">>({
    to: initialData?.to || "",
    cc: initialData?.cc || "",
    bcc: initialData?.bcc || "",
    subject: initialData?.subject || "",
    body: initialData?.body || "",
    replyToMessageId: initialData?.replyToMessageId,
    threadId: initialData?.threadId,
  });

  const { data: planbaseFiles = [] } = useQuery<PlanbaseFile[]>({
    queryKey: ["/api/files"],
    enabled: planbaseOpen,
  });

  const uploadedFiles = planbaseFiles.filter(f =>
    f.kind === "upload" && (f.storagePath || f.storageUrl)
  );

  const filteredPlanbaseFiles = planbaseSearch.trim()
    ? uploadedFiles.filter(f => f.name.toLowerCase().includes(planbaseSearch.toLowerCase()))
    : uploadedFiles;

  useEffect(() => {
    if (open && initialData) {
      const newBody = initialData.body || "";
      setData({
        to: initialData.to || "",
        cc: initialData.cc || "",
        bcc: initialData.bcc || "",
        subject: initialData.subject || "",
        body: newBody,
        replyToMessageId: initialData.replyToMessageId,
        threadId: initialData.threadId,
      });
      setAttachments([]);
      setMinimized(false);
      setShowCcBcc(false);
      setToolbarPos(null);
      // Sync into contenteditable on next tick
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = newBody;
      }, 0);
    }
  }, [open, initialData?.to, initialData?.subject, initialData?.body]);

  const detectSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setToolbarPos(null);
      return;
    }
    const range = sel.getRangeAt(0);
    if (!editorRef.current?.contains(range.commonAncestorContainer)) {
      setToolbarPos(null);
      return;
    }
    const rect = range.getBoundingClientRect();
    setToolbarPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikethrough: document.queryCommandState("strikeThrough"),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", detectSelection);
    return () => document.removeEventListener("selectionchange", detectSelection);
  }, [detectSelection]);

  const applyFormat = useCallback((cmd: string) => {
    document.execCommand(cmd, false, undefined);
    editorRef.current?.focus();
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setData(d => ({ ...d, body: html }));
    }
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikethrough: document.queryCommandState("strikeThrough"),
    });
  }, []);

  function handleEditorInput() {
    if (editorRef.current) {
      setData(d => ({ ...d, body: editorRef.current!.innerHTML }));
    }
  }

  function isBodyEmpty() {
    const html = data.body;
    if (!html) return true;
    const stripped = html.replace(/<[^>]*>/g, "").trim();
    return stripped === "";
  }

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        const base64 = result.split(",")[1];
        setAttachments(prev => [...prev, {
          filename: file.name,
          content: base64,
          mimeType: file.type || "application/octet-stream",
          size: file.size,
        }]);
      };
      reader.onerror = () => {
        console.error("Failed to read file:", file.name);
      };
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeAttachment(idx: number) {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  }

  async function attachPlanbaseFile(file: PlanbaseFile) {
    try {
      setAttachingFileId(file.id);
      const urlRes = await apiRequest(`/api/files/${file.id}/download-url`, "GET");
      const { url } = await urlRes.json();
      const fileRes = await fetch(url);
      if (!fileRes.ok) throw new Error("Download failed");
      const blob = await fileRes.blob();
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        const base64 = result.split(",")[1];
        const mimeType = file.mimeType || file.mime || blob.type || "application/octet-stream";
        const size = file.fileSize || file.size || blob.size;
        setAttachments(prev => [...prev, {
          filename: file.name,
          content: base64,
          mimeType,
          size,
        }]);
        setAttachingFileId(null);
        setPlanbaseOpen(false);
        setPlanbaseSearch("");
      };
      reader.onerror = () => {
        setAttachingFileId(null);
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Failed to attach Planbase file:", e);
      setAttachingFileId(null);
    }
  }

  const handleSend = () => {
    if (data.to && data.subject && data.body) {
      onSend({ ...data, attachments: attachments.length > 0 ? attachments : undefined });
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
          <span className="text-sm font-medium truncate">{data.subject || "Nouveau message"}</span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost"
              className="h-5 w-5 text-primary-foreground no-default-hover-elevate no-default-active-elevate"
              onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
              data-testid="button-expand-compose">
              <Maximize2 className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost"
              className="h-5 w-5 text-primary-foreground no-default-hover-elevate no-default-active-elevate"
              onClick={(e) => { e.stopPropagation(); onClose(); }}
              data-testid="button-close-compose-minimized">
              <X className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className="fixed bottom-0 right-6 z-50 w-[520px] max-w-[calc(100vw-2rem)] bg-background border rounded-t-lg shadow-2xl flex flex-col"
        style={{ height: "600px", maxHeight: "calc(100vh - 4rem)" }}
        data-testid="compose-email-modal"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-primary text-primary-foreground rounded-t-lg shrink-0">
          <span className="text-sm font-medium">
            {data.replyToMessageId ? "Répondre" : "Nouveau message"}
          </span>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost"
              className="h-5 w-5 text-primary-foreground no-default-hover-elevate no-default-active-elevate"
              onClick={() => setMinimized(true)}
              data-testid="button-minimize-compose">
              <Minus className="w-3 h-3" />
            </Button>
            <Button size="icon" variant="ghost"
              className="h-5 w-5 text-primary-foreground no-default-hover-elevate no-default-active-elevate"
              onClick={onClose}
              data-testid="button-close-compose">
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

          {showCcBcc && (
            <>
              <div className="px-3 py-1.5 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 w-6">Cc</span>
                  <EmailAutocomplete value={data.cc || ""} onChange={(v) => setData(d => ({ ...d, cc: v }))}
                    placeholder="Copie" contacts={contacts} data-testid="input-compose-cc" />
                </div>
              </div>
              <div className="px-3 py-1.5 border-b">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground shrink-0 w-6">Cci</span>
                  <EmailAutocomplete value={data.bcc || ""} onChange={(v) => setData(d => ({ ...d, bcc: v }))}
                    placeholder="Copie cachée" contacts={contacts} data-testid="input-compose-bcc" />
                </div>
              </div>
            </>
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

          {/* Floating format toolbar */}
          {toolbarPos && (
            <div
              ref={toolbarRef}
              className="fixed z-[200] flex items-center gap-0.5 bg-popover border border-border rounded-md shadow-md px-1 py-0.5 -translate-x-1/2"
              style={{ left: toolbarPos.x, top: toolbarPos.y - 36 }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }}
                className={cn("p-1 rounded hover-elevate", activeFormats.bold && "bg-accent")}
                title="Gras"
              >
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }}
                className={cn("p-1 rounded hover-elevate", activeFormats.italic && "bg-accent")}
                title="Italique"
              >
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("underline"); }}
                className={cn("p-1 rounded hover-elevate", activeFormats.underline && "bg-accent")}
                title="Souligné"
              >
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("strikeThrough"); }}
                className={cn("p-1 rounded hover-elevate", activeFormats.strikethrough && "bg-accent")}
                title="Barré"
              >
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("insertUnorderedList"); }}
                className="p-1 rounded hover-elevate"
                title="Liste"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); applyFormat("insertOrderedList"); }}
                className="p-1 rounded hover-elevate"
                title="Liste numérotée"
              >
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Body */}
          <div className="flex-1 px-3 py-2 overflow-y-auto min-h-0">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={handleEditorInput}
              className="outline-none text-xs min-h-full w-full leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground empty:before:pointer-events-none"
              data-placeholder="Contenu de l'email..."
              data-testid="input-compose-body"
              style={{ wordBreak: "break-word" }}
            />
          </div>

          {/* Attachments list */}
          {attachments.length > 0 && (
            <div className="px-3 py-2 border-t space-y-1 max-h-28 overflow-y-auto bg-muted/30">
              {attachments.map((att, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-background rounded-md px-2 py-1">
                  <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-[10px] text-foreground truncate flex-1">{att.filename}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatFileSize(att.size)}</span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(idx)}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    data-testid={`button-remove-attachment-${idx}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between px-3 py-2 border-t gap-2 shrink-0">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                onClick={handleSend}
                disabled={!data.to || !data.subject || isBodyEmpty() || isSending}
                data-testid="button-send-compose"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                {isSending ? "Envoi..." : "Envoyer"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFilePick}
                data-testid="input-compose-file"
              />
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Joindre un fichier local"
                data-testid="button-attach-file"
              >
                <Paperclip className="w-4 h-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                type="button"
                onClick={() => { setPlanbaseSearch(""); setPlanbaseOpen(true); }}
                title="Joindre un fichier Planbase"
                data-testid="button-attach-planbase"
              >
                <FolderOpen className="w-4 h-4" />
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

      {/* Planbase File Picker Dialog */}
      <Dialog open={planbaseOpen} onOpenChange={setPlanbaseOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Joindre un fichier Planbase</DialogTitle>
          </DialogHeader>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-8 h-8 text-xs"
              placeholder="Rechercher un fichier..."
              value={planbaseSearch}
              onChange={(e) => setPlanbaseSearch(e.target.value)}
              data-testid="input-planbase-search"
            />
          </div>
          <div className="max-h-64 overflow-y-auto space-y-1">
            {filteredPlanbaseFiles.length === 0 ? (
              <div className="text-center py-8 text-xs text-muted-foreground">
                <File className="w-8 h-8 mx-auto mb-2 opacity-30" />
                {uploadedFiles.length === 0 ? "Aucun fichier uploadé dans Planbase" : "Aucun résultat"}
              </div>
            ) : (
              filteredPlanbaseFiles.map(f => (
                <button
                  key={f.id}
                  type="button"
                  disabled={attachingFileId === f.id}
                  onClick={() => attachPlanbaseFile(f)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-muted/60 transition-colors text-left disabled:opacity-50"
                  data-testid={`button-planbase-file-${f.id}`}
                >
                  <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{f.name}</p>
                    {(f.fileSize || f.size) ? (
                      <p className="text-[10px] text-muted-foreground">{formatFileSize((f.fileSize || f.size)!)}</p>
                    ) : null}
                  </div>
                  {attachingFileId === f.id && (
                    <span className="text-[10px] text-muted-foreground shrink-0">Chargement...</span>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
