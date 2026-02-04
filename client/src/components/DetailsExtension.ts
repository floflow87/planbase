import { Node, mergeAttributes } from '@tiptap/core';

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { open: true, class: 'collapsible-section' }), 0];
  },

  addKeyboardShortcuts() {
    return {
      'Enter': ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        
        const detailsContent = $from.node($from.depth - 1);
        if (detailsContent?.type.name === 'detailsContent') {
          const currentNode = $from.parent;
          const isEmptyParagraph = currentNode.type.name === 'paragraph' && currentNode.textContent === '';
          
          if (isEmptyParagraph) {
            const $beforePrevPos = $from.before($from.depth - 1);
            if ($beforePrevPos > 0) {
              const prevNode = editor.state.doc.resolve($beforePrevPos - 1).parent;
              if (prevNode.type.name === 'paragraph' && prevNode.textContent === '') {
                editor.chain()
                  .deleteRange({ from: $from.pos - 2, to: $from.pos })
                  .insertContentAt($from.pos - 2, { type: 'paragraph' })
                  .focus()
                  .run();
                return true;
              }
            }
          }
        }
        return false;
      },
    };
  },
});

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes, { class: 'collapsible-summary' }), 0];
  },

  addKeyboardShortcuts() {
    return {
      'Enter': ({ editor }) => {
        const { selection } = editor.state;
        const { $from } = selection;
        
        if ($from.parent.type.name === 'detailsSummary') {
          const detailsPos = $from.after($from.depth);
          
          editor.commands.setTextSelection(detailsPos + 2);
          return true;
        }
        return false;
      },
    };
  },
});

export const DetailsContent = Node.create({
  name: 'detailsContent',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div.details-content' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'details-content' }), 0];
  },
});
