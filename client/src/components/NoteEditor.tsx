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
import ResizableImageExtension from 'tiptap-extension-resize-image';
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
  Heading5,
  Heading6,
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useCallback, useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { supabase } from '@/lib/supabase';

interface NoteEditorProps {
  content: any;
  onChange: (content: any) => void;
  editable?: boolean;
  placeholder?: string;
  onTitleChange?: (title: string) => void;
  title?: string;
}

// Color palette for text and highlights
const TEXT_COLORS = [
  { name: 'Noir', value: '#000000' },
  { name: 'Gris', value: '#6B7280' },
  { name: 'Rouge', value: '#EF4444' },
  { name: 'Orange', value: '#F97316' },
  { name: 'Jaune', value: '#EAB308' },
  { name: 'Vert', value: '#10B981' },
  { name: 'Bleu', value: '#3B82F6' },
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Rose', value: '#EC4899' },
];

const HIGHLIGHT_COLORS = [
  { name: 'Jaune', value: '#FEF08A' },
  { name: 'Vert', value: '#BBF7D0' },
  { name: 'Bleu', value: '#BFDBFE' },
  { name: 'Rose', value: '#FBCFE8' },
  { name: 'Orange', value: '#FED7AA' },
  { name: 'Violet', value: '#DDD6FE' },
];

export default function NoteEditor({ 
  content, 
  onChange, 
  editable = true,
  placeholder = "Commencez à taper ou tapez '/' pour les commandes...",
  onTitleChange,
  title = "",
}: NoteEditorProps) {
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
      ResizableImageExtension.configure({
        inline: false,
        allowBase64: true,
      }),
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
    },
  });

  // Fetch entities for linking
  const { data: projects = [] } = useQuery<any[]>({
    queryKey: ['/api/projects'],
    enabled: entityType === 'project',
  });

  const { data: tasks = [] } = useQuery<any[]>({
    queryKey: ['/api/tasks'],
    enabled: entityType === 'task',
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ['/api/clients'],
    enabled: entityType === 'client',
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

  // Image upload handler
  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !editor) return;

    setUploading(true);
    try {
      // Upload to Supabase Storage
      const fileName = `${Date.now()}-${file.name}`;
      const { data, error } = await supabase.storage
        .from('note-images')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('note-images')
        .getPublicUrl(fileName);

      // Insert image into editor
      editor.chain().focus().setImage({ src: publicUrl }).run();
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

  if (!editor) {
    return null;
  }

  return (
    <div className="border border-border rounded-md overflow-hidden bg-background">
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
          <div className="border-b border-border p-2 flex items-center gap-0.5 flex-wrap bg-muted/30">
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

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('heading', { level: 5 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 5 }).run()}
                  data-testid="button-h5"
                >
                  <Heading5 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Titre 5</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={editor.isActive('heading', { level: 6 }) ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => editor.chain().focus().toggleHeading({ level: 6 }).run()}
                  data-testid="button-h6"
                >
                  <Heading6 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Titre 6</TooltipContent>
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

            <Popover>
              <PopoverTrigger asChild>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="button-text-color"
                    >
                      <Palette className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Couleur du texte</TooltipContent>
                </Tooltip>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {TEXT_COLORS.map((color, index) => (
                    <button
                      key={color.value}
                      className="w-6 h-6 rounded border border-border hover-elevate active-elevate-2"
                      style={{ backgroundColor: color.value }}
                      onClick={() => editor.chain().focus().setColor(color.value).run()}
                      title={color.name}
                      data-testid={`button-text-color-${index}`}
                    />
                  ))}
                  <button
                    className="w-6 h-6 rounded border border-border hover-elevate active-elevate-2 bg-background"
                    onClick={() => editor.chain().focus().unsetColor().run()}
                    title="Réinitialiser"
                    data-testid="button-text-color-reset"
                  >
                    ✕
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
                      data-testid="button-highlight"
                    >
                      <Highlighter className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Surligner</TooltipContent>
                </Tooltip>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-2">
                <div className="flex flex-wrap gap-1 max-w-[200px]">
                  {HIGHLIGHT_COLORS.map((color, index) => (
                    <button
                      key={color.value}
                      className="w-6 h-6 rounded border border-border hover-elevate active-elevate-2"
                      style={{ backgroundColor: color.value }}
                      onClick={() => editor.chain().focus().toggleHighlight({ color: color.value }).run()}
                      title={color.name}
                      data-testid={`button-highlight-color-${index}`}
                    />
                  ))}
                  <button
                    className="w-6 h-6 rounded border border-border hover-elevate active-elevate-2 bg-background"
                    onClick={() => editor.chain().focus().unsetHighlight().run()}
                    title="Réinitialiser"
                    data-testid="button-highlight-reset"
                  >
                    ✕
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
                      data-testid="button-emoji"
                    >
                      <Smile className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Ajouter un emoji</TooltipContent>
                </Tooltip>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
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
      
      <EditorContent editor={editor} />

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
              {entityType === 'project' && projects
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
              {entityType === 'task' && tasks
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
              {entityType === 'client' && clients
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
}
