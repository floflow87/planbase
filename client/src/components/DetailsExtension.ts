import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    details: {
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
        parseHTML: element => element.getAttribute('data-open') === 'true',
        renderHTML: attributes => {
          return { 'data-open': attributes.open ? 'true' : 'false' };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="collapsible"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'collapsible', class: 'collapsible-section' }), 0];
  },

  addCommands() {
    return {
      setDetails: () => ({ commands }) => {
        return commands.insertContent({
          type: 'details',
          attrs: { open: true },
          content: [
            { type: 'detailsSummary', content: [{ type: 'text', text: 'Cliquez pour modifier le titre' }] },
            { type: 'detailsContent', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Contenu...' }] }] }
          ]
        });
      },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor, HTMLAttributes }) => {
      const dom = document.createElement('div');
      dom.classList.add('collapsible-section');
      dom.setAttribute('data-type', 'collapsible');
      dom.setAttribute('data-open', node.attrs.open ? 'true' : 'false');

      const contentDOM = document.createElement('div');
      contentDOM.classList.add('collapsible-content-wrapper');
      dom.appendChild(contentDOM);

      return {
        dom,
        contentDOM,
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'details') return false;
          dom.setAttribute('data-open', updatedNode.attrs.open ? 'true' : 'false');
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
  selectable: true,

  parseHTML() {
    return [{ tag: 'div[data-type="collapsible-summary"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'collapsible-summary', class: 'collapsible-summary' }), 0];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const dom = document.createElement('div');
      dom.classList.add('collapsible-summary');
      dom.setAttribute('data-type', 'collapsible-summary');

      // Create toggle button
      const toggleBtn = document.createElement('button');
      toggleBtn.type = 'button';
      toggleBtn.classList.add('collapsible-toggle');
      toggleBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>';
      toggleBtn.contentEditable = 'false';
      
      toggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        if (typeof getPos === 'function') {
          const pos = getPos();
          // Find the parent details node
          const $pos = editor.state.doc.resolve(pos);
          for (let d = $pos.depth; d >= 0; d--) {
            const parentNode = $pos.node(d);
            if (parentNode.type.name === 'details') {
              const parentPos = $pos.before(d);
              editor.view.dispatch(
                editor.state.tr.setNodeMarkup(parentPos, undefined, {
                  ...parentNode.attrs,
                  open: !parentNode.attrs.open,
                })
              );
              break;
            }
          }
        }
      });

      // Content container
      const contentDOM = document.createElement('span');
      contentDOM.classList.add('collapsible-summary-text');

      dom.appendChild(toggleBtn);
      dom.appendChild(contentDOM);

      return {
        dom,
        contentDOM,
      };
    };
  },
});

export const DetailsContent = Node.create({
  name: 'detailsContent',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-type="collapsible-content"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'collapsible-content', class: 'details-content' }), 0];
  },
});
