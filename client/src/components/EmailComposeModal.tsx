import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  X, Maximize2, Send, ChevronDown, Paperclip, FileText, Trash2, FolderOpen, Search, File,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered,
  Undo2, Redo2, Type, AlignLeft, AlignCenter, AlignRight, AlignJustify,
  Minus, Link2, Heading1, Heading2, Heading3,
  Clock, CalendarIcon, FileEdit,
} from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { format, addDays, setHours, setMinutes, nextMonday } from "date-fns";

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
  onSaveDraft?: (data: ComposeData) => void;
  isSavingDraft?: boolean;
  onSchedule?: (data: ComposeData, scheduledAt: Date) => void;
  isScheduling?: boolean;
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
  onSaveDraft,
  isSavingDraft,
  onSchedule,
  isScheduling,
}: EmailComposeModalProps) {
  const [minimized, setMinimized] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [planbaseOpen, setPlanbaseOpen] = useState(false);
  const [planbaseSearch, setPlanbaseSearch] = useState("");
  const [attachingFileId, setAttachingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState({ bold: false, italic: false, underline: false, strikethrough: false });
  const [headingValue, setHeadingValue] = useState<"p" | "h1" | "h2" | "h3">("p");
  const [alignValue, setAlignValue] = useState<"left" | "center" | "right" | "justify">("left");
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [customDateOpen, setCustomDateOpen] = useState(false);
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [customTime, setCustomTime] = useState("09:00");
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
      setHeadingValue("p");
      setAlignValue("left");
      // Sync into contenteditable on next tick
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = newBody;
      }, 0);
    }
  }, [open, initialData?.to, initialData?.subject, initialData?.body]);

  const updateFormatState = useCallback(() => {
    setActiveFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      strikethrough: document.queryCommandState("strikeThrough"),
    });
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", updateFormatState);
    return () => document.removeEventListener("selectionchange", updateFormatState);
  }, [updateFormatState]);

  const applyFormat = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    if (editorRef.current) setData(d => ({ ...d, body: editorRef.current!.innerHTML }));
    updateFormatState();
  }, [updateFormatState]);

  const applyBlockFormat = useCallback((tag: "p" | "h1" | "h2" | "h3") => {
    editorRef.current?.focus();
    document.execCommand("formatBlock", false, tag);
    setHeadingValue(tag);
    if (editorRef.current) setData(d => ({ ...d, body: editorRef.current!.innerHTML }));
  }, []);

  const applyAlign = useCallback((align: "left" | "center" | "right" | "justify") => {
    editorRef.current?.focus();
    const cmdMap = { left: "justifyLeft", center: "justifyCenter", right: "justifyRight", justify: "justifyFull" } as const;
    document.execCommand(cmdMap[align], false, undefined);
    setAlignValue(align);
    if (editorRef.current) setData(d => ({ ...d, body: editorRef.current!.innerHTML }));
  }, []);

  const handleLinkInsert = useCallback(() => {
    if (!linkUrl.trim() || linkUrl === "https://") return;
    editorRef.current?.focus();
    document.execCommand("createLink", false, linkUrl);
    if (editorRef.current) setData(d => ({ ...d, body: editorRef.current!.innerHTML }));
    setLinkDialogOpen(false);
    setLinkUrl("https://");
  }, [linkUrl]);

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

  const handleSaveDraft = () => {
    if (onSaveDraft) {
      onSaveDraft({ ...data, attachments: attachments.length > 0 ? attachments : undefined });
    }
  };

  const buildScheduledDate = (preset?: Date): Date => {
    if (preset) return preset;
    if (customDate) {
      const [h, m] = customTime.split(":").map(Number);
      const d = new Date(customDate);
      d.setHours(h, m, 0, 0);
      return d;
    }
    return addDays(new Date(), 1);
  };

  const handleSchedule = (scheduledAt: Date) => {
    if (onSchedule) {
      onSchedule({ ...data, attachments: attachments.length > 0 ? attachments : undefined }, scheduledAt);
      setScheduleOpen(false);
      setCustomDateOpen(false);
    }
  };

  const schedulePresets = () => {
    const now = new Date();
    const tomorrow = addDays(now, 1);
    const tomorrowMorning = setMinutes(setHours(tomorrow, 8), 0);
    const tomorrowAfternoon = setMinutes(setHours(tomorrow, 13), 0);
    const nextMon = nextMonday(now);
    const nextMonMorning = setMinutes(setHours(nextMon, 8), 0);
    return [
      { label: "Demain matin", date: tomorrowMorning, display: format(tomorrowMorning, "d MMM HH:mm") },
      { label: "Demain après-midi", date: tomorrowAfternoon, display: format(tomorrowAfternoon, "d MMM HH:mm") },
      { label: "Lundi matin", date: nextMonMorning, display: format(nextMonMorning, "d MMM HH:mm") },
    ];
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

          {/* Static format toolbar */}
          <div
            className="border-b border-border px-2 py-1 flex items-center gap-0.5 bg-muted/30 overflow-x-auto whitespace-nowrap shrink-0"
            onMouseDown={(e) => e.preventDefault()}
          >
            {/* Undo / Redo */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("undo"); }} className="h-7 w-7 flex items-center justify-center rounded hover-elevate text-muted-foreground hover:text-foreground">
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Annuler</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("redo"); }} className="h-7 w-7 flex items-center justify-center rounded hover-elevate text-muted-foreground hover:text-foreground">
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Rétablir</TooltipContent>
            </Tooltip>
            <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
            {/* Heading dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="h-7 px-1.5 flex items-center gap-0.5 rounded hover-elevate text-muted-foreground hover:text-foreground text-[11px]">
                      <Type className="w-3.5 h-3.5" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px]">Style de texte</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="text-xs min-w-[120px]">
                <DropdownMenuItem onSelect={() => applyBlockFormat("p")} className={cn("text-xs", headingValue === "p" && "font-semibold")}>Normal</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyBlockFormat("h1")} className={cn("text-xs", headingValue === "h1" && "font-semibold")}>
                  <Heading1 className="w-3.5 h-3.5 mr-1.5" />Titre 1
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyBlockFormat("h2")} className={cn("text-xs", headingValue === "h2" && "font-semibold")}>
                  <Heading2 className="w-3.5 h-3.5 mr-1.5" />Titre 2
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyBlockFormat("h3")} className={cn("text-xs", headingValue === "h3" && "font-semibold")}>
                  <Heading3 className="w-3.5 h-3.5 mr-1.5" />Titre 3
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
            {/* Bold / Italic / Underline / Strikethrough */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("bold"); }} className={cn("h-7 w-7 flex items-center justify-center rounded hover-elevate", activeFormats.bold ? "bg-[#EFE8FC] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "text-muted-foreground hover:text-foreground")}>
                  <Bold className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Gras</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("italic"); }} className={cn("h-7 w-7 flex items-center justify-center rounded hover-elevate", activeFormats.italic ? "bg-[#EFE8FC] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "text-muted-foreground hover:text-foreground")}>
                  <Italic className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Italique</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("underline"); }} className={cn("h-7 w-7 flex items-center justify-center rounded hover-elevate", activeFormats.underline ? "bg-[#EFE8FC] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "text-muted-foreground hover:text-foreground")}>
                  <Underline className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Souligné</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("strikeThrough"); }} className={cn("h-7 w-7 flex items-center justify-center rounded hover-elevate", activeFormats.strikethrough ? "bg-[#EFE8FC] text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" : "text-muted-foreground hover:text-foreground")}>
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Barré</TooltipContent>
            </Tooltip>
            <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
            {/* Align dropdown */}
            <DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <button type="button" className="h-7 px-1 flex items-center gap-0.5 rounded hover-elevate text-muted-foreground hover:text-foreground">
                      {alignValue === "left" && <AlignLeft className="w-3.5 h-3.5" />}
                      {alignValue === "center" && <AlignCenter className="w-3.5 h-3.5" />}
                      {alignValue === "right" && <AlignRight className="w-3.5 h-3.5" />}
                      {alignValue === "justify" && <AlignJustify className="w-3.5 h-3.5" />}
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-[10px]">Alignement</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="min-w-[130px]">
                <DropdownMenuItem onSelect={() => applyAlign("left")} className="text-xs gap-2">
                  <AlignLeft className="w-3.5 h-3.5" />À gauche
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyAlign("center")} className="text-xs gap-2">
                  <AlignCenter className="w-3.5 h-3.5" />Centré
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyAlign("right")} className="text-xs gap-2">
                  <AlignRight className="w-3.5 h-3.5" />À droite
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => applyAlign("justify")} className="text-xs gap-2">
                  <AlignJustify className="w-3.5 h-3.5" />Justifié
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
            {/* Lists */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("insertUnorderedList"); }} className="h-7 w-7 flex items-center justify-center rounded hover-elevate text-muted-foreground hover:text-foreground">
                  <List className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Liste à puces</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("insertOrderedList"); }} className="h-7 w-7 flex items-center justify-center rounded hover-elevate text-muted-foreground hover:text-foreground">
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Liste numérotée</TooltipContent>
            </Tooltip>
            {/* HR */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("insertHorizontalRule"); }} className="h-7 w-7 flex items-center justify-center rounded hover-elevate text-muted-foreground hover:text-foreground">
                  <Minus className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Séparateur</TooltipContent>
            </Tooltip>
            <div className="w-px h-4 bg-border mx-0.5 shrink-0" />
            {/* Link */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setLinkDialogOpen(true); }} className="h-7 w-7 flex items-center justify-center rounded hover-elevate text-muted-foreground hover:text-foreground">
                  <Link2 className="w-3.5 h-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">Insérer un lien</TooltipContent>
            </Tooltip>
          </div>

          {/* Link insert dialog */}
          {linkDialogOpen && (
            <div className="absolute inset-0 z-[210] flex items-center justify-center bg-black/20 rounded-lg" onMouseDown={(e) => e.stopPropagation()}>
              <div className="bg-popover border border-border rounded-md shadow-lg p-3 w-64">
                <p className="text-xs font-medium mb-2">Insérer un lien</p>
                <Input
                  autoFocus
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleLinkInsert(); if (e.key === "Escape") setLinkDialogOpen(false); }}
                  className="h-7 text-xs mb-2"
                  placeholder="https://example.com"
                />
                <div className="flex gap-1.5 justify-end">
                  <Button variant="ghost" size="sm" className="h-6 text-xs" onMouseDown={() => setLinkDialogOpen(false)}>Annuler</Button>
                  <Button size="sm" className="h-6 text-xs" onMouseDown={handleLinkInsert}>Insérer</Button>
                </div>
              </div>
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
              <div className="flex items-center">
                <Button
                  size="sm"
                  onClick={handleSend}
                  disabled={!data.to || !data.subject || isBodyEmpty() || isSending}
                  data-testid="button-send-compose"
                  className="rounded-r-none"
                >
                  <Send className="w-3.5 h-3.5 mr-1.5" />
                  {isSending ? "Envoi..." : "Envoyer"}
                </Button>
                <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={!data.to || !data.subject || isBodyEmpty() || isSending || isScheduling}
                      className="rounded-l-none border-l border-primary-foreground/20 px-1.5"
                      data-testid="button-schedule-send"
                      title="Programmer l'envoi"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="start" side="top" className="w-72 p-0">
                    <div className="p-3 border-b">
                      <p className="text-xs font-semibold">Programmer l'envoi</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">heure normale d'Europe centrale</p>
                    </div>
                    <div className="p-1">
                      {schedulePresets().map(preset => (
                        <button
                          key={preset.label}
                          className="w-full flex items-center justify-between px-3 py-2.5 rounded-md hover-elevate text-xs"
                          onClick={() => handleSchedule(preset.date)}
                          data-testid={`button-schedule-preset-${preset.label.replace(/\s+/g, '-')}`}
                        >
                          <span className="font-medium">{preset.label}</span>
                          <span className="text-muted-foreground">{preset.display}</span>
                        </button>
                      ))}
                      <div className="border-t mt-1 pt-1">
                        <button
                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-md hover-elevate text-xs"
                          onClick={() => setCustomDateOpen(!customDateOpen)}
                          data-testid="button-schedule-custom"
                        >
                          <CalendarIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="font-medium">Choisir une date et une heure</span>
                        </button>
                        {customDateOpen && (
                          <div className="px-2 pb-2 space-y-2">
                            <Calendar
                              mode="single"
                              selected={customDate}
                              onSelect={setCustomDate}
                              disabled={(d) => d < new Date()}
                              className="rounded-md border scale-95 origin-top"
                            />
                            <div className="flex items-center gap-2 px-1">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                              <input
                                type="time"
                                value={customTime}
                                onChange={(e) => setCustomTime(e.target.value)}
                                className="text-xs border rounded px-2 py-1 flex-1 bg-background"
                              />
                              <Button
                                size="sm"
                                disabled={!customDate}
                                onClick={() => handleSchedule(buildScheduledDate())}
                                data-testid="button-schedule-custom-confirm"
                              >
                                OK
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              {onSaveDraft && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft}
                  data-testid="button-save-draft"
                  className="text-xs"
                >
                  <FileEdit className="w-3.5 h-3.5 mr-1.5" />
                  {isSavingDraft ? "Enregistrement..." : "Brouillon"}
                </Button>
              )}
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
