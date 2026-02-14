import {
  ViewPlugin, Decoration, EditorView, WidgetType,
  type DecorationSet, type ViewUpdate,
} from '@codemirror/view'
import { type Range, type Extension } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

/**
 * Live preview plugin — Obsidian/Bear-style markdown editing.
 * Hides syntax markers when cursor is NOT on a line, reveals them when it IS.
 */

function isOnCursorLine(view: EditorView, from: number, to: number): boolean {
  for (const range of view.state.selection.ranges) {
    const cursorLine = view.state.doc.lineAt(range.head).number
    const fromLine = view.state.doc.lineAt(from).number
    const toLine = view.state.doc.lineAt(Math.min(to, view.state.doc.length)).number
    if (cursorLine >= fromLine && cursorLine <= toLine) return true
  }
  return false
}

class HrWidget extends WidgetType {
  toDOM() {
    const hr = document.createElement('hr')
    hr.className = 'cm-live-hr'
    return hr
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const decs: Range<Decoration>[] = []
  const tree = syntaxTree(view.state)

  tree.iterate({
    enter: (node) => {
      const { from, to, name } = node

      // Skip nodes on cursor line — reveal raw syntax there
      if (isOnCursorLine(view, from, to)) return

      // ATX Headings: hide "## " marker, style content
      if (/^ATXHeading[1-6]$/.test(name)) {
        const level = parseInt(name.charAt(name.length - 1))
        let markerEnd = from
        const cursor = node.node.cursor()
        if (cursor.firstChild()) {
          do {
            if (cursor.name === 'HeaderMark') {
              markerEnd = cursor.to
            }
          } while (cursor.nextSibling())
        }
        if (markerEnd > from) {
          const afterMarker = view.state.doc.sliceString(markerEnd, Math.min(markerEnd + 1, to))
          const hideEnd = afterMarker === ' ' ? markerEnd + 1 : markerEnd
          decs.push(Decoration.replace({}).range(from, hideEnd))
          decs.push(Decoration.mark({ class: `cm-live-heading cm-live-heading-${level}` }).range(hideEnd, to))
        }
        return false
      }

      // Bold: **text** or __text__
      if (name === 'StrongEmphasis') {
        const text = view.state.doc.sliceString(from, to)
        const marker = text.startsWith('**') ? '**' : text.startsWith('__') ? '__' : null
        if (marker && text.endsWith(marker) && to - from > marker.length * 2) {
          decs.push(Decoration.replace({}).range(from, from + marker.length))
          decs.push(Decoration.mark({ class: 'cm-live-strong' }).range(from + marker.length, to - marker.length))
          decs.push(Decoration.replace({}).range(to - marker.length, to))
        }
        return false
      }

      // Italic: *text* or _text_
      if (name === 'Emphasis') {
        const text = view.state.doc.sliceString(from, to)
        if ((text.startsWith('*') && text.endsWith('*')) || (text.startsWith('_') && text.endsWith('_'))) {
          if (to - from > 2) {
            decs.push(Decoration.replace({}).range(from, from + 1))
            decs.push(Decoration.mark({ class: 'cm-live-em' }).range(from + 1, to - 1))
            decs.push(Decoration.replace({}).range(to - 1, to))
          }
        }
        return false
      }

      // Links: [text](url)
      if (name === 'Link') {
        const cursor = node.node.cursor()
        let textStart = -1
        let textEnd = -1
        let urlPartStart = -1

        if (cursor.firstChild()) {
          do {
            if (cursor.name === 'LinkMark') {
              if (textStart === -1) {
                textStart = cursor.to
              } else if (urlPartStart === -1) {
                textEnd = cursor.from
                urlPartStart = cursor.from
              }
            }
          } while (cursor.nextSibling())
        }

        if (textStart !== -1 && textEnd !== -1 && urlPartStart !== -1) {
          decs.push(Decoration.replace({}).range(from, textStart))
          decs.push(Decoration.mark({ class: 'cm-live-link' }).range(textStart, textEnd))
          decs.push(Decoration.replace({}).range(urlPartStart, to))
        }
        return false
      }

      // Inline code: `code`
      if (name === 'InlineCode') {
        const text = view.state.doc.sliceString(from, to)
        if (text.startsWith('`') && text.endsWith('`') && to - from > 2) {
          decs.push(Decoration.replace({}).range(from, from + 1))
          decs.push(Decoration.mark({ class: 'cm-live-code' }).range(from + 1, to - 1))
          decs.push(Decoration.replace({}).range(to - 1, to))
        }
        return false
      }

      // Horizontal rules: ---, ***, ___
      if (name === 'HorizontalRule') {
        decs.push(Decoration.replace({ widget: new HrWidget() }).range(from, to))
        return false
      }
    },
  })

  return Decoration.set(decs, true)
}

const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet

    constructor(view: EditorView) {
      this.decorations = buildDecorations(view)
    }

    update(update: ViewUpdate) {
      if (update.docChanged || update.selectionSet || update.viewportChanged) {
        this.decorations = buildDecorations(update.view)
      }
    }
  },
  {
    decorations: (v) => v.decorations,
  }
)

const livePreviewTheme = EditorView.theme({
  '.cm-live-heading': {
    fontWeight: '700',
    color: '#e0e0e0',
  },
  '.cm-live-heading-1': {
    fontSize: '1.8em',
    lineHeight: '1.3',
  },
  '.cm-live-heading-2': {
    fontSize: '1.4em',
    lineHeight: '1.3',
  },
  '.cm-live-heading-3': {
    fontSize: '1.2em',
    lineHeight: '1.3',
  },
  '.cm-live-heading-4': {
    fontSize: '1.05em',
    lineHeight: '1.3',
  },
  '.cm-live-heading-5': {
    fontSize: '1em',
    lineHeight: '1.3',
  },
  '.cm-live-heading-6': {
    fontSize: '0.9em',
    lineHeight: '1.3',
    opacity: '0.8',
  },
  '.cm-live-strong': {
    fontWeight: '700',
  },
  '.cm-live-em': {
    fontStyle: 'italic',
  },
  '.cm-live-link': {
    color: '#4a9eff',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  '.cm-live-code': {
    fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", monospace',
    fontSize: '0.9em',
    background: '#1e1e3a',
    padding: '1px 4px',
    borderRadius: '3px',
  },
  '.cm-live-hr': {
    border: 'none',
    borderTop: '1px solid #3a3a5a',
    margin: '8px 0',
  },
})

export function livePreview(): Extension {
  return [livePreviewPlugin, livePreviewTheme]
}
