import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, Eye, EyeOff, Globe, Check, ChevronsUpDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import NoteEditor from "@/components/NoteEditor";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertNote, Project } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";

export default function NoteNew() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<any>({ type: 'doc', content: [] });
  const [status, setStatus] = useState<"draft" | "active" | "archived">("draft");
  const [visibility, setVisibility] = useState<"private" | "account" | "client_ro">("private");
  const [noteId, setNoteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isManualSaving, setIsManualSaving] = useState(false);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(false);
  const [isEditMode, setIsEditMode] = useState(true);
  const [projectSelectorOpen, setProjectSelectorOpen] = useState(false);

  // Stable ref for noteId to avoid autosave race conditions
  const noteIdRef = useRef<string | null>(null);
  const isCreatingRef = useRef(false);

  // Reset noteId ref on component mount
  useEffect(() => {
    noteIdRef.current = null;
    isCreatingRef.current = false;
  }, []);

  // Fetch projects for linking
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Debounced values for autosave
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContent = useDebounce(content, 1000);

  // Create note mutation
  const createMutation = useMutation({
    mutationFn: async (data: Partial<InsertNote>) => {
      const response = await apiRequest("/api/notes", "POST", data);
      return await response.json();
    },
    onSuccess: (data) => {
      // Set noteIdRef FIRST before updating any state
      noteIdRef.current = data.id;
      setNoteId(data.id);
      isCreatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setLastSaved(new Date());
      setIsSaving(false);
      setIsManualSaving(false);
      
      // Redirect to edit mode to prevent duplicate creation
      navigate(`/notes/${data.id}`);
    },
    onError: (error: any) => {
      isCreatingRef.current = false;
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la note",
        variant: "destructive",
      });
      setIsSaving(false);
      setIsManualSaving(false);
    },
  });

  // Update note mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertNote> }) => {
      const response = await apiRequest(`/api/notes/${id}`, "PATCH", data);
      return await response.json();
    },
    onSuccess: (response, variables) => {
      // Only invalidate the individual note query during autosave
      // This prevents unnecessary reloads of the notes list
      queryClient.invalidateQueries({ queryKey: ["/api/notes", variables.id] });
      setLastSaved(new Date());
      setIsSaving(false);
      setIsManualSaving(false);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de sauvegarder la note",
        variant: "destructive",
      });
      setIsSaving(false);
      setIsManualSaving(false);
    },
  });

  // Autosave effect
  useEffect(() => {
    // Skip if autosave is disabled
    if (!autoSaveEnabled) {
      return;
    }

    // Skip autosave if manual save is in progress
    if (isManualSaving) {
      return;
    }

    // Skip if a mutation is already in progress
    if (createMutation.isPending || updateMutation.isPending || isCreatingRef.current) {
      return;
    }

    if (!debouncedTitle && !debouncedContent.content?.length) {
      return;
    }

    setIsSaving(true);

    // Extract plain text from content for search
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      
      const getText = (node: any): string => {
        if (node.type === "text") {
          return node.text || "";
        }
        if (node.content && Array.isArray(node.content)) {
          return node.content.map(getText).join(" ");
        }
        return "";
      };

      return getText(content);
    };

    const plainText = extractPlainText(debouncedContent);

    const noteData = {
      title: debouncedTitle || "Sans titre",
      content: debouncedContent,
      plainText,
      status,
      visibility,
    };

    if (noteIdRef.current) {
      updateMutation.mutate({ id: noteIdRef.current, data: noteData });
    } else {
      isCreatingRef.current = true;
      createMutation.mutate(noteData);
    }
  }, [debouncedTitle, debouncedContent, status, visibility, isManualSaving, autoSaveEnabled]);

  const handleDelete = useCallback(async () => {
    if (!noteId) {
      navigate("/notes");
      return;
    }

    if (!confirm("Êtes-vous sûr de vouloir supprimer cette note ?")) {
      return;
    }

    try {
      await apiRequest(`/api/notes/${noteId}`, "DELETE");
      noteIdRef.current = null;
      setNoteId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note supprimée",
        description: "La note a été supprimée avec succès",
        variant: "success",
      });
      navigate("/notes");
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la note",
        variant: "destructive",
      });
    }
  }, [noteId, navigate, queryClient, toast]);

  const handleSaveDraft = useCallback(() => {
    // Block if a creation is in progress
    if (isCreatingRef.current || createMutation.isPending) {
      return;
    }

    setIsManualSaving(true);
    
    // Extract plain text from content for search
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      
      const getText = (node: any): string => {
        if (node.type === "text") {
          return node.text || "";
        }
        if (node.content && Array.isArray(node.content)) {
          return node.content.map(getText).join(" ");
        }
        return "";
      };

      return getText(content);
    };

    const plainText = extractPlainText(content);

    if (noteIdRef.current) {
      // Update existing note with all fields including content
      updateMutation.mutate({ 
        id: noteIdRef.current, 
        data: { 
          title: title || "Sans titre",
          content,
          plainText,
          status: "draft",
          visibility,
        } 
      });
      toast({
        title: "Brouillon enregistré",
        description: "La note a été enregistrée en brouillon",
        variant: "success",
      });
    } else {
      // Create note with draft status
      isCreatingRef.current = true;
      createMutation.mutate({
        title: title || "Sans titre",
        content,
        plainText,
        status: "draft",
        visibility,
      });
      toast({
        title: "Brouillon enregistré",
        description: "La note a été créée en brouillon",
        variant: "success",
      });
    }
  }, [title, content, visibility, updateMutation, createMutation, toast]);

  const handlePublish = useCallback(() => {
    // Block if a creation is in progress
    if (isCreatingRef.current || createMutation.isPending) {
      return;
    }

    setIsManualSaving(true);
    setStatus("active");
    
    // Extract plain text from content for search
    const extractPlainText = (content: any): string => {
      if (!content) return "";
      
      const getText = (node: any): string => {
        if (node.type === "text") {
          return node.text || "";
        }
        if (node.content && Array.isArray(node.content)) {
          return node.content.map(getText).join(" ");
        }
        return "";
      };

      return getText(content);
    };

    const plainText = extractPlainText(content);

    if (noteIdRef.current) {
      // Update existing note with all fields including content
      updateMutation.mutate({ 
        id: noteIdRef.current, 
        data: { 
          title: title || "Sans titre",
          content,
          plainText,
          status: "active",
          visibility,
        } 
      });
      toast({
        title: "Note publiée",
        description: "La note est maintenant active",
        variant: "success",
      });
    } else {
      // Create note with active status
      isCreatingRef.current = true;
      createMutation.mutate({
        title: title || "Sans titre",
        content,
        plainText,
        status: "active",
        visibility,
      });
      toast({
        title: "Note publiée",
        description: "La note a été créée et publiée",
        variant: "success",
      });
    }
  }, [title, content, visibility, updateMutation, createMutation, toast]);

  return (
    <div className="h-full flex flex-col">
      {/* Fixed Header */}
      <div className="flex-none border-b border-border bg-background">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4 flex-1 min-w-0">
              <Link href="/notes">
                <Button variant="ghost" size="icon" data-testid="button-back" className="mt-1">
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </Link>
              <div className="flex-1 min-w-0">
                <h1 className="text-2xl font-bold text-foreground truncate mb-2">
                  {title || "Nouvelle note"}
                </h1>
                <div className="flex items-center gap-2">
                  <Badge 
                    variant="outline" 
                    className={
                      status === "draft" 
                        ? "bg-gray-100 text-gray-700 border-gray-200"
                        : status === "archived"
                        ? "bg-orange-50 text-orange-700 border-orange-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }
                  >
                    {status === "draft" ? "Brouillon" : status === "archived" ? "Archivée" : "Active"}
                  </Badge>
                  {isSaving ? (
                    <span className="text-xs text-muted-foreground">Sauvegarde en cours...</span>
                  ) : lastSaved ? (
                    <span className="text-xs text-muted-foreground">
                      Sauvegardé à {lastSaved.toLocaleTimeString()}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Auto Save Toggle */}
              <div className="flex items-center gap-2">
                <Switch
                  id="autosave"
                  checked={autoSaveEnabled}
                  onCheckedChange={setAutoSaveEnabled}
                  data-testid="switch-autosave"
                />
                <Label htmlFor="autosave" className="text-sm cursor-pointer">
                  Auto save {autoSaveEnabled ? "ON" : "OFF"}
                </Label>
              </div>
              
              <Button
                variant="outline"
                onClick={() => setIsEditMode(!isEditMode)}
                data-testid="button-toggle-edit"
              >
                {isEditMode ? <Eye className="w-4 h-4 mr-2" /> : <EyeOff className="w-4 h-4 mr-2" />}
                {isEditMode ? "Aperçu" : "Modifier"}
              </Button>
              
              <select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as any)}
                className="border border-border rounded-md px-3 h-9 text-sm bg-background"
                data-testid="select-visibility"
              >
                <option value="private">Privée</option>
                <option value="account">Partagée (équipe)</option>
                <option value="client_ro">Partagée (client)</option>
              </select>
              
              {status === "draft" && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        onClick={handleSaveDraft} 
                        size="icon"
                        className="bg-green-50 hover:bg-green-100 text-green-700 border-green-200"
                        data-testid="button-save-draft"
                      >
                        <Save className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Enregistrer</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        onClick={handlePublish} 
                        size="icon"
                        data-testid="button-publish"
                      >
                        <Globe className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Publier</TooltipContent>
                  </Tooltip>
                </>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="destructive" 
                    onClick={handleDelete} 
                    size="icon"
                    data-testid="button-delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Supprimer</TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Project Selector */}
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Projet:</Label>
            <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={projectSelectorOpen}
                  className="justify-between min-w-[200px]"
                  data-testid="button-select-project"
                >
                  Sélectionner un projet
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[300px] p-0 bg-white dark:bg-background">
                <Command>
                  <CommandInput placeholder="Rechercher un projet..." />
                  <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                  <CommandGroup className="max-h-[300px] overflow-y-auto">
                    {projects.map((project) => (
                      <CommandItem
                        key={project.id}
                        onSelect={() => setProjectSelectorOpen(false)}
                        data-testid={`option-project-${project.id}`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{project.name}</div>
                          {project.description && (
                            <div className="text-xs text-muted-foreground truncate">
                              {project.description}
                            </div>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Editor */}
          <NoteEditor
            content={content}
            onChange={setContent}
            title={title}
            onTitleChange={setTitle}
            editable={isEditMode}
            placeholder="Commencez à écrire votre note..."
          />
        </div>
      </div>
    </div>
  );
}
