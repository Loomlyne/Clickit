import { getLocale } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getCategories } from '@/lib/queries'
import { DEFAULT_CATEGORY_PILL_HEX } from '@/lib/brand-colors'

const DEFAULT_COLOR = DEFAULT_CATEGORY_PILL_HEX

export async function GenrePills() {
  const [categories, locale] = await Promise.all([getCategories(), getLocale()])
  if (categories.length === 0) return null

  return (
    <section className="border-t border-[var(--line)] px-4 py-8 sm:px-6 md:px-10">
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-2">
        {categories.map((category) => {
          const color = category.color ?? DEFAULT_COLOR
          return (
            <Link
              key={category.slug}
              href={`/watch?category=${encodeURIComponent(category.slug)}`}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--uis-line-strong)] px-4 text-[13px] text-[var(--text-dim)] transition-colors hover:bg-[var(--bg-2)] hover:text-[var(--text)]"
            >
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-full"
                style={{ background: color }}
              />
              {{ ar: category.nameAr, en: category.nameEn }[locale] ??
                category.nameEn}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
