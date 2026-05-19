import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { searchShows, searchEpisodes } from '@/lib/queries'
import { SearchResults } from '@/components/search/search-results'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('search')
  return {
    title: `${t('heading')} | Clickit Story`,
    description: t('description'),
  }
}

interface Props {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage({ searchParams }: Props) {
  const { q } = await searchParams
  const t = await getTranslations('search')

  // Empty/no query state
  if (!q || q.trim().length === 0) {
    return (
      <div className="px-6 pt-16 pb-16 md:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="mono mb-4 text-[var(--text-mute)]">
            Search the catalog
          </p>
          <h1 className="font-display text-[clamp(2.5rem,5vw,56px)] leading-[1.05] font-normal tracking-[-0.02em] text-[var(--text)]">
            {t('pageTitle')}
          </h1>
          <p className="mt-3 text-[var(--text-dim)]">{t('description')}</p>

          {/* Search input placeholder */}
          <form action="/search" method="get" className="mt-10">
            <input
              type="text"
              name="q"
              placeholder={t('placeholder')}
              autoFocus
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-[18px] font-[family-name:var(--font-ui)] text-[16px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)] focus:border-[var(--line-2)]"
            />
          </form>
        </div>
      </div>
    )
  }

  // Short query state
  if (q.trim().length < 2) {
    return (
      <div className="px-6 pt-16 pb-16 md:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="mono mb-4 text-[var(--text-mute)]">
            Search the catalog
          </p>
          <form action="/search" method="get" className="mt-6">
            <input
              type="text"
              name="q"
              defaultValue={q}
              autoFocus
              placeholder={t('placeholder')}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-[18px] font-[family-name:var(--font-ui)] text-[16px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)] focus:border-[var(--line-2)]"
            />
          </form>
          <p className="mono mt-4 text-[var(--text-mute)]">{t('minChars')}</p>
        </div>
      </div>
    )
  }

  // Fetch results in parallel
  const [shows, episodes] = await Promise.all([
    searchShows(q),
    searchEpisodes(q),
  ])

  // No results state
  if (shows.length === 0 && episodes.length === 0) {
    return (
      <div className="px-6 pt-16 pb-16 md:px-12">
        <div className="mx-auto max-w-3xl">
          <p className="mono mb-4 text-[var(--text-mute)]">
            Search the catalog
          </p>
          <form action="/search" method="get" className="mb-8">
            <input
              type="text"
              name="q"
              defaultValue={q}
              autoFocus
              placeholder={t('placeholder')}
              className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-[18px] font-[family-name:var(--font-ui)] text-[16px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)] focus:border-[var(--line-2)]"
            />
          </form>

          <div className="border-t border-[var(--line)] py-20 text-center">
            <h2 className="font-display text-[28px] font-normal text-[var(--text)]">
              No results for &ldquo;{q}&rdquo;
            </h2>
            <p className="mt-3 text-[14px] text-[var(--text-dim)]">
              {t('noResultsDescription')}
            </p>
            <div className="mt-6 flex justify-center gap-4">
              <Link
                href="/search"
                className="mono rounded-full border border-[var(--line-2)] bg-transparent px-5 py-2.5 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--accent-yellow)] hover:text-[var(--text)]"
              >
                {t('clearSearch')}
              </Link>
              <Link
                href="/watch"
                className="mono rounded-full border border-[var(--line-2)] bg-transparent px-5 py-2.5 text-[12px] text-[var(--text-dim)] transition-colors hover:border-[var(--accent-yellow)] hover:text-[var(--text)]"
              >
                Watch catalog
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Results state
  return (
    <div className="px-6 pt-16 pb-16 md:px-12">
      <div className="mx-auto max-w-5xl">
        <p className="mono mb-4 text-[var(--text-mute)]">Search the catalog</p>
        <form action="/search" method="get" className="mb-8">
          <input
            type="text"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder={t('placeholder')}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--bg-1)] p-[18px] font-[family-name:var(--font-ui)] text-[16px] text-[var(--text)] outline-none placeholder:text-[var(--text-mute)] focus:border-[var(--line-2)]"
          />
        </form>
        <SearchResults query={q} shows={shows} episodes={episodes} />
      </div>
    </div>
  )
}
