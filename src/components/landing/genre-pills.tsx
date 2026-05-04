import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getCategories } from '@/lib/queries'

const DEFAULT_COLOR = '#8D9CFF'

export async function GenrePills() {
  const [categories, locale] = await Promise.all([getCategories(), getLocale()])
  if (categories.length === 0) return null

  const isArabic = locale === 'ar'

  return (
    <section className="border-t border-[var(--line)] px-4 py-8 sm:px-6 md:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-5 gap-y-3">
        <span className="mono shrink-0 text-[11px] tracking-[0.12em] text-[var(--text-mute)] uppercase">
          {isArabic ? 'التصنيفات' : 'Genres'}
        </span>
        <div className="h-4 w-px shrink-0 bg-[var(--line)]" />
        {categories.map((category) => {
          const color = category.color ?? DEFAULT_COLOR
          return (
            <Link
              key={category.slug}
              href={`/browse?category=${encodeURIComponent(category.slug)}`}
              className="mono rounded-full px-3 py-1 text-[11px] tracking-[0.08em] uppercase transition-opacity duration-150 hover:opacity-60"
              style={{ border: `1px solid ${color}`, color }}
            >
              {isArabic ? category.nameAr : category.nameEn}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
