import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import ResizableImageExtension from 'tiptap-extension-resize-image';
import { SlashCommands } from '@/components/SlashCommands';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  FileCode2,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  List,
  ListOrdered,
  CheckSquare,
  Quote,
  Minus,
  Undo,
  Redo,
  Link as LinkIcon,
  Image as ImageIcon,
  Highlighter,
  Palette,
  FolderKanban,
  Users,
  ListTodo,
  Smile,
  Upload,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Paintbrush,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useLocation } from 'wouter';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCallback, useEffect, useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { useQuery } from '@tanstack/react-query';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { supabase } from '@/lib/supabase';
import type { Editor } from '@tiptap/react';

export interface NoteEditorRef {
  insertText: (text: string) => void;
  deleteLastCharacters: (count: number) => void;
  getEditor: () => Editor | null;
}

interface NoteEditorProps {
  content: any;
  onChange: (content: any) => void;
  editable?: boolean;
  placeholder?: string;
  onTitleChange?: (title: string) => void;
  title?: string;
}

// Color palette for text - 18 colors
const TEXT_COLORS = [
  { name: 'Noir', value: '#000000' },
  { name: 'Gris foncé', value: '#374151' },
  { name: 'Gris', value: '#6B7280' },
  { name: 'Gris clair', value: '#9CA3AF' },
  { name: 'Rouge foncé', value: '#B91C1C' },
  { name: 'Rouge', value: '#EF4444' },
  { name: 'Orange foncé', value: '#C2410C' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Jaune foncé', value: '#A16207' },
  { name: 'Jaune', value: '#EAB308' },
  { name: 'Vert foncé', value: '#047857' },
  { name: 'Vert', value: '#10B981' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Bleu', value: '#3B82F6' },
  { name: 'Bleu foncé', value: '#1D4ED8' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Rose', value: '#EC4899' },
  { name: 'Magenta', value: '#D946EF' },
];

// Color palette for highlights - 18 colors
const HIGHLIGHT_COLORS = [
  { name: 'Jaune clair', value: '#FEF9C3' },
  { name: 'Jaune', value: '#FEF08A' },
  { name: 'Jaune foncé', value: '#FDE047' },
  { name: 'Orange clair', value: '#FFEDD5' },
  { name: 'Orange', value: '#FED7AA' },
  { name: 'Orange foncé', value: '#FDBA74' },
  { name: 'Vert clair', value: '#DCFCE7' },
  { name: 'Vert', value: '#BBF7D0' },
  { name: 'Vert foncé', value: '#86EFAC' },
  { name: 'Cyan clair', value: '#CFFAFE' },
  { name: 'Cyan', value: '#A5F3FC' },
  { name: 'Bleu clair', value: '#DBEAFE' },
  { name: 'Bleu', value: '#BFDBFE' },
  { name: 'Bleu foncé', value: '#93C5FD' },
  { name: 'Violet clair', value: '#EDE9FE' },
  { name: 'Violet', value: '#DDD6FE' },
  { name: 'Rose clair', value: '#FCE7F3' },
  { name: 'Rose', value: '#FBCFE8' },
];

const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>((props, ref) => {
  const {
    content,
    onChange,
    editable = true,
    placeholder = "Commencer à écrire… Appuyez sur la touche / pour utiliser les raccourcis.",
    onTitleChange,
    title = "",
  } = props;
  const [, navigate] = useLocation();
  
  // Dialogue states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Entity link states
  const [entityDialogOpen, setEntityDialogOpen] = useState(false);
  const [entityType, setEntityType] = useState<'project' | 'task' | 'client' | null>(null);
  const [entitySearch, setEntitySearch] = useState('');
  
  // Format painter state
  interface CopiedFormat {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    strike: boolean;
    code: boolean;
    color: string | null;
    highlight: string | null;
    textAlign: string | null;
    link: string | null;
    bulletList: boolean;
    orderedList: boolean;
    taskList: boolean;
    blockquote: boolean;
  }
  const [copiedFormat, setCopiedFormat] = useState<CopiedFormat | null>(null);
  
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4, 5, 6],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      Typography,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableCell,
      TableHeader,
      Highlight.configure({
        multicolor: true,
      }),
      TextStyle,
      Color,
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline cursor-pointer',
        },
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      ResizableImageExtension.configure({
        inline: false,
        allowBase64: true,
      }),
      SlashCommands,
    ],
    content,
    editable,
    onUpdate: ({ editor }) => {
      onChange(editor.getJSON());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[400px] p-4',
      },
      handleClick: (view, pos, event) => {
        const target = event.target as HTMLElement;
        if (target.tagName === 'A' && target.getAttribute('href')) {
          const href = target.getAttribute('href')!;
          // Check if this is an internal link (starts with /)
          if (href.startsWith('/')) {
            event.preventDefault();
            navigate(href);
            return true;
          }
        }
        return false;
      },
    },
  });

  // Fetch entities for linking - fetch when dialog is open
  const { data: projects = [], isLoading: isLoadingProjects } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    enabled: entityDialogOpen && entityType === 'project',
    staleTime: 30000,
  });

  const { data: tasks = [], isLoading: isLoadingTasks } = useQuery<any[]>({
    queryKey: ['/api/tasks'],
    enabled: entityDialogOpen && entityType === 'task',
    staleTime: 30000,
  });

  const { data: clients = [], isLoading: isLoadingClients } = useQuery<any[]>({
    queryKey: ['/api/clients'],
    enabled: entityDialogOpen && entityType === 'client',
    staleTime: 30000,
  });

  useEffect(() => {
    if (editor && content) {
      // Deep compare the content to avoid resetting the editor unnecessarily
      const currentContent = JSON.stringify(editor.getJSON());
      const newContent = JSON.stringify(content);
      
      if (currentContent !== newContent) {
        editor.commands.setContent(content);
      }
    }
  }, [content, editor]);

  // Sync editable state with TipTap
  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  // Handle slash command events
  useEffect(() => {
    const handleSlashImage = () => {
      fileInputRef.current?.click();
    };

    const handleSlashUrl = () => {
      setLinkDialogOpen(true);
    };

    const handleSlashVoice = () => {
      // Trigger voice dictation if supported
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'fr-FR';
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onresult = (event: any) => {
          const transcript = Array.from(event.results)
            .map((result: any) => result[0].transcript)
            .join('');
          
          if (event.results[event.results.length - 1].isFinal && editor) {
            editor.chain().focus().insertContent(transcript).run();
          }
        };
        
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          alert('Erreur de reconnaissance vocale: ' + event.error);
        };
        
        recognition.start();
        
        // Stop after 30 seconds max
        setTimeout(() => {
          recognition.stop();
        }, 30000);
      } else {
        alert('La reconnaissance vocale n\'est pas supportée par votre navigateur');
      }
    };

    const handleSlashProject = () => {
      setEntityType('project');
      setEntitySearch('');
      setEntityDialogOpen(true);
    };

    const handleSlashTask = () => {
      setEntityType('task');
      setEntitySearch('');
      setEntityDialogOpen(true);
    };

    const handleSlashClient = () => {
      setEntityType('client');
      setEntitySearch('');
      setEntityDialogOpen(true);
    };

    window.addEventListener('slash-command-image', handleSlashImage);
    window.addEventListener('slash-command-url', handleSlashUrl);
    window.addEventListener('slash-command-voice', handleSlashVoice);
    window.addEventListener('slash-command-project', handleSlashProject);
    window.addEventListener('slash-command-task', handleSlashTask);
    window.addEventListener('slash-command-client', handleSlashClient);

    return () => {
      window.removeEventListener('slash-command-image', handleSlashImage);
      window.removeEventListener('slash-command-url', handleSlashUrl);
      window.removeEventListener('slash-command-voice', handleSlashVoice);
      window.removeEventListener('slash-command-project', handleSlashProject);
      window.removeEventListener('slash-command-task', handleSlashTask);
      window.removeEventListener('slash-command-client', handleSlashClient);
    };
  }, [editor]);

  // Expose imperative methods for external control
  useImperativeHandle(ref, () => ({
    insertText: (text: string) => {
      if (editor) {
        editor.chain().focus().insertContent(text).run();
      }
    },
    deleteLastCharacters: (count: number) => {
      if (editor && count > 0) {
        const { from, to } = editor.state.selection;
        const deleteFrom = Math.max(0, from - count);
        editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
      }
    },
    getEditor: () => editor,
  }), [editor]);

  // New dialog-based link handler
  const openLinkDialog = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, '');
    
    setLinkUrl(previousUrl || '');
    setLinkText(text);
    setLinkDialogOpen(true);
  }, [editor]);

  const handleSetLink = useCallback(() => {
    if (!editor) return;

    if (linkUrl === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    }
    
    setLinkDialogOpen(false);
    setLinkUrl('');
    setLinkText('');
  }, [editor, linkUrl]);

  // Image upload handler - converts to base64 for reliable storage
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner un fichier image valide');
      return;
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('L\'image est trop volumineuse. Taille maximum: 5 MB');
      return;
    }

    setUploading(true);
    try {
      // Convert image to base64
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

      // Insert image into editor with base64 data
      editor.chain().focus().setImage({ src: base64Data }).run();
    } catch (error: any) {
      console.error('Upload failed:', error);
      alert('Échec de l\'upload de l\'image: ' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [editor]);

  // Emoji picker handler
  const handleEmojiClick = useCallback((emojiData: EmojiClickData) => {
    if (!editor) return;
    editor.chain().focus().insertContent(emojiData.emoji).run();
  }, [editor]);

  // Entity linking handlers
  const openEntityDialog = useCallback((type: 'project' | 'task' | 'client') => {
    setEntityType(type);
    setEntitySearch('');
    setEntityDialogOpen(true);
  }, []);

  const handleEntityLink = useCallback((entity: any) => {
    if (!editor || !entityType) return;
    
    const entityLabel = entityType === 'project' 
      ? entity.name 
      : entityType === 'task' 
      ? entity.title 
      : entity.name;
    
    // Correct URL routing based on actual routes in App.tsx
    const entityUrl = entityType === 'client' 
      ? `/crm/${entity.id}`
      : entityType === 'project'
      ? `/projects/${entity.id}`
      : `/projects/${entity.projectId || entity.id}`; // Tasks link to their parent project
    
    editor.chain().focus().insertContent({
      type: 'text',
      marks: [
        { 
          type: 'link', 
          attrs: { 
            href: entityUrl,
            class: 'text-primary underline cursor-pointer font-medium',
          } 
        }
      ],
      text: entityLabel,
    }).run();
    
    setEntityDialogOpen(false);
    setEntityType(null);
    setEntitySearch('');
  }, [editor, entityType]);

  // Format painter functions
  const copyFormat = useCallback(() => {
    if (!editor) return;
    
    const attrs = editor.getAttributes('textStyle');
    const linkAttrs = editor.getAttributes('link');
    const highlightAttrs = editor.getAttributes('highlight');
    
    // Get text alignment from paragraph or heading
    let textAlign: string | null = null;
    const { from } = editor.state.selection;
    const resolvedPos = editor.state.doc.resolve(from);
    const node = resolvedPos.parent;
    if (node.attrs?.textAlign) {
      textAlign = node.attrs.textAlign;
    }
    
    setCopiedFormat({
      bold: editor.isActive('bold'),
      italic: editor.isActive('italic'),
      underline: editor.isActive('underline'),
      strike: editor.isActive('strike'),
      code: editor.isActive('code'),
      color: attrs.color || null,
      highlight: highlightAttrs.color || null,
      textAlign: textAlign,
      link: linkAttrs.href || null,
      bulletList: editor.isActive('bulletList'),
      orderedList: editor.isActive('orderedList'),
      taskList: editor.isActive('taskList'),
      blockquote: editor.isActive('blockquote'),
    });
  }, [editor]);
  
  const applyFormat = useCallback(() => {
    if (!editor || !copiedFormat) return;
    
    let chain = editor.chain().focus();
    
    // Apply text marks
    if (copiedFormat.bold) chain = chain.setBold();
    else chain = chain.unsetBold();
    
    if (copiedFormat.italic) chain = chain.setItalic();
    else chain = chain.unsetItalic();
    
    if (copiedFormat.underline) chain = chain.setUnderline();
    else chain = chain.unsetUnderline();
    
    if (copiedFormat.strike) chain = chain.setStrike();
    else chain = chain.unsetStrike();
    
    if (copiedFormat.code) chain = chain.setCode();
    else chain = chain.unsetCode();
    
    // Apply color
    if (copiedFormat.color) {
      chain = chain.setColor(copiedFormat.color);
    } else {
      chain = chain.unsetColor();
    }
    
    // Apply highlight
    if (copiedFormat.highlight) {
      chain = chain.setHighlight({ color: copiedFormat.highlight });
    } else {
      chain = chain.unsetHighlight();
    }
    
    // Apply text alignment
    if (copiedFormat.textAlign) {
      chain = chain.setTextAlign(copiedFormat.textAlign);
    }
    
    // Apply link
    if (copiedFormat.link) {
      chain = chain.setLink({ href: copiedFormat.link });
    } else {
      chain = chain.unsetLink();
    }
    
    chain.run();
    
    // Clear copied format after applying
    setCopiedFormat(null);
  }, [editor, copiedFormat]);
  
  const handleFormatPainter = useCallback(() => {
    if (!editor) return;
    
    if (copiedFormat) {
      // If format is already copied, apply it
      applyFormat();
    } else {
      // Otherwise, copy the current format
      copyFormat();
    }
  }, [editor, copiedFormat, copyFormat, applyFormat]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-border rounded-md bg-background">
      {editable && (
        <>
          {onTitleChange && (
            <div className="border-b border-border">
              <input
                type="text"
                className="w-full px-4 py-3 text-2xl font-heading font-bold bg-transparent focus:outline-none"
                placeholder="Titre de la note"
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                data-testid="input-note-title"
              />
            </div>
          )}
          <div className="sticky top-0 z-50 border-b border-border p-2 flex items-center gap-px flex-wrap bg-background shadow-sm overflow-x-auto">
            {/* Format Painter - first icon */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={copiedFormat ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={handleFormatPainter}
                  data-testid="button-format-painter"
                >
                  <Paintbrush className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {copiedFormat ? 'Cliquez pour appliquer le style' : 'Copier le style'}
              </TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().undo().run()}
                  disabled={!editor.can().undo()}
                  data-testid="button-undo"
                >
                  <Undo className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Annuler</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().redo().run()}
                  disabled={!editor.can().redo()}
                  data-testid="button-redo"
                >
                  <Redo className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Rétablir</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                  data-testid="button-h1"
                >
                  <Heading1 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Titre 1</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  data-testid="button-h2"
                >
                  <Heading2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Titre 2</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  data-testid="button-h3"
                >
                  <Heading3 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Titre 3</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('heading', { level: 4 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()}
                  data-testid="button-h4"
                >
                  <Heading4 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Titre 4</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('bold') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBold().run()}
                  data-testid="button-bold"
                >
                  <Bold className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Gras</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('italic') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                  data-testid="button-italic"
                >
                  <Italic className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Italique</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('underline') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                  data-testid="button-underline"
                >
                  <UnderlineIcon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Souligner</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('strike') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                  data-testid="button-strike"
                >
                  <Strikethrough className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Barrer</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('code') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleCode().run()}
                  data-testid="button-code"
                >
                  <Code className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Code inline</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                  data-testid="button-code-block"
                >
                  <FileCode2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Bloc de code</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive({ textAlign: 'left' }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('left').run()}
                  data-testid="button-align-left"
                >
                  <AlignLeft className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aligner à gauche</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive({ textAlign: 'center' }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('center').run()}
                  data-testid="button-align-center"
                >
                  <AlignCenter className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Centrer</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive({ textAlign: 'right' }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('right').run()}
                  data-testid="button-align-right"
                >
                  <AlignRight className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aligner à droite</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive({ textAlign: 'justify' }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().setTextAlign('justify').run()}
                  data-testid="button-align-justify"
                >
                  <AlignJustify className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Justifier</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Popover>
              <PopoverTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-white dark:hover:bg-muted"
                      data-testid="button-text-color"
                    >
                      <Palette className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Couleur du texte</TooltipContent>
                </Tooltip>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-2 bg-white dark:bg-card"
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {TEXT_COLORS.map((color, index) => (
                    <button
                      key={color.value}
                      className="w-6 h-6 rounded border border-border hover-elevate active-elevate-2"
                      style={{ backgroundColor: color.value }}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.chain().focus().setColor(color.value).run();
                      }}
                      title={color.name}
                      data-testid={`button-text-color-${index}`}
                    />
                  ))}
                  <button
                    className="w-6 h-6 rounded border border-border hover-elevate active-elevate-2 bg-background flex items-center justify-center text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.chain().focus().unsetColor().run();
                    }}
                    title="Réinitialiser"
                    data-testid="button-text-color-reset"
                  >
                    X
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={editor.isActive('highlight') ? 'secondary' : 'ghost'}
                      size="sm"
                      className="hover:bg-white dark:hover:bg-muted"
                      data-testid="button-highlight"
                    >
                      <Highlighter className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Surligner</TooltipContent>
                </Tooltip>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-2 bg-white dark:bg-card"
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {HIGHLIGHT_COLORS.map((color, index) => (
                    <button
                      key={color.value}
                      className="w-6 h-6 rounded border border-border hover-elevate active-elevate-2"
                      style={{ backgroundColor: color.value }}
                      onClick={(e) => {
                        e.stopPropagation();
                        editor.chain().focus().toggleHighlight({ color: color.value }).run();
                      }}
                      title={color.name}
                      data-testid={`button-highlight-color-${index}`}
                    />
                  ))}
                  <button
                    className="w-6 h-6 rounded border border-border hover-elevate active-elevate-2 bg-background flex items-center justify-center text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      editor.chain().focus().unsetHighlight().run();
                    }}
                    title="Réinitialiser"
                    data-testid="button-highlight-reset"
                  >
                    X
                  </button>
                </div>
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  data-testid="button-bullet-list"
                >
                  <List className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Liste à puces</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  data-testid="button-ordered-list"
                >
                  <ListOrdered className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Liste numérotée</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('taskList') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                  data-testid="button-task-list"
                >
                  <CheckSquare className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Liste de tâches</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  data-testid="button-blockquote"
                >
                  <Quote className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Citation</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => editor.chain().focus().setHorizontalRule().run()}
                  data-testid="button-hr"
                >
                  <Minus className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Séparateur</TooltipContent>
            </Tooltip>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('link') ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={openLinkDialog}
                  data-testid="button-link"
                >
                  <LinkIcon className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Ajouter un lien</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  data-testid="button-upload-image"
                >
                  {uploading ? <Upload className="w-4 h-4 animate-pulse" /> : <Upload className="w-4 h-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{uploading ? 'Upload en cours...' : 'Upload image'}</TooltipContent>
            </Tooltip>

            <Popover>
              <PopoverTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-white dark:hover:bg-muted"
                      data-testid="button-emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ajouter un emoji</TooltipContent>
                </Tooltip>
              </PopoverTrigger>
              <PopoverContent 
                className="w-auto p-0 bg-white dark:bg-card"
                onPointerDownOutside={(e) => e.preventDefault()}
              >
                <EmojiPicker onEmojiClick={handleEmojiClick} />
              </PopoverContent>
            </Popover>

            <Separator orientation="vertical" className="h-6 mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEntityDialog('project')}
                  data-testid="button-link-project"
                >
                  <FolderKanban className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lier à un projet</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEntityDialog('task')}
                  data-testid="button-link-task"
                >
                  <ListTodo className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lier à une tâche</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEntityDialog('client')}
                  data-testid="button-link-client"
                >
                  <Users className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Lier à un client</TooltipContent>
            </Tooltip>
          </div>
        </>
      )}
      
      {/* Hidden file input for image upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
        data-testid="input-file-upload"
      />
      
      <div className="bg-white dark:bg-background">
        <EditorContent editor={editor} />
      </div>

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent data-testid="dialog-link">
          <DialogHeader>
            <DialogTitle>Ajouter un lien</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="link-url">URL</Label>
              <Input
                id="link-url"
                type="url"
                placeholder="https://example.com"
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                data-testid="input-link-url"
              />
            </div>
            {linkText && (
              <div>
                <Label>Texte sélectionné</Label>
                <p className="text-sm text-muted-foreground">{linkText}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)} data-testid="button-cancel-link">
              Annuler
            </Button>
            <Button onClick={handleSetLink} data-testid="button-save-link">
              {linkUrl ? 'Ajouter' : 'Supprimer le lien'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Entity Link Dialog */}
      <Dialog open={entityDialogOpen} onOpenChange={setEntityDialogOpen}>
        <DialogContent data-testid="dialog-entity">
          <DialogHeader>
            <DialogTitle>
              Lier à {entityType === 'project' ? 'un projet' : entityType === 'task' ? 'une tâche' : 'un client'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="entity-search">Rechercher</Label>
              <Input
                id="entity-search"
                type="text"
                placeholder="Tapez pour rechercher..."
                value={entitySearch}
                onChange={(e) => setEntitySearch(e.target.value)}
                data-testid="input-entity-search"
              />
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {/* Loading states */}
              {entityType === 'project' && isLoadingProjects && (
                <div className="text-center py-4 text-muted-foreground">Chargement des projets...</div>
              )}
              {entityType === 'task' && isLoadingTasks && (
                <div className="text-center py-4 text-muted-foreground">Chargement des tâches...</div>
              )}
              {entityType === 'client' && isLoadingClients && (
                <div className="text-center py-4 text-muted-foreground">Chargement des clients...</div>
              )}
              
              {/* Empty states */}
              {entityType === 'project' && !isLoadingProjects && projects.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">Aucun projet disponible</div>
              )}
              {entityType === 'task' && !isLoadingTasks && tasks.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">Aucune tâche disponible</div>
              )}
              {entityType === 'client' && !isLoadingClients && clients.length === 0 && (
                <div className="text-center py-4 text-muted-foreground">Aucun client disponible</div>
              )}
              
              {/* Data lists */}
              {entityType === 'project' && !isLoadingProjects && projects
                .filter((p: any) => 
                  !entitySearch || 
                  p.name.toLowerCase().includes(entitySearch.toLowerCase())
                )
                .map((project: any) => (
                  <button
                    key={project.id}
                    className="w-full text-left px-3 py-2 rounded hover-elevate active-elevate-2 border border-border"
                    onClick={() => handleEntityLink(project)}
                    data-testid={`button-select-project-${project.id}`}
                  >
                    <div className="font-medium">{project.name}</div>
                    {project.description && (
                      <div className="text-sm text-muted-foreground">{project.description}</div>
                    )}
                  </button>
                ))}
              {entityType === 'task' && !isLoadingTasks && tasks
                .filter((t: any) => 
                  !entitySearch || 
                  t.title.toLowerCase().includes(entitySearch.toLowerCase())
                )
                .map((task: any) => (
                  <button
                    key={task.id}
                    className="w-full text-left px-3 py-2 rounded hover-elevate active-elevate-2 border border-border"
                    onClick={() => handleEntityLink(task)}
                    data-testid={`button-select-task-${task.id}`}
                  >
                    <div className="font-medium">{task.title}</div>
                    {task.description && (
                      <div className="text-sm text-muted-foreground">{task.description}</div>
                    )}
                  </button>
                ))}
              {entityType === 'client' && !isLoadingClients && clients
                .filter((c: any) => 
                  !entitySearch || 
                  c.name.toLowerCase().includes(entitySearch.toLowerCase())
                )
                .map((client: any) => (
                  <button
                    key={client.id}
                    className="w-full text-left px-3 py-2 rounded hover-elevate active-elevate-2 border border-border"
                    onClick={() => handleEntityLink(client)}
                    data-testid={`button-select-client-${client.id}`}
                  >
                    <div className="font-medium">{client.name}</div>
                    {client.email && (
                      <div className="text-sm text-muted-foreground">{client.email}</div>
                    )}
                  </button>
                ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntityDialogOpen(false)} data-testid="button-cancel-entity">
              Annuler
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';

export default NoteEditor;
