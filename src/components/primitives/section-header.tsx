// Section header — matches handoff rail-header pattern
// Mono eyebrow + serif title + "View all" link
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'

interface SectionHeaderProps {
  title: string
  eyebrow?: string
  seeAllHref?: string
  className?: string
}

export function SectionHeader({
  title,
  eyebrow,
  seeAllHref,
  className,
}: SectionHeaderProps) {
  const tCommon = useTranslations('common')

  return (
    <div className={`mb-4 flex items-start justify-between gap-4 px-10${className ? ` ${className}` : ''}`}>
      <div>
        {eyebrow && <div className="mono mb-1.5">{eyebrow}</div>}
        <h2 className="font-display m-0 text-[26px]">{title}</h2>
      </div>

      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="mono inline-flex min-h-11 shrink-0 items-center gap-1.5"
        >
          {tCommon('viewAll')}
          <ArrowRight className="size-3 rtl:scale-x-[-1]" />
        </Link>
      )}
    </div>
  )
}
