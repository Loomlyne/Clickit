// Section header — title + "View all" link
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ArrowRight } from 'lucide-react'

interface SectionHeaderProps {
  title: string
  seeAllHref?: string
  className?: string
}

export function SectionHeader({
  title,
  seeAllHref,
  className,
}: SectionHeaderProps) {
  const tCommon = useTranslations('common')

  return (
    <div
      className={`mb-4 flex items-start justify-between gap-4 px-10${className ? ` ${className}` : ''}`}
    >
      <div>
        <h2 className="font-display m-0 text-[26px] font-bold">{title}</h2>
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
