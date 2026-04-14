import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Mail, Paperclip, ChevronDown, ChevronUp, Reply, Forward, Check, CheckCheck } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useState, useRef, useEffect, useCallback } from "react";

interface EmailPayload {
  gmailMessageId: string;
  emailMessageId?: string;
  subject?: string;
  snippet?: string;
  bodyText?: string;
  bodyHtml?: string;
  fromEmail: string;
  fromName?: string;
  direction: "sent" | "received";
  hasAttachments?: boolean;
  contactNames?: string;
  recipients?: string;
  participants?: Array<{ email: string; name?: string; role: string }>;
}

interface EmailActivityCardProps {
  activityId: string;
  payload: EmailPayload | Record<string, unknown>;
  occurredAt?: string | Date | null;
  variant?: "card" | "timeline";
  onReply?: (payload: EmailPayload) => void;
  onForward?: (payload: EmailPayload) => void;
}

function getSenderRecipientLine(payload: EmailPayload): string {
  if (payload.direction === "sent") {
    if (payload.recipients) {
      return `\u00C0 : ${payload.recipients}`;
    }
    const toParticipants = (payload.participants || [])
      .filter((p) => p.role === "to" || p.role === "cc")
      .map((p) => p.name || p.email)
      .join(", ");
    return toParticipants ? `\u00C0 : ${toParticipants}` : "";
  }
  const senderDisplay = payload.fromName || payload.fromEmail;
  return `De : ${senderDisplay}`;
}

function getPreviewText(payload: EmailPayload): string {
  if (payload.snippet && payload.snippet.trim()) return payload.snippet;
  if (payload.bodyText && payload.bodyText.trim()) {
    const text = payload.bodyText.trim();
    return text.length > 150 ? text.substring(0, 150) + "\u2026" : text;
  }
  return "";
}

function hasExpandableContent(payload: EmailPayload): boolean {
  return !!(payload.bodyHtml?.trim() || payload.bodyText?.trim() || payload.snippet?.trim());
}

function DeliveryStatus({ direction }: { direction: "sent" | "received" }) {
  if (direction === "received") {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center cursor-default" data-testid="status-received">
            <CheckCheck className="w-3.5 h-3.5 text-blue-500" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs bg-white dark:bg-gray-900 text-foreground border shadow-md">
          {"Re\u00e7u et lu"}
        </TooltipContent>
      </Tooltip>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center cursor-default" data-testid="status-sent">
          <Check className="w-3.5 h-3.5 text-emerald-500" />
          <Check className="w-3.5 h-3.5 text-emerald-500 -ml-2" />
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs bg-white dark:bg-gray-900 text-foreground border shadow-md">
        {"Envoy\u00e9 et lu"}
      </TooltipContent>
    </Tooltip>
  );
}

function HtmlEmailBody({ html }: { html: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(200);
  const isDark = document.documentElement.classList.contains("dark");

  const adjustHeight = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentDocument?.body) {
      const newHeight = Math.min(iframe.contentDocument.body.scrollHeight + 16, 600);
      setHeight(Math.max(newHeight, 60));
    }
  }, []);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const doc = iframe.contentDocument;
    if (!doc) return;

    const textColor = isDark ? "#e5e7eb" : "#333";
    const bgColor = isDark ? "transparent" : "transparent";
    const linkColor = isDark ? "#93c5fd" : "#2563eb";
    const blockquoteColor = isDark ? "#9ca3af" : "#666";
    const blockquoteBorder = isDark ? "#4b5563" : "#ddd";

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              font-size: 13px;
              line-height: 1.5;
              color: ${textColor};
              background: ${bgColor};
              margin: 0;
              padding: 8px;
              word-wrap: break-word;
              overflow-wrap: break-word;
            }
            img { max-width: 100%; height: auto; }
            a { color: ${linkColor}; }
            blockquote { border-left: 3px solid ${blockquoteBorder}; margin: 8px 0; padding-left: 12px; color: ${blockquoteColor}; }
            pre { white-space: pre-wrap; word-wrap: break-word; }
            table { max-width: 100%; border-collapse: collapse; }
            td, th { padding: 4px 8px; }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    doc.close();

    setTimeout(adjustHeight, 100);
    setTimeout(adjustHeight, 500);
  }, [html, adjustHeight, isDark]);

  return (
    <iframe
      ref={iframeRef}
      sandbox="allow-same-origin"
      style={{ width: "100%", height: `${height}px`, border: "none" }}
      title="Email content"
      data-testid="iframe-email-content"
    />
  );
}

function EmailContent({ payload }: { payload: EmailPayload }) {
  if (payload.bodyHtml && payload.bodyHtml.trim()) {
    return <HtmlEmailBody html={payload.bodyHtml} />;
  }
  if (payload.bodyText && payload.bodyText.trim()) {
    return (
      <div className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
        {payload.bodyText}
      </div>
    );
  }
  if (payload.snippet) {
    return (
      <div className="text-xs text-muted-foreground italic">
        {payload.snippet}
      </div>
    );
  }
  return null;
}

function ActionButtons({ payload, onReply, onForward }: {
  payload: EmailPayload;
  onReply?: (p: EmailPayload) => void;
  onForward?: (p: EmailPayload) => void;
}) {
  if (!onReply && !onForward) return null;
  return (
    <div className="flex items-center gap-1 mt-2">
      {onReply && (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs gap-1"
          onClick={(e) => { e.stopPropagation(); onReply(payload); }}
          data-testid={`button-reply-email-${payload.gmailMessageId}`}
        >
          <Reply className="w-3 h-3" />
          {"R\u00e9pondre"}
        </Button>
      )}
      {onForward && (
        <Button
          size="sm"
          variant="ghost"
          className="text-xs gap-1"
          onClick={(e) => { e.stopPropagation(); onForward(payload); }}
          data-testid={`button-forward-email-${payload.gmailMessageId}`}
        >
          <Forward className="w-3 h-3" />
          {"Transf\u00e9rer"}
        </Button>
      )}
    </div>
  );
}

export function EmailActivityCard({ activityId, payload: rawPayload, occurredAt, variant = "card", onReply, onForward }: EmailActivityCardProps) {
  const payload = rawPayload as EmailPayload;
  const [expanded, setExpanded] = useState(false);
  const senderRecipientLine = getSenderRecipientLine(payload);
  const preview = getPreviewText(payload);
  const expandable = hasExpandableContent(payload);

  const isSent = payload.direction === "sent";
  const iconBgClass = isSent
    ? "bg-emerald-100 dark:bg-emerald-900/30"
    : "bg-blue-100 dark:bg-blue-900/30";
  const iconColorClass = isSent
    ? "text-emerald-600 dark:text-emerald-400"
    : "text-blue-600 dark:text-blue-400";
  const badgeClass = isSent
    ? "bg-emerald-500 text-white no-default-hover-elevate no-default-active-elevate"
    : "bg-blue-500 text-white no-default-hover-elevate no-default-active-elevate";
  const timelineDotClass = isSent
    ? "bg-emerald-500"
    : "bg-blue-500";

  if (variant === "timeline") {
    return (
      <div className="relative" data-testid={`activity-email-timeline-${activityId}`}>
        <div className={`absolute left-[-1.75rem] top-0.5 w-4 h-4 rounded-full ${timelineDotClass} flex items-center justify-center`}>
          <Mail className="w-2.5 h-2.5 text-white" />
        </div>
        <div
          className="cursor-pointer"
          onClick={() => expandable && setExpanded(!expanded)}
          data-testid={`button-toggle-email-${activityId}`}
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              className={`text-[10px] h-4 px-1.5 ${badgeClass}`}
            >
              {isSent ? "Envoy\u00e9" : "Re\u00e7u"}
            </Badge>
            <DeliveryStatus direction={payload.direction} />
            <span className="text-xs font-medium text-foreground truncate max-w-[200px]">
              {payload.subject || "(sans objet)"}
            </span>
            {payload.hasAttachments && <Paperclip className="w-3 h-3 text-muted-foreground" />}
            {expandable && (
              expanded
                ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                : <ChevronDown className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
          {senderRecipientLine && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {senderRecipientLine}
              {payload.contactNames && ` \u2014 ${payload.contactNames}`}
            </p>
          )}
          {occurredAt && (
            <p className="text-[10px] text-muted-foreground">
              {format(new Date(occurredAt), "d MMM yyyy '\u00e0' HH:mm", { locale: fr })}
            </p>
          )}
          {!expanded && preview && (
            <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 italic">
              {preview}
            </p>
          )}
        </div>
        {expanded && (
          <div className="mt-1.5 p-2 rounded-md bg-muted/50 border" data-testid={`text-email-content-${activityId}`}>
            <EmailContent payload={payload} />
            <ActionButtons payload={payload} onReply={onReply} onForward={onForward} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex items-start gap-3 p-3 border rounded-md hover-elevate cursor-pointer"
      onClick={() => expandable && setExpanded(!expanded)}
      data-testid={`activity-email-${activityId}`}
    >
      <div className={`w-7 h-7 rounded-full ${iconBgClass} flex items-center justify-center shrink-0`}>
        <Mail className={`w-3.5 h-3.5 ${iconColorClass}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <Badge
            className={`text-[10px] h-4 px-1.5 ${badgeClass}`}
          >
            {isSent ? "Envoy\u00e9" : "Re\u00e7u"}
          </Badge>
          <DeliveryStatus direction={payload.direction} />
          {payload.hasAttachments && <Paperclip className="w-3 h-3 text-muted-foreground" />}
          {occurredAt && (
            <span className="text-[10px] text-muted-foreground">
              {format(new Date(occurredAt), "d MMM yyyy '\u00e0' HH:mm", { locale: fr })}
            </span>
          )}
          {expandable && (
            <span className="ml-auto">
              {expanded
                ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
              }
            </span>
          )}
        </div>
        <p className="text-xs font-medium text-foreground truncate">
          {payload.subject || "(sans objet)"}
        </p>
        {senderRecipientLine && (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {senderRecipientLine}
            {payload.contactNames && ` \u2014 ${payload.contactNames}`}
          </p>
        )}
        {!expanded && preview && (
          <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2 italic">
            {preview}
          </p>
        )}
        {expanded && (
          <div className="mt-2 p-2.5 rounded-md bg-muted/50 border" data-testid={`text-email-content-${activityId}`}>
            <EmailContent payload={payload} />
            <ActionButtons payload={payload} onReply={onReply} onForward={onForward} />
          </div>
        )}
      </div>
    </div>
  );
}
