import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    details: {
      toggleDetailsOpen: () => ReturnType;
      setDetails: () => ReturnType;
    };
  }
}

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: element => element.hasAttribute('open'),
        renderHTML: attributes => {
          return attributes.open ? { open: '' } : {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes, { class: 'collapsible-section' }), 0];
  },

  addCommands() {
    return {
      toggleDetailsOpen: () => ({ tr, state, dispatch }) => {
        const { selection } = state;
        const { $from } = selection;
        
        let depth = $from.depth;
        while (depth > 0) {
          const node = $from.node(depth);
          if (node.type.name === 'details') {
            if (dispatch) {
              const pos = $from.before(depth);
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                open: !node.attrs.open,
              });
            }
            return true;
          }
          depth--;
        }
        return false;
      },
      setDetails: () => ({ commands }) => {
        return commands.insertContent({
          type: 'details',
          attrs: { open: true },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Cliquez pour modifier le titre' }] },
            { type: 'detailsContent', content: [{ type: 'paragraph' }] }
          ]
        });
      },
    };
  },
});

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [
      { tag: 'summary' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes, { class: 'collapsible-summary' }), 0];
  },
});

export const DetailsContent = Node.create({
  name: 'detailsContent',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [
      { tag: 'div.details-content' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'details-content' }), 0];
  },
});
