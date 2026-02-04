import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    details: {
      toggleDetailsOpen: () => ReturnType;
    };
  }
}

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,
  isolating: true,

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
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      if (typeof document === 'undefined') {
        return {};
      }
      
      const dom = document.createElement('details');
      dom.classList.add('collapsible-section');
      if (node.attrs.open) {
        dom.setAttribute('open', '');
      }

      const contentDOM = document.createElement('div');
      contentDOM.style.display = 'contents';
      dom.appendChild(contentDOM);

      dom.addEventListener('toggle', () => {
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos !== undefined) {
            const currentNode = editor.state.doc.nodeAt(pos);
            if (currentNode && currentNode.attrs.open !== dom.open) {
              editor.view.dispatch(
                editor.state.tr.setNodeMarkup(pos, undefined, {
                  ...currentNode.attrs,
                  open: dom.open,
                })
              );
            }
          }
        }
      });

      return {
        dom,
        contentDOM,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'details') {
            return false;
          }
          if (updatedNode.attrs.open !== dom.open) {
            if (updatedNode.attrs.open) {
              dom.setAttribute('open', '');
            } else {
              dom.removeAttribute('open');
            }
          }
          return true;
        },
      };
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
      { tag: 'details > summary' },
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
  isolating: true,

  parseHTML() {
    return [
      { tag: 'div.details-content' },
      { tag: 'details > div:not(:first-child)', priority: 50 },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'details-content' }), 0];
  },
});
