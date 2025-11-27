import { useState, useCallback, useRef, useEffect } from "react";
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
} from "reactflow";
import "reactflow/dist/style.css";
import {
  ArrowLeft,
  Plus,
  Save,
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
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import type {
  Mindmap,
  MindmapNode as MindmapNodeType,
  MindmapEdge as MindmapEdgeType,
  MindmapNodeKind,
} from "@shared/schema";

const NODE_KIND_CONFIG: Record<
  MindmapNodeKind,
  { label: string; icon: typeof Lightbulb; color: string; bgColor: string }
> = {
  idea: {
    label: "Idée",
    icon: Lightbulb,
    color: "text-amber-600",
    bgColor: "bg-amber-50 border-amber-200",
  },
  note: {
    label: "Note",
    icon: StickyNote,
    color: "text-blue-600",
    bgColor: "bg-blue-50 border-blue-200",
  },
  project: {
    label: "Projet",
    icon: FolderOpen,
    color: "text-violet-600",
    bgColor: "bg-violet-50 border-violet-200",
  },
  document: {
    label: "Document",
    icon: FileText,
    color: "text-green-600",
    bgColor: "bg-green-50 border-green-200",
  },
  task: {
    label: "Tâche",
    icon: CheckSquare,
    color: "text-orange-600",
    bgColor: "bg-orange-50 border-orange-200",
  },
  client: {
    label: "Client",
    icon: User,
    color: "text-cyan-600",
    bgColor: "bg-cyan-50 border-cyan-200",
  },
};

interface CustomNodeData {
  label: string;
  description?: string;
  kind: MindmapNodeKind;
  isDraft?: boolean;
  linkedEntityType?: string;
  linkedEntityId?: string;
  onDelete?: (id: string) => void;
}

function CustomMindmapNode({ id, data }: { id: string; data: CustomNodeData }) {
  const config = NODE_KIND_CONFIG[data.kind];
  const Icon = config.icon;

  return (
    <div
      className={`px-4 py-3 rounded-lg border-2 shadow-sm min-w-[150px] max-w-[250px] ${config.bgColor} ${data.isDraft ? "border-dashed" : ""}`}
    >
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${config.color}`} />
        <Badge variant="outline" className="text-xs">
          {config.label}
        </Badge>
        {data.isDraft && (
          <Badge variant="secondary" className="text-xs">
            Draft
          </Badge>
        )}
      </div>
      <div className="font-medium text-sm text-foreground truncate">
        {data.label}
      </div>
      {data.description && (
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

  const { data, isLoading, error } = useQuery<{
    mindmap: Mindmap;
    nodes: MindmapNodeType[];
    edges: MindmapEdgeType[];
  }>({
    queryKey: ["/api/mindmaps", id],
    enabled: !!id,
  });

  useEffect(() => {
    if (data) {
      const flowNodes: Node[] = data.nodes.map((node) => ({
        id: node.id,
        type: "custom",
        position: { x: node.positionX, y: node.positionY },
        data: {
          label: node.label,
          description: node.description,
          kind: node.kind,
          isDraft: node.isDraft,
          linkedEntityType: node.linkedEntityType,
          linkedEntityId: node.linkedEntityId,
        },
      }));

      const flowEdges: Edge[] = data.edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        label: edge.label || undefined,
        type: edge.edgeType || "default",
        animated: edge.edgeType === "animated",
        style: { stroke: edge.color || undefined },
      }));

      setNodes(flowNodes);
      setEdges(flowEdges);
    }
  }, [data, setNodes, setEdges]);

  const createNodeMutation = useMutation({
    mutationFn: async (nodeData: {
      label: string;
      description?: string;
      kind: MindmapNodeKind;
      positionX: number;
      positionY: number;
    }) => {
      return await apiRequest(`/api/mindmaps/${id}/nodes`, {
        method: "POST",
        body: JSON.stringify(nodeData),
      });
    },
    onSuccess: (newNode: MindmapNodeType) => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
      const flowNode: Node = {
        id: newNode.id,
        type: "custom",
        position: { x: newNode.positionX, y: newNode.positionY },
        data: {
          label: newNode.label,
          description: newNode.description,
          kind: newNode.kind,
          isDraft: newNode.isDraft,
        },
      };
      setNodes((nds) => [...nds, flowNode]);
      setIsAddingNode(false);
      setNewNodeLabel("");
      setNewNodeDescription("");
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
      return await apiRequest(`/api/mindmap-nodes/${nodeId}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
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
      return await apiRequest(`/api/mindmap-nodes/${nodeId}`, {
        method: "DELETE",
      });
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
      return await apiRequest(`/api/mindmaps/${id}/edges`, {
        method: "POST",
        body: JSON.stringify(edgeData),
      });
    },
    onSuccess: (newEdge: MindmapEdgeType) => {
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
      return await apiRequest(`/api/mindmaps/${id}`, {
        method: "PATCH",
        body: JSON.stringify(updates),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/mindmaps", id] });
      toast({ title: "Mindmap mise à jour" });
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
        setEdges((eds) =>
          addEdge(
            { ...connection, id: `temp-${Date.now()}`, animated: true },
            eds
          )
        );
      }
    },
    [createEdgeMutation, setEdges]
  );

  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      updateNodeMutation.mutate({
        nodeId: node.id,
        updates: {
          positionX: Math.round(node.position.x),
          positionY: Math.round(node.position.y),
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
      label: newNodeLabel,
      description: newNodeDescription || undefined,
      kind: newNodeKind,
      positionX: centerX,
      positionY: centerY,
    });
  };

  const handleDeleteSelectedNode = () => {
    if (selectedNode) {
      deleteNodeMutation.mutate(selectedNode.id);
    }
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button data-testid="button-add-node">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {Object.entries(NODE_KIND_CONFIG).map(
                ([kind, { label, icon: Icon, color }]) => (
                  <DropdownMenuItem
                    key={kind}
                    onClick={() => {
                      setNewNodeKind(kind as MindmapNodeKind);
                      setIsAddingNode(true);
                    }}
                    data-testid={`menu-add-${kind}`}
                  >
                    <Icon className={`w-4 h-4 mr-2 ${color}`} />
                    {label}
                  </DropdownMenuItem>
                )
              )}
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
        </ReactFlow>

        {isAddingNode && (
          <div className="absolute top-4 right-4 z-50">
            <Card className="w-80">
              <CardContent className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">
                    Nouveau {NODE_KIND_CONFIG[newNodeKind].label}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsAddingNode(false)}
                  >
                    Annuler
                  </Button>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="node-label">Nom *</Label>
                  <Input
                    id="node-label"
                    value={newNodeLabel}
                    onChange={(e) => setNewNodeLabel(e.target.value)}
                    placeholder="Nom du noeud"
                    data-testid="input-node-label"
                    autoFocus
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
          <div className="absolute bottom-4 left-4 z-50">
            <Card className="w-64">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Noeud sélectionné</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNode(null)}
                  >
                    Fermer
                  </Button>
                </div>
                <p className="text-sm truncate">{selectedNode.data.label}</p>
                <Badge className={NODE_KIND_CONFIG[selectedNode.data.kind as MindmapNodeKind].bgColor}>
                  {NODE_KIND_CONFIG[selectedNode.data.kind as MindmapNodeKind].label}
                </Badge>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelectedNode}
                  disabled={deleteNodeMutation.isPending}
                  className="w-full"
                  data-testid="button-delete-node"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Supprimer
                </Button>
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
