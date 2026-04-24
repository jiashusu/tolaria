import { useTranslation } from 'react-i18next'
import { setLanguage } from '@/i18n'
import { Button } from '@/components/ui/button'

interface LanguageSwitcherProps {
  className?: string
}

export function LanguageSwitcher({ className }: LanguageSwitcherProps) {
  const { i18n } = useTranslation()
  const isZh = i18n.language === 'zh'

  return (
    <Button
      variant="ghost"
      size="sm"
      className={className}
      onClick={() => setLanguage(isZh ? 'en' : 'zh')}
      style={{ fontSize: 12, fontWeight: 600, padding: '4px 8px', height: 'auto' }}
    >
      {isZh ? 'EN' : '中文'}
    </Button>
  )
}
