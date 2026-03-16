import { Node, mergeAttributes } from "@tiptap/core";
import { ReactNodeViewRenderer, NodeViewWrapper } from "@tiptap/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Code, Eye, RefreshCw, Copy, Trash2 } from "lucide-react";

interface MermaidNodeViewProps {
  node: { attrs: { code: string } };
  updateAttributes: (attrs: { code: string }) => void;
  deleteNode: () => void;
  editor: { isEditable: boolean };
}

let mermaidIdCounter = 0;

function MermaidNodeView({ node, updateAttributes, deleteNode, editor }: MermaidNodeViewProps) {
  const [svgContent, setSvgContent] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [editMode, setEditMode] = useState(false);
  const [draftCode, setDraftCode] = useState(node.attrs.code);
  const [loading, setLoading] = useState(false);
  const idRef = useRef(`mermaid-${++mermaidIdCounter}-${Date.now()}`);

  const renderDiagram = useCallback(async (code: string) => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        theme: document.documentElement.classList.contains("dark") ? "dark" : "default",
        securityLevel: "loose",
        fontFamily: "Inter, system-ui, sans-serif",
        fontSize: 14,
      });
      const id = `mermaid-svg-${++mermaidIdCounter}`;
      const { svg } = await mermaid.render(id, code.trim());
      setSvgContent(svg);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg.replace(/^Error:\s*/i, "").split("\n")[0]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    renderDiagram(node.attrs.code);
  }, [node.attrs.code, renderDiagram]);

  function handleSave() {
    updateAttributes({ code: draftCode });
    setEditMode(false);
  }

  function handleCancel() {
    setDraftCode(node.attrs.code);
    setEditMode(false);
  }

  function handleCopy() {
    navigator.clipboard.writeText(node.attrs.code);
  }

  return (
    <NodeViewWrapper>
      <div
        className="mermaid-block group relative my-3 rounded-lg border border-border bg-muted/30 overflow-hidden"
        data-testid="mermaid-block"
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border">
          <span className="text-[10px] font-mono text-muted-foreground tracking-wide">Mermaid</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={() => renderDiagram(node.attrs.code)}
              title="Rafraîchir"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6"
              onClick={handleCopy}
              title="Copier le code"
            >
              <Copy className="w-3 h-3" />
            </Button>
            {editor.isEditable && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => { setDraftCode(node.attrs.code); setEditMode(v => !v); }}
                  title={editMode ? "Voir le diagramme" : "Modifier le code"}
                >
                  {editMode ? <Eye className="w-3 h-3" /> : <Code className="w-3 h-3" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6 text-destructive hover:text-destructive"
                  onClick={deleteNode}
                  title="Supprimer"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-3">
          {editMode ? (
            <div className="space-y-2">
              <Textarea
                value={draftCode}
                onChange={e => setDraftCode(e.target.value)}
                className="font-mono text-xs min-h-[120px] resize-y"
                spellCheck={false}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="ghost" onClick={handleCancel} className="h-7 text-xs">
                  Annuler
                </Button>
                <Button size="sm" onClick={handleSave} className="h-7 text-xs">
                  Appliquer
                </Button>
              </div>
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              Rendu en cours…
            </div>
          ) : error ? (
            <div className="space-y-2">
              <div className="text-xs text-destructive font-mono bg-destructive/10 rounded px-3 py-2">
                {error}
              </div>
              <div className="font-mono text-xs text-muted-foreground whitespace-pre-wrap bg-muted rounded px-3 py-2">
                {node.attrs.code}
              </div>
            </div>
          ) : (
            <div
              className="mermaid-svg-wrapper flex justify-center"
              dangerouslySetInnerHTML={{ __html: svgContent }}
            />
          )}
        </div>
      </div>
    </NodeViewWrapper>
  );
}

export const MermaidBlock = Node.create({
  name: "mermaidBlock",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      code: {
        default: "",
        parseHTML: el => el.getAttribute("data-code") ?? "",
        renderHTML: attrs => ({ "data-code": attrs.code }),
      },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-mermaid-block]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-mermaid-block": "" })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidNodeView as any);
  },
});

export function extractMermaidBlocks(text: string): { code: string; fullMatch: string }[] {
  const regex = /```mermaid\s*\n([\s\S]*?)```/gi;
  const results: { code: string; fullMatch: string }[] = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    results.push({ code: match[1].trim(), fullMatch: match[0] });
  }
  return results;
}

export function hasMermaidBlock(text: string): boolean {
  return /```mermaid[\s\S]*?```/i.test(text);
}
