import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, ChevronDown, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useBilling } from "@/hooks/useBilling";
import { apiRequest } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import type { Project } from "@shared/schema";

interface NoteSource {
  title: string;
  noteId: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: NoteSource[];
}

interface AiAssistantProps {
  projectId?: string;
  projectName?: string;
}

interface AiChatResponse {
  response?: string;
  error?: string;
  sources?: NoteSource[];
}

function parseApiError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    const jsonMatch = msg.match(/^\d+:\s*(\{.+\})$/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return parsed.message ?? parsed.error ?? msg;
      } catch { /* fall through */ }
    }
    return msg;
  }
  if (typeof err === "string") return err;
  return "Erreur de l'assistant IA";
}

function SimpleMarkdown({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("### ")) {
          return <p key={i} className="font-semibold text-sm mt-2">{line.slice(4)}</p>;
        }
        if (line.startsWith("## ")) {
          return <p key={i} className="font-semibold text-sm mt-2">{line.slice(3)}</p>;
        }
        if (line.startsWith("# ")) {
          return <p key={i} className="font-semibold text-sm mt-2">{line.slice(2)}</p>;
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return <p key={i} className="font-semibold text-sm">{line.slice(2, -2)}</p>;
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return <p key={i} className="text-sm pl-2">• {line.slice(2)}</p>;
        }
        if (/^\d+\. /.test(line)) {
          return <p key={i} className="text-sm pl-2">{line}</p>;
        }
        if (line.trim() === "") {
          return <div key={i} className="h-1" />;
        }
        const boldRegex = /\*\*(.+?)\*\*/g;
        const parts: (string | JSX.Element)[] = [];
        let last = 0;
        let match;
        const lineStr = line;
        while ((match = boldRegex.exec(lineStr)) !== null) {
          if (match.index > last) parts.push(lineStr.slice(last, match.index));
          parts.push(<strong key={match.index}>{match[1]}</strong>);
          last = match.index + match[0].length;
        }
        if (last < lineStr.length) parts.push(lineStr.slice(last));
        return <p key={i} className="text-sm">{parts}</p>;
      })}
    </div>
  );
}


function AiAssistantPanel({ onClose, projectId, projectName }: { onClose: () => void; projectId?: string; projectName?: string }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: projectName
        ? `Bonjour ! Je suis votre assistant IA PlanBase. Je suis prêt à vous aider sur le projet **${projectName}** ou toute autre question business.`
        : "Bonjour ! Je suis votre assistant IA PlanBase. Posez-moi vos questions sur la gestion de projet, la rentabilité, ou comment tirer le meilleur parti de PlanBase.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: trimmed }]);
    setIsLoading(true);

    try {
      const res = await apiRequest("/api/ai/chat", "POST", {
        message: trimmed,
        projectId: projectId ?? undefined,
      });
      const data: AiChatResponse = await res.json();
      if (data.error) throw new Error(data.error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response ?? "",
          sources: data.sources && data.sources.length > 0 ? data.sources : undefined,
        },
      ]);
    } catch (err) {
      let errorMsg = "Désolé, une erreur est survenue.";
      try {
        if (err instanceof Response) {
          const body = await err.json();
          errorMsg = body?.message ?? body?.error ?? errorMsg;
        } else {
          errorMsg = parseApiError(err);
        }
      } catch {
        errorMsg = parseApiError(err);
      }
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: errorMsg,
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="ai-assistant-panel">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-violet-100 dark:bg-violet-900/30 p-1.5">
            <Bot className="w-4 h-4 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">Assistant IA</p>
            {projectName && (
              <p className="text-xs text-muted-foreground">Contexte : {projectName}</p>
            )}
          </div>
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} data-testid="button-close-ai-assistant">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0"
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex flex-col", msg.role === "user" ? "items-end" : "items-start")}
            data-testid={`ai-message-${msg.role}-${i}`}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-md px-3 py-2 overflow-hidden break-words",
                msg.role === "user"
                  ? "bg-violet-600 text-white text-sm"
                  : "bg-muted text-foreground"
              )}
            >
              {msg.role === "assistant" ? (
                <SimpleMarkdown text={msg.content} />
              ) : (
                <span className="text-sm">{msg.content}</span>
              )}
            </div>
            {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
              <div className="max-w-[85%] mt-1 flex flex-wrap gap-1" data-testid={`ai-sources-${i}`}>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 w-full">
                  <FileText className="w-3 h-3" />
                  Contexte trouvé dans {msg.sources.length} note{msg.sources.length > 1 ? "s" : ""}
                </span>
                {msg.sources.map((src) => (
                  <span
                    key={src.noteId}
                    className="text-[10px] bg-muted border rounded px-1.5 py-0.5 text-muted-foreground truncate max-w-[180px]"
                    title={src.title}
                    data-testid={`ai-source-note-${src.noteId}`}
                  >
                    {src.title}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start" data-testid="ai-loading">
            <div className="bg-muted rounded-md px-3 py-2 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Réflexion en cours...</span>
            </div>
          </div>
        )}
      </div>

      <div className="border-t p-3 shrink-0">
        <div className="flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Posez votre question..."
            className="resize-none text-sm min-h-[60px] max-h-[120px]"
            disabled={isLoading}
            data-testid="input-ai-message"
            rows={2}
          />
          <Button
            size="icon"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            data-testid="button-send-ai-message"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">Entrée pour envoyer · Maj+Entrée pour nouvelle ligne</p>
      </div>
    </div>
  );
}

interface UrlProjectInfo {
  projectId: string | null;
  projectName: string | null;
}

function useProjectInfoFromUrl(): UrlProjectInfo {
  const [location] = useLocation();
  const match = location.match(/^\/projects\/([^/]+)/);
  const projectId = match ? match[1] : null;

  const { data: project } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
    enabled: projectId !== null,
  });

  return {
    projectId: projectId ?? null,
    projectName: project?.name ?? null,
  };
}

export function useAiAssistantState() {
  const { hasFeature, isLoading } = useBilling();
  const [isOpen, setIsOpen] = useState(false);
  const { projectId, projectName } = useProjectInfoFromUrl();

  return {
    isOpen,
    setIsOpen,
    toggle: () => setIsOpen((v) => !v),
    hasAccess: !isLoading && hasFeature("ai_assistant"),
    isLoading,
    projectId: projectId ?? undefined,
    projectName: projectName ?? undefined,
  };
}

export function AiAssistantDrawer({ isOpen, onClose, projectId, projectName }: { isOpen: boolean; onClose: () => void; projectId?: string; projectName?: string }) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-50"
      data-testid="ai-assistant-container"
    >
      <div className="w-[380px] h-[520px] bg-background border rounded-md shadow-lg flex flex-col overflow-hidden">
        <AiAssistantPanel onClose={onClose} projectId={projectId} projectName={projectName} />
      </div>
    </div>
  );
}

export function AiAssistant({ projectId: propProjectId, projectName: propProjectName }: AiAssistantProps) {
  const { hasAccess, isLoading, isOpen, toggle, projectId: urlProjectId, projectName: urlProjectName } = useAiAssistantState();
  const projectId = propProjectId ?? urlProjectId;
  const projectName = propProjectName ?? urlProjectName;

  if (isLoading || !hasAccess) return null;

  return (
    <div
      className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
      data-testid="ai-assistant-container"
    >
      {isOpen && (
        <div className="w-[380px] h-[520px] bg-background border rounded-md shadow-lg flex flex-col overflow-hidden">
          <AiAssistantPanel onClose={toggle} projectId={projectId} projectName={projectName} />
        </div>
      )}

      <Button
        className="rounded-full shadow-lg px-4 gap-2"
        onClick={toggle}
        data-testid="button-toggle-ai-assistant"
        title={isOpen ? "Fermer l'assistant IA" : "Ouvrir l'assistant IA"}
      >
        {isOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <Bot className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">Assistant IA</span>
      </Button>
    </div>
  );
}
