import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import ReactFlow, {
  Node,
  Edge,
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
  Map as MapIcon,
  Network,
  Brain,
  Square,
  Upload,
  Search,
  X,
  Link2,
  Palette,
  Bold,
  Italic,
  List,
  ListOrdered,
  Highlighter,
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
  Hand,
  MousePointer2,
  LayoutGrid,
  GitBranch,
  Workflow,
  CircleDot,
  TreeDeciduous,
  Layers,
  Home,
  Globe,
  Server,
  BookOpen,
  Target,
  Users,
  Phone,
  Mail,
  Calendar,
  Clock,
  Star,
  Heart,
  Bookmark,
  Flag,
  Award,
  Zap,
  TrendingUp,
  BarChart2,
  PieChart,
  Activity,
  Database,
  Code,
  Terminal,
  Layout,
  Smartphone,
  Monitor,
  Tablet,
  MousePointer,
  Play,
  Pause,
  SkipForward,
  MessageSquare,
  MessageCircle,
  Bell,
  Lock,
  Unlock,
  Key,
  Shield,
  AlertTriangle,
  Info,
  HelpCircle,
  ChevronRight,
  ChevronDown,
  Copy,
  Clipboard,
  Edit,
  Trash,
  Save,
  Download,
  Share2,
  RefreshCw,
  RotateCcw,
  Move,
  Maximize2,
  Minimize2,
  Box,
  Package,
  ShoppingCart,
  CreditCard,
  DollarSign,
  Tag,
  Briefcase,
  Building,
  MapPin,
  Navigation,
  Compass,
  Sun,
  Moon,
  Cloud,
  Droplet,
  Wind,
  ThermometerSun,
  Camera,
  Video,
  Mic,
  Headphones,
  Music,
  Volume2,
  Wifi,
  Bluetooth,
  Battery,
  Cpu,
  HardDrive,
  Printer,
  Plug,
  Power,
  ToggleLeft,
  ToggleRight,
  Send,
  Inbox,
  Archive,
  Folder,
  File,
  FileImage,
  FileVideo,
  FileAudio,
  FileCode,
  FilePlus,
  FileCheck,
  Paperclip,
  Scissors,
  Wand2,
  Sparkles,
  Flame,
  Gift,
  Cake,
  Coffee,
  Pizza,
  Apple,
  Grape,
  Candy,
  Gem,
  Crown,
  Glasses,
  Smile,
  Frown,
  Meh,
  ThumbsUp,
  ThumbsDown,
  Hand as HandIcon,
  Footprints,
  PersonStanding,
  Bike,
  Car,
  Plane,
  Train,
  Bus,
  Rocket,
  Anchor,
  Umbrella,
  Paintbrush,
  Palette as PaletteIcon,
  Brush,
  Eraser,
  Ruler,
  Triangle,
  Pentagon,
  Hexagon,
  Octagon,
  Shapes,
  CircleDashed,
  SquareDashed,
  Undo2,
  Redo2,
} from "lucide-react";
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
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
  fontStyle?: "normal" | "italic";
  textColor?: string;
  hasShadow?: boolean;
  customIcon?: string;
  width?: number;
  height?: number;
  richContent?: string;
}

// Icon packs organized by category
const ICON_PACKS: Record<string, { label: string; icons: { name: string; icon: typeof Lightbulb }[] }> = {
  ux: {
    label: "UX / Design",
    icons: [
      { name: "Layout", icon: Layout },
      { name: "MousePointer", icon: MousePointer },
      { name: "Smartphone", icon: Smartphone },
      { name: "Monitor", icon: Monitor },
      { name: "Tablet", icon: Tablet },
      { name: "Shapes", icon: Shapes },
      { name: "Paintbrush", icon: Paintbrush },
      { name: "Brush", icon: Brush },
      { name: "PaletteIcon", icon: PaletteIcon },
      { name: "Eye", icon: Eye },
      { name: "EyeOff", icon: EyeOff },
      { name: "Layers", icon: Layers },
      { name: "Maximize2", icon: Maximize2 },
      { name: "Minimize2", icon: Minimize2 },
    ],
  },
  web: {
    label: "Pages Web",
    icons: [
      { name: "Home", icon: Home },
      { name: "Globe", icon: Globe },
      { name: "Search", icon: Search },
      { name: "Menu", icon: MoreHorizontal },
      { name: "Link", icon: Link2 },
      { name: "ExternalLink", icon: ExternalLink },
      { name: "FileText", icon: FileText },
      { name: "Image", icon: Image },
      { name: "Video", icon: Video },
      { name: "Play", icon: Play },
      { name: "Pause", icon: Pause },
      { name: "Lock", icon: Lock },
      { name: "Unlock", icon: Unlock },
      { name: "Send", icon: Send },
    ],
  },
  architecture: {
    label: "Architecture",
    icons: [
      { name: "Server", icon: Server },
      { name: "Database", icon: Database },
      { name: "Code", icon: Code },
      { name: "Terminal", icon: Terminal },
      { name: "Cpu", icon: Cpu },
      { name: "HardDrive", icon: HardDrive },
      { name: "Cloud", icon: Cloud },
      { name: "Wifi", icon: Wifi },
      { name: "Network", icon: Network },
      { name: "Key", icon: Key },
      { name: "Shield", icon: Shield },
      { name: "Box", icon: Box },
      { name: "Package", icon: Package },
      { name: "Plug", icon: Plug },
    ],
  },
  storytelling: {
    label: "Storytelling",
    icons: [
      { name: "BookOpen", icon: BookOpen },
      { name: "Film", icon: Film },
      { name: "Camera", icon: Camera },
      { name: "Mic", icon: Mic },
      { name: "Music", icon: Music },
      { name: "Headphones", icon: Headphones },
      { name: "MessageSquare", icon: MessageSquare },
      { name: "MessageCircle", icon: MessageCircle },
      { name: "Heart", icon: Heart },
      { name: "Star", icon: Star },
      { name: "Sparkles", icon: Sparkles },
      { name: "Wand2", icon: Wand2 },
      { name: "PersonStanding", icon: PersonStanding },
      { name: "Rocket", icon: Rocket },
    ],
  },
  tasks: {
    label: "Tâches / Projets",
    icons: [
      { name: "Target", icon: Target },
      { name: "CheckSquare", icon: CheckSquare },
      { name: "Calendar", icon: Calendar },
      { name: "Clock", icon: Clock },
      { name: "Flag", icon: Flag },
      { name: "Bookmark", icon: Bookmark },
      { name: "Award", icon: Award },
      { name: "Zap", icon: Zap },
      { name: "TrendingUp", icon: TrendingUp },
      { name: "BarChart2", icon: BarChart2 },
      { name: "PieChart", icon: PieChart },
      { name: "Activity", icon: Activity },
      { name: "RefreshCw", icon: RefreshCw },
      { name: "AlertTriangle", icon: AlertTriangle },
    ],
  },
  crm: {
    label: "CRM",
    icons: [
      { name: "User", icon: User },
      { name: "Users", icon: Users },
      { name: "Building", icon: Building },
      { name: "Briefcase", icon: Briefcase },
      { name: "Phone", icon: Phone },
      { name: "Mail", icon: Mail },
      { name: "Inbox", icon: Inbox },
      { name: "Bell", icon: Bell },
      { name: "DollarSign", icon: DollarSign },
      { name: "CreditCard", icon: CreditCard },
      { name: "ShoppingCart", icon: ShoppingCart },
      { name: "Tag", icon: Tag },
      { name: "MapPin", icon: MapPin },
      { name: "ThumbsUp", icon: ThumbsUp },
    ],
  },
};

// Get icon component from name
function getIconByName(name: string): typeof Lightbulb | null {
  for (const category of Object.values(ICON_PACKS)) {
    const found = category.icons.find(i => i.name === name);
    if (found) return found.icon;
  }
  return null;
}

// Flattened list of all icons (no categories) for simplified picker
const ALL_ICONS = Object.values(ICON_PACKS).flatMap(pack => pack.icons);

// Text colors for rich text
const TEXT_COLORS = [
  { name: "Défaut", value: "" },
  { name: "Noir", value: "#000000" },
  { name: "Gris", value: "#6b7280" },
  { name: "Rouge", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Jaune", value: "#eab308" },
  { name: "Vert", value: "#22c55e" },
  { name: "Bleu", value: "#3b82f6" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Rose", value: "#ec4899" },
];

// Highlight colors
const HIGHLIGHT_COLORS = [
  { name: "Aucun", value: "" },
  { name: "Jaune", value: "#fef08a" },
  { name: "Vert", value: "#bbf7d0" },
  { name: "Bleu", value: "#bfdbfe" },
  { name: "Rose", value: "#fbcfe8" },
  { name: "Orange", value: "#fed7aa" },
  { name: "Violet", value: "#ddd6fe" },
];

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
  sitemap: MapIcon,
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

function RichTextNode({ id, data, selected }: { id: string; data: CustomNodeData; selected?: boolean }) {
  const [isEditing, setIsEditing] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: data.nodeStyle?.width || 250,
    height: data.nodeStyle?.height || 100,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const nodeStyle = data.nodeStyle || {};
  
  const initialContent = data.nodeStyle?.richContent || data.label || "";
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Highlight.configure({ multicolor: true }),
      TaskList,
      TaskItem.configure({ nested: true }),
      TextStyle,
      Color,
    ],
    content: initialContent,
    editable: isEditing,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const plainText = editor.getText();
      data.onUpdateStyle?.({ richContent: html });
      if (plainText !== data.label) {
        data.onEndEdit?.(plainText);
      }
    },
  });
  
  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing);
      if (isEditing) {
        editor.commands.focus('end');
      }
    }
  }, [editor, isEditing]);
  
  useEffect(() => {
    if (editor && data.nodeStyle?.richContent && data.nodeStyle.richContent !== editor.getHTML()) {
      editor.commands.setContent(data.nodeStyle.richContent);
    }
  }, [editor, data.nodeStyle?.richContent]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = dimensions.width;
    const startHeight = dimensions.height;
    
    // Store current cursor and set resize cursor on body
    const originalCursor = document.body.style.cursor;
    document.body.style.cursor = 'se-resize';
    
    let finalWidth = startWidth;
    let finalHeight = startHeight;

    const handleMouseMove = (e: MouseEvent) => {
      finalWidth = Math.max(150, startWidth + (e.clientX - startX));
      finalHeight = Math.max(60, startHeight + (e.clientY - startY));
      setDimensions({ width: finalWidth, height: finalHeight });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      // Restore original cursor
      document.body.style.cursor = originalCursor;
      // Use the final dimensions from the closure
      data.onUpdateStyle?.({ width: finalWidth, height: finalHeight });
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const style: React.CSSProperties = {
    backgroundColor: nodeStyle.backgroundColor || "rgba(255,255,255,0.95)",
    borderColor: nodeStyle.borderColor || "transparent",
    borderWidth: nodeStyle.borderWidth || 1,
    borderStyle: "solid",
    fontSize: nodeStyle.fontSize || 14,
    color: nodeStyle.textColor || "inherit",
    width: dimensions.width,
    minHeight: dimensions.height,
    boxShadow: nodeStyle.hasShadow ? "0 4px 12px rgba(0,0,0,0.15)" : "0 1px 3px rgba(0,0,0,0.08)",
  };

  return (
    <div className="relative" ref={containerRef}>
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
        <NodeToolbar isVisible position={Position.Top} className="flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-zinc-900 border rounded-lg shadow-lg max-w-[400px]">
          {/* Background color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800" title="Couleur de fond">
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

          {/* Text color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800" title="Couleur du texte">
                <Type className="w-4 h-4" style={{ color: nodeStyle.textColor || "currentColor" }} />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-5 gap-1">
                {TEXT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className={`w-6 h-6 rounded border flex items-center justify-center ${!color.value ? "bg-white" : ""}`}
                    style={{ backgroundColor: color.value || undefined }}
                    onClick={() => data.onUpdateStyle?.({ textColor: color.value || undefined })}
                    title={color.name}
                  >
                    <span className="text-xs font-bold" style={{ color: color.value ? "#fff" : "#000" }}>A</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>

          <Separator orientation="vertical" className="h-5" />

          {/* Border */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800" title="Bordure">
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

          {/* Font size */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800" title="Taille de police">
                <span className="text-xs font-bold">{nodeStyle.fontSize || 14}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="flex items-center gap-1">
                {[12, 14, 16, 18, 20, 24, 28, 32].map((size) => (
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

          {/* Bold (TipTap) */}
          <Button
            variant={editor?.isActive('bold') ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            title="Gras (Ctrl+B)"
          >
            <Bold className="w-4 h-4" />
          </Button>

          {/* Italic (TipTap) */}
          <Button
            variant={editor?.isActive('italic') ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            title="Italique (Ctrl+I)"
          >
            <Italic className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="h-5" />

          {/* Bullet List (TipTap) */}
          <Button
            variant={editor?.isActive('bulletList') ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            title="Liste à puces"
          >
            <List className="w-4 h-4" />
          </Button>

          {/* Ordered List (TipTap) */}
          <Button
            variant={editor?.isActive('orderedList') ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            title="Liste numérotée"
          >
            <ListOrdered className="w-4 h-4" />
          </Button>

          {/* Task List (TipTap) */}
          <Button
            variant={editor?.isActive('taskList') ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => editor?.chain().focus().toggleTaskList().run()}
            title="Liste de tâches"
          >
            <CheckSquare className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="h-5" />

          {/* Highlight (TipTap) */}
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant={editor?.isActive('highlight') ? "default" : "ghost"} 
                size="icon" 
                className="h-7 w-7" 
                title="Surlignage"
              >
                <Highlighter className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2">
              <div className="grid grid-cols-4 gap-1">
                <button
                  className="w-6 h-6 rounded border bg-white flex items-center justify-center"
                  onClick={() => editor?.chain().focus().unsetHighlight().run()}
                  title="Sans surlignage"
                >
                  <X className="w-3 h-3" />
                </button>
                {HIGHLIGHT_COLORS.map((color) => (
                  <button
                    key={color.value}
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: color.value }}
                    onClick={() => editor?.chain().focus().toggleHighlight({ color: color.value }).run()}
                    title={color.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>

          {/* Shadow toggle */}
          <Button
            variant={nodeStyle.hasShadow ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => data.onUpdateStyle?.({ hasShadow: !nodeStyle.hasShadow })}
            title="Ombre"
          >
            <Layers className="w-4 h-4" />
          </Button>

          {/* Edit mode toggle */}
          <Separator orientation="vertical" className="h-5" />
          <Button
            variant={isEditing ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsEditing(!isEditing)}
            title={isEditing ? "Terminer l'édition" : "Éditer le texte"}
          >
            <Edit className="w-4 h-4" />
          </Button>
        </NodeToolbar>
      )}
      
      <div
        className="p-3 rounded relative overflow-hidden"
        style={style}
        onDoubleClick={() => !isEditing && setIsEditing(true)}
      >
        {editor ? (
          <EditorContent 
            editor={editor} 
            className={`prose prose-sm max-w-none focus:outline-none ${!isEditing ? 'cursor-text' : ''}`}
            style={{ fontSize: nodeStyle.fontSize || 14 }}
          />
        ) : (
          <div className="text-muted-foreground italic">Double-cliquer pour éditer</div>
        )}
        
        {/* Resize handle */}
        {selected && (
          <div
            className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize flex items-center justify-center"
            onMouseDown={handleResizeStart}
          >
            <div className="w-2 h-2 border-b-2 border-r-2 border-muted-foreground opacity-50" />
          </div>
        )}
      </div>
    </div>
  );
}

function CustomMindmapNode({ id, data, selected }: { id: string; data: CustomNodeData; selected?: boolean }) {
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  
  const config = NODE_KIND_CONFIG[data.kind] || NODE_KIND_CONFIG.generic;
  const nodeStyle = data.nodeStyle || {};
  
  // Use custom icon if set, otherwise use default from config
  const CustomIcon = nodeStyle.customIcon ? getIconByName(nodeStyle.customIcon) : null;
  const Icon = CustomIcon || config.icon;
  
  const { showTitle, showDescription, showImage } = data.layoutConfig;

  const isCompact = !showDescription && !showImage;

  const customStyle: React.CSSProperties = {
    backgroundColor: nodeStyle.backgroundColor || undefined,
    borderColor: nodeStyle.borderColor || undefined,
    borderWidth: nodeStyle.borderWidth ? `${nodeStyle.borderWidth}px` : undefined,
    boxShadow: nodeStyle.hasShadow ? "0 4px 12px rgba(0,0,0,0.15)" : undefined,
  };

  const textStyle: React.CSSProperties = {
    fontSize: nodeStyle.fontSize || undefined,
    fontWeight: nodeStyle.fontWeight || undefined,
  };

  return (
    <div
      className={`relative rounded-lg border-2 ${nodeStyle.hasShadow ? "" : "shadow-sm"} ${!nodeStyle.backgroundColor ? config.bgColor : ""} ${data.isDraft ? "border-dashed" : ""} ${isCompact ? "px-3 py-2 min-w-[100px]" : "px-4 py-3 min-w-[150px] max-w-[280px]"}`}
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
        <NodeToolbar isVisible position={Position.Top} className="flex flex-wrap items-center gap-1 p-1 bg-white dark:bg-zinc-900 border rounded-lg shadow-lg max-w-[450px]">
          {/* Background color */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800" title="Couleur de fond">
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

          {/* Border */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800" title="Bordure">
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

          {/* Font size */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800" title="Taille de police">
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

          {/* Bold */}
          <Button
            variant={nodeStyle.fontWeight === "bold" ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800"
            onClick={() => data.onUpdateStyle?.({ fontWeight: nodeStyle.fontWeight === "bold" ? "normal" : "bold" })}
            title="Gras"
          >
            <Bold className="w-4 h-4" />
          </Button>

          <Separator orientation="vertical" className="h-5" />

          {/* Icon picker */}
          <Popover open={iconPickerOpen} onOpenChange={setIconPickerOpen}>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800" title="Changer l'icône">
                <Icon className="w-4 h-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2 bg-white" align="start">
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-600">Choisir une icône</div>
                <div className="grid grid-cols-8 gap-1 max-h-[240px] overflow-y-auto">
                  {/* Reset to default icon */}
                  <button
                    className={`w-7 h-7 rounded border flex items-center justify-center hover:bg-gray-100 ${!nodeStyle.customIcon ? "ring-2 ring-primary bg-primary/10" : ""}`}
                    onClick={() => {
                      data.onUpdateStyle?.({ customIcon: undefined });
                      setIconPickerOpen(false);
                    }}
                    title="Icône par défaut"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                  {ALL_ICONS.map((iconItem) => {
                    const IconComponent = iconItem.icon;
                    return (
                      <button
                        key={iconItem.name}
                        className={`w-7 h-7 rounded border flex items-center justify-center hover:bg-gray-100 ${nodeStyle.customIcon === iconItem.name ? "ring-2 ring-primary bg-primary/10" : ""}`}
                        onClick={() => {
                          data.onUpdateStyle?.({ customIcon: iconItem.name });
                          setIconPickerOpen(false);
                        }}
                        title={iconItem.name}
                      >
                        <IconComponent className="w-3.5 h-3.5" />
                      </button>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          {/* Shadow toggle */}
          <Button
            variant={nodeStyle.hasShadow ? "default" : "ghost"}
            size="icon"
            className="h-7 w-7 hover:bg-white dark:hover:bg-zinc-800"
            onClick={() => data.onUpdateStyle?.({ hasShadow: !nodeStyle.hasShadow })}
            title="Ombre"
          >
            <Layers className="w-4 h-4" />
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
        <Icon className={`w-4 h-4 flex-shrink-0 ${nodeStyle.customIcon ? "text-foreground" : config.color}`} />
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
  text: RichTextNode,
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
  const [gridSize, setGridSize] = useState<16 | 24 | 32>(24);
  const [alignmentGuides, setAlignmentGuides] = useState<{ 
    x?: number; 
    y?: number; 
    xCenter?: number; // Center vertical alignment
    yCenter?: number; // Center horizontal alignment
  }>({});

  // Interaction mode: "pan" (hand - navigate) or "select" (pointer - select multiple)
  const [interactionMode, setInteractionMode] = useState<"pan" | "select">("pan");

  // Clipboard state for copy-paste (serialized data, not React Flow instances)
  interface ClipboardNode {
    label: string;
    description?: string;
    kind: MindmapNodeKind;
    x: number;
    y: number;
    imageUrl?: string;
    originalId: string;
  }
  interface ClipboardEdge {
    sourceId: string;
    targetId: string;
  }
  const [clipboard, setClipboard] = useState<{ nodes: ClipboardNode[]; edges: ClipboardEdge[] } | null>(null);

  // Undo/redo history state - uses JSON serialization for deep cloning
  interface HistoryState {
    nodesJson: string;
    edgesJson: string;
  }
  const [undoStack, setUndoStack] = useState<HistoryState[]>([]);
  const [redoStack, setRedoStack] = useState<HistoryState[]>([]);
  const isUndoRedoAction = useRef(false);
  const isInitializing = useRef(true);

  // Deep clone nodes and edges using JSON serialization
  const serializeState = useCallback((): HistoryState => {
    // Strip non-serializable functions and transient selection state from nodes before serializing
    const serializableNodes = nodes.map(node => ({
      ...node,
      selected: undefined, // Don't persist selection state - it's transient UI state
      data: {
        ...node.data,
        onUpdateStyle: undefined,
        onEndEdit: undefined,
      }
    }));
    return {
      nodesJson: JSON.stringify(serializableNodes),
      edgesJson: JSON.stringify(edges),
    };
  }, [nodes, edges]);

  // Save current state to history (called before mutations)
  const saveToHistory = useCallback(() => {
    // Skip if undo/redo action, initializing, or loading
    if (isUndoRedoAction.current || isInitializing.current) return;
    if (nodes.length === 0) return; // Don't save empty state
    
    const snapshot = serializeState();
    setUndoStack(prev => {
      const newStack = [...prev, snapshot];
      // Keep only last 50 states to prevent memory issues
      return newStack.slice(-50);
    });
    // Clear redo stack when new action is performed
    setRedoStack([]);
  }, [serializeState, nodes.length]);

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

  // Note: The useEffect that transforms data to flowNodes/flowEdges is moved after handleNodeStyleUpdate and handleTextNodeEdit definitions

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
    onSuccess: (newNode: MindmapNodeType) => {
      // Add the new node locally instead of refetching everything
      const rfNode: Node = {
        id: newNode.id,
        type: newNode.type === "text" ? "text" : "custom",
        position: { x: parseFloat(newNode.positionX || "0"), y: parseFloat(newNode.positionY || "0") },
        data: {
          label: newNode.title,
          description: newNode.description,
          type: newNode.type,
          imageUrl: newNode.imageUrl,
          nodeStyle: newNode.style || {},
          linkedEntityType: newNode.linkedEntityType,
          linkedEntityId: newNode.linkedEntityId,
          onUpdateStyle: (styleUpdate: Partial<NodeStyle>) => handleNodeStyleUpdate(newNode.id, styleUpdate),
          onEndEdit: (newText: string) => handleTextNodeEdit(newNode.id, newText),
        },
      };
      setNodes((nds) => [...nds, rfNode]);
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
    // No onSuccess - we already updated the UI optimistically
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Style and text node update handlers - must be defined after updateNodeMutation
  const handleNodeStyleUpdate = useCallback((nodeId: string, styleUpdate: Partial<NodeStyle>) => {
    // Use functional update with nodes to safely access current state and compute merged style
    setNodes((currentNodes) => {
      // Find the target node to get its current style
      const targetNode = currentNodes.find(n => n.id === nodeId);
      if (!targetNode) {
        // Node not found, skip update
        return currentNodes;
      }
      
      // Compute the fully merged style
      const currentStyle = targetNode.data.nodeStyle || {};
      const mergedStyle: NodeStyle = { ...currentStyle, ...styleUpdate };
      
      // Send the complete merged style to the backend (inside functional update to have correct value)
      updateNodeMutation.mutate({
        nodeId,
        updates: {
          style: mergedStyle,
        },
      });
      
      // Return updated nodes array with the merged style
      return currentNodes.map((node) => {
        if (node.id === nodeId) {
          return {
            ...node,
            data: {
              ...node.data,
              nodeStyle: mergedStyle,
            },
          };
        }
        return node;
      });
    });
  }, [updateNodeMutation]);

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
  }, [updateNodeMutation]);

  // Rehydrate nodes by adding back the callback handlers
  // Selection state is preserved from the parsed snapshot
  const rehydrateNodes = useCallback((parsedNodes: Node[]): Node[] => {
    return parsedNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onUpdateStyle: (styleUpdate: Partial<NodeStyle>) => handleNodeStyleUpdate(node.id, styleUpdate),
        onEndEdit: (newText: string) => handleTextNodeEdit(node.id, newText),
      }
    }));
  }, [handleNodeStyleUpdate, handleTextNodeEdit]);

  // Undo function - uses functional updaters to avoid stale closures
  const undo = useCallback(() => {
    setUndoStack(prevUndo => {
      if (prevUndo.length === 0) return prevUndo;
      
      isUndoRedoAction.current = true;
      const previousState = prevUndo[prevUndo.length - 1];
      
      // Save current state to redo stack before restoring (serialize for immutability)
      const currentSnapshot = serializeState();
      setRedoStack(prevRedo => [...prevRedo, currentSnapshot]);
      
      // Restore previous state - parse JSON and rehydrate handlers
      try {
        const parsedNodes: Node[] = JSON.parse(previousState.nodesJson);
        const parsedEdges: Edge[] = JSON.parse(previousState.edgesJson);
        const restoredNodes = rehydrateNodes(parsedNodes);
        setNodes(restoredNodes);
        setEdges(parsedEdges);
        toast({ title: "Action annulée" });
      } catch (e) {
        console.error("Failed to parse undo state:", e);
      }
      
      setTimeout(() => {
        isUndoRedoAction.current = false;
      }, 100);
      
      // Return updated stack without the last element
      return prevUndo.slice(0, -1);
    });
  }, [serializeState, setNodes, setEdges, toast, rehydrateNodes]);

  // Redo function - uses functional updaters to avoid stale closures
  const redo = useCallback(() => {
    setRedoStack(prevRedo => {
      if (prevRedo.length === 0) return prevRedo;
      
      isUndoRedoAction.current = true;
      const nextState = prevRedo[prevRedo.length - 1];
      
      // Save current state to undo stack before restoring (serialize for immutability)
      const currentSnapshot = serializeState();
      setUndoStack(prevUndo => [...prevUndo, currentSnapshot]);
      
      // Restore next state - parse JSON and rehydrate handlers
      try {
        const parsedNodes: Node[] = JSON.parse(nextState.nodesJson);
        const parsedEdges: Edge[] = JSON.parse(nextState.edgesJson);
        const restoredNodes = rehydrateNodes(parsedNodes);
        setNodes(restoredNodes);
        setEdges(parsedEdges);
        toast({ title: "Action rétablie" });
      } catch (e) {
        console.error("Failed to parse redo state:", e);
      }
      
      setTimeout(() => {
        isUndoRedoAction.current = false;
      }, 100);
      
      // Return updated stack without the last element
      return prevRedo.slice(0, -1);
    });
  }, [serializeState, setNodes, setEdges, toast, rehydrateNodes]);

  // Transform data into ReactFlow nodes and edges - preserve selection state
  useEffect(() => {
    if (data) {
      // Use functional update to preserve existing selection state
      setNodes((currentNodes) => {
        // Create a map of current node selection states
        const selectionMap = new Map<string, boolean>();
        currentNodes.forEach(n => {
          if (n.selected) {
            selectionMap.set(n.id, true);
          }
        });
        
        // Create a map of current node positions (to preserve drag state)
        const positionMap = new Map<string, { x: number; y: number }>();
        currentNodes.forEach(n => {
          positionMap.set(n.id, n.position);
        });
        
        return data.nodes.map((node) => {
          const wasSelected = selectionMap.get(node.id) || false;
          // Use current position if available (node might have been dragged but not saved yet)
          const currentPos = positionMap.get(node.id);
          const serverPos = { x: parseFloat(node.x), y: parseFloat(node.y) };
          
          return {
            id: node.id,
            type: node.type === "text" ? "text" : "custom",
            position: currentPos || serverPos,
            selected: wasSelected,
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
          };
        });
      });

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

      setEdges(flowEdges);
      
      // Mark initialization complete after first data load
      if (isInitializing.current && data.nodes.length >= 0) {
        setTimeout(() => {
          isInitializing.current = false;
        }, 500); // Delay to allow initial render to complete
      }
    }
  }, [data, setNodes, setEdges, layoutConfig, handleNodeStyleUpdate, handleTextNodeEdit]);

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
        saveToHistory(); // Save state before creating edge
        createEdgeMutation.mutate({
          sourceNodeId: connection.source,
          targetNodeId: connection.target,
        });
        setEdges((eds) => addEdge(connection, eds));
      }
    },
    [createEdgeMutation, setEdges, saveToHistory]
  );

  // Alignment detection during drag
  const onNodeDrag = useCallback(
    (_: any, node: Node) => {
      if (!snapEnabled) {
        setAlignmentGuides({});
        return;
      }

      const ALIGNMENT_THRESHOLD = 8;
      const guides: { x?: number; y?: number; xCenter?: number; yCenter?: number } = {};
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const nodeWidth = 200; // approximate node width
      const nodeHeight = 80; // approximate node height
      const nodeCenterX = nodeX + nodeWidth / 2;
      const nodeCenterY = nodeY + nodeHeight / 2;
      const nodeRight = nodeX + nodeWidth;
      const nodeBottom = nodeY + nodeHeight;

      nodes.forEach((otherNode) => {
        if (otherNode.id === node.id) return;

        const otherX = otherNode.position.x;
        const otherY = otherNode.position.y;
        const otherWidth = 200;
        const otherHeight = 80;
        const otherCenterX = otherX + otherWidth / 2;
        const otherCenterY = otherY + otherHeight / 2;
        const otherRight = otherX + otherWidth;
        const otherBottom = otherY + otherHeight;

        // VERTICAL alignments (X axis)
        // Center-to-center vertical alignment (priority)
        if (Math.abs(nodeCenterX - otherCenterX) < ALIGNMENT_THRESHOLD) {
          guides.xCenter = otherCenterX;
        }
        // Left edge alignment
        if (Math.abs(nodeX - otherX) < ALIGNMENT_THRESHOLD) {
          guides.x = otherX;
        }
        // Right edge alignment
        if (Math.abs(nodeRight - otherRight) < ALIGNMENT_THRESHOLD && !guides.x) {
          guides.x = otherRight - nodeWidth;
        }
        // Left to right edge alignment
        if (Math.abs(nodeX - otherRight) < ALIGNMENT_THRESHOLD && !guides.x) {
          guides.x = otherRight;
        }

        // HORIZONTAL alignments (Y axis)
        // Center-to-center horizontal alignment (priority)
        if (Math.abs(nodeCenterY - otherCenterY) < ALIGNMENT_THRESHOLD) {
          guides.yCenter = otherCenterY;
        }
        // Top edge alignment
        if (Math.abs(nodeY - otherY) < ALIGNMENT_THRESHOLD) {
          guides.y = otherY;
        }
        // Bottom edge alignment
        if (Math.abs(nodeBottom - otherBottom) < ALIGNMENT_THRESHOLD && !guides.y) {
          guides.y = otherBottom - nodeHeight;
        }
        // Top to bottom edge alignment
        if (Math.abs(nodeY - otherBottom) < ALIGNMENT_THRESHOLD && !guides.y) {
          guides.y = otherBottom;
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

    // Update UI immediately
    setNodes((nds) =>
      nds.map((node) => {
        if (selectedNodes.some((n) => n.id === node.id)) {
          return { ...node, position: { ...node.position, y: referenceY } };
        }
        return node;
      })
    );

    // Batch update to server
    const updates = selectedNodes
      .filter(node => node.position.y !== referenceY)
      .map(node => ({ id: node.id, positionY: referenceY }));
    
    if (updates.length > 0) {
      apiRequest(`/api/mindmaps/${id}/nodes/batch`, "PATCH", { updates }).catch(console.error);
    }

    toast({ title: "Nodes alignés horizontalement" });
  }, [nodes, selectedNode, id, setNodes, toast]);

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

    // Update UI immediately
    setNodes((nds) =>
      nds.map((node) => {
        if (selectedNodes.some((n) => n.id === node.id)) {
          return { ...node, position: { ...node.position, x: referenceX } };
        }
        return node;
      })
    );

    // Batch update to server
    const updates = selectedNodes
      .filter(node => node.position.x !== referenceX)
      .map(node => ({ id: node.id, positionX: referenceX }));
    
    if (updates.length > 0) {
      apiRequest(`/api/mindmaps/${id}/nodes/batch`, "PATCH", { updates }).catch(console.error);
    }

    toast({ title: "Nodes alignés verticalement" });
  }, [nodes, selectedNode, id, setNodes, toast]);

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

    // Update UI immediately
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

    // Batch update to server
    const updates = sortedNodes.map((node, index) => ({
      id: node.id,
      positionX: firstX + spacing * index,
    }));
    
    apiRequest(`/api/mindmaps/${id}/nodes/batch`, "PATCH", { updates }).catch(console.error);

    toast({ title: "Nodes distribués horizontalement" });
  }, [nodes, selectedNode, id, setNodes, toast]);

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

    // Update UI immediately
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

    // Batch update to server
    const updates = sortedNodes.map((node, index) => ({
      id: node.id,
      positionY: firstY + spacing * index,
    }));
    
    apiRequest(`/api/mindmaps/${id}/nodes/batch`, "PATCH", { updates }).catch(console.error);

    toast({ title: "Nodes distribués verticalement" });
  }, [nodes, selectedNode, id, setNodes, toast]);

  // Auto-layout types
  type LayoutType = "tree" | "flowchart" | "grid" | "circle" | "hierarchy";

  // Auto-reorganize nodes with different layout algorithms
  const reorganizeNodes = useCallback((layoutType: LayoutType) => {
    if (nodes.length === 0) {
      toast({ title: "Aucun node à réorganiser", variant: "destructive" });
      return;
    }

    const NODE_WIDTH = 180;
    const NODE_HEIGHT = 80;
    const H_SPACING = 60;
    const V_SPACING = 80;

    let newPositions: Record<string, { x: number; y: number }> = {};

    switch (layoutType) {
      case "tree": {
        // Tree layout: hierarchical from top to bottom
        // Find root nodes (nodes with no incoming edges)
        const targetIds = new Set(edges.map(e => e.target));
        const rootNodes = nodes.filter(n => !targetIds.has(n.id));
        
        // Build adjacency list
        const children: Record<string, string[]> = {};
        edges.forEach(e => {
          if (!children[e.source]) children[e.source] = [];
          children[e.source].push(e.target);
        });

        // BFS to calculate positions
        let level = 0;
        let queue = rootNodes.length > 0 ? [...rootNodes] : [nodes[0]];
        const visited = new Set<string>();
        
        while (queue.length > 0) {
          const levelNodes = queue.slice();
          queue = [];
          const levelWidth = levelNodes.length * (NODE_WIDTH + H_SPACING);
          const startX = -levelWidth / 2;
          
          levelNodes.forEach((node, i) => {
            if (visited.has(node.id)) return;
            visited.add(node.id);
            
            newPositions[node.id] = {
              x: startX + i * (NODE_WIDTH + H_SPACING),
              y: level * (NODE_HEIGHT + V_SPACING),
            };
            
            const nodeChildren = children[node.id] || [];
            nodeChildren.forEach(childId => {
              const child = nodes.find(n => n.id === childId);
              if (child && !visited.has(child.id)) {
                queue.push(child);
              }
            });
          });
          level++;
        }
        
        // Position remaining unvisited nodes
        nodes.forEach((node, i) => {
          if (!visited.has(node.id)) {
            newPositions[node.id] = {
              x: i * (NODE_WIDTH + H_SPACING),
              y: level * (NODE_HEIGHT + V_SPACING),
            };
          }
        });
        break;
      }

      case "flowchart": {
        // Flowchart layout: left to right
        const sourceIds = new Set(edges.map(e => e.source));
        const targetIds = new Set(edges.map(e => e.target));
        const startNodes = nodes.filter(n => !targetIds.has(n.id));
        
        const children: Record<string, string[]> = {};
        edges.forEach(e => {
          if (!children[e.source]) children[e.source] = [];
          children[e.source].push(e.target);
        });

        let column = 0;
        let queue = startNodes.length > 0 ? [...startNodes] : [nodes[0]];
        const visited = new Set<string>();
        
        while (queue.length > 0) {
          const columnNodes = queue.slice();
          queue = [];
          const columnHeight = columnNodes.length * (NODE_HEIGHT + V_SPACING);
          const startY = -columnHeight / 2;
          
          columnNodes.forEach((node, i) => {
            if (visited.has(node.id)) return;
            visited.add(node.id);
            
            newPositions[node.id] = {
              x: column * (NODE_WIDTH + H_SPACING * 2),
              y: startY + i * (NODE_HEIGHT + V_SPACING),
            };
            
            const nodeChildren = children[node.id] || [];
            nodeChildren.forEach(childId => {
              const child = nodes.find(n => n.id === childId);
              if (child && !visited.has(child.id)) {
                queue.push(child);
              }
            });
          });
          column++;
        }
        
        // Position remaining unvisited nodes
        nodes.forEach((node, i) => {
          if (!visited.has(node.id)) {
            newPositions[node.id] = {
              x: column * (NODE_WIDTH + H_SPACING * 2),
              y: i * (NODE_HEIGHT + V_SPACING),
            };
          }
        });
        break;
      }

      case "grid": {
        // Grid layout: nodes arranged in a grid
        const cols = Math.ceil(Math.sqrt(nodes.length));
        nodes.forEach((node, i) => {
          const row = Math.floor(i / cols);
          const col = i % cols;
          newPositions[node.id] = {
            x: col * (NODE_WIDTH + H_SPACING),
            y: row * (NODE_HEIGHT + V_SPACING),
          };
        });
        break;
      }

      case "circle": {
        // Circular layout: nodes arranged in a circle
        const radius = Math.max(200, nodes.length * 40);
        const angleStep = (2 * Math.PI) / nodes.length;
        nodes.forEach((node, i) => {
          const angle = i * angleStep - Math.PI / 2;
          newPositions[node.id] = {
            x: Math.cos(angle) * radius,
            y: Math.sin(angle) * radius,
          };
        });
        break;
      }

      case "hierarchy": {
        // Hierarchical layout: based on node types
        const typeGroups: Record<string, typeof nodes> = {};
        nodes.forEach(node => {
          const type = node.data?.kind || "generic";
          if (!typeGroups[type]) typeGroups[type] = [];
          typeGroups[type].push(node);
        });

        let yOffset = 0;
        Object.entries(typeGroups).forEach(([type, typeNodes]) => {
          const groupWidth = typeNodes.length * (NODE_WIDTH + H_SPACING);
          const startX = -groupWidth / 2;
          
          typeNodes.forEach((node, i) => {
            newPositions[node.id] = {
              x: startX + i * (NODE_WIDTH + H_SPACING),
              y: yOffset,
            };
          });
          
          yOffset += NODE_HEIGHT + V_SPACING * 1.5;
        });
        break;
      }
    }

    // Apply new positions locally immediately (optimistic update)
    setNodes((nds) =>
      nds.map((node) => {
        const newPos = newPositions[node.id];
        if (newPos) {
          return { ...node, position: newPos };
        }
        return node;
      })
    );

    // Fit view after reorganization immediately
    setTimeout(() => fitView({ padding: 0.2 }), 50);

    // Batch update to server (non-blocking)
    const updates = Object.entries(newPositions).map(([nodeId, pos]) => ({
      id: nodeId,
      positionX: pos.x,
      positionY: pos.y,
    }));
    
    apiRequest(`/api/mindmaps/${id}/nodes/batch`, "PATCH", { updates }).catch((error) => {
      console.error("Batch update failed:", error);
      toast({ title: "Erreur lors de la sauvegarde", variant: "destructive" });
    });

    const layoutNames: Record<LayoutType, string> = {
      tree: "Arbre",
      flowchart: "Flowchart",
      grid: "Grille",
      circle: "Cercle",
      hierarchy: "Hiérarchie",
    };
    toast({ title: `Layout "${layoutNames[layoutType]}" appliqué` });
  }, [nodes, edges, updateNodeMutation, setNodes, fitView, toast]);

  // Delete selected nodes
  const deleteSelectedNodes = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    if (selectedNodes.length === 0 && selectedNode) {
      saveToHistory(); // Save state before deleting node
      deleteNodeMutation.mutate(selectedNode.id);
      return;
    }
    
    if (selectedNodes.length > 0) {
      saveToHistory(); // Save state before deleting nodes
    }
    
    selectedNodes.forEach((node) => {
      deleteNodeMutation.mutate(node.id);
    });
    
    if (selectedNodes.length > 0) {
      toast({ title: `${selectedNodes.length} node(s) supprimé(s)` });
    }
  }, [nodes, selectedNode, deleteNodeMutation, toast, saveToHistory]);

  // Copy selected nodes to clipboard (serialize data, not React Flow instances)
  const copySelectedNodes = useCallback(() => {
    const selectedNodes = nodes.filter(n => n.selected);
    let nodesToCopy = selectedNodes;
    
    if (selectedNodes.length === 0 && selectedNode) {
      nodesToCopy = [selectedNode];
    }
    
    if (nodesToCopy.length === 0) {
      toast({ title: "Sélectionnez des nodes à copier", variant: "destructive" });
      return;
    }

    // Serialize nodes to plain data
    const serializedNodes: ClipboardNode[] = nodesToCopy.map(n => ({
      label: n.data.label || "",
      description: n.data.description,
      kind: n.data.kind || "idea",
      x: n.position.x,
      y: n.position.y,
      imageUrl: n.data.imageUrl,
      originalId: n.id,
    }));

    // Also copy edges between selected nodes
    const selectedNodeIds = new Set(nodesToCopy.map(n => n.id));
    const serializedEdges: ClipboardEdge[] = edges
      .filter(e => selectedNodeIds.has(e.source) && selectedNodeIds.has(e.target))
      .map(e => ({ sourceId: e.source, targetId: e.target }));

    setClipboard({ nodes: serializedNodes, edges: serializedEdges });
    toast({ title: `${nodesToCopy.length} node(s) copié(s)` });
  }, [nodes, edges, selectedNode, toast]);

  // Paste nodes from clipboard
  const pasteNodes = useCallback(async () => {
    if (!clipboard || clipboard.nodes.length === 0) {
      toast({ title: "Rien à coller", variant: "destructive" });
      return;
    }

    saveToHistory(); // Save state before pasting nodes
    const PASTE_OFFSET = 50;
    const idMapping: Record<string, string> = {};

    try {
      // Create new nodes with offset positions
      for (const node of clipboard.nodes) {
        const result = await apiRequest(`/api/mindmaps/${id}/nodes`, "POST", {
          title: node.label || "Copie",
          description: node.description || undefined,
          type: node.kind || "idea",
          x: node.x + PASTE_OFFSET,
          y: node.y + PASTE_OFFSET,
          imageUrl: node.imageUrl || undefined,
        });
        const newNode = await result.json();
        idMapping[node.originalId] = newNode.id;
      }

      // Create edges between pasted nodes
      for (const edge of clipboard.edges) {
        if (idMapping[edge.sourceId] && idMapping[edge.targetId]) {
          await apiRequest(`/api/mindmaps/${id}/edges`, "POST", {
            sourceNodeId: idMapping[edge.sourceId],
            targetNodeId: idMapping[edge.targetId],
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
      toast({ title: `${clipboard.nodes.length} node(s) collé(s)` });
    } catch (error) {
      console.error("Paste error:", error);
      toast({ title: "Erreur lors du collage", variant: "destructive" });
    }
  }, [clipboard, id, toast, saveToHistory]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input, textarea, or any contenteditable element (including TipTap editors)
      const target = e.target as HTMLElement;
      const isInEditableContext = 
        target.tagName === "INPUT" || 
        target.tagName === "TEXTAREA" || 
        target.isContentEditable ||
        target.closest('[contenteditable="true"]') !== null ||
        target.closest('.tiptap') !== null ||
        target.closest('.ProseMirror') !== null;
      
      if (isInEditableContext) {
        return;
      }

      // Delete / Backspace - delete selected nodes
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedNodes();
      }

      // Ctrl/Cmd + C - copy
      if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        copySelectedNodes();
      }

      // Ctrl/Cmd + V - paste
      if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        pasteNodes();
      }

      // Ctrl/Cmd + Z - undo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Ctrl/Cmd + Y or Ctrl/Cmd + Shift + Z - redo
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [deleteSelectedNodes, copySelectedNodes, pasteNodes, undo, redo]);

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
    
    saveToHistory(); // Save state before adding node
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
    saveToHistory(); // Save state before adding text node
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
    saveToHistory(); // Save state before deleting node
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
          panOnDrag={interactionMode === "pan"}
          selectionOnDrag={interactionMode === "select"}
          selectNodesOnDrag={interactionMode === "select"}
          className="bg-muted/30"
          data-testid="mindmap-canvas"
        >
          {/* Alignment guides */}
          {/* Edge alignment lines (dashed, violet) */}
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
          {/* Center alignment lines (solid, cyan) */}
          {alignmentGuides.xCenter !== undefined && (
            <svg className="absolute inset-0 pointer-events-none z-50" style={{ overflow: 'visible' }}>
              <line
                x1={alignmentGuides.xCenter}
                y1={-9999}
                x2={alignmentGuides.xCenter}
                y2={9999}
                stroke="#06b6d4"
                strokeWidth={2}
              />
            </svg>
          )}
          {alignmentGuides.yCenter !== undefined && (
            <svg className="absolute inset-0 pointer-events-none z-50" style={{ overflow: 'visible' }}>
              <line
                x1={-9999}
                y1={alignmentGuides.yCenter}
                x2={9999}
                y2={alignmentGuides.yCenter}
                stroke="#06b6d4"
                strokeWidth={2}
              />
            </svg>
          )}
          <Background variant={BackgroundVariant.Dots} gap={snapEnabled ? gridSize : 20} size={1} />
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

          {/* Interaction mode and Snap to grid controls */}
          <Panel position="bottom-left" className="flex flex-wrap gap-1 p-2 mb-12">
            {/* Interaction mode toggle */}
            <div className="flex items-center gap-1 bg-card border rounded-lg p-1 shadow-sm">
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant={interactionMode === "pan" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setInteractionMode("pan")}
                    data-testid="button-mode-pan"
                    className="h-8 w-8"
                  >
                    <Hand className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  Mode navigation (déplacer le canvas)
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant={interactionMode === "select" ? "default" : "ghost"}
                    size="icon"
                    onClick={() => setInteractionMode("select")}
                    data-testid="button-mode-select"
                    className="h-8 w-8"
                  >
                    <MousePointer2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  Mode sélection (sélectionner plusieurs éléments)
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Undo/Redo controls */}
            <div className="flex items-center gap-1 bg-card border rounded-lg p-1 shadow-sm">
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={undo}
                    disabled={undoStack.length === 0}
                    data-testid="button-undo"
                    className="h-8 w-8"
                  >
                    <Undo2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  Annuler (Ctrl+Z)
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={redo}
                    disabled={redoStack.length === 0}
                    data-testid="button-redo"
                    className="h-8 w-8"
                  >
                    <Redo2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="font-medium">
                  Rétablir (Ctrl+Y)
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Snap to grid controls */}
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

            {/* Auto-reorganize layouts */}
            <div className="flex items-center gap-1 bg-card border rounded-lg p-1 shadow-sm">
              <DropdownMenu>
                <Tooltip delayDuration={100}>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        data-testid="button-auto-layout"
                      >
                        <Workflow className="w-4 h-4 mr-1" />
                        Réorganiser
                      </Button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="font-medium">
                    Réorganiser automatiquement
                  </TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel>Choisir un layout</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => reorganizeNodes("tree")}>
                    <TreeDeciduous className="w-4 h-4 mr-2" />
                    Arbre
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => reorganizeNodes("flowchart")}>
                    <GitBranch className="w-4 h-4 mr-2" />
                    Flowchart
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => reorganizeNodes("grid")}>
                    <LayoutGrid className="w-4 h-4 mr-2" />
                    Grille
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => reorganizeNodes("circle")}>
                    <CircleDot className="w-4 h-4 mr-2" />
                    Cercle
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => reorganizeNodes("hierarchy")}>
                    <Layers className="w-4 h-4 mr-2" />
                    Hiérarchie
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
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
              <CardContent className="p-3 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const NodeIcon = NODE_KIND_CONFIG[newNodeKind].icon;
                      return <NodeIcon className={`w-4 h-4 ${NODE_KIND_CONFIG[newNodeKind].color}`} />;
                    })()}
                    <h3 className="text-sm font-medium">
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
                  <div className="space-y-1.5">
                    <Label className="text-xs flex items-center gap-2">
                      <Link2 className="w-3 h-3" />
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

                <div className="space-y-1.5">
                  <Label htmlFor="node-label" className="text-xs">Nom *</Label>
                  <Input
                    id="node-label"
                    value={newNodeLabel}
                    onChange={(e) => setNewNodeLabel(e.target.value)}
                    placeholder="Nom du noeud"
                    data-testid="input-node-label"
                    autoFocus={!canLinkEntity(newNodeKind)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="node-description" className="text-xs">Description</Label>
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
              <CardContent className="p-3 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Modifier le noeud</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNode(null)}
                  >
                    Fermer
                  </Button>
                </div>
                
                <div className="space-y-1.5">
                  <Label htmlFor="edit-title" className="text-xs">Titre</Label>
                  <Input
                    id="edit-title"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    data-testid="input-edit-title"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="edit-description" className="text-xs">Description</Label>
                  <Textarea
                    id="edit-description"
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Description..."
                    data-testid="input-edit-description"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs">Image</Label>
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
              <CardContent className="p-3 space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Connecteur</h4>
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
