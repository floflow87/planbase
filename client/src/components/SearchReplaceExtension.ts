import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

export interface SearchPluginState {
  term: string;
  matches: { from: number; to: number }[];
  currentIndex: number;
}

export const searchPluginKey = new PluginKey<SearchPluginState>('searchReplace');

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function findAllMatches(doc: any, term: string): { from: number; to: number }[] {
  if (!term) return [];
  const matches: { from: number; to: number }[] = [];
  const re = new RegExp(escapeRegex(term), 'gi');
  doc.descendants((node: any, pos: number) => {
    if (node.isText && node.text) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(node.text)) !== null) {
        matches.push({ from: pos + m.index, to: pos + m.index + m[0].length });
      }
    }
  });
  return matches;
}

export const SearchReplaceExtension = Extension.create({
  name: 'searchReplace',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init(): SearchPluginState {
            return { term: '', matches: [], currentIndex: 0 };
          },
          apply(tr, prev): SearchPluginState {
            const meta = tr.getMeta(searchPluginKey) as Partial<SearchPluginState> | undefined;
            const newTerm = meta?.term !== undefined ? meta.term : prev.term;
            const matches =
              tr.docChanged || meta?.term !== undefined
                ? findAllMatches(tr.doc, newTerm)
                : prev.matches;
            const clampedIndex =
              meta?.currentIndex !== undefined
                ? Math.min(meta.currentIndex, Math.max(0, matches.length - 1))
                : Math.min(prev.currentIndex, Math.max(0, matches.length - 1));
            return { term: newTerm, matches, currentIndex: clampedIndex };
          },
        },
        props: {
          decorations(state) {
            const ps = searchPluginKey.getState(state);
            if (!ps || !ps.term || ps.matches.length === 0) return DecorationSet.empty;
            const decos = ps.matches.map((m, i) =>
              Decoration.inline(m.from, m.to, {
                style:
                  i === ps.currentIndex
                    ? 'background-color:#f59e0b;color:#1f2937;border-radius:2px;outline:2px solid #d97706;'
                    : 'background-color:#fef3c7;color:#1f2937;border-radius:2px;',
              })
            );
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },

  addCommands() {
    return {
      srSetTerm:
        (term: string) =>
        ({ tr, dispatch }: any) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { term, currentIndex: 0 });
            dispatch(tr);
          }
          return true;
        },

      srClearTerm:
        () =>
        ({ tr, dispatch }: any) => {
          if (dispatch) {
            tr.setMeta(searchPluginKey, { term: '', currentIndex: 0 });
            dispatch(tr);
          }
          return true;
        },

      srFindNext:
        () =>
        ({ tr, dispatch, state }: any) => {
          const ps = searchPluginKey.getState(state);
          if (!ps || ps.matches.length === 0) return false;
          const next = (ps.currentIndex + 1) % ps.matches.length;
          if (dispatch) {
            tr.setMeta(searchPluginKey, { currentIndex: next });
            dispatch(tr);
          }
          return true;
        },

      srFindPrev:
        () =>
        ({ tr, dispatch, state }: any) => {
          const ps = searchPluginKey.getState(state);
          if (!ps || ps.matches.length === 0) return false;
          const prev = (ps.currentIndex - 1 + ps.matches.length) % ps.matches.length;
          if (dispatch) {
            tr.setMeta(searchPluginKey, { currentIndex: prev });
            dispatch(tr);
          }
          return true;
        },

      srReplaceOne:
        (replaceTerm: string) =>
        ({ tr, dispatch, state }: any) => {
          const ps = searchPluginKey.getState(state);
          if (!ps || ps.matches.length === 0) return false;
          const match = ps.matches[ps.currentIndex];
          if (!match) return false;
          if (dispatch) {
            if (replaceTerm) {
              tr.replaceWith(match.from, match.to, state.schema.text(replaceTerm));
            } else {
              tr.delete(match.from, match.to);
            }
            dispatch(tr);
          }
          return true;
        },

      srReplaceAll:
        (replaceTerm: string) =>
        ({ tr, dispatch, state }: any) => {
          const ps = searchPluginKey.getState(state);
          if (!ps || ps.matches.length === 0 || !dispatch) return false;
          const reversed = [...ps.matches].reverse();
          for (const m of reversed) {
            if (replaceTerm) {
              tr.replaceWith(m.from, m.to, state.schema.text(replaceTerm));
            } else {
              tr.delete(m.from, m.to);
            }
          }
          tr.setMeta(searchPluginKey, { term: '', currentIndex: 0 });
          dispatch(tr);
          return true;
        },
    } as any;
  },
});

export function getSearchPluginState(editor: any): SearchPluginState | null {
  if (!editor) return null;
  return searchPluginKey.getState(editor.state) ?? null;
}
