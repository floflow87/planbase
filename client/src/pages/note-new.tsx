import { useState, useCallback, useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Save, Trash2, Lock, LockOpen, Globe, Check, X, Star, ChevronDown, Users, Eye, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import NoteEditor, { type NoteEditorRef } from "@/components/NoteEditor";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { InsertNote, Project, Client } from "@shared/schema";
import { useDebounce } from "@/hooks/use-debounce";
import { VoiceRecordingButton } from "@/components/VoiceRecordingButton";

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
  const [clientSelectorOpen, setClientSelectorOpen] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [pendingClient, setPendingClient] = useState<Client | null>(null);

  // Stable ref for noteId to avoid autosave race conditions
  const noteIdRef = useRef<string | null>(null);
  const isCreatingRef = useRef(false);
  const pendingProjectIdRef = useRef<string | null>(null);
  const pendingClientIdRef = useRef<string | null>(null);

  // Editor ref for voice recording
  const editorRef = useRef<NoteEditorRef>(null);
  // Ref to track interim transcript length for deletion
  const interimLengthRef = useRef(0);

  // Memoized callbacks for voice recording to prevent re-renders
  const handleVoiceTranscript = useCallback((text: string, isFinal: boolean) => {
    if (!text) return;

    if (isFinal) {
      // Delete interim text if exists
      if (interimLengthRef.current > 0) {
        editorRef.current?.deleteLastCharacters(interimLengthRef.current);
        interimLengthRef.current = 0;
      }
      // Insert final text with space
      editorRef.current?.insertText(' ' + text);
    } else {
      // Delete previous interim text if exists
      if (interimLengthRef.current > 0) {
        editorRef.current?.deleteLastCharacters(interimLengthRef.current);
      }
      // Insert new interim text
      editorRef.current?.insertText(text);
      interimLengthRef.current = text.length;
    }
  }, []);

  const handleVoiceError = useCallback((error: string) => {
    toast({
      title: "Erreur de transcription",
      description: error,
      variant: "destructive",
    });
  }, [toast]);

  // Reset noteId ref on component mount
  useEffect(() => {
    noteIdRef.current = null;
    isCreatingRef.current = false;
  }, []);

  // Fetch projects for linking
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  // Fetch clients for linking
  const { data: clients = [] } = useQuery<Client[]>({
    queryKey: ["/api/clients"],
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
      noteIdRef.current = data.id;
      setNoteId(data.id);
      isCreatingRef.current = false;
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setLastSaved(new Date());
      setIsSaving(false);
      setIsManualSaving(false);
      
      // Link pending project/client (fire and forget)
      if (pendingProjectIdRef.current) {
        apiRequest("/api/entity-links", "POST", {
          sourceId: data.id,
          sourceType: "note",
          targetId: pendingProjectIdRef.current,
          targetType: "project",
        });
      }
      if (pendingClientIdRef.current) {
        apiRequest("/api/entity-links", "POST", {
          sourceId: data.id,
          sourceType: "note",
          targetId: pendingClientIdRef.current,
          targetType: "client",
        });
      }

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
                <div className="flex items-center gap-2 min-w-0 mb-2">
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="flex-1 min-w-0 text-xl font-bold bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground"
                    placeholder="Nouvelle note"
                    data-testid="input-note-title-header"
                    autoFocus
                  />
                  <Badge 
                    variant="outline" 
                    className={`shrink-0 ${
                      status === "draft" 
                        ? "bg-gray-100 text-gray-700 border-gray-200"
                        : status === "archived"
                        ? "bg-orange-50 text-orange-700 border-orange-200"
                        : "bg-green-50 text-green-700 border-green-200"
                    }`}
                  >
                    {status === "draft" ? "Brouillon" : status === "archived" ? "Archivée" : "Active"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* Project selector */}
                  <div className="flex items-center">
                    <Popover open={projectSelectorOpen} onOpenChange={setProjectSelectorOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${pendingProject ? 'rounded-r-none border-r-0' : ''}`}
                          data-testid="button-select-project"
                        >
                          <FolderKanban className="w-3 h-3 text-violet-500" />
                          <span className="truncate max-w-[100px]">
                            {pendingProject ? pendingProject.name : "Projet"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0 bg-white dark:bg-background" align="start">
                        <Command>
                          <CommandInput placeholder="Rechercher un projet..." />
                          <CommandEmpty>Aucun projet trouvé.</CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-y-auto">
                            {projects.map((project) => (
                              <CommandItem
                                key={project.id}
                                onSelect={() => {
                                  setPendingProject(project);
                                  pendingProjectIdRef.current = project.id;
                                  setProjectSelectorOpen(false);
                                }}
                                data-testid={`option-project-${project.id}`}
                              >
                                <Check className={`w-3 h-3 mr-2 ${pendingProject?.id === project.id ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="font-medium truncate">{project.name}</div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {pendingProject && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 rounded-l-none"
                        onClick={() => {
                          setPendingProject(null);
                          pendingProjectIdRef.current = null;
                        }}
                        data-testid="button-unselect-project"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {/* Client selector */}
                  <div className="flex items-center">
                    <Popover open={clientSelectorOpen} onOpenChange={setClientSelectorOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className={`h-6 px-2 text-xs gap-1 bg-white dark:bg-gray-900 ${pendingClient ? 'rounded-r-none border-r-0' : ''}`}
                          data-testid="button-select-client"
                        >
                          <Users className="w-3 h-3 text-cyan-500" />
                          <span className="truncate max-w-[100px]">
                            {pendingClient ? pendingClient.name : "Client"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[280px] p-0 bg-white dark:bg-background" align="start">
                        <Command>
                          <CommandInput placeholder="Rechercher un client..." />
                          <CommandEmpty>Aucun client trouvé.</CommandEmpty>
                          <CommandGroup className="max-h-[300px] overflow-y-auto">
                            {clients.map((client) => (
                              <CommandItem
                                key={client.id}
                                onSelect={() => {
                                  setPendingClient(client);
                                  pendingClientIdRef.current = client.id;
                                  setClientSelectorOpen(false);
                                }}
                                data-testid={`option-client-${client.id}`}
                              >
                                <Check className={`w-3 h-3 mr-2 ${pendingClient?.id === client.id ? 'opacity-100' : 'opacity-0'}`} />
                                <div className="font-medium truncate">{client.name}</div>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    {pendingClient && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-6 w-6 p-0 rounded-l-none"
                        onClick={() => {
                          setPendingClient(null);
                          pendingClientIdRef.current = null;
                        }}
                        data-testid="button-unselect-client"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  {/* Visibility + save status */}
                  
                  {/* Visibility Dropdown */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Badge 
                        variant="outline" 
                        className={`cursor-pointer hover-elevate ${
                          visibility === "private" 
                            ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                            : visibility === "account"
                            ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800"
                            : "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-800"
                        }`}
                        data-testid="badge-visibility"
                      >
                        {visibility === "private" ? (
                          <><Lock className="w-3 h-3 mr-1" />Privée</>
                        ) : visibility === "account" ? (
                          <><Users className="w-3 h-3 mr-1" />Équipe</>
                        ) : (
                          <><Eye className="w-3 h-3 mr-1" />Client</>
                        )}
                        <ChevronDown className="w-3 h-3 ml-1" />
                      </Badge>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      <DropdownMenuItem
                        onClick={() => setVisibility("private")}
                        data-testid="menu-item-visibility-private"
                      >
                        <Lock className="w-4 h-4 mr-2" />
                        Privée
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setVisibility("account")}
                        data-testid="menu-item-visibility-account"
                      >
                        <Users className="w-4 h-4 mr-2" />
                        Partagée (équipe)
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setVisibility("client_ro")}
                        data-testid="menu-item-visibility-client"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Partagée (client)
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
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
            <div className="flex items-center gap-2">
              {/* Auto Save Toggle */}
              <div className="flex items-center gap-2 mr-2">
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
              
              {/* Edit Mode Toggle - Lock Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsEditMode(!isEditMode)}
                    className="hover:bg-white dark:hover:bg-muted"
                    data-testid="button-toggle-edit"
                  >
                    {isEditMode ? <LockOpen className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isEditMode ? "Verrouiller (mode lecture)" : "Déverrouiller (mode édition)"}</TooltipContent>
              </Tooltip>
              
              {/* Favorite Button - Star Icon */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="icon"
                    disabled
                    className="hover:bg-white dark:hover:bg-muted opacity-50"
                    data-testid="button-toggle-favorite"
                  >
                    <Star className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Enregistrer d'abord pour ajouter aux favoris</TooltipContent>
              </Tooltip>
              
              {status === "draft" && (
                <>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        variant="outline" 
                        onClick={handleSaveDraft} 
                        size="icon"
                        className="bg-green-50 hover:bg-white dark:hover:bg-muted text-green-700 border-green-200"
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

        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {/* Editor */}
          <NoteEditor
            ref={editorRef}
            content={content}
            onChange={setContent}
            editable={isEditMode}
          />
        </div>
      </div>

      {/* Voice Recording Button */}
      {isEditMode && (
        <VoiceRecordingButton
          onTranscript={handleVoiceTranscript}
          onError={handleVoiceError}
        />
      )}
    </div>
  );
}
