import { Search, Filter, Settings as SettingsIcon, Download, LayoutGrid, List, Table2, Plus, Sparkles, File, FileText, Trash2, MoreVertical, CheckCircle2, Copy, Globe, GripVertical, ArrowUp, ArrowDown, ArrowUpDown, Star, Settings2, FolderKanban, ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Loader } from "@/components/Loader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, optimisticAdd, optimisticUpdate, optimisticDelete, rollbackOptimistic, queryClient as qc } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { useState, useMemo, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import type { Note, AppUser, Project, NoteLink, NoteCategory } from "@shared/schema";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tag } from "lucide-react";
import { PermissionGuard, Can, ReadOnlyBadge } from "@/components/Can";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDistanceToNow, format, isAfter, isBefore, isEqual, startOfDay, endOfDay } from "date-fns";
import { fr } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { X } from "lucide-react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Sortable column header component
interface SortableNoteColumnHeaderProps {
  id: string;
  label: string;
  className?: string;
  isDraggable?: boolean;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  isSortable?: boolean;
  children?: React.ReactNode;
}

function SortableNoteColumnHeader({
  id,
  label,
  className = '',
  isDraggable = true,
  sortColumn,
  sortDirection,
  onSort,
  isSortable = true,
  children,
}: SortableNoteColumnHeaderProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    disabled: !isDraggable,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const isActive = sortColumn === id;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex-1 min-w-0 flex items-center gap-1 ${isDraggable ? 'cursor-move' : ''} ${className}`}
    >
      {isDraggable && (
        <GripVertical className="h-3 w-3 text-muted-foreground flex-shrink-0" {...attributes} {...listeners} />
      )}
      {children ? (
        children
      ) : (
        <>
          <span className="truncate">{label}</span>
          {isSortable && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSort(id);
              }}
              className="p-0.5 hover:bg-muted rounded flex-shrink-0"
              data-testid={`sort-note-${id}`}
            >
              {isActive ? (
                sortDirection === 'asc' ? (
                  <ArrowUp className="h-3 w-3 text-primary" />
                ) : (
                  <ArrowDown className="h-3 w-3 text-primary" />
                )
              ) : (
                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
              )}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function Notes() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can: canDo } = usePermissions();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "draft" | "active" | "archived">("all");
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteNoteId, setDeleteNoteId] = useState<string | null>(null);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [bulkPublishDialogOpen, setBulkPublishDialogOpen] = useState(false);
  const [quickAddNoteTitle, setQuickAddNoteTitle] = useState("");
  const [isQuickAddingNote, setIsQuickAddingNote] = useState(false);
  const [pageSize, setPageSize] = useState(() => {
    const saved = localStorage.getItem('noteListPageSize');
    return saved ? parseInt(saved) : 20;
  });
  const [currentPage, setCurrentPage] = useState(1);
  
  // Group by state with localStorage persistence
  const [groupBy, setGroupBy] = useState<"none" | "project" | "status" | "visibility" | "favorite" | "tag">(() => {
    const saved = localStorage.getItem('noteListGroupBy');
    return (saved as "none" | "project" | "status" | "visibility" | "favorite" | "tag") || "none";
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  
  // Advanced filter panel state with localStorage persistence
  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterByTag, setFilterByTag] = useState<string | null>(() => {
    const saved = localStorage.getItem('notesFilterByTag');
    return saved ? JSON.parse(saved) : null;
  });
  const [filterByProject, setFilterByProject] = useState<string | null>(() => {
    const saved = localStorage.getItem('notesFilterByProject');
    return saved ? JSON.parse(saved) : null;
  });
  const [filterDateFrom, setFilterDateFrom] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem('notesFilterDateFrom');
    if (saved && saved !== 'null') {
      const parsed = JSON.parse(saved);
      if (parsed) {
        const date = new Date(parsed);
        return isNaN(date.getTime()) ? undefined : date;
      }
    }
    return undefined;
  });
  const [filterDateTo, setFilterDateTo] = useState<Date | undefined>(() => {
    const saved = localStorage.getItem('notesFilterDateTo');
    if (saved && saved !== 'null') {
      const parsed = JSON.parse(saved);
      if (parsed) {
        const date = new Date(parsed);
        return isNaN(date.getTime()) ? undefined : date;
      }
    }
    return undefined;
  });
  const [filterByVisibility, setFilterByVisibility] = useState<"all" | "public" | "private">(() => {
    const saved = localStorage.getItem('notesFilterByVisibility');
    return saved ? JSON.parse(saved) : "all";
  });

  // Persist filters to localStorage
  useEffect(() => {
    localStorage.setItem('notesFilterByTag', JSON.stringify(filterByTag));
  }, [filterByTag]);
  
  useEffect(() => {
    localStorage.setItem('notesFilterByProject', JSON.stringify(filterByProject));
  }, [filterByProject]);
  
  useEffect(() => {
    localStorage.setItem('notesFilterDateFrom', JSON.stringify(filterDateFrom ? filterDateFrom.toISOString() : null));
  }, [filterDateFrom]);
  
  useEffect(() => {
    localStorage.setItem('notesFilterDateTo', JSON.stringify(filterDateTo ? filterDateTo.toISOString() : null));
  }, [filterDateTo]);
  
  useEffect(() => {
    localStorage.setItem('notesFilterByVisibility', JSON.stringify(filterByVisibility));
  }, [filterByVisibility]);
  
  // Column order and sorting state with localStorage persistence
  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    const saved = localStorage.getItem('noteListColumnOrder');
    const defaultOrder = ['checkbox', 'favorite', 'title', 'tag', 'status', 'visibility', 'createdAt', 'updatedAt', 'project', 'actions'];
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure 'favorite' is included for existing users
      if (!parsed.includes('favorite')) {
        const checkboxIdx = parsed.indexOf('checkbox');
        parsed.splice(checkboxIdx + 1, 0, 'favorite');
      }
      // Ensure 'tag' is included for existing users
      if (!parsed.includes('tag')) {
        const titleIdx = parsed.indexOf('title');
        parsed.splice(titleIdx + 1, 0, 'tag');
      }
      return parsed;
    }
    return defaultOrder;
  });
  const [sortColumn, setSortColumn] = useState<string>(() => {
    const saved = localStorage.getItem('noteListSortColumn');
    return saved || 'updatedAt';
  });
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(() => {
    const saved = localStorage.getItem('noteListSortDirection');
    return (saved as 'asc' | 'desc') || 'desc';
  });
  const [activeColumnId, setActiveColumnId] = useState<string | null>(null);
  const [isColumnSettingsOpen, setIsColumnSettingsOpen] = useState(false);
  
  // Column visibility state with localStorage persistence
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const saved = localStorage.getItem('noteColumnVisibility');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure 'tag' is included for existing users, default hidden createdAt
      if (parsed.tag === undefined) {
        parsed.tag = true;
      }
      return parsed;
    }
    return {
      favorite: true,
      title: true,
      tag: true,
      status: true,
      visibility: true,
      createdAt: false, // Hidden by default
      updatedAt: true,
      project: true,
    };
  });

  // Sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Save column order to localStorage
  useEffect(() => {
    localStorage.setItem('noteListColumnOrder', JSON.stringify(columnOrder));
  }, [columnOrder]);

  // Save sort settings to localStorage
  useEffect(() => {
    localStorage.setItem('noteListSortColumn', sortColumn);
    localStorage.setItem('noteListSortDirection', sortDirection);
  }, [sortColumn, sortDirection]);

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveColumnId(null);
    
    if (over && active.id !== over.id) {
      const oldIndex = columnOrder.indexOf(active.id as string);
      const newIndex = columnOrder.indexOf(over.id as string);
      setColumnOrder(arrayMove(columnOrder, oldIndex, newIndex));
    }
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["/api/notes"],
  });

  const { data: users = [] } = useQuery<AppUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: noteLinks = [] } = useQuery<NoteLink[]>({
    queryKey: ["/api/note-links"],
  });

  const { data: noteCategories = [] } = useQuery<NoteCategory[]>({
    queryKey: ["/api/note-categories"],
  });

  // Update note category mutation with optimistic update
  const updateNoteCategoryMutation = useMutation({
    mutationFn: async ({ noteId, categoryId }: { noteId: string; categoryId: string | null }) => {
      const response = await apiRequest(`/api/notes/${noteId}`, "PATCH", { categoryId });
      return await response.json();
    },
    onMutate: async ({ noteId, categoryId }) => {
      await queryClient.cancelQueries({ queryKey: ["/api/notes"] });
      const previousNotes = queryClient.getQueryData<Note[]>(["/api/notes"]);
      queryClient.setQueryData<Note[]>(["/api/notes"], (old) => 
        old?.map(note => note.id === noteId ? { ...note, categoryId } : note) || []
      );
      return { previousNotes };
    },
    onError: (err, variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(["/api/notes"], context.previousNotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

  // Create note category mutation
  const createCategoryMutation = useMutation({
    mutationFn: async (name: string) => {
      const response = await apiRequest("/api/note-categories", "POST", { name });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/note-categories"] });
    },
  });

  // Save pageSize to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('noteListPageSize', pageSize.toString());
  }, [pageSize]);
  
  // Save groupBy to localStorage when it changes and reset collapsed groups
  useEffect(() => {
    localStorage.setItem('noteListGroupBy', groupBy);
    setCollapsedGroups(new Set()); // Reset collapsed state when grouping changes
  }, [groupBy]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, pageSize]);

  // Helper function to get linked project for sorting
  const getLinkedProjectForSort = (noteId: string): Project | null => {
    const projectLink = noteLinks.find(
      (link) => link.noteId === noteId && link.targetType === "project"
    );
    if (!projectLink) return null;
    return projects.find((p) => p.id === projectLink.targetId) || null;
  };

  // Filter and search notes
  const filteredNotes = useMemo(() => {
    // Clone the notes array to avoid mutating the cache
    let result = [...notes];

    // Filter by status
    if (statusFilter !== "all") {
      result = result.filter((note) => note.status === statusFilter);
    }

    // Search by title or plainText
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (note) =>
          note.title.toLowerCase().includes(query) ||
          note.plainText?.toLowerCase().includes(query) ||
          note.summary?.toLowerCase().includes(query)
      );
    }
    
    // Advanced filters
    // Filter by tag
    if (filterByTag) {
      result = result.filter((note) => note.categoryId === filterByTag);
    }
    
    // Filter by project
    if (filterByProject) {
      const notesWithProject = noteLinks
        .filter((link) => link.targetType === "project" && link.targetId === filterByProject)
        .map((link) => link.noteId);
      result = result.filter((note) => notesWithProject.includes(note.id));
    }
    
    // Filter by visibility
    if (filterByVisibility !== "all") {
      result = result.filter((note) => note.visibility === filterByVisibility);
    }
    
    // Filter by date range (noteDate field)
    if (filterDateFrom) {
      result = result.filter((note) => {
        if (!note.noteDate) return false;
        const noteDate = startOfDay(new Date(note.noteDate));
        const fromDate = startOfDay(filterDateFrom);
        return isAfter(noteDate, fromDate) || isEqual(noteDate, fromDate);
      });
    }
    
    if (filterDateTo) {
      result = result.filter((note) => {
        if (!note.noteDate) return false;
        const noteDate = startOfDay(new Date(note.noteDate));
        const toDate = startOfDay(filterDateTo);
        return isBefore(noteDate, toDate) || isEqual(noteDate, toDate);
      });
    }

    // Sort by selected column, but favorites always come first (sorted alphabetically among themselves)
    return result.sort((a, b) => {
      // Favorites always first
      const aFavorite = a.isFavorite || false;
      const bFavorite = b.isFavorite || false;
      
      if (aFavorite !== bFavorite) {
        return aFavorite ? -1 : 1;
      }
      
      // If both are favorites, sort alphabetically by title
      if (aFavorite && bFavorite) {
        return (a.title || '').localeCompare(b.title || '');
      }
      
      // Normal sorting for non-favorites
      let comparison = 0;
      
      switch (sortColumn) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'visibility':
          comparison = (a.visibility || '').localeCompare(b.visibility || '');
          break;
        case 'tag':
          const tagA = a.categoryId ? noteCategories.find(c => c.id === a.categoryId)?.name || '' : '';
          const tagB = b.categoryId ? noteCategories.find(c => c.id === b.categoryId)?.name || '' : '';
          comparison = tagA.localeCompare(tagB);
          break;
        case 'createdAt':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'project':
          const projectA = getLinkedProjectForSort(a.id)?.name || '';
          const projectB = getLinkedProjectForSort(b.id)?.name || '';
          comparison = projectA.localeCompare(projectB);
          break;
        default:
          comparison = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [notes, searchQuery, statusFilter, sortColumn, sortDirection, noteLinks, projects, filterByTag, filterByProject, filterByVisibility, filterDateFrom, filterDateTo, noteCategories]);

  // Pagination
  const totalPages = Math.ceil(filteredNotes.length / pageSize);
  const paginatedNotes = useMemo(() => {
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    return filteredNotes.slice(startIdx, endIdx);
  }, [filteredNotes, currentPage, pageSize]);
  
  // Group notes by column
  type GroupedNotes = {
    groupKey: string;
    groupName: string;
    projectId: string | null;
    notes: Note[];
  }[];
  
  // Helper function to get group info based on groupBy type
  const getGroupInfo = (note: Note, currentGroupBy: typeof groupBy): { key: string; name: string } => {
    switch (currentGroupBy) {
      case "project": {
        const project = getLinkedProjectForSort(note.id);
        return {
          key: project?.id || "no-project",
          name: project?.name || "Sans projet",
        };
      }
      case "status": {
        const statusLabels: Record<string, string> = {
          draft: "Brouillons",
          active: "Publiées",
          archived: "Archivées",
        };
        return {
          key: note.status || "active",
          name: statusLabels[note.status || "active"] || "Publiées",
        };
      }
      case "visibility": {
        const visibilityLabels: Record<string, string> = {
          private: "Privées",
          shared: "Partagées",
          public: "Publiques",
        };
        return {
          key: note.visibility || "private",
          name: visibilityLabels[note.visibility || "private"] || "Privées",
        };
      }
      case "favorite": {
        const isFav = note.isFavorite || false;
        return {
          key: isFav ? "favorite" : "not-favorite",
          name: isFav ? "Favoris" : "Autres notes",
        };
      }
      case "tag": {
        const category = note.categoryId ? noteCategories.find(c => c.id === note.categoryId) : null;
        return {
          key: category?.id || "no-tag",
          name: category?.name || "Sans tag",
        };
      }
      case "none":
        // "none" means no grouping - return generic key
        return { key: "all", name: "" };
    }
  };
  
  const groupedNotes = useMemo<GroupedNotes>(() => {
    if (groupBy === "none") {
      return [{ groupKey: "all", groupName: "", projectId: null, notes: paginatedNotes }];
    }
    
    const groups = new Map<string, { name: string; projectId: string | null; notes: Note[] }>();
    
    paginatedNotes.forEach((note) => {
      const { key: groupKey, name: groupName } = getGroupInfo(note, groupBy);
      const project = groupBy === "project" ? getLinkedProjectForSort(note.id) : null;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { name: groupName, projectId: project?.id || null, notes: [] });
      }
      groups.get(groupKey)!.notes.push(note);
    });
    
    // Define sort order based on group type
    const getSortPriority = (key: string): number => {
      if (groupBy === "project") {
        return key === "no-project" ? 999 : 0;
      }
      if (groupBy === "status") {
        const statusOrder: Record<string, number> = { active: 0, draft: 1, archived: 2 };
        return statusOrder[key] ?? 99;
      }
      if (groupBy === "visibility") {
        const visOrder: Record<string, number> = { private: 0, shared: 1, public: 2 };
        return visOrder[key] ?? 99;
      }
      if (groupBy === "favorite") {
        return key === "favorite" ? 0 : 1;
      }
      if (groupBy === "tag") {
        return key === "no-tag" ? 999 : 0;
      }
      return 0;
    };
    
    return Array.from(groups.entries())
      .sort(([keyA, a], [keyB, b]) => {
        const priorityA = getSortPriority(keyA);
        const priorityB = getSortPriority(keyB);
        if (priorityA !== priorityB) return priorityA - priorityB;
        return a.name.localeCompare(b.name);
      })
      .map(([key, group]) => ({
        groupKey: key,
        groupName: group.name,
        projectId: group.projectId,
        notes: group.notes,
      }));
  }, [paginatedNotes, groupBy, noteLinks, projects]);
  
  const toggleGroupCollapse = (groupKey: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  const getUserById = (userId: string) => {
    return users.find((u) => u.id === userId);
  };

  const getLinkedProject = (noteId: string) => {
    const projectLink = noteLinks.find(
      (link) => link.noteId === noteId && link.targetType === "project"
    );
    if (!projectLink) return null;
    return projects.find((p) => p.id === projectLink.targetId);
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      draft: "bg-gray-100 text-gray-700 border-gray-200",
      active: "bg-green-50 text-green-700 border-green-200",
      archived: "bg-orange-50 text-orange-700 border-orange-200",
    };
    return variants[status as keyof typeof variants] || variants.active;
  };

  const toggleNoteSelection = (noteId: string) => {
    const newSelection = new Set(selectedNotes);
    if (newSelection.has(noteId)) {
      newSelection.delete(noteId);
    } else {
      newSelection.add(noteId);
    }
    setSelectedNotes(newSelection);
  };

  const toggleAllNotes = () => {
    if (selectedNotes.size === filteredNotes.length) {
      setSelectedNotes(new Set());
    } else {
      setSelectedNotes(new Set(filteredNotes.map(n => n.id)));
    }
  };

  const updateNoteMutation = useMutation({
    mutationFn: async ({ noteId, data }: { noteId: string; data: Partial<Note> }) => {
      return apiRequest(`/api/notes/${noteId}`, "PATCH", data);
    },
    onMutate: async ({ noteId, data }) => {
      const { previousData } = optimisticUpdate<Note>(["/api/notes"], noteId, data);
      return { previousData };
    },
    onError: (error: any, variables, context) => {
      if (context?.previousData) {
        rollbackOptimistic(["/api/notes"], context.previousData);
      }
      toast({
        title: "Erreur",
        description: error.message || "Impossible de mettre à jour la note",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/note-links"] });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      return apiRequest(`/api/notes/${noteId}`, "DELETE");
    },
    onMutate: async (noteId) => {
      const { previousData } = optimisticDelete<Note>(["/api/notes"], noteId);
      return { previousData };
    },
    onSuccess: () => {
      toast({
        title: "Note supprimée",
        description: "La note a été supprimée avec succès",
        variant: "success",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousData) {
        rollbackOptimistic(["/api/notes"], context.previousData);
      }
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la note",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

  const duplicateNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await apiRequest(`/api/notes/${noteId}/duplicate`, "POST");
      return await response.json();
    },
    onSuccess: (duplicatedNote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      toast({
        title: "Note dupliquée",
        description: "La note a été dupliquée avec succès",
        variant: "success",
      });
      navigate(`/notes/${duplicatedNote.id}`);
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de dupliquer la note",
        variant: "destructive",
      });
    },
  });

  const bulkPublishMutation = useMutation({
    mutationFn: async (noteIds: string[]) => {
      return Promise.all(noteIds.map(id => 
        apiRequest(`/api/notes/${id}`, "PATCH", { status: "active" })
      ));
    },
    onMutate: async (noteIds) => {
      qc.cancelQueries({ queryKey: ["/api/notes"] });
      const previousData = qc.getQueryData<Note[]>(["/api/notes"]);
      qc.setQueryData<Note[]>(["/api/notes"], (old) => {
        if (!old) return old;
        return old.map(note => 
          noteIds.includes(note.id) ? { ...note, status: "active" } : note
        );
      });
      return { previousData };
    },
    onSuccess: () => {
      setSelectedNotes(new Set());
      toast({
        title: "Notes publiées",
        description: `${selectedNotes.size} note(s) ont été publiées`,
        variant: "success",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousData) {
        rollbackOptimistic(["/api/notes"], context.previousData);
      }
      toast({
        title: "Erreur",
        description: error.message || "Impossible de publier les notes",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (noteIds: string[]) => {
      return Promise.all(noteIds.map(id => 
        apiRequest(`/api/notes/${id}`, "DELETE")
      ));
    },
    onMutate: async (noteIds) => {
      qc.cancelQueries({ queryKey: ["/api/notes"] });
      const previousData = qc.getQueryData<Note[]>(["/api/notes"]);
      qc.setQueryData<Note[]>(["/api/notes"], (old) => {
        if (!old) return old;
        return old.filter(note => !noteIds.includes(note.id));
      });
      return { previousData };
    },
    onSuccess: () => {
      setSelectedNotes(new Set());
      toast({
        title: "Notes supprimées",
        description: `${selectedNotes.size} note(s) ont été supprimées`,
        variant: "success",
      });
    },
    onError: (error: any, variables, context) => {
      if (context?.previousData) {
        rollbackOptimistic(["/api/notes"], context.previousData);
      }
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer les notes",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
  });

  const handleDeleteNote = (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteNoteId(noteId);
    setDeleteDialogOpen(true);
  };

  const handleDuplicateNote = (noteId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    duplicateNoteMutation.mutate(noteId);
  };

  const confirmDeleteNote = () => {
    if (deleteNoteId) {
      deleteNoteMutation.mutate(deleteNoteId);
      setDeleteDialogOpen(false);
      setDeleteNoteId(null);
    }
  };

  const handleBulkPublish = () => {
    if (selectedNotes.size === 0) return;
    setBulkPublishDialogOpen(true);
  };

  const confirmBulkPublish = () => {
    bulkPublishMutation.mutate(Array.from(selectedNotes));
    setBulkPublishDialogOpen(false);
  };

  const handleBulkDelete = () => {
    if (selectedNotes.size === 0) return;
    setBulkDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    bulkDeleteMutation.mutate(Array.from(selectedNotes));
    setBulkDeleteDialogOpen(false);
  };

  const linkProjectMutation = useMutation({
    mutationFn: async ({ noteId, projectId }: { noteId: string; projectId: string | null }) => {
      if (projectId === null) {
        // Remove existing link
        const existingLink = noteLinks.find(
          (link) => link.noteId === noteId && link.targetType === "project"
        );
        if (existingLink) {
          return apiRequest(`/api/notes/${noteId}/links/${existingLink.targetType}/${existingLink.targetId}`, "DELETE");
        }
      } else {
        // Create or update link
        return apiRequest(`/api/notes/${noteId}/links`, "POST", {
          targetType: "project",
          targetId: projectId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/note-links"] });
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de lier le projet",
        variant: "destructive",
      });
    },
  });

  const createNoteMutation = useMutation({
    mutationFn: async (title: string) => {
      const response = await apiRequest("/api/notes", "POST", {
        title,
        content: { type: 'doc', content: [] },
        plainText: "",
        status: "draft",
        visibility: "private",
      });
      return await response.json();
    },
    onSuccess: (newNote) => {
      queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
      setQuickAddNoteTitle("");
      setIsQuickAddingNote(false);
      toast({
        title: "Note créée",
        description: "La note a été créée avec succès",
        variant: "success",
      });
      navigate(`/notes/${newNote.id}`);
    },
    onError: (error: any) => {
      setIsQuickAddingNote(false);
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la note",
        variant: "destructive",
      });
    },
  });

  return (
    <PermissionGuard module="notes" action="read">
    <div className="h-full overflow-y-auto overflow-x-hidden bg-[#F8FAFC] dark:bg-background">
      <div className="p-6 space-y-6" data-testid="notes-list">
        <div className="flex items-center justify-between">
          <ReadOnlyBadge module="notes" />
        </div>
        {/* Filters & Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          {/* Mobile: Single row with search, new button, and filter */}
          <div className="flex md:hidden items-center gap-2 w-full">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                className="pl-9 w-full"
                data-testid="input-rechercher-mobile"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Can module="notes" action="create">
              <Link href="/notes/new">
                <Button size="icon" data-testid="button-nouvelle-note-mobile">
                  <Plus className="w-4 h-4" />
                </Button>
              </Link>
            </Can>
            <select
              className="border border-border rounded-md px-2 h-9 text-sm bg-card"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              data-testid="select-status-filter-mobile"
            >
              <option value="all">Tous</option>
              <option value="draft">Brouillons</option>
              <option value="active">Publiées</option>
              <option value="archived">Archivées</option>
            </select>
          </div>
          
          {/* Desktop: Original layout */}
          <div className="hidden md:flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher dans les notes..."
                className="pl-9 w-64"
                data-testid="input-rechercher"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <select
              className="border border-border rounded-md px-3 h-9 text-sm bg-card"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              data-testid="select-status-filter"
            >
              <option value="all">Tous les statuts</option>
              <option value="draft">Brouillons</option>
              <option value="active">Publiées</option>
              <option value="archived">Archivées</option>
            </select>
            <select
              className="border border-border rounded-md px-3 h-9 text-sm bg-card"
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as any)}
              data-testid="select-group-by"
            >
              <option value="none">Sans groupage</option>
              <option value="project">Par projet</option>
              <option value="status">Par statut</option>
              <option value="visibility">Par visibilité</option>
              <option value="favorite">Par favoris</option>
              <option value="tag">Par tag</option>
            </select>
            <Button
              variant={showFilterPanel ? "default" : "outline"}
              size="sm"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              data-testid="button-advanced-filters"
              className="gap-1"
            >
              <Filter className="w-4 h-4" />
              Filtres
              {(filterByTag || filterByProject || filterByVisibility !== "all" || filterDateFrom || filterDateTo) && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {[filterByTag, filterByProject, filterByVisibility !== "all", filterDateFrom, filterDateTo].filter(Boolean).length}
                </Badge>
              )}
            </Button>
          </div>
          
          <div className="hidden md:flex items-center gap-2">
            {selectedNotes.size > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-actions">
                    <MoreVertical className="w-4 h-4 mr-2" />
                    Actions ({selectedNotes.size})
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={handleBulkPublish}
                    disabled={bulkPublishMutation.isPending}
                    data-testid="dropdown-bulk-publish"
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Publier
                  </DropdownMenuItem>
                  {canDo("notes", "delete") && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={handleBulkDelete}
                        disabled={bulkDeleteMutation.isPending}
                        className="text-destructive"
                        data-testid="dropdown-bulk-delete"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsColumnSettingsOpen(true)}
              data-testid="button-column-settings"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
            <Can module="notes" action="create">
              <Link href="/notes/new">
                <Button className="gap-2 text-[12px]" data-testid="button-nouvelle-note">
                  <Plus className="w-4 h-4" />
                  Nouvelle note
                </Button>
              </Link>
            </Can>
          </div>
        </div>

        {/* Advanced Filter Drawer */}
        <Sheet open={showFilterPanel} onOpenChange={setShowFilterPanel}>
          <SheetContent side="right" className="w-[320px] bg-white dark:bg-gray-900" data-testid="filter-panel">
            <SheetHeader>
              <SheetTitle className="flex items-center justify-between">
                <span>Filtres avancés</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilterByTag(null);
                    setFilterByProject(null);
                    setFilterByVisibility("all");
                    setFilterDateFrom(undefined);
                    setFilterDateTo(undefined);
                  }}
                  className="text-xs text-muted-foreground"
                  data-testid="button-clear-all-filters"
                >
                  Tout effacer
                </Button>
              </SheetTitle>
            </SheetHeader>
            
            <div className="space-y-6 mt-6">
              {/* Filter by Tag */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tag</Label>
                <Select
                  value={filterByTag || "all"}
                  onValueChange={(value) => setFilterByTag(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-gray-900" data-testid="select-filter-tag">
                    <SelectValue placeholder="Tous les tags" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900">
                    <SelectItem value="all">Tous les tags</SelectItem>
                    {noteCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-2 h-2 rounded-full" 
                            style={{ backgroundColor: category.color || '#6B7280' }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filter by Project */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Projet</Label>
                <Select
                  value={filterByProject || "all"}
                  onValueChange={(value) => setFilterByProject(value === "all" ? null : value)}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-gray-900" data-testid="select-filter-project">
                    <SelectValue placeholder="Tous les projets" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900">
                    <SelectItem value="all">Tous les projets</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filter by Visibility */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Visibilité</Label>
                <Select
                  value={filterByVisibility}
                  onValueChange={(value) => setFilterByVisibility(value as "all" | "public" | "private")}
                >
                  <SelectTrigger className="w-full bg-white dark:bg-gray-900" data-testid="select-filter-visibility">
                    <SelectValue placeholder="Toutes" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-900">
                    <SelectItem value="all">Toutes</SelectItem>
                    <SelectItem value="public">Publiques</SelectItem>
                    <SelectItem value="private">Privées</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filter by Date From */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Date de début</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-white dark:bg-gray-900"
                      data-testid="button-filter-date-from"
                    >
                      {filterDateFrom ? format(filterDateFrom, "dd MMM yyyy", { locale: fr }) : "Sélectionner..."}
                      {filterDateFrom && (
                        <X 
                          className="w-3 h-3 ml-auto" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterDateFrom(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDateFrom}
                      onSelect={setFilterDateFrom}
                      locale={fr}
                      classNames={{
                        day_selected: "bg-violet-600 text-white hover:bg-violet-700 focus:bg-violet-700",
                        day_today: "bg-accent text-accent-foreground",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              
              {/* Filter by Date To */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Date de fin</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal bg-white dark:bg-gray-900"
                      data-testid="button-filter-date-to"
                    >
                      {filterDateTo ? format(filterDateTo, "dd MMM yyyy", { locale: fr }) : "Sélectionner..."}
                      {filterDateTo && (
                        <X 
                          className="w-3 h-3 ml-auto" 
                          onClick={(e) => {
                            e.stopPropagation();
                            setFilterDateTo(undefined);
                          }}
                        />
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-white dark:bg-gray-900" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDateTo}
                      onSelect={setFilterDateTo}
                      locale={fr}
                      classNames={{
                        day_selected: "bg-violet-600 text-white hover:bg-violet-700 focus:bg-violet-700",
                        day_today: "bg-accent text-accent-foreground",
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {/* Notes List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader size="md" text="Chargement des notes..." />
          </div>
        ) : (
          <>
          {/* Mobile Card View - visible only on mobile */}
          <div className="md:hidden space-y-3">
            {filteredNotes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  {notes.length === 0 
                    ? "Aucune note disponible. Cliquez sur \"Nouvelle note\" pour commencer."
                    : "Aucune note ne correspond à votre recherche."}
                </CardContent>
              </Card>
            ) : (
              <>
                {paginatedNotes.map((note) => {
                  const linkedProject = getLinkedProject(note.id);
                  
                  return (
                    <Card 
                      key={note.id}
                      className="hover-elevate"
                      data-testid={`card-note-${note.id}`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <Checkbox
                              checked={selectedNotes.has(note.id)}
                              onCheckedChange={() => toggleNoteSelection(note.id)}
                              className="mt-1 flex-shrink-0"
                              data-testid={`checkbox-note-mobile-${note.id}`}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateNoteMutation.mutate({
                                      noteId: note.id,
                                      data: { isFavorite: !note.isFavorite }
                                    });
                                  }}
                                  className="flex-shrink-0"
                                  data-testid={`button-favorite-mobile-${note.id}`}
                                >
                                  <Star 
                                    className={`h-4 w-4 ${
                                      note.isFavorite 
                                        ? 'fill-yellow-400 text-yellow-400' 
                                        : 'text-muted-foreground'
                                    }`}
                                  />
                                </button>
                                <h3 
                                  className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                                  onClick={() => navigate(`/notes/${note.id}`)}
                                >
                                  {note.title || "Sans titre"}
                                </h3>
                              </div>
                              {note.summary && (
                                <p className="text-xs text-muted-foreground mt-1 truncate flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate">{note.summary}</span>
                                </p>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 flex-shrink-0"
                                data-testid={`button-actions-note-mobile-${note.id}`}
                              >
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" >
                              <DropdownMenuItem 
                                onClick={() => navigate(`/notes/${note.id}`)}
                                data-testid={`button-open-note-mobile-${note.id}`}
                              >
                                <FileText className="w-4 h-4 mr-2" />
                                Ouvrir
                              </DropdownMenuItem>
                              <DropdownMenuItem 
                                onClick={() => handleDuplicateNote(note.id)}
                                data-testid={`button-duplicate-note-mobile-${note.id}`}
                              >
                                <Copy className="w-4 h-4 mr-2" />
                                Dupliquer
                              </DropdownMenuItem>
                              {canDo("notes", "delete") && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDeleteNote(note.id)}
                                    className="text-destructive"
                                    data-testid={`button-delete-note-mobile-${note.id}`}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Supprimer
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              note.status === "draft"
                                ? "bg-gray-50 text-gray-700 border-gray-200"
                                : note.status === "active"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-orange-50 text-orange-700 border-orange-200"
                            }`}
                          >
                            {note.status === "draft" ? "Brouillon" : note.status === "active" ? "Publiée" : "Archivée"}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              note.visibility === "private"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : note.visibility === "account"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-cyan-50 text-cyan-700 border-cyan-200"
                            }`}
                          >
                            {note.visibility === "private" ? "Privée" : note.visibility === "account" ? "Équipe" : "Client"}
                          </Badge>
                          {linkedProject && (
                            <Badge variant="outline" className="text-[10px] bg-card text-violet-700 border-violet-200">
                              {linkedProject.name}
                            </Badge>
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between mt-3 pt-3 border-t text-xs text-muted-foreground">
                          <span>{format(new Date(note.createdAt), "d MMM yyyy", { locale: fr })}</span>
                          <span>{formatDistanceToNow(new Date(note.updatedAt), { addSuffix: true, locale: fr })}</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                
                {/* Quick add on mobile */}
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2">
                      <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <Input
                        placeholder="Créer une nouvelle note..."
                        value={quickAddNoteTitle}
                        onChange={(e) => setQuickAddNoteTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && quickAddNoteTitle.trim()) {
                            setIsQuickAddingNote(true);
                            createNoteMutation.mutate(quickAddNoteTitle.trim());
                          } else if (e.key === "Escape") {
                            setQuickAddNoteTitle("");
                          }
                        }}
                        disabled={isQuickAddingNote}
                        className="border-0 focus-visible:ring-0 text-sm h-8"
                        data-testid="input-quick-add-note-mobile"
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
          
          {/* Desktop Table View - hidden on mobile */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event) => setActiveColumnId(event.active.id as string)}
            onDragEnd={handleColumnDragEnd}
          >
          <div className="hidden md:block border border-border rounded-md overflow-hidden bg-card">
            {/* Table Header */}
            <div className="bg-muted/50 border-b border-border px-4 py-2.5">
              <SortableContext
                items={columnOrder.filter(id => id !== 'checkbox' && id !== 'favorite' && id !== 'actions')}
                strategy={horizontalListSortingStrategy}
              >
                <div className="flex items-center gap-4 text-[11px] font-medium text-muted-foreground">
                  {/* Fixed checkbox column */}
                  <div className="w-8 flex-shrink-0 flex items-center">
                    <Checkbox
                      checked={filteredNotes.length > 0 && selectedNotes.size === filteredNotes.length}
                      onCheckedChange={toggleAllNotes}
                      data-testid="checkbox-select-all"
                    />
                  </div>
                  
                  {/* Fixed favorite column */}
                  {columnVisibility['favorite'] !== false && (
                    <div className="w-8 flex-shrink-0 flex items-center justify-center">
                      <Star className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Dynamic columns */}
                  {columnOrder.filter(col => 
                    col !== 'checkbox' && 
                    col !== 'favorite' && 
                    col !== 'actions' && 
                    columnVisibility[col] !== false
                  ).map((columnId) => {
                    const columnConfig: Record<string, { label: string; isSortable: boolean; isDraggable: boolean }> = {
                      title: { label: 'Titre', isSortable: true, isDraggable: true },
                      tag: { label: 'Tag', isSortable: true, isDraggable: true },
                      status: { label: 'Statut', isSortable: true, isDraggable: true },
                      visibility: { label: 'Visibilité', isSortable: true, isDraggable: true },
                      createdAt: { label: 'Date de création', isSortable: true, isDraggable: true },
                      updatedAt: { label: 'Dernière modification', isSortable: true, isDraggable: true },
                      project: { label: 'Projet rattaché', isSortable: true, isDraggable: true },
                    };
                    
                    const config = columnConfig[columnId] || { label: columnId, isSortable: false, isDraggable: true };
                    
                    return (
                      <SortableNoteColumnHeader
                        key={columnId}
                        id={columnId}
                        label={config.label}
                        isDraggable={config.isDraggable}
                        sortColumn={sortColumn}
                        sortDirection={sortDirection}
                        onSort={handleSort}
                        isSortable={config.isSortable}
                      />
                    );
                  })}
                  
                  {/* Fixed actions column */}
                  <div className="w-10 flex-shrink-0"></div>
                </div>
              </SortableContext>
            </div>

            {/* Table Body */}
            {filteredNotes.length === 0 ? (
              <div className="py-12 px-4">
                <div className="text-center text-muted-foreground text-[14px]">
                  {notes.length === 0 
                    ? "Aucune note disponible. Cliquez sur \"Nouvelle note\" pour commencer."
                    : "Aucune note ne correspond à votre recherche."}
                </div>
              </div>
            ) : (
              groupedNotes.map((group) => (
                <div key={group.groupKey}>
                  {/* Group Header - only show when grouping is enabled */}
                  {groupBy !== "none" && (
                    <div 
                      className="flex items-center gap-2 px-4 py-2 bg-muted/40 border-b border-border cursor-pointer hover:bg-muted/60"
                      onClick={() => toggleGroupCollapse(group.groupKey)}
                      data-testid={`group-header-${group.groupKey}`}
                    >
                      {collapsedGroups.has(group.groupKey) ? (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                      <FolderKanban className="h-4 w-4 text-violet-500" />
                      <span className="font-medium text-sm">{group.groupName}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {group.notes.length}
                      </Badge>
                    </div>
                  )}
                  
                  {/* Group Notes - hide if collapsed */}
                  {!collapsedGroups.has(group.groupKey) && group.notes.map((note) => {
                    const linkedProject = getLinkedProject(note.id);
                    const isSelected = selectedNotes.has(note.id);
                
                const cellContent: Record<string, JSX.Element> = {
                  title: (
                    <div 
                      key="title"
                      className="flex-1 min-w-0 flex flex-col gap-1 cursor-pointer"
                      onClick={() => navigate(`/notes/${note.id}`)}
                    >
                      <div className="font-medium text-foreground truncate text-[12px]">
                        {note.title || "Sans titre"}
                      </div>
                      {note.summary && (
                        <div className="text-[10px] text-muted-foreground italic truncate flex items-center gap-1">
                          <Sparkles className="w-3 h-3 flex-shrink-0" />
                          <span className="truncate">{note.summary}</span>
                        </div>
                      )}
                    </div>
                  ),
                  tag: (
                    <div key="tag" className="flex-1 min-w-0 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Popover>
                        <PopoverTrigger asChild>
                          {note.categoryId && noteCategories.find(c => c.id === note.categoryId) ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] cursor-pointer hover-elevate bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-300 dark:border-violet-700"
                              data-testid={`badge-tag-${note.id}`}
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              {noteCategories.find(c => c.id === note.categoryId)?.name}
                            </Badge>
                          ) : (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-6 px-2 text-[10px] text-muted-foreground"
                              data-testid={`button-add-tag-${note.id}`}
                            >
                              <Tag className="w-3 h-3 mr-1" />
                              Ajouter
                            </Button>
                          )}
                        </PopoverTrigger>
                        <PopoverContent className="w-48 p-2 bg-white dark:bg-gray-900" align="start">
                          <div className="space-y-1">
                            {noteCategories.map((category) => (
                              <Button
                                key={category.id}
                                variant={note.categoryId === category.id ? "secondary" : "ghost"}
                                size="sm"
                                className="w-full justify-start text-[11px] h-7"
                                onClick={() => {
                                  updateNoteCategoryMutation.mutate({
                                    noteId: note.id,
                                    categoryId: note.categoryId === category.id ? null : category.id
                                  });
                                }}
                                data-testid={`button-select-tag-${category.id}`}
                              >
                                <Tag className="w-3 h-3 mr-2" />
                                {category.name}
                              </Button>
                            ))}
                            {noteCategories.length === 0 && (
                              <div className="text-[11px] text-muted-foreground text-center py-2">
                                Aucun tag disponible
                              </div>
                            )}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {note.categoryId && (
                        <span
                          className="inline-flex items-center justify-center cursor-pointer text-muted-foreground hover-elevate active-elevate-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            updateNoteCategoryMutation.mutate({
                              noteId: note.id,
                              categoryId: null
                            });
                          }}
                          data-testid={`button-remove-tag-${note.id}`}
                        >
                          <X className="w-3 h-3" />
                        </span>
                      )}
                    </div>
                  ),
                  status: (
                    <div key="status" className="flex-1 min-w-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`text-[10px] cursor-pointer hover-elevate ${
                              note.status === "draft"
                                ? "bg-gray-50 text-gray-700 border-gray-200"
                                : note.status === "active"
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-orange-50 text-orange-700 border-orange-200"
                            }`}
                            data-testid={`badge-status-${note.id}`}
                          >
                            {note.status === "draft" ? "Brouillon" : note.status === "active" ? "Publiée" : "Archivée"}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { status: "draft" }
                              });
                            }}
                          >
                            Brouillon
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { status: "active" }
                              });
                            }}
                          >
                            Publiée
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { status: "archived" }
                              });
                            }}
                          >
                            Archivée
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ),
                  visibility: (
                    <div key="visibility" className="flex-1 min-w-0 flex items-center" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Badge
                            variant="outline"
                            className={`text-[10px] cursor-pointer hover-elevate ${
                              note.visibility === "private"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : note.visibility === "account"
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-cyan-50 text-cyan-700 border-cyan-200"
                            }`}
                            data-testid={`badge-visibility-${note.id}`}
                          >
                            {note.visibility === "private" ? "Privée" : note.visibility === "account" ? "Équipe" : "Client"}
                          </Badge>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { visibility: "private" }
                              });
                            }}
                          >
                            Privée
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { visibility: "account" }
                              });
                            }}
                          >
                            Équipe
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ 
                                noteId: note.id, 
                                data: { visibility: "client_ro" }
                              });
                            }}
                          >
                            Client
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ),
                  createdAt: (
                    <div key="createdAt" className="flex-1 min-w-0 flex items-center text-[11px] text-muted-foreground">
                      {format(new Date(note.createdAt), "d MMM yyyy", { locale: fr })}
                    </div>
                  ),
                  updatedAt: (
                    <div key="updatedAt" className="flex-1 min-w-0 flex items-center text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(note.updatedAt), { 
                        addSuffix: true, 
                        locale: fr 
                      })}
                    </div>
                  ),
                  project: (
                    <div key="project" className="flex-1 min-w-0 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          {linkedProject ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-card text-violet-700 border-violet-200 cursor-pointer hover-elevate"
                              data-testid={`badge-project-${note.id}`}
                            >
                              {linkedProject.name}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-[10px] bg-card text-gray-600 border-gray-200 cursor-pointer hover-elevate"
                              data-testid={`badge-project-${note.id}`}
                            >
                              Aucun
                            </Badge>
                          )}
                        </DropdownMenuTrigger>
                        <DropdownMenuContent className=" max-h-[300px] overflow-y-auto">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              linkProjectMutation.mutate({ 
                                noteId: note.id, 
                                projectId: null
                              });
                            }}
                          >
                            Aucun
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {projects.map((project) => (
                            <DropdownMenuItem
                              key={project.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                linkProjectMutation.mutate({ 
                                  noteId: note.id, 
                                  projectId: project.id
                                });
                              }}
                            >
                              {project.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ),
                  actions: (
                    <div key="actions" className="w-10 flex-shrink-0 flex items-center justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            data-testid={`button-actions-note-${note.id}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" >
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              updateNoteMutation.mutate({ noteId: note.id, data: { status: "active" } });
                            }}
                            data-testid={`dropdown-publish-note-${note.id}`}
                          >
                            <Globe className="w-4 h-4 mr-2" />
                            Publier
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateNote(note.id);
                            }}
                            data-testid={`dropdown-duplicate-note-${note.id}`}
                          >
                            <Copy className="w-4 h-4 mr-2" />
                            Dupliquer
                          </DropdownMenuItem>
                          {canDo("notes", "delete") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteNote(note.id);
                                }}
                                className="text-destructive"
                                data-testid={`dropdown-delete-note-${note.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ),
                };
                
                return (
                  <div
                    key={note.id}
                    className="flex items-center gap-4 px-4 py-2 border-b border-border last:border-b-0 hover-elevate"
                    data-testid={`row-note-${note.id}`}
                  >
                    {/* Fixed checkbox column */}
                    <div className="w-8 flex-shrink-0 flex items-center">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleNoteSelection(note.id)}
                        onClick={(e) => e.stopPropagation()}
                        data-testid={`checkbox-note-${note.id}`}
                      />
                    </div>
                    
                    {/* Fixed favorite column */}
                    {columnVisibility['favorite'] !== false && (
                      <div 
                        className="w-8 flex-shrink-0 flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => {
                            updateNoteMutation.mutate({
                              noteId: note.id,
                              data: { isFavorite: !note.isFavorite }
                            });
                          }}
                          className="p-1 rounded hover:bg-muted transition-colors"
                          data-testid={`button-favorite-${note.id}`}
                        >
                          <Star 
                            className={`h-4 w-4 transition-colors ${
                              note.isFavorite 
                                ? 'fill-yellow-400 text-yellow-400' 
                                : 'text-muted-foreground hover:text-yellow-400'
                            }`}
                          />
                        </button>
                      </div>
                    )}
                    
                    {/* Dynamic columns */}
                    {columnOrder.filter(col => 
                      col !== 'checkbox' && 
                      col !== 'favorite' && 
                      col !== 'actions' && 
                      columnVisibility[col] !== false
                    ).map((columnId) => cellContent[columnId])}
                    
                    {/* Fixed actions column */}
                    {cellContent.actions}
                  </div>
                );
              })}
              </div>
            ))
            )}

            {/* Quick add note row */}
            {filteredNotes.length > 0 && (
              <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted/20">
                <div className="w-8 flex-shrink-0"></div>
                {columnVisibility['favorite'] !== false && (
                  <div className="w-8 flex-shrink-0"></div>
                )}
                <div className="flex-1 flex items-center gap-2">
                  <Plus className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <Input
                    placeholder="Créer une nouvelle note..."
                    value={quickAddNoteTitle}
                    onChange={(e) => setQuickAddNoteTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && quickAddNoteTitle.trim()) {
                        setIsQuickAddingNote(true);
                        createNoteMutation.mutate(quickAddNoteTitle.trim());
                      } else if (e.key === "Escape") {
                        setQuickAddNoteTitle("");
                      }
                    }}
                    disabled={isQuickAddingNote}
                    className="border-0 focus-visible:ring-0 text-sm h-8 flex-1"
                    data-testid="input-quick-add-note"
                  />
                </div>
                <div className="w-10 flex-shrink-0"></div>
              </div>
            )}
          </div>
          </DndContext>
          </>
        )}

        {/* Pagination Controls */}
        {filteredNotes.length > 0 && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {filteredNotes.length} note{filteredNotes.length > 1 ? 's' : ''}
              </span>
              <select
                className="border border-border rounded-md px-2 h-8 text-sm bg-background"
                value={pageSize}
                onChange={(e) => setPageSize(parseInt(e.target.value))}
                data-testid="select-page-size"
              >
                <option value="10">10 par page</option>
                <option value="20">20 par page</option>
                <option value="50">50 par page</option>
                <option value="100">100 par page</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                data-testid="button-previous-page"
              >
                Précédent
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} sur {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                data-testid="button-next-page"
              >
                Suivant
              </Button>
            </div>
          </div>
        )}
      </div>
      {/* Delete Single Note Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent data-testid="dialog-delete-note">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer cette note ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              data-testid="button-cancel-delete"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeleteNote}
              disabled={deleteNoteMutation.isPending}
              data-testid="button-confirm-delete"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Publish Dialog */}
      <Dialog open={bulkPublishDialogOpen} onOpenChange={setBulkPublishDialogOpen}>
        <DialogContent data-testid="dialog-bulk-publish">
          <DialogHeader>
            <DialogTitle>Publier les notes</DialogTitle>
            <DialogDescription>
              Voulez-vous publier {selectedNotes.size} note(s) sélectionnée(s) ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkPublishDialogOpen(false)}
              data-testid="button-cancel-publish"
            >
              Annuler
            </Button>
            <Button
              onClick={confirmBulkPublish}
              disabled={bulkPublishMutation.isPending}
              data-testid="button-confirm-publish"
            >
              Publier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Bulk Delete Dialog */}
      <Dialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <DialogContent data-testid="dialog-bulk-delete">
          <DialogHeader>
            <DialogTitle>Confirmer la suppression</DialogTitle>
            <DialogDescription>
              Êtes-vous sûr de vouloir supprimer {selectedNotes.size} note(s) sélectionnée(s) ? Cette action est irréversible.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBulkDeleteDialogOpen(false)}
              data-testid="button-cancel-bulk-delete"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={confirmBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              data-testid="button-confirm-bulk-delete"
            >
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Column Settings Sheet */}
      <Sheet open={isColumnSettingsOpen} onOpenChange={setIsColumnSettingsOpen}>
        <SheetContent className="w-80" data-testid="sheet-column-settings">
          <SheetHeader>
            <SheetTitle>Personnaliser les colonnes</SheetTitle>
          </SheetHeader>
          <div className="py-4 space-y-4">
            {[
              { id: "favorite", label: "Favoris" },
              { id: "title", label: "Titre", disabled: true },
              { id: "tag", label: "Tag" },
              { id: "status", label: "Statut" },
              { id: "visibility", label: "Visibilité" },
              { id: "createdAt", label: "Date de création" },
              { id: "updatedAt", label: "Dernière modification" },
              { id: "project", label: "Projet rattaché" },
            ].map((column) => (
              <div key={column.id} className="flex items-center justify-between">
                <Label htmlFor={`toggle-note-${column.id}`} className="text-sm">
                  {column.label}
                </Label>
                <Switch
                  id={`toggle-note-${column.id}`}
                  checked={columnVisibility[column.id] ?? true}
                  disabled={column.disabled}
                  onCheckedChange={(checked) => {
                    const newVisibility = { ...columnVisibility, [column.id]: checked };
                    setColumnVisibility(newVisibility);
                    localStorage.setItem("noteColumnVisibility", JSON.stringify(newVisibility));
                  }}
                  data-testid={`toggle-column-${column.id}`}
                />
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
    </PermissionGuard>
  );
}
