import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { useDragRegion } from '../hooks/useDragRegion'

interface OnboardingShellProps {
  children: ReactNode
  className?: string
  contentClassName?: string
  contentStyle?: CSSProperties
  style?: CSSProperties
  testId?: string
  topRight?: ReactNode
}

export function OnboardingShell({
  children,
  className,
  contentClassName,
  contentStyle,
  style,
  testId,
  topRight,
}: OnboardingShellProps) {
  const { onMouseDown } = useDragRegion()

  return (
    <div
      className={cn('relative flex h-full w-full items-center justify-center px-6 py-8', className)}
      style={style}
      data-testid={testId}
      onMouseDown={onMouseDown}
    >
      {topRight && (
        <div
          data-no-drag
          style={{ position: 'absolute', top: 12, right: 12, zIndex: 10 }}
        >
          {topRight}
        </div>
      )}
      <div className={contentClassName} style={contentStyle} data-no-drag>
        {children}
      </div>
    </div>
  )
}
