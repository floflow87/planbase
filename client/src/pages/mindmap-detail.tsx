import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  BackgroundVariant,
  Panel,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  Handle,
  Position,
  MarkerType,
  EdgeTypes,
  getBezierPath,
  EdgeProps,
} from "reactflow";
import { NodeToolbar } from "@reactflow/node-toolbar";
import "reactflow/dist/style.css";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Lightbulb,
  FileText,
  FolderOpen,
  CheckSquare,
  User,
  StickyNote,
  Settings,
  ZoomIn,
  ZoomOut,
  Maximize,
  Eye,
  EyeOff,
  Image,
  Type,
  AlignLeft,
  ExternalLink,
  Film,
  Route,
  Map,
  Network,
  Brain,
  Square,
  Upload,
  Search,
  X,
  Link2,
  Palette,
  Bold,
  Minus,
  Circle,
  ArrowRight,
  ArrowLeftRight,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  Grid3X3,
  AlignHorizontalJustifyCenter,
  AlignVerticalJustifyCenter,
  AlignHorizontalDistributeCenter,
  AlignVerticalDistributeCenter,
  Magnet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type {
  Mindmap,
  MindmapNode as MindmapNodeType,
  MindmapEdge as MindmapEdgeType,
  MindmapKind,
  Note,
  Project,
  Document,
  Task,
  Client,
} from "@shared/schema";
import { mindmapKindOptions, mindmapNodeTypeOptions } from "@shared/schema";

type MindmapNodeKind = typeof mindmapNodeTypeOptions[number]["value"];

interface LayoutConfig {
  showTitle: boolean;
  showDescription: boolean;
  showImage: boolean;
}

interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  fontWeight?: "normal" | "bold";
}

interface EdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  strokeDasharray?: string;
  markerStart?: string;
  markerEnd?: string;
}

const NODE_COLORS = [
  { name: "Défaut", value: "" },
  { name: "Rouge", value: "#fecaca" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Jaune", value: "#fef08a" },
  { name: "Vert", value: "#bbf7d0" },
  { name: "Bleu", value: "#bfdbfe" },
  { name: "Violet", value: "#ddd6fe" },
  { name: "Rose", value: "#fbcfe8" },
  { name: "Gris", value: "#e5e7eb" },
];

const BORDER_COLORS = [
  { name: "Défaut", value: "" },
  { name: "Noir", value: "#000000" },
  { name: "Rouge", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Jaune", value: "#eab308" },
  { name: "Vert", value: "#22c55e" },
  { name: "Bleu", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Rose", value: "#ec4899" },
];

const EDGE_COLORS = [
  { name: "Gris", value: "#94a3b8" },
  { name: "Noir", value: "#1f2937" },
  { name: "Rouge", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Vert", value: "#22c55e" },
  { name: "Bleu", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
];

const DEFAULT_LAYOUT_CONFIGS: Record<MindmapKind, LayoutConfig> = {
  generic: { showTitle: true, showDescription: true, showImage: true },
  storyboard: { showTitle: true, showDescription: true, showImage: true },
  user_flow: { showTitle: true, showDescription: true, showImage: false },
  architecture: { showTitle: true, showDescription: true, showImage: false },
  sitemap: { showTitle: true, showDescription: false, showImage: false },
  ideas: { showTitle: true, showDescription: false, showImage: false },
};

const KIND_ICONS: Record<MindmapKind, typeof Brain> = {
  generic: Brain,
  storyboard: Film,
  user_flow: Route,
  architecture: Network,
  sitemap: Map,
  ideas: Lightbulb,
};

const NODE_KIND_CONFIG: Record<
  MindmapNodeKind,
  { label: string; icon: typeof Lightbulb; color: string; bgColor: string }
> = {
  idea: {
    label: "Idée",
    icon: Lightbulb,
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  },
  note: {
    label: "Note",
    icon: StickyNote,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
  },
  project: {
    label: "Projet",
    icon: FolderOpen,
    color: "text-violet-600",
    bgColor: "bg-violet-50 border-violet-200 dark:bg-violet-950/30 dark:border-violet-800",
  },
  document: {
    label: "Document",
    icon: FileText,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
  },
  task: {
    label: "Tâche",
    icon: CheckSquare,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200 dark:bg-orange-950/30 dark:border-orange-800",
  },
  client: {
    label: "Client",
    icon: User,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 border-cyan-200 dark:bg-cyan-950/30 dark:border-cyan-800",
  },
  generic: {
    label: "Générique",
    icon: Square,
    color: "text-gray-600",
    bgColor: "bg-gray-50 border-gray-200 dark:bg-gray-950/30 dark:border-gray-800",
  },
  text: {
    label: "Texte",
    icon: Type,
    color: "text-neutral-600",
    bgColor: "bg-white border-transparent dark:bg-neutral-900",
  },
};

interface CustomNodeData {
  label: string;
  description?: string;
  imageUrl?: string;
  kind: MindmapNodeKind;
  isDraft?: boolean;
  linkedEntityType?: string;
  linkedEntityId?: string;
  layoutConfig: LayoutConfig;
  nodeStyle?: NodeStyle;
  isEditing?: boolean;
  onStartEdit?: () => void;
  onEndEdit?: (newText: string) => void;
  onUpdateStyle?: (style: Partial<NodeStyle>) => void;
}

function TextNode({ id, data, selected }: { id: string; data: CustomNodeData; selected?: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [text, setText] = useState(data.label);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nodeStyle = data.nodeStyle || {};

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    if (text !== data.label && data.onEndEdit) {
      data.onEndEdit(text);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setText(data.label);
      setIsEditing(false);
    }
  };

  const style: React.CSSProperties = {
    backgroundColor: nodeStyle.backgroundColor || "transparent",
    borderColor: nodeStyle.borderColor || "transparent",
    borderWidth: nodeStyle.borderWidth || 0,
    borderStyle: nodeStyle.borderWidth ? "solid" : "none",
    fontSize: nodeStyle.fontSize || 14,
    fontWeight: nodeStyle.fontWeight || "normal",
  };

  return (
    <div className="relative">
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-primary/50 !border-0"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-primary/50 !border-0"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-2 !h-2 !bg-primary/50 !border-0"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-2 !h-2 !bg-primary/50 !border-0"
      />
      
      {selected && (
        <NodeToolbar isVisible position={Position.Top} className="flex items-center gap-1 p-1 bg-card border rounded-lg shadow-lg">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Couleur de fond">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: nodeStyle.backgroundColor || "#ffffff" }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {NODE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-6 h-6 rounded border ${!color.value ? "bg-white" : ""}`}
                    style={{ backgroundColor: color.value || undefined }}
                    onClick={() => data.onUpdateStyle?.({ backgroundColor: color.value || undefined })}
                    title={color.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-5" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Bordure">
                <Square className="w-4 h-4" style={{ color: nodeStyle.borderColor || "#000000" }} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 space-y-2">
              <div className="grid grid-cols-5 gap-1">
                {BORDER_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-6 h-6 rounded border-2 ${!color.value ? "bg-white border-gray-200" : ""}`}
                    style={{ borderColor: color.value || undefined, backgroundColor: "transparent" }}
                    onClick={() => data.onUpdateStyle?.({ borderColor: color.value || undefined })}
                    title={color.name}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">Épaisseur:</span>
                {[0, 1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    className={`px-2 py-1 text-xs rounded ${nodeStyle.borderWidth === w ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => data.onUpdateStyle?.({ borderWidth: w })}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-5" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Taille de police">
                <span className="text-xs font-bold">{nodeStyle.fontSize || 14}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex items-center gap-1">
                {[12, 14, 16, 18, 20, 24].map((size) => (
                  <button
                    key={size}
                    className={`px-2 py-1 text-xs rounded ${nodeStyle.fontSize === size ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => data.onUpdateStyle?.({ fontSize: size })}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant={nodeStyle.fontWeight === "bold" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => data.onUpdateStyle?.({ fontWeight: nodeStyle.fontWeight === "bold" ? "normal" : "bold" })}
            title="Gras"
          >
            <Bold className="w-4 h-4" />
          </Button>
        </NodeToolbar>
      )}
      
      {isEditing ? (
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          className="min-w-[100px] max-w-[300px] p-2 rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
          style={style}
          rows={Math.max(1, text.split("\n").length)}
        />
      ) : (
        <div
          className="min-w-[60px] p-2 rounded cursor-text whitespace-pre-wrap"
          style={style}
          onDoubleClick={() => setIsEditing(true)}
        >
          {data.label || "Double-cliquer pour éditer"}
        </div>
      )}
    </div>
  );
}

function CustomMindmapNode({ id, data, selected }: { id: string; data: CustomNodeData; selected?: boolean }) {
  const config = NODE_KIND_CONFIG[data.kind] || NODE_KIND_CONFIG.generic;
  const Icon = config.icon;
  const { showTitle, showDescription, showImage } = data.layoutConfig;
  const nodeStyle = data.nodeStyle || {};

  const isCompact = !showDescription && !showImage;

  const customStyle: React.CSSProperties = {
    backgroundColor: nodeStyle.backgroundColor || undefined,
    borderColor: nodeStyle.borderColor || undefined,
    borderWidth: nodeStyle.borderWidth ? `${nodeStyle.borderWidth}px` : undefined,
  };

  const textStyle: React.CSSProperties = {
    fontSize: nodeStyle.fontSize || undefined,
    fontWeight: nodeStyle.fontWeight || undefined,
  };

  return (
    <div
      className={`relative rounded-lg border-2 shadow-sm ${!nodeStyle.backgroundColor ? config.bgColor : ""} ${data.isDraft ? "border-dashed" : ""} ${isCompact ? "px-3 py-2 min-w-[100px]" : "px-4 py-3 min-w-[150px] max-w-[280px]"}`}
      style={customStyle}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      <Handle
        type="target"
        position={Position.Left}
        id="left"
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
      <Handle
        type="source"
        position={Position.Right}
        id="right"
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      {selected && (
        <NodeToolbar isVisible position={Position.Top} className="flex items-center gap-1 p-1 bg-card border rounded-lg shadow-lg">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Couleur de fond">
                <div 
                  className="w-4 h-4 rounded border"
                  style={{ backgroundColor: nodeStyle.backgroundColor || "#ffffff" }}
                />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {NODE_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-6 h-6 rounded border ${!color.value ? "bg-white" : ""}`}
                    style={{ backgroundColor: color.value || undefined }}
                    onClick={() => data.onUpdateStyle?.({ backgroundColor: color.value || undefined })}
                    title={color.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-5" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Bordure">
                <Square className="w-4 h-4" style={{ color: nodeStyle.borderColor || "#000000" }} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2 space-y-2">
              <div className="grid grid-cols-5 gap-1">
                {BORDER_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-6 h-6 rounded border-2 ${!color.value ? "bg-white border-gray-200" : ""}`}
                    style={{ borderColor: color.value || undefined, backgroundColor: "transparent" }}
                    onClick={() => data.onUpdateStyle?.({ borderColor: color.value || undefined })}
                    title={color.name}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs">Épaisseur:</span>
                {[0, 1, 2, 3, 4].map((w) => (
                  <button
                    key={w}
                    className={`px-2 py-1 text-xs rounded ${nodeStyle.borderWidth === w ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => data.onUpdateStyle?.({ borderWidth: w })}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-5" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" title="Taille de police">
                <span className="text-xs font-bold">{nodeStyle.fontSize || 14}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex items-center gap-1">
                {[12, 14, 16, 18, 20, 24].map((size) => (
                  <button
                    key={size}
                    className={`px-2 py-1 text-xs rounded ${nodeStyle.fontSize === size ? "bg-primary text-primary-foreground" : "bg-muted"}`}
                    onClick={() => data.onUpdateStyle?.({ fontSize: size })}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant={nodeStyle.fontWeight === "bold" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => data.onUpdateStyle?.({ fontWeight: nodeStyle.fontWeight === "bold" ? "normal" : "bold" })}
            title="Gras"
          >
            <Bold className="w-4 h-4" />
          </Button>
        </NodeToolbar>
      )}
      
      {showImage && data.imageUrl && (
        <div className="mb-2 -mx-1 -mt-1 rounded-t overflow-hidden">
          <img 
            src={data.imageUrl} 
            alt="" 
            className="w-full h-24 object-cover"
          />
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 flex-shrink-0 ${config.color}`} />
        {!isCompact && (
          <Badge variant="outline" className="text-xs">
            {config.label}
          </Badge>
        )}
        {data.isDraft && (
          <Badge variant="secondary" className="text-xs">
            Draft
          </Badge>
        )}
        {data.linkedEntityId && (
          <ExternalLink className="w-3 h-3 text-muted-foreground" />
        )}
      </div>
      
      {showTitle && (
        <div 
          className={`font-medium text-foreground truncate ${isCompact ? "text-xs" : "text-sm"}`}
          style={textStyle}
        >
          {data.label}
        </div>
      )}
      
      {showDescription && data.description && (
        <div className="text-xs text-muted-foreground mt-1 line-clamp-2" style={textStyle}>
          {data.description}
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomMindmapNode,
  text: TextNode,
};

function MindmapCanvas() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, zoomIn, zoomOut, setViewport, getViewport } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [viewportRestored, setViewportRestored] = useState(false);
  const [isAddingNode, setIsAddingNode] = useState(false);
  const [newNodeKind, setNewNodeKind] = useState<MindmapNodeKind>("idea");
  const [newNodeLabel, setNewNodeLabel] = useState("");
  const [newNodeDescription, setNewNodeDescription] = useState("");

  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState<MindmapNodeKind>("idea");
  const [editImageUrl, setEditImageUrl] = useState("");

  const [newLinkedEntityType, setNewLinkedEntityType] = useState<string | null>(null);
  const [newLinkedEntityId, setNewLinkedEntityId] = useState<string | null>(null);
  const [newLinkedEntityName, setNewLinkedEntityName] = useState<string>("");
  const [entitySearchOpen, setEntitySearchOpen] = useState(false);
  const [entitySearchQuery, setEntitySearchQuery] = useState("");

  const [editLinkedEntityType, setEditLinkedEntityType] = useState<string | null>(null);
  const [editLinkedEntityId, setEditLinkedEntityId] = useState<string | null>(null);
  const [editLinkedEntityName, setEditLinkedEntityName] = useState<string>("");
  const [editEntitySearchOpen, setEditEntitySearchOpen] = useState(false);

  const [selectedEdge, setSelectedEdge] = useState<Edge | null>(null);
  const [showEdgeDeleteDialog, setShowEdgeDeleteDialog] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Snap to grid state
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [gridSize, setGridSize] = useState<16 | 24 | 32>(16);
  const [alignmentGuides, setAlignmentGuides] = useState<{ x?: number; y?: number }>({});

  const { data, isLoading, error } = useQuery<{
    mindmap: Mindmap;
    nodes: MindmapNodeType[];
    edges: MindmapEdgeType[];
  }>({
    queryKey: ["/api/mindmaps", id],
    enabled: !!id,
  });

  const { data: notes } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: projects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: documents } = useQuery<Document[]>({
    queryKey: ["/api/documents"],
  });

  const { data: tasks } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: clients } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
  });

  const getEntitiesForType = useCallback((type: MindmapNodeKind): Array<{ id: string; name: string }> => {
    switch (type) {
      case "note":
        return (notes || []).map(n => ({ id: n.id, name: n.title }));
      case "project":
        return (projects || []).map(p => ({ id: p.id, name: p.name }));
      case "document":
        return (documents || []).map(d => ({ id: d.id, name: d.title }));
      case "task":
        return (tasks || []).map(t => ({ id: t.id, name: t.title }));
      case "client":
        return (clients || []).map(c => ({ id: c.id, name: c.name }));
      default:
        return [];
    }
  }, [notes, projects, documents, tasks, clients]);

  const canLinkEntity = (type: MindmapNodeKind): boolean => {
    return ["note", "project", "document", "task", "client"].includes(type);
  };

  const layoutConfig: LayoutConfig = useMemo(() => {
    if (data?.mindmap?.layoutConfig && typeof data.mindmap.layoutConfig === "object") {
      const config = data.mindmap.layoutConfig as LayoutConfig;
      return {
        showTitle: config.showTitle ?? true,
        showDescription: config.showDescription ?? true,
        showImage: config.showImage ?? true,
      };
    }
    const kind = data?.mindmap?.kind as MindmapKind || "generic";
    return DEFAULT_LAYOUT_CONFIGS[kind] || DEFAULT_LAYOUT_CONFIGS.generic;
  }, [data?.mindmap?.layoutConfig, data?.mindmap?.kind]);

  const handleNodeStyleUpdate = useCallback((nodeId: string, styleUpdate: Partial<NodeStyle>) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          const currentStyle = node.data.nodeStyle || {};
          const newStyle = { ...currentStyle, ...styleUpdate };
          return {
            ...node,
            data: {
              ...node.data,
              nodeStyle: newStyle,
            },
          };
        }
        return node;
      })
    );
    updateNodeMutation.mutate({
      nodeId,
      updates: {
        style: styleUpdate,
      },
    });
  }, []);

  const handleTextNodeEdit = useCallback((nodeId: string, newText: string) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              label: newText,
            },
          };
        }
        return node;
      })
    );
    updateNodeMutation.mutate({
      nodeId,
      updates: {
        title: newText,
      },
    });
  }, []);

  useEffect(() => {
    if (data) {
      const flowNodes: Node[] = data.nodes.map((node) => ({
        id: node.id,
        type: node.type === "text" ? "text" : "custom",
        position: { x: parseFloat(node.x), y: parseFloat(node.y) },
        data: {
          label: node.title,
          description: node.description,
          imageUrl: node.imageUrl,
          kind: node.type as MindmapNodeKind,
          linkedEntityType: node.linkedEntityType,
          linkedEntityId: node.linkedEntityId,
          layoutConfig,
          nodeStyle: node.style as NodeStyle || {},
          onUpdateStyle: (styleUpdate: Partial<NodeStyle>) => handleNodeStyleUpdate(node.id, styleUpdate),
          onEndEdit: (newText: string) => handleTextNodeEdit(node.id, newText),
        },
      }));

      const flowEdges: Edge[] = data.edges.map((edge) => {
        const edgeStyle = edge.style as EdgeStyle || {};
        // Default style is solid (no strokeDasharray), only dashed if explicitly set
        const isDashed = edgeStyle.strokeDasharray === "5,5";
        return {
          id: edge.id,
          source: edge.sourceNodeId,
          target: edge.targetNodeId,
          label: edge.label || undefined,
          type: "default",
          animated: edge.isDraft,
          markerEnd: edgeStyle.markerEnd === "arrow" ? { type: MarkerType.ArrowClosed } : 
                     edgeStyle.markerEnd === "none" ? undefined :
                     (edge.isDraft ? undefined : { type: MarkerType.ArrowClosed }),
          markerStart: edgeStyle.markerStart === "arrow" ? { type: MarkerType.ArrowClosed } : undefined,
          style: {
            stroke: edgeStyle.stroke || (edge.isDraft ? "#94a3b8" : "#22c55e"),
            strokeWidth: edgeStyle.strokeWidth || (edge.isDraft ? 1 : 2),
            strokeDasharray: isDashed ? "5,5" : undefined,
          },
          data: {
            isDraft: edge.isDraft,
            linkedEntityLinkId: edge.linkedEntityLinkId,
            edgeStyle: edgeStyle,
          },
        };
      });

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [data, setNodes, setEdges, layoutConfig, handleNodeStyleUpdate, handleTextNodeEdit]);

  // Restore viewport from localStorage when nodes are loaded
  useEffect(() => {
    if (nodes.length > 0 && !viewportRestored && id) {
      const savedViewport = localStorage.getItem(`mindmap-viewport-${id}`);
      if (savedViewport) {
        try {
          const viewport = JSON.parse(savedViewport);
          setTimeout(() => {
            setViewport(viewport, { duration: 0 });
          }, 100);
        } catch (e) {
          console.error("Failed to restore viewport:", e);
        }
      }
      setViewportRestored(true);
    }
  }, [nodes.length, viewportRestored, id, setViewport]);

  // Save viewport to localStorage on move end
  const handleMoveEnd = useCallback(() => {
    if (id) {
      const viewport = getViewport();
      localStorage.setItem(`mindmap-viewport-${id}`, JSON.stringify(viewport));
    }
  }, [id, getViewport]);

  useEffect(() => {
    if (selectedNode) {
      const nodeData = data?.nodes.find(n => n.id === selectedNode.id);
      if (nodeData) {
        setEditTitle(nodeData.title);
        setEditDescription(nodeData.description || "");
        setEditType(nodeData.type as MindmapNodeKind);
        setEditImageUrl(nodeData.imageUrl || "");
      }
    }
  }, [selectedNode, data?.nodes]);

  const createNodeMutation = useMutation({
    mutationFn: async (nodeData: {
      title: string;
      description?: string;
      type: MindmapNodeKind;
      x: number;
      y: number;
      linkedEntityType?: string;
      linkedEntityId?: string;
    }) => {
      const res = await apiRequest(`/api/mindmaps/${id}/nodes`, "POST", nodeData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
      setIsAddingNode(false);
      setNewNodeLabel("");
      setNewNodeDescription("");
      setNewLinkedEntityType(null);
      setNewLinkedEntityId(null);
      setNewLinkedEntityName("");
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: async ({
      nodeId,
      updates,
    }: {
      nodeId: string;
      updates: Partial<MindmapNodeType>;
    }) => {
      return await apiRequest(`/api/mindmap-nodes/${nodeId}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (nodeId: string) => {
      return await apiRequest(`/api/mindmap-nodes/${nodeId}`, "DELETE");
    },
    onSuccess: (_, nodeId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeId && e.target !== nodeId)
      );
      setSelectedNode(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createEdgeMutation = useMutation({
    mutationFn: async (edgeData: {
      sourceNodeId: string;
      targetNodeId: string;
    }) => {
      const res = await apiRequest(`/api/mindmaps/${id}/edges`, "POST", edgeData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEdgeMutation = useMutation({
    mutationFn: async ({
      edgeId,
      updates,
    }: {
      edgeId: string;
      updates: Partial<MindmapEdgeType>;
    }) => {
      return await apiRequest(`/api/mindmap-edges/${edgeId}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteEdgeMutation = useMutation({
    mutationFn: async ({ edgeId, deleteEntityLink }: { edgeId: string; deleteEntityLink: boolean }) => {
      const url = `/api/mindmap-edges/${edgeId}/with-entity-link?deleteEntityLink=${deleteEntityLink}`;
      return await apiRequest(url, "DELETE");
    },
    onSuccess: (_, { edgeId }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
      setEdges((eds) => eds.filter((e) => e.id !== edgeId));
      setSelectedEdge(null);
      setShowEdgeDeleteDialog(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const connectNodesMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(`/api/mindmaps/${id}/connect-nodes`, "POST");
      return await res.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
      if (result.connected > 0) {
        toast({ 
          title: "Connexions créées",
          description: `${result.connected} connexion(s) métier créée(s). ${result.skipped} lien(s) visuel(s) conservé(s).`
        });
      } else if (result.skipped > 0) {
        toast({ 
          title: "Aucune connexion créée",
          description: `${result.skipped} lien(s) visuel(s) ne peuvent pas être convertis (nœuds non liés à des entités).`
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateMindmapMutation = useMutation({
    mutationFn: async (updates: Partial<Mindmap>) => {
      return await apiRequest(`/api/mindmaps/${id}`, "PATCH", updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdgeStyleUpdate = useCallback((edgeId: string, styleUpdate: Partial<EdgeStyle>) => {
    const updateEdge = (edge: Edge): Edge => {
      const currentStyle = edge.data?.edgeStyle || {};
      const newStyle = { ...currentStyle, ...styleUpdate };
      
      const updatedEdge: Edge = {
        ...edge,
        style: {
          ...edge.style,
          stroke: newStyle.stroke || edge.style?.stroke,
          strokeWidth: newStyle.strokeWidth || edge.style?.strokeWidth,
          strokeDasharray: styleUpdate.strokeDasharray !== undefined ? styleUpdate.strokeDasharray : edge.style?.strokeDasharray,
        },
        markerEnd: newStyle.markerEnd === "arrow" ? { type: MarkerType.ArrowClosed } : 
                   newStyle.markerEnd === "none" ? undefined : edge.markerEnd,
        markerStart: newStyle.markerStart === "arrow" ? { type: MarkerType.ArrowClosed } :
                    newStyle.markerStart === "none" ? undefined : edge.markerStart,
        data: {
          ...edge.data,
          edgeStyle: newStyle,
        },
      };
      return updatedEdge;
    };

    setEdges((eds) =>
      eds.map((edge) => edge.id === edgeId ? updateEdge(edge) : edge)
    );
    
    // Also update selectedEdge to reflect changes immediately
    setSelectedEdge((currentEdge) => {
      if (currentEdge && currentEdge.id === edgeId) {
        return updateEdge(currentEdge);
      }
      return currentEdge;
    });

    updateEdgeMutation.mutate({
      edgeId,
      updates: {
        style: styleUpdate,
      },
    });
  }, [updateEdgeMutation]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        createEdgeMutation.mutate({
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
        });
        setEdges((eds) => addEdge(connection, eds));
      }
    },
    [createEdgeMutation, setEdges]
  );

  // Alignment detection during drag
  const onNodeDrag = useCallback(
    (_: any, node: Node) => {
      if (!snapEnabled) {
        setAlignmentGuides({});
        return;
      }

      const ALIGNMENT_THRESHOLD = 5;
      const guides: { x?: number; y?: number } = {};
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const nodeWidth = 200; // approximate node width
      const nodeHeight = 80; // approximate node height
      const nodeCenterX = nodeX + nodeWidth / 2;
      const nodeCenterY = nodeY + nodeHeight / 2;

      nodes.forEach((otherNode) => {
        if (otherNode.id === node.id) return;

        const otherX = otherNode.position.x;
        const otherY = otherNode.position.y;
        const otherCenterX = otherX + nodeWidth / 2;
        const otherCenterY = otherY + nodeHeight / 2;

        // Vertical center alignment
        if (Math.abs(nodeCenterX - otherCenterX) < ALIGNMENT_THRESHOLD) {
          guides.x = otherCenterX;
        }
        // Left edge alignment
        if (Math.abs(nodeX - otherX) < ALIGNMENT_THRESHOLD) {
          guides.x = otherX;
        }
        // Horizontal center alignment
        if (Math.abs(nodeCenterY - otherCenterY) < ALIGNMENT_THRESHOLD) {
          guides.y = otherCenterY;
        }
        // Top edge alignment
        if (Math.abs(nodeY - otherY) < ALIGNMENT_THRESHOLD) {
          guides.y = otherY;
        }
      });

      setAlignmentGuides(guides);
    },
    [nodes, snapEnabled]
  );

  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      setAlignmentGuides({});
      updateNodeMutation.mutate({
        nodeId: node.id,
        updates: {
          x: node.position.x.toString(),
          y: node.position.y.toString(),
        },
      });
    },
    [updateNodeMutation]
  );

  // Align selected nodes horizontally (same Y)
  const alignNodesHorizontal = useCallback(() => {
    if (!selectedNode) return;

    const selectedNodes = nodes.filter(n => n.selected || n.id === selectedNode.id);
    if (selectedNodes.length < 2) {
      toast({ title: "Sélectionnez au moins 2 nodes", variant: "destructive" });
      return;
    }

    // Use the first selected node's Y as reference
    const referenceY = selectedNodes[0].position.y;

    selectedNodes.forEach((node) => {
      if (node.position.y !== referenceY) {
        updateNodeMutation.mutate({
          nodeId: node.id,
          updates: { y: referenceY.toString() },
        });
      }
    });

    setNodes((nds) =>
      nds.map((node) => {
        if (selectedNodes.some((n) => n.id === node.id)) {
          return { ...node, position: { ...node.position, y: referenceY } };
        }
        return node;
      })
    );

    toast({ title: "Nodes alignés horizontalement" });
  }, [nodes, selectedNode, updateNodeMutation, setNodes, toast]);

  // Align selected nodes vertically (same X)
  const alignNodesVertical = useCallback(() => {
    if (!selectedNode) return;

    const selectedNodes = nodes.filter(n => n.selected || n.id === selectedNode.id);
    if (selectedNodes.length < 2) {
      toast({ title: "Sélectionnez au moins 2 nodes", variant: "destructive" });
      return;
    }

    // Use the first selected node's X as reference
    const referenceX = selectedNodes[0].position.x;

    selectedNodes.forEach((node) => {
      if (node.position.x !== referenceX) {
        updateNodeMutation.mutate({
          nodeId: node.id,
          updates: { x: referenceX.toString() },
        });
      }
    });

    setNodes((nds) =>
      nds.map((node) => {
        if (selectedNodes.some((n) => n.id === node.id)) {
          return { ...node, position: { ...node.position, x: referenceX } };
        }
        return node;
      })
    );

    toast({ title: "Nodes alignés verticalement" });
  }, [nodes, selectedNode, updateNodeMutation, setNodes, toast]);

  // Distribute nodes horizontally with equal spacing
  const distributeNodesHorizontal = useCallback(() => {
    if (!selectedNode) return;

    const selectedNodes = nodes.filter(n => n.selected || n.id === selectedNode.id);
    if (selectedNodes.length < 3) {
      toast({ title: "Sélectionnez au moins 3 nodes", variant: "destructive" });
      return;
    }

    // Sort by X position
    const sortedNodes = [...selectedNodes].sort((a, b) => a.position.x - b.position.x);
    const firstX = sortedNodes[0].position.x;
    const lastX = sortedNodes[sortedNodes.length - 1].position.x;
    const spacing = (lastX - firstX) / (sortedNodes.length - 1);

    sortedNodes.forEach((node, index) => {
      const newX = firstX + spacing * index;
      if (node.position.x !== newX) {
        updateNodeMutation.mutate({
          nodeId: node.id,
          updates: { x: newX.toString() },
        });
      }
    });

    setNodes((nds) =>
      nds.map((node) => {
        const sortedIndex = sortedNodes.findIndex((n) => n.id === node.id);
        if (sortedIndex >= 0) {
          const newX = firstX + spacing * sortedIndex;
          return { ...node, position: { ...node.position, x: newX } };
        }
        return node;
      })
    );

    toast({ title: "Nodes distribués horizontalement" });
  }, [nodes, selectedNode, updateNodeMutation, setNodes, toast]);

  // Distribute nodes vertically with equal spacing
  const distributeNodesVertical = useCallback(() => {
    if (!selectedNode) return;

    const selectedNodes = nodes.filter(n => n.selected || n.id === selectedNode.id);
    if (selectedNodes.length < 3) {
      toast({ title: "Sélectionnez au moins 3 nodes", variant: "destructive" });
      return;
    }

    // Sort by Y position
    const sortedNodes = [...selectedNodes].sort((a, b) => a.position.y - b.position.y);
    const firstY = sortedNodes[0].position.y;
    const lastY = sortedNodes[sortedNodes.length - 1].position.y;
    const spacing = (lastY - firstY) / (sortedNodes.length - 1);

    sortedNodes.forEach((node, index) => {
      const newY = firstY + spacing * index;
      if (node.position.y !== newY) {
        updateNodeMutation.mutate({
          nodeId: node.id,
          updates: { y: newY.toString() },
        });
      }
    });

    setNodes((nds) =>
      nds.map((node) => {
        const sortedIndex = sortedNodes.findIndex((n) => n.id === node.id);
        if (sortedIndex >= 0) {
          const newY = firstY + spacing * sortedIndex;
          return { ...node, position: { ...node.position, y: newY } };
        }
        return node;
      })
    );

    toast({ title: "Nodes distribués verticalement" });
  }, [nodes, selectedNode, updateNodeMutation, setNodes, toast]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === "text") {
      setSelectedNode(null);
    } else {
      setSelectedNode(node);
      setSelectedEdge(null);
    }
  }, []);

  const onEdgeClick = useCallback((_: any, edge: Edge) => {
    setSelectedEdge(edge);
    setSelectedNode(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
    setSelectedEdge(null);
  }, []);

  const handleAddNode = () => {
    if (!newNodeLabel.trim() && newNodeKind !== "text") return;
    
    const viewportCenter = { x: 400, y: 300 };
    createNodeMutation.mutate({
      title: newNodeLabel || "Texte...",
      description: newNodeDescription || undefined,
      type: newNodeKind,
      x: viewportCenter.x + Math.random() * 100 - 50,
      y: viewportCenter.y + Math.random() * 100 - 50,
      linkedEntityType: newLinkedEntityType || undefined,
      linkedEntityId: newLinkedEntityId || undefined,
    });
  };

  const handleAddTextNode = () => {
    const viewportCenter = { x: 400, y: 300 };
    createNodeMutation.mutate({
      title: "Texte...",
      type: "text",
      x: viewportCenter.x + Math.random() * 100 - 50,
      y: viewportCenter.y + Math.random() * 100 - 50,
    });
  };

  const handleSaveNodeEdit = () => {
    if (!selectedNode) return;
    updateNodeMutation.mutate({
      nodeId: selectedNode.id,
      updates: {
        title: editTitle,
        description: editDescription || null,
        type: editType,
        imageUrl: editImageUrl || null,
      },
    });
    setSelectedNode(null);
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNode) return;
    deleteNodeMutation.mutate(selectedNode.id);
  };

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Erreur",
        description: "Veuillez sélectionner un fichier image valide",
        variant: "destructive",
      });
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB max for base64
    if (file.size > maxSize) {
      toast({
        title: "Erreur",
        description: "L'image est trop volumineuse. Taille maximum: 2 MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploadingImage(true);
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          if (typeof reader.result === 'string') {
            resolve(reader.result);
          } else {
            reject(new Error('Échec de la lecture du fichier'));
          }
        };
        reader.onerror = () => reject(new Error('Erreur lors de la lecture du fichier'));
      });

      reader.readAsDataURL(file);
      const base64Data = await base64Promise;
      setEditImageUrl(base64Data);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: "Échec de l'upload de l'image: " + error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    }
  }, [toast]);

  const handleSelectEntity = (entity: { id: string; name: string }) => {
    setNewLinkedEntityType(newNodeKind);
    setNewLinkedEntityId(entity.id);
    setNewLinkedEntityName(entity.name);
    setNewNodeLabel(entity.name);
    setEntitySearchOpen(false);
    setEntitySearchQuery("");
  };

  const handleClearLinkedEntity = () => {
    setNewLinkedEntityType(null);
    setNewLinkedEntityId(null);
    setNewLinkedEntityName("");
  };

  const handleLayoutToggle = (key: keyof LayoutConfig) => {
    const newConfig = {
      ...layoutConfig,
      [key]: !layoutConfig[key],
    };
    updateMindmapMutation.mutate({
      layoutConfig: newConfig,
    });
  };

  const handleKindChange = (kind: MindmapKind) => {
    updateMindmapMutation.mutate({
      kind,
      layoutConfig: DEFAULT_LAYOUT_CONFIGS[kind],
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">Erreur lors du chargement de la mindmap</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentKind = data.mindmap.kind as MindmapKind;
  const CurrentKindIcon = KIND_ICONS[currentKind] || Brain;

  return (
    <div className="flex-1 flex flex-col h-full">
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/mindmaps")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">{data.mindmap.name}</h1>
            {data.mindmap.description && (
              <p className="text-sm text-muted-foreground">{data.mindmap.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={currentKind} onValueChange={(v) => handleKindChange(v as MindmapKind)}>
            <SelectTrigger className="w-[200px]" data-testid="select-view-kind">
              <div className="flex items-center gap-2">
                <CurrentKindIcon className="w-4 h-4" />
                <span>{mindmapKindOptions.find(o => o.value === currentKind)?.label || "Mindmap"}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {mindmapKindOptions.map((option) => {
                const KindIcon = KIND_ICONS[option.value as MindmapKind] || Brain;
                return (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <KindIcon className="w-4 h-4" />
                      {option.label}
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-display-settings">
                <Eye className="w-4 h-4 mr-2" />
                Affichage
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Options d'affichage</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={layoutConfig.showTitle}
                onCheckedChange={() => handleLayoutToggle("showTitle")}
                data-testid="toggle-show-title"
              >
                <Type className="w-4 h-4 mr-2" />
                Afficher le titre
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={layoutConfig.showDescription}
                onCheckedChange={() => handleLayoutToggle("showDescription")}
                data-testid="toggle-show-description"
              >
                <AlignLeft className="w-4 h-4 mr-2" />
                Afficher la description
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={layoutConfig.showImage}
                onCheckedChange={() => handleLayoutToggle("showImage")}
                data-testid="toggle-show-image"
              >
                <Image className="w-4 h-4 mr-2" />
                Afficher l'image
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" data-testid="button-settings">
                <Settings className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Paramètres de la mindmap</SheetTitle>
                <SheetDescription>
                  Modifiez les propriétés de votre mindmap
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div className="space-y-2">
                  <Label htmlFor="mindmap-name">Nom</Label>
                  <Input
                    id="mindmap-name"
                    defaultValue={data.mindmap.name}
                    onBlur={(e) => {
                      if (e.target.value !== data.mindmap.name) {
                        updateMindmapMutation.mutate({ name: e.target.value });
                      }
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mindmap-description">Description</Label>
                  <Textarea
                    id="mindmap-description"
                    defaultValue={data.mindmap.description || ""}
                    onBlur={(e) => {
                      if (e.target.value !== (data.mindmap.description || "")) {
                        updateMindmapMutation.mutate({
                          description: e.target.value || null,
                        });
                      }
                    }}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Client (optionnel)</Label>
                  <Select
                    value={data.mindmap.clientId || "none"}
                    onValueChange={(value) => {
                      const clientId = value === "none" ? null : value;
                      updateMindmapMutation.mutate({ 
                        clientId,
                        projectId: clientId === null ? null : data.mindmap.projectId 
                      });
                    }}
                  >
                    <SelectTrigger data-testid="select-mindmap-client">
                      <SelectValue placeholder="Aucun client" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun client</SelectItem>
                      {(clients || []).map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Projet (optionnel)</Label>
                  <Select
                    value={data.mindmap.projectId || "none"}
                    onValueChange={(value) => {
                      updateMindmapMutation.mutate({ 
                        projectId: value === "none" ? null : value 
                      });
                    }}
                  >
                    <SelectTrigger data-testid="select-mindmap-project">
                      <SelectValue placeholder="Aucun projet" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucun projet</SelectItem>
                      {(projects || [])
                        .filter(p => !data.mindmap.clientId || p.clientId === data.mindmap.clientId)
                        .map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {data.mindmap.clientId && (
                    <p className="text-xs text-muted-foreground">
                      Filtré par le client sélectionné
                    </p>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Connexions métier</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Convertit les liens visuels (draft) en connexions métier réelles entre les entités liées.
                  </p>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => connectNodesMutation.mutate()}
                    disabled={connectNodesMutation.isPending}
                    data-testid="button-connect-nodes"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    {connectNodesMutation.isPending ? "Connexion..." : "Connecter les nœuds"}
                  </Button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeDrag={onNodeDrag}
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onMoveEnd={handleMoveEnd}
          nodeTypes={nodeTypes}
          fitView={!viewportRestored}
          snapToGrid={snapEnabled}
          snapGrid={[gridSize, gridSize]}
          selectionOnDrag
          selectNodesOnDrag
          className="bg-muted/30"
          data-testid="mindmap-canvas"
        >
          {/* Alignment guides */}
          {alignmentGuides.x !== undefined && (
            <svg className="absolute inset-0 pointer-events-none z-50" style={{ overflow: 'visible' }}>
              <line
                x1={alignmentGuides.x}
                y1={-9999}
                x2={alignmentGuides.x}
                y2={9999}
                stroke="#7c3aed"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            </svg>
          )}
          {alignmentGuides.y !== undefined && (
            <svg className="absolute inset-0 pointer-events-none z-50" style={{ overflow: 'visible' }}>
              <line
                x1={-9999}
                y1={alignmentGuides.y}
                x2={9999}
                y2={alignmentGuides.y}
                stroke="#7c3aed"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
            </svg>
          )}
          <Background variant={BackgroundVariant.Dots} gap={snapEnabled ? gridSize : 20} size={1} />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const kind = n.data?.kind as MindmapNodeKind;
              if (kind === "idea") return "#f59e0b";
              if (kind === "note") return "#3b82f6";
              if (kind === "project") return "#8b5cf6";
              if (kind === "document") return "#22c55e";
              if (kind === "task") return "#f97316";
              if (kind === "client") return "#06b6d4";
              if (kind === "text") return "#737373";
              return "#9ca3af";
            }}
            maskColor="rgba(0, 0, 0, 0.1)"
          />
          <Panel position="bottom-right" className="flex gap-2 p-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => zoomIn()}
              data-testid="button-zoom-in"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => zoomOut()}
              data-testid="button-zoom-out"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => fitView()}
              data-testid="button-fit-view"
            >
              <Maximize className="w-4 h-4" />
            </Button>
          </Panel>

          {/* Snap to grid and alignment controls */}
          <Panel position="bottom-left" className="flex gap-1 p-2">
            <div className="flex items-center gap-1 bg-card border rounded-lg p-1 shadow-sm">
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant={snapEnabled ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setSnapEnabled(!snapEnabled)}
                    data-testid="button-snap-toggle"
                    className="h-8 w-8"
                  >
                    <Magnet className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  {snapEnabled ? "Désactiver" : "Activer"} snap-to-grid
                </TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        data-testid="button-grid-size"
                      >
                        <Grid3X3 className="w-4 h-4 mr-1" />
                        {gridSize}px
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-medium">
                    Taille de la grille
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent>
                  <DropdownMenuLabel>Taille de grille</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => setGridSize(16)} className={gridSize === 16 ? "bg-accent" : ""}>
                    16px (fine)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGridSize(24)} className={gridSize === 24 ? "bg-accent" : ""}>
                    24px (moyenne)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setGridSize(32)} className={gridSize === 32 ? "bg-accent" : ""}>
                    32px (large)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Separator orientation="vertical" className="h-6" />

              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={alignNodesHorizontal}
                    data-testid="button-align-horizontal"
                    className="h-8 w-8"
                  >
                    <AlignHorizontalJustifyCenter className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  Aligner horizontalement
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={alignNodesVertical}
                    data-testid="button-align-vertical"
                    className="h-8 w-8"
                  >
                    <AlignVerticalJustifyCenter className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  Aligner verticalement
                </TooltipContent>
              </Tooltip>

              <Separator orientation="vertical" className="h-6" />

              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={distributeNodesHorizontal}
                    data-testid="button-distribute-horizontal"
                    className="h-8 w-8"
                  >
                    <AlignHorizontalDistributeCenter className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  Distribuer horizontalement
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={distributeNodesVertical}
                    data-testid="button-distribute-vertical"
                    className="h-8 w-8"
                  >
                    <AlignVerticalDistributeCenter className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  Distribuer verticalement
                </TooltipContent>
              </Tooltip>
            </div>
          </Panel>

          <Panel position="top-right" className="mr-2">
            <div className="flex flex-col gap-1 p-1.5 bg-card border rounded-lg shadow-lg">
              {Object.entries(NODE_KIND_CONFIG).map(([kind, { label, icon: Icon, color }]) => (
                <Tooltip key={kind} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (kind === "text") {
                          handleAddTextNode();
                        } else {
                          setNewNodeKind(kind as MindmapNodeKind);
                          setIsAddingNode(true);
                        }
                      }}
                      data-testid={`toolbar-add-${kind}`}
                      className="h-9 w-9"
                    >
                      <Icon className={`w-5 h-5 ${color}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="font-medium">
                    {label}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </Panel>
        </ReactFlow>

        {isAddingNode && newNodeKind !== "text" && (
          <div className="absolute top-4 right-20 z-50">
            <Card className="w-80">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const NodeIcon = NODE_KIND_CONFIG[newNodeKind].icon;
                      return <NodeIcon className={`w-5 h-5 ${NODE_KIND_CONFIG[newNodeKind].color}`} />;
                    })()}
                    <h3 className="font-medium">
                      Nouveau {NODE_KIND_CONFIG[newNodeKind].label}
                    </h3>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setIsAddingNode(false);
                      handleClearLinkedEntity();
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {canLinkEntity(newNodeKind) && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      Lier à un {NODE_KIND_CONFIG[newNodeKind].label.toLowerCase()} existant
                    </Label>
                    {newLinkedEntityId ? (
                      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                        <Badge variant="secondary" className="flex-1 justify-start">
                          {newLinkedEntityName}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={handleClearLinkedEntity}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <Popover open={entitySearchOpen} onOpenChange={setEntitySearchOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className="w-full justify-start text-muted-foreground"
                            data-testid="button-search-entity"
                          >
                            <Search className="w-4 h-4 mr-2" />
                            Rechercher...
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-0" align="start">
                          <Command>
                            <CommandInput
                              placeholder={`Rechercher ${NODE_KIND_CONFIG[newNodeKind].label.toLowerCase()}...`}
                              value={entitySearchQuery}
                              onValueChange={setEntitySearchQuery}
                            />
                            <CommandList>
                              <CommandEmpty>Aucun résultat trouvé</CommandEmpty>
                              <CommandGroup>
                                {getEntitiesForType(newNodeKind)
                                  .filter(e => e.name.toLowerCase().includes(entitySearchQuery.toLowerCase()))
                                  .slice(0, 10)
                                  .map((entity) => (
                                    <CommandItem
                                      key={entity.id}
                                      value={entity.name}
                                      onSelect={() => handleSelectEntity(entity)}
                                    >
                                      {entity.name}
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="node-label">Nom *</Label>
                  <Input
                    id="node-label"
                    value={newNodeLabel}
                    onChange={(e) => setNewNodeLabel(e.target.value)}
                    placeholder="Nom du noeud"
                    data-testid="input-node-label"
                    autoFocus={!canLinkEntity(newNodeKind)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="node-description">Description</Label>
                  <Textarea
                    id="node-description"
                    value={newNodeDescription}
                    onChange={(e) => setNewNodeDescription(e.target.value)}
                    placeholder="Description..."
                    data-testid="input-node-description"
                  />
                </div>
                <Button
                  onClick={handleAddNode}
                  disabled={createNodeMutation.isPending}
                  className="w-full"
                  data-testid="button-confirm-add-node"
                >
                  {createNodeMutation.isPending ? "Création..." : "Créer"}
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedNode && selectedNode.type !== "text" && (
          <div className="absolute top-4 left-4 z-50 w-80">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Modifier le noeud</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNode(null)}
                  >
                    Fermer
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="edit-title">Titre</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    data-testid="input-edit-title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-type">Type</Label>
                  <Select value={editType} onValueChange={(v) => setEditType(v as MindmapNodeKind)}>
                    <SelectTrigger data-testid="select-edit-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(NODE_KIND_CONFIG).map(([kind, { label, icon: Icon, color }]) => (
                        <SelectItem key={kind} value={kind}>
                          <div className="flex items-center gap-2">
                            <Icon className={`w-4 h-4 ${color}`} />
                            {label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description..."
                    data-testid="input-edit-description"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Image</Label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={imageInputRef}
                    onChange={handleImageUpload}
                    className="hidden"
                    data-testid="input-file-image"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => imageInputRef.current?.click()}
                      disabled={isUploadingImage}
                      className="flex-1"
                      data-testid="button-upload-image"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {isUploadingImage ? "Upload..." : "Choisir une image"}
                    </Button>
                    {editImageUrl && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditImageUrl("")}
                        data-testid="button-remove-image"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  {editImageUrl && (
                    <div className="mt-2 rounded overflow-hidden border">
                      <img src={editImageUrl} alt="" className="w-full h-24 object-cover" />
                    </div>
                  )}
                </div>

                {selectedNode.data.linkedEntityId && (
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <ExternalLink className="w-4 h-4" />
                      <span className="text-muted-foreground">Lié à :</span>
                      <Badge variant="outline">
                        {selectedNode.data.linkedEntityType} : {selectedNode.data.linkedEntityId.slice(0, 8)}...
                      </Badge>
                    </div>
                    <Button
                      variant="link"
                      size="sm"
                      className="mt-1 h-auto p-0"
                      onClick={() => {
                        toast({ title: "Fonctionnalité à venir", description: "L'ouverture dans l'app sera bientôt disponible" });
                      }}
                    >
                      Ouvrir dans l'app
                    </Button>
                  </div>
                )}

                <Separator />

                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveNodeEdit}
                    disabled={updateNodeMutation.isPending}
                    className="flex-1"
                    data-testid="button-save-node"
                  >
                    Enregistrer
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon"
                    onClick={handleDeleteSelectedNode}
                    disabled={deleteNodeMutation.isPending}
                    data-testid="button-delete-node"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {selectedEdge && (
          <div className="absolute top-4 left-4 z-50 w-80">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Connecteur</h4>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSelectedEdge(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="text-sm text-muted-foreground">
                  {selectedEdge.data?.isDraft ? (
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Draft</Badge>
                      <span>Lien visuel uniquement</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-green-600">Connecté</Badge>
                      <span>Lien métier actif</span>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Couleur</Label>
                    <div className="flex flex-wrap gap-1">
                      {EDGE_COLORS.map((color) => (
                        <button
                          key={color.value}
                          className={`w-6 h-6 rounded border-2 ${
                            (selectedEdge.style?.stroke === color.value) ? "ring-2 ring-primary" : ""
                          }`}
                          style={{ backgroundColor: color.value }}
                          onClick={() => handleEdgeStyleUpdate(selectedEdge.id, { stroke: color.value })}
                          title={color.name}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Épaisseur</Label>
                    <div className="flex gap-1">
                      {[
                        { label: "Fin", value: 1 },
                        { label: "Moyen", value: 2 },
                        { label: "Épais", value: 4 },
                      ].map((opt) => (
                        <Button
                          key={opt.value}
                          variant={selectedEdge.style?.strokeWidth === opt.value ? "default" : "outline"}
                          size="sm"
                          onClick={() => handleEdgeStyleUpdate(selectedEdge.id, { strokeWidth: opt.value })}
                        >
                          {opt.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Style</Label>
                    <div className="flex gap-1">
                      <Button
                        variant={!selectedEdge.style?.strokeDasharray ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEdgeStyleUpdate(selectedEdge.id, { strokeDasharray: undefined })}
                      >
                        Continu
                      </Button>
                      <Button
                        variant={selectedEdge.style?.strokeDasharray === "5,5" ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEdgeStyleUpdate(selectedEdge.id, { strokeDasharray: "5,5" })}
                      >
                        Pointillé
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs">Flèches</Label>
                    <div className="flex flex-wrap gap-1">
                      <Button
                        variant={!selectedEdge.markerEnd && !selectedEdge.markerStart ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEdgeStyleUpdate(selectedEdge.id, { markerEnd: "none", markerStart: "none" })}
                        title="Aucune flèche"
                      >
                        <Minus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={selectedEdge.markerEnd && !selectedEdge.markerStart ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEdgeStyleUpdate(selectedEdge.id, { markerEnd: "arrow", markerStart: "none" })}
                        title="Flèche vers la droite"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={!selectedEdge.markerEnd && selectedEdge.markerStart ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEdgeStyleUpdate(selectedEdge.id, { markerEnd: "none", markerStart: "arrow" })}
                        title="Flèche vers la gauche"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </Button>
                      <Button
                        variant={selectedEdge.markerEnd && selectedEdge.markerStart ? "default" : "outline"}
                        size="sm"
                        onClick={() => handleEdgeStyleUpdate(selectedEdge.id, { markerEnd: "arrow", markerStart: "arrow" })}
                        title="Flèches des deux côtés"
                      >
                        <ArrowLeftRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => {
                      deleteEdgeMutation.mutate({ 
                        edgeId: selectedEdge.id, 
                        deleteEntityLink: false 
                      });
                    }}
                    disabled={deleteEdgeMutation.isPending}
                    data-testid="button-delete-edge-visual"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Supprimer le lien visuel
                  </Button>

                  {selectedEdge.data?.linkedEntityLinkId && (
                    <Button
                      variant="destructive"
                      className="w-full justify-start"
                      onClick={() => {
                        deleteEdgeMutation.mutate({ 
                          edgeId: selectedEdge.id, 
                          deleteEntityLink: true 
                        });
                      }}
                      disabled={deleteEdgeMutation.isPending}
                      data-testid="button-delete-edge-business"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer la connexion métier
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MindmapDetail() {
  return (
    <ReactFlowProvider>
      <MindmapCanvas />
    </ReactFlowProvider>
  );
}
