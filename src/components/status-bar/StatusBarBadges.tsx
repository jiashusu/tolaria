import { useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import {
  AlertTriangle,
  ArrowDown,
  Cpu,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  RefreshCw,
  Terminal,
} from 'lucide-react'
import { GitDiff, Pulse } from '@phosphor-icons/react'
import { ActionTooltip, type ActionTooltipCopy } from '@/components/ui/action-tooltip'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { ClaudeCodeStatus } from '../../hooks/useClaudeCodeStatus'
import type { McpStatus } from '../../hooks/useMcpStatus'
import type { GitRemoteStatus, LastCommitInfo, SyncStatus } from '../../types'
import { openExternalUrl } from '../../utils/url'
import { useDismissibleLayer } from './useDismissibleLayer'
import { ICON_STYLE, SEP_STYLE } from './styles'

const SYNC_ICON_MAP: Record<string, typeof RefreshCw> = {
  syncing: Loader2,
  conflict: AlertTriangle,
  pull_required: ArrowDown,
}

const CLAUDE_INSTALL_URL = 'https://docs.anthropic.com/en/docs/claude-code'

function formatElapsedSync(lastSyncTime: number | null, t: TFunction): string {
  if (!lastSyncTime) return t('status_bar.not_synced')
  const secs = Math.round((Date.now() - lastSyncTime) / 1000)
  return secs < 60
    ? t('status_bar.synced_just_now')
    : t('status_bar.synced_ago', { minutes: Math.floor(secs / 60) })
}

function formatSyncLabel(status: SyncStatus, lastSyncTime: number | null, t: TFunction): string {
  const labels: Record<string, string> = {
    syncing: t('status_bar.syncing'),
    conflict: t('status_bar.conflict'),
    error: t('status_bar.sync_failed'),
    pull_required: t('status_bar.pull_required'),
  }
  return labels[status] ?? formatElapsedSync(lastSyncTime, t)
}

function syncIconColor(status: SyncStatus): string {
  const colors: Record<string, string> = {
    conflict: 'var(--accent-orange)',
    error: 'var(--muted-foreground)',
    pull_required: 'var(--accent-orange)',
  }
  return colors[status] ?? 'var(--accent-green)'
}

function syncBadgeTooltipCopy(status: SyncStatus, t: TFunction): ActionTooltipCopy {
  if (status === 'conflict') return { label: t('status_bar.resolve_conflicts') }
  if (status === 'syncing') return { label: t('status_bar.sync_in_progress') }
  if (status === 'pull_required') return { label: t('status_bar.pull_and_push') }
  if (status === 'error') return { label: t('status_bar.retry_sync') }
  return { label: t('status_bar.sync_now') }
}

function syncStatusText(status: SyncStatus, t: TFunction): string {
  if (status === 'idle') return t('status_bar.synced')
  if (status === 'pull_required') return t('status_bar.pull_required')
  if (status === 'conflict') return t('status_bar.conflicts')
  if (status === 'error') return t('status_bar.error')
  if (status === 'syncing') return t('status_bar.syncing')
  return status
}

function hasRemote(remoteStatus: GitRemoteStatus | null): boolean {
  return remoteStatus?.hasRemote ?? false
}

function isRemoteMissing(remoteStatus: GitRemoteStatus | null | undefined): boolean {
  return remoteStatus?.hasRemote === false
}

function commitButtonTooltipCopy(remoteStatus: GitRemoteStatus | null | undefined, t: TFunction): ActionTooltipCopy {
  return {
    label: isRemoteMissing(remoteStatus)
      ? t('status_bar.commit_local')
      : t('status_bar.commit_and_push'),
  }
}

function getMcpBadgeConfig(status: McpStatus, t: TFunction, onInstall?: () => void) {
  if (status === 'installed' || status === 'checking') return null
  const clickable = status === 'not_installed' && Boolean(onInstall)
  return {
    clickable,
    tooltip: status === 'not_installed' ? t('status_bar.mcp_not_connected') : t('status_bar.mcp_unknown'),
    onClick: clickable ? onInstall : undefined,
  }
}

function getClaudeCodeBadgeConfig(status: ClaudeCodeStatus, t: TFunction, version?: string | null) {
  if (status === 'checking') return null
  const missing = status === 'missing'
  return {
    missing,
    label: missing ? t('status_bar.claude_code_missing') : 'Claude Code',
    tooltip: missing
      ? t('status_bar.claude_not_found')
      : `Claude Code${version ? ` ${version}` : ''}`,
    onActivate: missing ? () => openExternalUrl(CLAUDE_INSTALL_URL) : undefined,
  }
}

function handleStatusBarActionKeyDown(
  event: ReactKeyboardEvent<HTMLButtonElement>,
  onClick?: () => void,
) {
  if (!onClick) return
  if (event.key !== 'Enter' && event.key !== ' ') return
  event.preventDefault()
  onClick()
}

function StatusBarAction({
  copy,
  children,
  onClick,
  testId,
  ariaLabel,
  className,
  style,
  disabled = false,
}: {
  copy: ActionTooltipCopy
  children: ReactNode
  onClick?: () => void
  testId?: string
  ariaLabel?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
}) {
  return (
    <ActionTooltip copy={copy} side="top">
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className={cn(
          'h-auto gap-1 rounded-sm px-1 py-0.5 text-[11px] font-medium text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground',
          disabled && 'cursor-not-allowed opacity-40 hover:bg-transparent hover:text-muted-foreground',
          className,
        )}
        style={style}
        onClick={disabled ? undefined : onClick}
        onKeyDown={(event) => handleStatusBarActionKeyDown(event, disabled ? undefined : onClick)}
        aria-label={ariaLabel ?? copy.label}
        aria-disabled={disabled || undefined}
        data-testid={testId}
      >
        {children}
      </Button>
    </ActionTooltip>
  )
}

function RemoteStatusSummary({ remoteStatus }: { remoteStatus: GitRemoteStatus | null }) {
  const { t } = useTranslation()

  if (!hasRemote(remoteStatus)) {
    return <div style={{ color: 'var(--muted-foreground)', marginBottom: 6 }}>{t('status_bar.no_remote_configured')}</div>
  }

  const ahead = remoteStatus?.ahead ?? 0
  const behind = remoteStatus?.behind ?? 0

  if (ahead === 0 && behind === 0) {
    return <div style={{ display: 'flex', gap: 12, marginBottom: 6, color: 'var(--muted-foreground)' }}>{t('status_bar.in_sync')}</div>
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 6, color: 'var(--muted-foreground)' }}>
      {ahead > 0 && (
        <span title={t('status_bar.ahead', { count: ahead })}>
          {t('status_bar.ahead', { count: ahead })}
        </span>
      )}
      {behind > 0 && (
        <span
          title={t('status_bar.behind', { count: behind })}
          style={{ color: 'var(--accent-orange)' }}
        >
          {t('status_bar.behind', { count: behind })}
        </span>
      )}
    </div>
  )
}

function PullAction({
  remoteStatus,
  onPull,
  onClose,
}: {
  remoteStatus: GitRemoteStatus | null
  onPull?: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()

  if (!hasRemote(remoteStatus)) return null

  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 6, borderTop: '1px solid var(--border)', paddingTop: 6 }}>
      <button
        onClick={() => {
          onPull?.()
          onClose()
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '3px 8px',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 4,
          fontSize: 11,
          color: 'var(--foreground)',
          cursor: 'pointer',
        }}
        onMouseEnter={(event) => { event.currentTarget.style.background = 'var(--hover)' }}
        onMouseLeave={(event) => { event.currentTarget.style.background = 'transparent' }}
        data-testid="git-status-pull-btn"
      >
        <ArrowDown size={11} />
        {t('status_bar.pull')}
      </button>
    </div>
  )
}

function GitStatusPopup({
  status,
  remoteStatus,
  onPull,
  onClose,
}: {
  status: SyncStatus
  remoteStatus: GitRemoteStatus | null
  onPull?: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()

  return (
    <div
      data-testid="git-status-popup"
      style={{
        position: 'absolute',
        bottom: '100%',
        left: 0,
        marginBottom: 4,
        background: 'var(--sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: 8,
        minWidth: 220,
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 1000,
        fontSize: 12,
        color: 'var(--foreground)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <GitBranch size={13} style={{ color: 'var(--muted-foreground)' }} />
        <span style={{ fontWeight: 500 }}>{remoteStatus?.branch || '—'}</span>
      </div>
      <RemoteStatusSummary remoteStatus={remoteStatus} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, color: 'var(--muted-foreground)' }}>
        {t('status_bar.status_label')}: {syncStatusText(status, t)}
      </div>
      <PullAction remoteStatus={remoteStatus} onPull={onPull} onClose={onClose} />
    </div>
  )
}

export function CommitBadge({ info }: { info: LastCommitInfo }) {
  const commitUrl = info.commitUrl

  if (commitUrl) {
    return (
      <span
        role="button"
        onClick={() => openExternalUrl(commitUrl)}
        style={{ ...ICON_STYLE, color: 'var(--muted-foreground)', textDecoration: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 3 }}
        title={`Open commit ${info.shortHash} on GitHub`}
        data-testid="status-commit-link"
        onMouseEnter={(event) => { event.currentTarget.style.color = 'var(--foreground)' }}
        onMouseLeave={(event) => { event.currentTarget.style.color = 'var(--muted-foreground)' }}
      >
        <GitCommitHorizontal size={13} />
        {info.shortHash}
      </span>
    )
  }

  return (
    <span style={ICON_STYLE} data-testid="status-commit-hash">
      <GitCommitHorizontal size={13} />
      {info.shortHash}
    </span>
  )
}

export function OfflineBadge({ isOffline }: { isOffline?: boolean }) {
  const { t } = useTranslation()

  if (!isOffline) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        style={{
          ...ICON_STYLE,
          color: 'var(--destructive, #e03e3e)',
          background: 'rgba(224, 62, 62, 0.12)',
          borderRadius: 999,
          padding: '2px 6px',
          fontWeight: 600,
        }}
        title={t('status_bar.no_internet')}
        data-testid="status-offline"
      >
        <span aria-hidden="true" style={{ fontSize: 10, lineHeight: 1 }}>●</span>
        {t('status_bar.offline')}
      </span>
    </>
  )
}

export function NoRemoteBadge({
  remoteStatus,
  onAddRemote,
}: {
  remoteStatus?: GitRemoteStatus | null
  onAddRemote?: () => void
}) {
  const { t } = useTranslation()

  if (!isRemoteMissing(remoteStatus)) return null

  if (onAddRemote) {
    return (
      <>
        <span style={SEP_STYLE}>|</span>
        <StatusBarAction
          copy={{ label: t('status_bar.add_remote') }}
          onClick={onAddRemote}
          testId="status-no-remote"
        >
          <span style={ICON_STYLE}>
            <GitBranch size={12} />
            {t('status_bar.no_remote')}
          </span>
        </StatusBarAction>
      </>
    )
  }

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <span
        style={{
          ...ICON_STYLE,
          color: 'var(--muted-foreground)',
          background: 'var(--hover)',
          borderRadius: 999,
          padding: '2px 6px',
          fontWeight: 600,
        }}
        title={t('status_bar.no_remote_title')}
        data-testid="status-no-remote"
      >
        <GitBranch size={12} />
        {t('status_bar.no_remote')}
      </span>
    </>
  )
}

export function SyncBadge({
  status,
  lastSyncTime,
  remoteStatus,
  onTriggerSync,
  onPullAndPush,
  onOpenConflictResolver,
}: {
  status: SyncStatus
  lastSyncTime: number | null
  remoteStatus?: GitRemoteStatus | null
  onTriggerSync?: () => void
  onPullAndPush?: () => void
  onOpenConflictResolver?: () => void
}) {
  const { t } = useTranslation()
  const [showPopup, setShowPopup] = useState(false)
  const popupRef = useRef<HTMLDivElement>(null)
  const SyncIcon = SYNC_ICON_MAP[status] ?? RefreshCw
  const isSyncing = status === 'syncing'

  useDismissibleLayer(showPopup, popupRef, () => setShowPopup(false))

  const handleClick = () => {
    if (status === 'conflict') {
      onOpenConflictResolver?.()
      return
    }

    if (status === 'pull_required') {
      onPullAndPush?.()
      return
    }

    setShowPopup((value) => !value)
  }

  return (
    <div ref={popupRef} style={{ position: 'relative' }}>
      <StatusBarAction copy={syncBadgeTooltipCopy(status, t)} onClick={handleClick} testId="status-sync">
        <span style={ICON_STYLE}>
          <SyncIcon size={13} style={{ color: syncIconColor(status) }} className={isSyncing ? 'animate-spin' : ''} />
          {formatSyncLabel(status, lastSyncTime, t)}
        </span>
      </StatusBarAction>
      {showPopup && (
        <GitStatusPopup
          status={status}
          remoteStatus={remoteStatus ?? null}
          onPull={onTriggerSync}
          onClose={() => setShowPopup(false)}
        />
      )}
    </div>
  )
}

export function ConflictBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  const { t } = useTranslation()

  if (count <= 0) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction
        copy={{ label: t('status_bar.resolve_conflicts') }}
        onClick={onClick}
        testId="status-conflict-count"
        className="text-[var(--destructive,#e03e3e)]"
      >
        <span style={ICON_STYLE}>
          <AlertTriangle size={13} />
          {t('status_bar.conflict_count', { count })}
        </span>
      </StatusBarAction>
    </>
  )
}

export function ChangesBadge({ count, onClick }: { count: number; onClick?: () => void }) {
  const { t } = useTranslation()

  if (count <= 0) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction copy={{ label: t('status_bar.view_pending') }} onClick={onClick} testId="status-modified-count">
        <span style={ICON_STYLE}>
          <GitDiff size={13} style={{ color: 'var(--accent-orange)' }} />
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--accent-orange)',
              color: '#fff',
              borderRadius: 9,
              padding: '0 5px',
              fontSize: 10,
              fontWeight: 600,
              minWidth: 16,
              lineHeight: '16px',
            }}
          >
            {count}
          </span>
          {t('status_bar.changes')}
        </span>
      </StatusBarAction>
    </>
  )
}

export function CommitButton({
  onClick,
  remoteStatus,
}: {
  onClick?: () => void
  remoteStatus?: GitRemoteStatus | null
}) {
  const { t } = useTranslation()

  if (!onClick) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction copy={commitButtonTooltipCopy(remoteStatus, t)} onClick={onClick} testId="status-commit-push">
        <span style={ICON_STYLE}>
          <GitCommitHorizontal size={13} />
          {t('status_bar.commit')}
        </span>
      </StatusBarAction>
    </>
  )
}

export function PulseBadge({ onClick, disabled }: { onClick?: () => void; disabled?: boolean }) {
  const { t } = useTranslation()

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction
        copy={{ label: disabled ? t('status_bar.history_git_only') : t('status_bar.open_history') }}
        onClick={disabled ? undefined : onClick}
        testId="status-pulse"
        disabled={Boolean(disabled)}
      >
        <span style={ICON_STYLE}>
          <Pulse size={13} />
          {t('status_bar.history')}
        </span>
      </StatusBarAction>
    </>
  )
}

export function McpBadge({ status, onInstall }: { status: McpStatus; onInstall?: () => void }) {
  const { t } = useTranslation()
  const config = getMcpBadgeConfig(status, t, onInstall)

  if (!config) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction
        copy={{ label: config.tooltip }}
        onClick={config.onClick}
        testId="status-mcp"
        className="text-[var(--accent-orange)]"
      >
        <span style={ICON_STYLE}>
          <Cpu size={13} />
          MCP
          <AlertTriangle size={10} style={{ marginLeft: 2 }} />
        </span>
      </StatusBarAction>
    </>
  )
}

export function ClaudeCodeBadge({ status, version }: { status: ClaudeCodeStatus; version?: string | null }) {
  const { t } = useTranslation()
  const config = getClaudeCodeBadgeConfig(status, t, version)

  if (!config) return null

  return (
    <>
      <span style={SEP_STYLE}>|</span>
      <StatusBarAction
        copy={{ label: config.tooltip }}
        onClick={config.onActivate}
        testId="status-claude-code"
        className={config.missing ? 'text-[var(--accent-orange)]' : undefined}
      >
        <span style={ICON_STYLE}>
          <Terminal size={13} />
          {config.label}
          {config.missing && <AlertTriangle size={10} style={{ marginLeft: 2 }} />}
        </span>
      </StatusBarAction>
    </>
  )
}
