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
  ChevronDown,
  Columns2,
  Columns3,
  Columns4,
  Highlighter,
  Palette,
} from 'lucide-react';
import { insertColumnBlock } from '@/components/ColumnExtension';

export interface SlashCommand {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  category: string;
  swatchColor?: string;
  command: (props: { editor: any; range: any }) => void;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'h1',
    label: 'Titre 1',
    description: 'Grand titre de section',
    icon: Heading1,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
    },
  },
  {
    id: 'h2',
    label: 'Titre 2',
    description: 'Titre de sous-section',
    icon: Heading2,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
    },
  },
  {
    id: 'h3',
    label: 'Titre 3',
    description: 'Petit titre',
    icon: Heading3,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
    },
  },
  {
    id: 'h4',
    label: 'Titre 4',
    description: 'Sous-titre',
    icon: Heading4,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run();
    },
  },
  {
    id: 'toggle',
    label: 'Titre déroulant',
    description: 'Section repliable style Notion',
    icon: ChevronDown,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertContent({
        type: 'details',
        content: [
          {
            type: 'detailsSummary',
            content: [{ type: 'text', text: 'Titre de la section' }],
          },
          {
            type: 'detailsContent',
            content: [{ type: 'paragraph' }],
          },
        ],
      }).run();
    },
  },
  {
    id: 'b',
    label: 'Gras',
    description: 'Texte en gras',
    icon: Bold,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBold().run();
    },
  },
  {
    id: 'em',
    label: 'Italique',
    description: 'Texte en italique',
    icon: Italic,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleItalic().run();
    },
  },
  {
    id: 'u',
    label: 'Souligné',
    description: 'Texte souligné',
    icon: Underline,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleUnderline().run();
    },
  },
  {
    id: 't',
    label: 'Texte',
    description: 'Paragraphe de texte normal',
    icon: Type,
    category: 'Texte',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    id: 'tab',
    label: 'Liste à puces',
    description: 'Créer une liste non ordonnée',
    icon: List,
    category: 'Listes',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBulletList().run();
    },
  },
  {
    id: 'num',
    label: 'Liste numérotée',
    description: 'Créer une liste ordonnée',
    icon: ListOrdered,
    category: 'Listes',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleOrderedList().run();
    },
  },
  {
    id: '[]',
    label: 'Liste de tâches',
    description: 'Créer une liste de tâches à cocher',
    icon: CheckSquare,
    category: 'Listes',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleTaskList().run();
    },
  },
  {
    id: 'q',
    label: 'Citation',
    description: 'Ajouter une citation',
    icon: Quote,
    category: 'Listes',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleBlockquote().run();
    },
  },
  {
    id: 'url',
    label: 'Lien',
    description: 'Insérer un lien (site, projet, client, tâche)',
    icon: Link,
    category: 'Médias',
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
    category: 'Médias',
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
    category: 'Médias',
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
    category: 'Liens',
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
    category: 'Liens',
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
    category: 'Liens',
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
    category: 'Mise en page',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      
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
        editor.chain().focus().insertContent({
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'italic' }], text: 'Aucun titre trouvé dans le document' }]
        }).run();
        return;
      }
      
      const minLevel = Math.min(...headings.map(h => h.level));
      const counters: number[] = [0, 0, 0, 0, 0];
      const tocContent: any[] = [];
      let headingIdx = 0;
      
      headings.forEach((heading) => {
        counters[heading.level - 1]++;
        for (let i = heading.level; i < counters.length; i++) {
          counters[i] = 0;
        }
        const numberParts = [];
        for (let i = 0; i < heading.level; i++) {
          if (counters[i] > 0) numberParts.push(counters[i]);
        }
        const numberPrefix = numberParts.join('.') + '.';
        const relativeLevel = heading.level - minLevel;
        const indentSpaces = '    '.repeat(relativeLevel);
        
        tocContent.push({
          type: 'paragraph',
          content: [
            { type: 'text', text: indentSpaces + numberPrefix + ' ' },
            { 
              type: 'text', 
              marks: [{ type: 'link', attrs: { href: `toc:${headingIdx}`, target: null, class: 'toc-link cursor-pointer' } }], 
              text: heading.text 
            }
          ]
        });
        headingIdx++;
      });
      
      tocContent.push({ type: 'horizontalRule' });
      editor.chain().focus().insertContent(tocContent).run();
    },
  },
  {
    id: 'columnx2',
    label: '2 colonnes',
    description: 'Diviser la page en 2 colonnes côte à côte',
    icon: Columns2,
    category: 'Mise en page',
    command: ({ editor, range }) => {
      insertColumnBlock(editor, range, 2);
    },
  },
  {
    id: 'columnx3',
    label: '3 colonnes',
    description: 'Diviser la page en 3 colonnes côte à côte',
    icon: Columns3,
    category: 'Mise en page',
    command: ({ editor, range }) => {
      insertColumnBlock(editor, range, 3);
    },
  },
  {
    id: 'columnx4',
    label: '4 colonnes',
    description: 'Diviser la page en 4 colonnes côte à côte',
    icon: Columns4,
    category: 'Mise en page',
    command: ({ editor, range }) => {
      insertColumnBlock(editor, range, 4);
    },
  },
  // Text colors
  {
    id: 'rouge',
    label: 'Texte rouge',
    description: 'Colorier le texte en rouge',
    icon: Palette,
    category: 'Couleurs',
    swatchColor: '#EF4444',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setColor('#EF4444').run();
    },
  },
  {
    id: 'orange',
    label: 'Texte orange',
    description: 'Colorier le texte en orange',
    icon: Palette,
    category: 'Couleurs',
    swatchColor: '#F97316',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setColor('#F97316').run();
    },
  },
  {
    id: 'vert',
    label: 'Texte vert',
    description: 'Colorier le texte en vert',
    icon: Palette,
    category: 'Couleurs',
    swatchColor: '#10B981',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setColor('#10B981').run();
    },
  },
  {
    id: 'bleu',
    label: 'Texte bleu',
    description: 'Colorier le texte en bleu',
    icon: Palette,
    category: 'Couleurs',
    swatchColor: '#3B82F6',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setColor('#3B82F6').run();
    },
  },
  {
    id: 'violet',
    label: 'Texte violet',
    description: 'Colorier le texte en violet',
    icon: Palette,
    category: 'Couleurs',
    swatchColor: '#8B5CF6',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setColor('#8B5CF6').run();
    },
  },
  {
    id: 'rose',
    label: 'Texte rose',
    description: 'Colorier le texte en rose',
    icon: Palette,
    category: 'Couleurs',
    swatchColor: '#EC4899',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setColor('#EC4899').run();
    },
  },
  // Highlights
  {
    id: 's-jaune',
    label: 'Surligner jaune',
    description: 'Surligner en jaune',
    icon: Highlighter,
    category: 'Couleurs',
    swatchColor: '#FDE047',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight({ color: '#FDE047' }).run();
    },
  },
  {
    id: 's-vert',
    label: 'Surligner vert',
    description: 'Surligner en vert',
    icon: Highlighter,
    category: 'Couleurs',
    swatchColor: '#86EFAC',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight({ color: '#86EFAC' }).run();
    },
  },
  {
    id: 's-bleu',
    label: 'Surligner bleu',
    description: 'Surligner en bleu',
    icon: Highlighter,
    category: 'Couleurs',
    swatchColor: '#93C5FD',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight({ color: '#93C5FD' }).run();
    },
  },
  {
    id: 's-rose',
    label: 'Surligner rose',
    description: 'Surligner en rose',
    icon: Highlighter,
    category: 'Couleurs',
    swatchColor: '#FBCFE8',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight({ color: '#FBCFE8' }).run();
    },
  },
  {
    id: 's-orange',
    label: 'Surligner orange',
    description: 'Surligner en orange',
    icon: Highlighter,
    category: 'Couleurs',
    swatchColor: '#FDBA74',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight({ color: '#FDBA74' }).run();
    },
  },
  {
    id: 's-violet',
    label: 'Surligner violet',
    description: 'Surligner en violet',
    icon: Highlighter,
    category: 'Couleurs',
    swatchColor: '#DDD6FE',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).toggleHighlight({ color: '#DDD6FE' }).run();
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
          setSelectedIndex((prev) => Math.max(0, prev - 2));
          return true;
        }
        if (event.key === 'ArrowDown') {
          setSelectedIndex((prev) => Math.min(items.length - 1, prev + 2));
          return true;
        }
        if (event.key === 'ArrowLeft') {
          setSelectedIndex((prev) => Math.max(0, prev - 1));
          return true;
        }
        if (event.key === 'ArrowRight') {
          setSelectedIndex((prev) => Math.min(items.length - 1, prev + 1));
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
        <div className="bg-card border border-border rounded-lg shadow-lg p-3 min-w-[420px]">
          <p className="text-xs text-muted-foreground">Aucune commande trouvée</p>
        </div>
      );
    }

    const categories = Array.from(new Set(items.map(i => i.category)));

    const indexedItems = items.map((item, idx) => ({ item, flatIdx: idx }));
    const categoryGroups = categories.map((cat) => ({
      cat,
      catItems: indexedItems.filter(({ item }) => item.category === cat),
    }));

    return (
      <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden min-w-[440px] max-h-[380px] overflow-y-auto">
        <div className="px-3 py-1.5 border-b border-border bg-muted/30">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
            Commandes
          </p>
        </div>
        <div className="p-2 space-y-1">
          {categoryGroups.map(({ cat, catItems }) => (
            <div key={cat}>
              <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-widest px-1 py-0.5 mb-0.5">
                {cat}
              </p>
              <div className="grid grid-cols-2 gap-0.5">
                {catItems.map(({ item, flatIdx }) => {
                  const Icon = item.icon;
                  const isSelected = flatIdx === selectedIndex;
                  return (
                    <button
                      key={item.id}
                      onClick={() => selectItem(flatIdx)}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded text-left transition-colors ${
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted/60 text-foreground'
                      }`}
                      data-testid={`slash-command-${item.id}`}
                    >
                      <div
                        className={`flex-shrink-0 flex items-center justify-center w-6 h-6 rounded ${
                          item.swatchColor ? '' : (isSelected ? 'bg-primary/20' : 'bg-muted')
                        }`}
                        style={item.swatchColor ? { backgroundColor: item.swatchColor } : undefined}
                      >
                        {item.swatchColor ? null : <Icon className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-[11px] font-medium truncate">{item.label}</span>
                          <code className="text-[9px] px-1 py-px bg-muted rounded text-muted-foreground shrink-0">
                            /{item.id}
                          </code>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="px-3 py-1.5 border-t border-border bg-muted/30">
          <p className="text-[9px] text-muted-foreground flex gap-2">
            <span><kbd className="px-1 py-px bg-muted rounded">↑↓←→</kbd> Naviguer</span>
            <span><kbd className="px-1 py-px bg-muted rounded">Entrée</kbd> Valider</span>
            <span><kbd className="px-1 py-px bg-muted rounded">Échap</kbd> Annuler</span>
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
