import { useLocale } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { ChevronRight } from 'lucide-react'

interface SectionHeaderProps {
  title: string
  seeAllHref?: string
  accentColor?: string
  className?: string
}

export function SectionHeader({
  title,
  seeAllHref,
  accentColor,
  className,
}: SectionHeaderProps) {
  const locale = useLocale()
  const isArabic = locale === 'ar'
  return (
    <div
      className={`mb-5 flex items-center justify-between px-6 md:px-12${className ? ` ${className}` : ''}`}
    >
      <div className="flex items-center gap-3">
        {accentColor && (
          <div
            className="h-7 w-1 rounded-full flex-shrink-0"
            style={{ background: accentColor, boxShadow: `0 0 24px ${accentColor}50` }}
            aria-hidden="true"
          />
        )}
        <div>
          <p className="mono mb-1 text-white/34">
            {isArabic ? 'اختيار كلِك إت' : 'Curated by Clickit'}
          </p>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.03em] text-white md:text-[2rem]">
            {title}
          </h2>
        </div>
      </div>

      {seeAllHref && (
        <Link
          href={seeAllHref}
          className="inline-flex items-center gap-1 text-sm text-primary transition-colors hover:text-white"
        >
          {isArabic ? 'عرض الكل' : 'See all'}
          <ChevronRight className="size-4 rtl:scale-x-[-1]" />
        </Link>
      )}
    </div>
  )
}
