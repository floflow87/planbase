import { Extension, Editor, Range } from '@tiptap/core';
import { ReactRenderer } from '@tiptap/react';
import Suggestion, { SuggestionOptions, SuggestionProps, SuggestionKeyDownProps } from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { forwardRef, useEffect, useImperativeHandle, useState, useCallback } from 'react';
import {
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Type,
  CheckSquare,
  Quote,
  Link,
  Mic,
  Image,
  FolderKanban,
  CheckCircle,
  Users,
  ListTree,
} from 'lucide-react';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  command: (props: { editor: any; range: any }) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Titre 1',
    description: 'Grand titre de section',
    icon: Heading1,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    id: 'h2',
    label: 'Titre 2',
    description: 'Titre de sous-section',
    icon: Heading2,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    id: 'h3',
    label: 'Titre 3',
    description: 'Petit titre',
    icon: Heading3,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    id: 'h4',
    label: 'Titre 4',
    description: 'Sous-titre',
    icon: Heading4,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run();
    },
  },
  {
    id: 'b',
    label: 'Gras',
    description: 'Texte en gras',
    icon: Bold,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBold().run();
    },
  },
  {
    id: 'em',
    label: 'Italique',
    description: 'Texte en italique',
    icon: Italic,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleItalic().run();
    },
  },
  {
    id: 'u',
    label: 'Souligné',
    description: 'Texte souligné',
    icon: Underline,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleUnderline().run();
    },
  },
  {
    id: 'tab',
    label: 'Liste à puces',
    description: 'Créer une liste non ordonnée',
    icon: List,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: 'num',
    label: 'Liste numérotée',
    description: 'Créer une liste ordonnée',
    icon: ListOrdered,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: 't',
    label: 'Texte',
    description: 'Paragraphe de texte normal',
    icon: Type,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: '[]',
    label: 'Liste de tâches',
    description: 'Créer une liste de tâches à cocher',
    icon: CheckSquare,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: 'q',
    label: 'Citation',
    description: 'Ajouter une citation',
    icon: Quote,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: 'url',
    label: 'Lien',
    description: 'Insérer un lien (site, projet, client, tâche)',
    icon: Link,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('slash-command-url'));
    },
  },
  {
    id: 'img',
    label: 'Image',
    description: 'Télécharger une image',
    icon: Image,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('slash-command-image'));
    },
  },
  {
    id: 'voice',
    label: 'Dictaphone',
    description: 'Démarrer la dictée vocale',
    icon: Mic,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('slash-command-voice'));
    },
  },
  {
    id: 'projet',
    label: 'Lier un projet',
    description: 'Insérer un lien vers un projet',
    icon: FolderKanban,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('slash-command-project'));
    },
  },
  {
    id: 'tache',
    label: 'Lier une tâche',
    description: 'Insérer un lien vers une tâche',
    icon: CheckCircle,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('slash-command-task'));
    },
  },
  {
    id: 'client',
    label: 'Lier un client',
    description: 'Insérer un lien vers un client',
    icon: Users,
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      window.dispatchEvent(new CustomEvent('slash-command-client'));
    },
  },
  {
    id: 'table',
    label: 'Table des matières',
    description: 'Générer une table des matières automatique',
    icon: ListTree,
    command: ({ editor, range }) => {
      // Delete the slash command first
      editor.chain().focus().deleteRange(range).run();
      
      // Extract all headings from the document with their positions
      const headings: { level: number; text: string; pos: number }[] = [];
      editor.state.doc.descendants((node, pos) => {
        if (node.type.name === 'heading' && node.attrs.level) {
          headings.push({
            level: node.attrs.level,
            text: node.textContent,
            pos: pos,
          });
        }
      });
      
      if (headings.length === 0) {
        // Insert a placeholder if no headings found
        editor.chain().focus().insertContent({
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Aucun titre trouvé dans le document' }]
        }).run();
        return;
      }
      
      // Find the minimum heading level to use as base
      const minLevel = Math.min(...headings.map(h => h.level));
      
      // Track counters for each level
      const counters: number[] = [0, 0, 0, 0, 0]; // For h1-h4
      
      // Build TipTap content structure - no header, just items
      const tocContent: any[] = [];
      
      // Build ordered list with proper hierarchy and clickable links
      let headingIdx = 0;
      headings.forEach((heading) => {
        // Update counters
        counters[heading.level - 1]++;
        // Reset lower level counters
        for (let i = heading.level; i < counters.length; i++) {
          counters[i] = 0;
        }
        
        // Build number prefix (e.g., "1.", "1.1.", "1.1.1.")
        const numberParts = [];
        for (let i = 0; i < heading.level; i++) {
          if (counters[i] > 0) {
            numberParts.push(counters[i]);
          }
        }
        const numberPrefix = numberParts.join('.') + '.';
        
        // Calculate indentation based on level
        const relativeLevel = heading.level - minLevel;
        const indentSpaces = '    '.repeat(relativeLevel); // 4 spaces per level
        
        tocContent.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: indentSpaces + numberPrefix + ' ' },
            { 
              type: 'text', 
              marks: [{ 
                type: 'link', 
                attrs: { 
                  href: `toc:${headingIdx}`,
                  target: null,
                  class: 'toc-link cursor-pointer'
                } 
              }], 
              text: heading.text 
            }
          ]
        });
        headingIdx++;
      });
      
      // Add separator
      tocContent.push({
        type: 'horizontalRule'
      });
      
      // Insert the table of contents
      editor.chain().focus().insertContent(tocContent).run();
    },
  },
];

interface CommandListProps {
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
}

export interface CommandListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const CommandList = forwardRef<CommandListRef, CommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) {
          command(item);
        }
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === 'ArrowUp') {
          setSelectedIndex((prev) => (prev - 1 + items.length) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter') {
          selectItem(selectedIndex);
          return true;
        }

        if (event.key === 'Escape') {
          return true;
        }

        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[280px]">
          <p className="text-sm text-muted-foreground">Aucune commande trouvée</p>
        </div>
      );
    }

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[280px] max-h-[320px] overflow-y-auto">
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Commandes
          </p>
        </div>
        <div className="py-1">
          {items.map((item, index) => {
            const Icon = item.icon;
            const isSelected = index === selectedIndex;
            return (
              <button
                key={item.id}
                onClick={() => selectItem(index)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  isSelected
                    ? 'bg-primary/10 text-primary'
                    : 'hover:bg-muted/50 text-foreground'
                }`}
                data-testid={`slash-command-${item.id}`}
              >
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-md ${
                    isSelected ? 'bg-primary/20' : 'bg-muted'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{item.label}</span>
                    <code className="text-xs px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                      /{item.id}
                    </code>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {item.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
        <div className="px-3 py-2 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground">
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs">↑↓</kbd> Naviguer{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs ml-2">Entrée</kbd> Valider{' '}
            <kbd className="px-1 py-0.5 bg-muted rounded text-xs ml-2">Échap</kbd> Annuler
          </p>
        </div>
      </div>
    );
  }
);

CommandList.displayName = 'CommandList';

const getSuggestionItems = (query: string): SlashCommand[] => {
  return SLASH_COMMANDS.filter((item) => {
    const searchLower = query.toLowerCase();
    return (
      item.id.toLowerCase().includes(searchLower) ||
      item.label.toLowerCase().includes(searchLower) ||
      item.description.toLowerCase().includes(searchLower)
    );
  });
};

export const createSlashCommandSuggestion = (): Omit<SuggestionOptions<SlashCommand>, 'editor'> => ({
  char: '/',
  command: ({ editor, range, props }: { editor: Editor; range: Range; props: SlashCommand }) => {
    props.command({ editor, range });
  },
  items: ({ query }: { query: string }) => getSuggestionItems(query),
  render: () => {
    let component: ReactRenderer<CommandListRef> | null = null;
    let popup: TippyInstance[] | null = null;

    return {
      onStart: (props: SuggestionProps<SlashCommand>) => {
        component = new ReactRenderer(CommandList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) {
          return;
        }

        popup = tippy('body', {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
          offset: [0, 8],
        });
      },

      onUpdate: (props: SuggestionProps<SlashCommand>) => {
        component?.updateProps(props);

        if (!props.clientRect) {
          return;
        }

        popup?.[0]?.setProps({
          getReferenceClientRect: props.clientRect as () => DOMRect,
        });
      },

      onKeyDown: (props: SuggestionKeyDownProps) => {
        if (props.event.key === 'Escape') {
          popup?.[0]?.hide();
          return true;
        }

        return component?.ref?.onKeyDown(props) ?? false;
      },

      onExit: () => {
        popup?.[0]?.destroy();
        component?.destroy();
      },
    };
  },
});

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: createSlashCommandSuggestion(),
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommands;
