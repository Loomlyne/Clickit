import { getLocale, getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { getCategories } from '@/lib/queries'
import { getAppConfig } from '@/lib/config'
import { DEFAULT_GENRE_HEX } from '@/lib/brand-colors'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

const DEFAULT_COLOR = DEFAULT_GENRE_HEX

export async function GenresGrid() {
  const [categories, config, locale, t] = await Promise.all([
    getCategories(),
    getAppConfig(),
    getLocale(),
    getTranslations('home'),
  ])

  if (!config.flags.showGenresGrid) return null
  if (categories.length === 0) return null

  return (
    <ScrollReveal>
      <section className="pt-1">
        <SectionHeader title={t('genresHeading')} />
        <div className="scrollbar-hide flex gap-3 overflow-x-auto px-6 py-2 md:px-12">
          {categories.map((category) => {
            const color = category.color ?? DEFAULT_COLOR
            const categoryNameByLocale: Record<string, string> = {
              ar: category.nameAr,
              en: category.nameEn,
            }
            return (
              <Link
                key={category.slug}
                href={`/watch?category=${encodeURIComponent(category.slug)}`}
                className="group flex-shrink-0"
              >
                <div
                  className="flex min-w-[120px] cursor-pointer items-center justify-center rounded-full border bg-white/[0.03] px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 sm:min-w-[160px] sm:px-6"
                  style={{
                    borderColor: `${color}35`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.03), 0 18px 40px rgba(0,0,0,0.12)`,
                  }}
                >
                  <span
                    className="text-sm font-medium whitespace-nowrap"
                    style={{ color }}
                  >
                    {categoryNameByLocale[locale] ?? category.nameEn}
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </section>
    </ScrollReveal>
  )
}
