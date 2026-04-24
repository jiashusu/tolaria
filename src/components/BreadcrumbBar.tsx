import { memo, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { VaultEntry } from '../types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ActionTooltip, type ActionTooltipCopy } from '@/components/ui/action-tooltip'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  GitBranch,
  Code,
  Sparkle,
  SlidersHorizontal,
  Trash,
  Archive,
  ArrowUUpLeft,
  Star,
  CheckCircle,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import { NoteTitleIcon } from './NoteTitleIcon'
import { slugify } from '../hooks/useNoteCreation'
import { useDragRegion } from '../hooks/useDragRegion'

interface BreadcrumbBarProps {
  entry: VaultEntry
  wordCount: number
  showDiffToggle: boolean
  diffMode: boolean
  diffLoading: boolean
  onToggleDiff: () => void
  rawMode?: boolean
  onToggleRaw?: () => void
  forceRawMode?: boolean
  showAIChat?: boolean
  onToggleAIChat?: () => void
  inspectorCollapsed?: boolean
  onToggleInspector?: () => void
  onToggleFavorite?: () => void
  onToggleOrganized?: () => void
  onDelete?: () => void
  onArchive?: () => void
  onUnarchive?: () => void
  onRenameFilename?: (path: string, newFilenameStem: string) => void
  barRef?: React.Ref<HTMLDivElement>
}

const DISABLED_ICON_STYLE = { opacity: 0.4, cursor: 'not-allowed' } as const
const BREADCRUMB_ICON_CLASS = 'size-[16px]'

function focusFilenameInput(
  isEditing: boolean,
  inputRef: React.RefObject<HTMLInputElement | null>,
) {
  if (!isEditing) return
  inputRef.current?.focus()
  inputRef.current?.select()
}

function beginFilenameEditing(
  onRenameFilename: BreadcrumbBarProps['onRenameFilename'],
  filenameStem: string,
  setDraftStem: (value: string) => void,
  setIsEditing: (value: boolean) => void,
) {
  if (!onRenameFilename) return
  setDraftStem(filenameStem)
  setIsEditing(true)
}

function resolveFilenameRenameTarget(draftStem: string, filenameStem: string): string | null {
  const nextStem = normalizeFilenameStemInput(draftStem)
  if (!nextStem || nextStem === filenameStem) return null
  return nextStem
}

function handleFilenameInputKeyDown(
  event: KeyboardEvent<HTMLInputElement>,
  submitRename: () => void,
  cancelEditing: () => void,
) {
  switch (event.key) {
    case 'Enter':
      event.preventDefault()
      submitRename()
      return
    case 'Escape':
      event.preventDefault()
      cancelEditing()
      return
    default:
      return
  }
}

function IconActionButton({
  copy,
  onClick,
  className,
  style,
  children,
  testId,
  tooltipAlign,
}: {
  copy: ActionTooltipCopy
  onClick?: () => void
  className?: string
  style?: CSSProperties
  children: ReactNode
  testId?: string
  tooltipAlign?: 'start' | 'center' | 'end'
}) {
  return (
    <ActionTooltip copy={copy} side="bottom" align={tooltipAlign}>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className={cn('text-muted-foreground [&_svg:not([class*=size-])]:size-4', className)}
        style={style}
        onClick={onClick}
        aria-label={copy.label}
        aria-disabled={onClick ? undefined : true}
        data-testid={testId}
      >
        {children}
      </Button>
    </ActionTooltip>
  )
}

function RawToggleButton({ rawMode, onToggleRaw }: { rawMode?: boolean; onToggleRaw?: () => void }) {
  const { t } = useTranslation()
  const copy: ActionTooltipCopy = {
    label: rawMode ? t('breadcrumb.raw_close') : t('breadcrumb.raw_open'),
    shortcut: '⌘\\',
  }
  return (
    <IconActionButton
      copy={copy}
      onClick={onToggleRaw}
      className={cn(rawMode ? 'text-foreground' : 'hover:text-foreground')}
    >
      <Code size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function FavoriteAction({ favorite, onToggleFavorite }: { favorite: boolean; onToggleFavorite?: () => void }) {
  const { t } = useTranslation()
  const copy: ActionTooltipCopy = {
    label: favorite ? t('breadcrumb.favorite_remove') : t('breadcrumb.favorite_add'),
    shortcut: '⌘D',
  }
  return (
    <IconActionButton
      copy={copy}
      onClick={onToggleFavorite}
      className={cn(favorite ? 'text-yellow-500' : 'hover:text-foreground')}
    >
      <Star size={16} weight={favorite ? 'fill' : 'regular'} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function OrganizedAction({
  organized,
  onToggleOrganized,
}: {
  organized: boolean
  onToggleOrganized?: () => void
}) {
  const { t } = useTranslation()

  if (!onToggleOrganized) return null
  const copy: ActionTooltipCopy = {
    label: organized ? t('breadcrumb.organized_unset') : t('breadcrumb.organized_set'),
    shortcut: '⌘E',
  }
  return (
    <IconActionButton
      copy={copy}
      onClick={onToggleOrganized}
      className={cn(organized ? 'text-green-600' : 'hover:text-foreground')}
    >
      <CheckCircle size={16} weight={organized ? 'fill' : 'regular'} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function DiffAction({
  showDiffToggle,
  diffMode,
  diffLoading,
  onToggleDiff,
}: Pick<BreadcrumbBarProps, 'showDiffToggle' | 'diffMode' | 'diffLoading' | 'onToggleDiff'>) {
  const { t } = useTranslation()

  if (!showDiffToggle) {
    return (
      <IconActionButton copy={{ label: t('breadcrumb.diff_unavailable') }} style={DISABLED_ICON_STYLE}>
        <GitBranch size={16} className={BREADCRUMB_ICON_CLASS} />
      </IconActionButton>
    )
  }

  const copy: ActionTooltipCopy = diffLoading
    ? { label: t('breadcrumb.diff_loading') }
    : { label: diffMode ? t('breadcrumb.diff_close') : t('breadcrumb.diff_show') }
  return (
    <IconActionButton
      copy={copy}
      onClick={onToggleDiff}
      className={cn(diffMode ? 'text-foreground' : 'hover:text-foreground')}
    >
      <GitBranch size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function AIChatAction({ showAIChat, onToggleAIChat }: Pick<BreadcrumbBarProps, 'showAIChat' | 'onToggleAIChat'>) {
  const { t } = useTranslation()
  const copy: ActionTooltipCopy = {
    label: showAIChat ? t('breadcrumb.ai_close') : t('breadcrumb.ai_open'),
    shortcut: '⇧⌘L',
  }
  return (
    <IconActionButton
      copy={copy}
      onClick={onToggleAIChat}
      className={cn(showAIChat ? 'text-primary' : 'hover:text-foreground')}
    >
      <Sparkle size={16} weight={showAIChat ? 'fill' : 'regular'} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function ArchiveAction({
  archived,
  onArchive,
  onUnarchive,
}: Pick<VaultEntry, 'archived'> & Pick<BreadcrumbBarProps, 'onArchive' | 'onUnarchive'>) {
  const { t } = useTranslation()

  if (archived) {
    return (
      <IconActionButton copy={{ label: t('breadcrumb.unarchive') }} onClick={onUnarchive} className="hover:text-foreground">
        <ArrowUUpLeft size={16} className={BREADCRUMB_ICON_CLASS} />
      </IconActionButton>
    )
  }

  return (
    <IconActionButton copy={{ label: t('breadcrumb.archive') }} onClick={onArchive} className="hover:text-foreground">
      <Archive size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function DeleteAction({ onDelete }: Pick<BreadcrumbBarProps, 'onDelete'>) {
  const { t } = useTranslation()
  return (
    <IconActionButton copy={{ label: t('breadcrumb.delete'), shortcut: '⌘⌫' }} onClick={onDelete} className="hover:text-destructive">
      <Trash size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function InspectorAction({
  inspectorCollapsed,
  onToggleInspector,
}: Pick<BreadcrumbBarProps, 'inspectorCollapsed' | 'onToggleInspector'>) {
  const { t } = useTranslation()

  if (!inspectorCollapsed) return null
  return (
    <IconActionButton copy={{ label: t('breadcrumb.inspector_open'), shortcut: '⌘⇧I' }} onClick={onToggleInspector} className="hover:text-foreground" tooltipAlign="end">
      <SlidersHorizontal size={16} className={BREADCRUMB_ICON_CLASS} />
    </IconActionButton>
  )
}

function normalizeFilenameStemInput(value: string): string {
  const trimmed = value.trim()
  return trimmed.replace(/\.md$/i, '').trim()
}

function deriveSyncStem(entry: VaultEntry): string | null {
  const expectedStem = slugify(entry.title.trim())
  const filenameStem = entry.filename.replace(/\.md$/, '')
  if (!expectedStem || expectedStem === filenameStem) return null
  return expectedStem
}

function FilenameInput({
  inputRef,
  draftStem,
  onDraftStemChange,
  onBlur,
  onKeyDown,
  ariaLabel,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  draftStem: string
  onDraftStemChange: (nextValue: string) => void
  onBlur: () => void
  onKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  ariaLabel: string
}) {
  return (
    <Input
      ref={inputRef}
      value={draftStem}
      onChange={(event) => onDraftStemChange(event.target.value)}
      onBlur={onBlur}
      onKeyDown={onKeyDown}
      className="h-7 w-[180px] text-sm"
      data-testid="breadcrumb-filename-input"
      aria-label={ariaLabel}
    />
  )
}

function FilenameTrigger({
  entry,
  filenameStem,
  onStartEditing,
  ariaLabel,
}: {
  entry: VaultEntry
  filenameStem: string
  onStartEditing: () => void
  ariaLabel: string
}) {
  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'Enter') return
    event.preventDefault()
    onStartEditing()
  }, [onStartEditing])

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      className="h-auto min-w-0 gap-1 px-0 py-0 text-sm font-medium text-foreground hover:bg-transparent hover:text-foreground"
      onDoubleClick={onStartEditing}
      onKeyDown={handleKeyDown}
      data-testid="breadcrumb-filename-trigger"
      aria-label={ariaLabel}
    >
      <NoteTitleIcon icon={entry.icon} size={15} testId="breadcrumb-note-icon" />
      <span className="truncate">{filenameStem}</span>
    </Button>
  )
}

function SyncFilenameButton({
  entryPath,
  syncStem,
  onRenameFilename,
  label,
}: {
  entryPath: string
  syncStem: string | null
  onRenameFilename?: (path: string, newFilenameStem: string) => void
  label: string
}) {
  if (!syncStem || !onRenameFilename) return null
  return (
    <ActionTooltip copy={{ label }} side="bottom">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => onRenameFilename(entryPath, syncStem)}
        data-testid="breadcrumb-sync-button"
        aria-label={label}
      >
        <ArrowsClockwise size={14} />
      </Button>
    </ActionTooltip>
  )
}

function FilenameDisplay({
  entry,
  filenameStem,
  syncStem,
  onRenameFilename,
  onStartEditing,
  triggerAriaLabel,
  syncLabel,
}: {
  entry: VaultEntry
  filenameStem: string
  syncStem: string | null
  onRenameFilename?: (path: string, newFilenameStem: string) => void
  onStartEditing: () => void
  triggerAriaLabel: string
  syncLabel: string
}) {
  return (
    <div className="flex min-w-0 items-center gap-1">
      <FilenameTrigger entry={entry} filenameStem={filenameStem} onStartEditing={onStartEditing} ariaLabel={triggerAriaLabel} />
      <SyncFilenameButton entryPath={entry.path} syncStem={syncStem} onRenameFilename={onRenameFilename} label={syncLabel} />
    </div>
  )
}

function FilenameCrumb({ entry, onRenameFilename }: Pick<BreadcrumbBarProps, 'entry' | 'onRenameFilename'>) {
  const { t } = useTranslation()
  const filenameStem = useMemo(() => entry.filename.replace(/\.md$/, ''), [entry.filename])
  const syncStem = useMemo(() => deriveSyncStem(entry), [entry])
  const [isEditing, setIsEditing] = useState(false)
  const [draftStem, setDraftStem] = useState(filenameStem)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    focusFilenameInput(isEditing, inputRef)
  }, [isEditing])

  const startEditing = useCallback(() => {
    beginFilenameEditing(onRenameFilename, filenameStem, setDraftStem, setIsEditing)
  }, [onRenameFilename, filenameStem])

  const cancelEditing = useCallback(() => {
    setDraftStem(filenameStem)
    setIsEditing(false)
  }, [filenameStem])

  const submitRename = useCallback(() => {
    setIsEditing(false)
    const nextStem = resolveFilenameRenameTarget(draftStem, filenameStem)
    if (!nextStem) return
    onRenameFilename?.(entry.path, nextStem)
  }, [draftStem, filenameStem, onRenameFilename, entry.path])

  const handleInputKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    handleFilenameInputKeyDown(event, submitRename, cancelEditing)
  }, [submitRename, cancelEditing])

  if (isEditing) {
    return (
      <FilenameInput
        inputRef={inputRef}
        draftStem={draftStem}
        onDraftStemChange={setDraftStem}
        onBlur={submitRename}
        onKeyDown={handleInputKeyDown}
        ariaLabel={t('breadcrumb.rename_label')}
      />
    )
  }

  return (
    <FilenameDisplay
      entry={entry}
      filenameStem={filenameStem}
      syncStem={syncStem}
      onRenameFilename={onRenameFilename}
      onStartEditing={startEditing}
      triggerAriaLabel={t('breadcrumb.filename_aria', { stem: filenameStem })}
      syncLabel={t('breadcrumb.sync_filename')}
    />
  )
}

function BreadcrumbActions({
  entry,
  showDiffToggle,
  diffMode,
  diffLoading,
  onToggleDiff,
  rawMode,
  onToggleRaw,
  forceRawMode,
  showAIChat,
  onToggleAIChat,
  inspectorCollapsed,
  onToggleInspector,
  onToggleFavorite,
  onToggleOrganized,
  onDelete,
  onArchive,
  onUnarchive,
}: Omit<BreadcrumbBarProps, 'wordCount' | 'barRef' | 'onRenameFilename'>) {
  return (
    <div className="breadcrumb-bar__actions ml-auto flex items-center" style={{ gap: 12 }}>
      <FavoriteAction favorite={entry.favorite} onToggleFavorite={onToggleFavorite} />
      <OrganizedAction organized={entry.organized} onToggleOrganized={onToggleOrganized} />
      <DiffAction
        showDiffToggle={showDiffToggle}
        diffMode={diffMode}
        diffLoading={diffLoading}
        onToggleDiff={onToggleDiff}
      />
      {!forceRawMode && <RawToggleButton rawMode={rawMode} onToggleRaw={onToggleRaw} />}
      <AIChatAction showAIChat={showAIChat} onToggleAIChat={onToggleAIChat} />
      <ArchiveAction archived={entry.archived} onArchive={onArchive} onUnarchive={onUnarchive} />
      <DeleteAction onDelete={onDelete} />
      <InspectorAction inspectorCollapsed={inspectorCollapsed} onToggleInspector={onToggleInspector} />
    </div>
  )
}

function BreadcrumbTitle({
  entry,
  onRenameFilename,
}: Pick<BreadcrumbBarProps, 'entry' | 'onRenameFilename'>) {
  const { t } = useTranslation()
  const typeLabel = entry.isA ?? t('breadcrumb.type_fallback')
  return (
    <div className="flex items-center gap-1.5 min-w-0 text-sm text-muted-foreground">
      <span className="shrink-0">{typeLabel}</span>
      <span className="shrink-0 text-border">›</span>
      <div className="flex min-w-0 items-center gap-1 truncate">
        <FilenameCrumb entry={entry} onRenameFilename={onRenameFilename} />
      </div>
    </div>
  )
}

export const BreadcrumbBar = memo(function BreadcrumbBar({
  entry,
  barRef,
  onRenameFilename,
  ...actionProps
}: BreadcrumbBarProps) {
  const { onMouseDown } = useDragRegion()

  return (
    <TooltipProvider>
      <div
        ref={barRef}
        data-tauri-drag-region
        data-title-hidden=""
        onMouseDown={onMouseDown}
        className="breadcrumb-bar flex shrink-0 items-center border-b border-transparent"
        style={{
          height: 52,
          background: 'var(--background)',
          padding: '6px 16px',
          boxSizing: 'border-box',
        }}
      >
        <div className="breadcrumb-bar__title min-w-0">
          <BreadcrumbTitle entry={entry} onRenameFilename={onRenameFilename} />
        </div>
        <div
          aria-hidden="true"
          data-tauri-drag-region
          className="breadcrumb-bar__drag-spacer min-w-0 flex-1"
        />
        <BreadcrumbActions entry={entry} {...actionProps} />
      </div>
    </TooltipProvider>
  )
})
