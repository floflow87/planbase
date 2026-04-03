import { Node, mergeAttributes } from '@tiptap/core';

export const Column = Node.create({
  name: 'column',
  content: 'block+',
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-type="column"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'column', class: 'tiptap-column' }), 0];
  },

  addNodeView() {
    return () => {
      const dom = document.createElement('div');
      dom.setAttribute('data-type', 'column');
      dom.classList.add('tiptap-column');
      return { dom, contentDOM: dom };
    };
  },
});

export const ColumnBlock = Node.create({
  name: 'columnBlock',
  group: 'block',
  content: 'column+',
  defining: true,

  addAttributes() {
    return {
      columns: {
        default: 2,
        parseHTML: (element) => parseInt(element.getAttribute('data-columns') || '2', 10),
        renderHTML: (attributes) => ({ 'data-columns': attributes.columns }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="column-block"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-type': 'column-block',
        class: `tiptap-column-block columns-${HTMLAttributes['data-columns']}`,
      }),
      0,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const dom = document.createElement('div');
      dom.setAttribute('data-type', 'column-block');
      dom.setAttribute('data-columns', String(node.attrs.columns));
      dom.classList.add('tiptap-column-block');
      dom.classList.add(`columns-${node.attrs.columns}`);
      return { dom, contentDOM: dom };
    };
  },
});

function makeColumnBlockContent(columns: number): object {
  return {
    type: 'columnBlock',
    attrs: { columns },
    content: Array.from({ length: columns }, () => ({
      type: 'column',
      content: [{ type: 'paragraph' }],
    })),
  };
}

export function insertColumnBlock(editor: any, range: any, columns: number) {
  editor
    .chain()
    .focus()
    .deleteRange(range)
    .insertContent(makeColumnBlockContent(columns))
    .run();
}
