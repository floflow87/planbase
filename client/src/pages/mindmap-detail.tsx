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
} from "reactflow";
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
}

function CustomMindmapNode({ id, data }: { id: string; data: CustomNodeData }) {
  const config = NODE_KIND_CONFIG[data.kind] || NODE_KIND_CONFIG.generic;
  const Icon = config.icon;
  const { showTitle, showDescription, showImage } = data.layoutConfig;

  const isCompact = !showDescription && !showImage;

  return (
    <div
      className={`relative rounded-lg border-2 shadow-sm ${config.bgColor} ${data.isDraft ? "border-dashed" : ""} ${isCompact ? "px-3 py-2 min-w-[100px]" : "px-4 py-3 min-w-[150px] max-w-[280px]"}`}
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
        <div className={`font-medium text-foreground truncate ${isCompact ? "text-xs" : "text-sm"}`}>
          {data.label}
        </div>
      )}
      
      {showDescription && data.description && (
        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {data.description}
        </div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  custom: CustomMindmapNode,
};

function MindmapCanvas() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { fitView, zoomIn, zoomOut } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
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

  useEffect(() => {
    if (data) {
      const flowNodes: Node[] = data.nodes.map((node) => ({
        id: node.id,
        type: "custom",
        position: { x: parseFloat(node.x), y: parseFloat(node.y) },
        data: {
          label: node.title,
          description: node.description,
          imageUrl: node.imageUrl,
          kind: node.type as MindmapNodeKind,
          linkedEntityType: node.linkedEntityType,
          linkedEntityId: node.linkedEntityId,
          layoutConfig,
        },
      }));

      const flowEdges: Edge[] = data.edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        label: edge.label || undefined,
        type: "default",
        animated: false,
        style: edge.style as Record<string, unknown> || {},
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [data, setNodes, setEdges, layoutConfig]);

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
      toast({ title: "Noeud créé" });
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
      toast({ title: "Noeud supprimé" });
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
      toast({ title: "Connexion créée" });
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

  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      updateNodeMutation.mutate({
        nodeId: node.id,
        updates: {
          x: Math.round(node.position.x).toString(),
          y: Math.round(node.position.y).toString(),
        },
      });
    },
    [updateNodeMutation]
  );

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node);
  }, []);

  const handleAddNode = () => {
    if (!newNodeLabel.trim()) {
      toast({
        title: "Nom requis",
        description: "Veuillez entrer un nom pour le noeud.",
        variant: "destructive",
      });
      return;
    }

    const centerX = 200 + Math.random() * 400;
    const centerY = 150 + Math.random() * 300;

    createNodeMutation.mutate({
      title: newNodeLabel,
      description: newNodeDescription || undefined,
      type: newNodeKind,
      x: centerX,
      y: centerY,
      linkedEntityType: newLinkedEntityType || undefined,
      linkedEntityId: newLinkedEntityId || undefined,
    });
  };

  const handleSelectEntity = (entity: { id: string; name: string }) => {
    setNewLinkedEntityId(entity.id);
    setNewLinkedEntityName(entity.name);
    setNewLinkedEntityType(newNodeKind);
    if (!newNodeLabel.trim()) {
      setNewNodeLabel(entity.name);
    }
    setEntitySearchOpen(false);
  };

  const handleClearLinkedEntity = () => {
    setNewLinkedEntityId(null);
    setNewLinkedEntityName("");
    setNewLinkedEntityType(null);
  };

  const handleSelectEditEntity = (entity: { id: string; name: string }) => {
    setEditLinkedEntityId(entity.id);
    setEditLinkedEntityName(entity.name);
    setEditLinkedEntityType(editType);
    setEditEntitySearchOpen(false);
  };

  const handleClearEditLinkedEntity = () => {
    setEditLinkedEntityId(null);
    setEditLinkedEntityName("");
    setEditLinkedEntityType(null);
  };

  const handleDeleteSelectedNode = () => {
    if (selectedNode) {
      deleteNodeMutation.mutate(selectedNode.id);
    }
  };

  const handleKindChange = (newKind: MindmapKind) => {
    const defaultConfig = DEFAULT_LAYOUT_CONFIGS[newKind];
    updateMindmapMutation.mutate({
      kind: newKind,
      layoutConfig: defaultConfig,
    });
  };

  const handleLayoutToggle = (key: keyof LayoutConfig) => {
    const newConfig = { ...layoutConfig, [key]: !layoutConfig[key] };
    updateMindmapMutation.mutate({ layoutConfig: newConfig });
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
    
    toast({ title: "Noeud mis à jour" });
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-full flex items-center justify-center">
        <Card className="p-6">
          <p className="text-muted-foreground">Mindmap non trouvée</p>
          <Button onClick={() => setLocation("/mindmaps")} className="mt-4">
            Retour aux mindmaps
          </Button>
        </Card>
      </div>
    );
  }

  const currentKind = (data.mindmap.kind as MindmapKind) || "generic";
  const CurrentKindIcon = KIND_ICONS[currentKind] || Brain;

  return (
    <div className="h-full flex flex-col" ref={reactFlowWrapper}>
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/mindmaps")}
            data-testid="button-back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold" data-testid="mindmap-title">
              {data.mindmap.name}
            </h1>
            {data.mindmap.description && (
              <p className="text-sm text-muted-foreground">
                {data.mindmap.description}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={currentKind} onValueChange={(v) => handleKindChange(v as MindmapKind)}>
            <SelectTrigger className="w-[200px]" data-testid="select-view-kind">
              <CurrentKindIcon className="w-4 h-4 mr-2" />
              <SelectValue />
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
          onNodeDragStop={onNodeDragStop}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          className="bg-muted/30"
          data-testid="mindmap-canvas"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
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

          <Panel position="top-right" className="mr-2">
            <div className="flex flex-col gap-1 p-1.5 bg-card border rounded-lg shadow-lg">
              {Object.entries(NODE_KIND_CONFIG).map(([kind, { label, icon: Icon, color }]) => (
                <Tooltip key={kind} delayDuration={100}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setNewNodeKind(kind as MindmapNodeKind);
                        setIsAddingNode(true);
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

        {isAddingNode && (
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

        {selectedNode && (
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
                  <Label htmlFor="edit-image">URL de l'image</Label>
                  <Input
                    id="edit-image"
                    value={editImageUrl}
                    onChange={(e) => setEditImageUrl(e.target.value)}
                    placeholder="https://..."
                    data-testid="input-edit-image"
                  />
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
