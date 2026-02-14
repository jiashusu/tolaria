import { useEffect, useRef } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'
import { livePreview } from './livePreview'
import type { VaultEntry } from '../types'
import './Editor.css'

interface EditorProps {
  content: string
  selectedNote: VaultEntry | null
}

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
  },
  '.cm-scroller': {
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    padding: '16px 0',
  },
  '.cm-content': {
    padding: '0 24px',
    maxWidth: '800px',
  },
  '.cm-gutters': {
    background: '#0f0f1a',
    border: 'none',
    color: '#444',
  },
  '.cm-activeLineGutter': {
    background: '#1a1a2e',
  },
  '.cm-activeLine': {
    background: '#1a1a2e',
  },
  '.cm-cursor': {
    borderLeftColor: '#e0e0e0',
  },
  '.cm-selectionBackground': {
    background: '#2a2a5a !important',
  },
  '&.cm-focused .cm-selectionBackground': {
    background: '#2a2a5a !important',
  },
})

export function Editor({ content, selectedNote }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)

  // Create/destroy editor view
  useEffect(() => {
    if (!containerRef.current) return

    const state = EditorState.create({
      doc: content,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        bracketMatching(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        oneDark,
        editorTheme,
        livePreview(),
        keymap.of([...defaultKeymap, ...historyKeymap]),
        EditorView.lineWrapping,
      ],
    })

    const view = new EditorView({
      state,
      parent: containerRef.current,
    })

    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
  // Re-create editor when the selected note changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNote?.path])

  // Update content when it loads (async content fetch)
  useEffect(() => {
    const view = viewRef.current
    if (!view) return

    const currentDoc = view.state.doc.toString()
    if (currentDoc !== content) {
      view.dispatch({
        changes: { from: 0, to: currentDoc.length, insert: content },
      })
    }
  }, [content])

  if (!selectedNote) {
    return (
      <div className="editor">
        <div className="editor__placeholder">
          <p>Select a note to start editing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="editor">
      <div className="editor__cm-container" ref={containerRef} />
    </div>
  )
}
