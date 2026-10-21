'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { toast } from 'sonner'
import { User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { viewerInitials } from '@/lib/initials'
import { createClient } from '@/lib/supabase/client'

interface Review {
  id: string
  show_id: string
  user_id: string
  stars: number
  body: string
  created_at: string
  profiles?: { display_name: string | null; avatar_url: string | null }
}

interface ReviewComposerProps {
  showId: string
  userId: string | null
  userName?: string | null
}

export function ReviewComposer({
  showId,
  userId,
  userName,
}: ReviewComposerProps) {
  const t = useTranslations('reviews')
  const locale = useLocale()
  const dateLocale = locale === 'ar' ? 'ar-AE' : 'en-US'
  const STAR_LABELS = [
    '',
    t('starNope'),
    t('starMeh'),
    t('starFine'),
    t('starGreat'),
    t('starMasterpiece'),
  ]
  const [reviews, setReviews] = useState<Review[]>([])
  const [draftStars, setDraftStars] = useState(0)
  const [hoverStars, setHoverStars] = useState(0)
  const [draftText, setDraftText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  async function loadReviews(supabase = createClient()) {
    const { data, error } = await supabase
      .from('reviews')
      .select(
        'id, show_id, user_id, stars, body, created_at, profiles:profiles!reviews_user_id_fkey(display_name, avatar_url)'
      )
      .eq('show_id', showId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[review-composer] load failed', error)
      setLoadError(error.message)
      return
    }

    setReviews(data as unknown as Review[])
    setLoadError(null)
  }

  // Fetch reviews + subscribe to real-time
  useEffect(() => {
    const supabase = createClient()
    // Data fetch on mount/showId change: loadReviews only sets state after the awaited query resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadReviews(supabase)

    const channel = supabase
      .channel(`reviews:${showId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'reviews',
          filter: `show_id=eq.${showId}`,
        },
        () => {
          void loadReviews(supabase)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [showId])

  const submitReview = async () => {
    if (!userId || !draftText.trim() || draftStars === 0) return
    setSubmitting(true)
    setSubmitError(null)
    const supabase = createClient()
    const { error } = await supabase.from('reviews').insert({
      show_id: showId,
      user_id: userId,
      stars: draftStars,
      body: draftText.trim(),
    })
    if (error) {
      console.error('[review-composer] insert failed', error)
      setSubmitError(error.message)
      toast.error(error.message)
      setSubmitting(false)
      return
    }

    setDraftStars(0)
    setDraftText('')
    await loadReviews(supabase)
    setSubmitting(false)
  }

  const activeStars = hoverStars || draftStars
  const myInitials = viewerInitials(
    reviews.find((r) => r.user_id === userId)?.profiles?.display_name ||
      userName
  )

  return (
    <div>
      <div className="label mb-4">
        {t('heading')} ·{' '}
        {reviews.length === 1
          ? t('countOne', { count: reviews.length })
          : t('countMany', { count: reviews.length })}
      </div>

      {/* Composer (auth'd users only) */}
      {userId && (
        <div className="mb-8 rounded-card border border-[var(--line)] bg-[var(--bg-1)] p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-full bg-[var(--primary)] font-[family-name:var(--font-mono)] text-xs font-medium text-[var(--primary-foreground)]">
              {myInitials ?? <User className="size-4" aria-hidden />}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium">{t('yourReview')}</div>
            </div>
          </div>

          {/* Star rating */}
          <div
            className="mb-3 flex flex-wrap items-center gap-x-1"
            onMouseLeave={() => setHoverStars(0)}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className="focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none"
                onMouseEnter={() => setHoverStars(n)}
                onClick={() => setDraftStars(n)}
                aria-label={t('starsAria', { n })}
                style={{
                  color:
                    activeStars >= n ? 'var(--primary)' : 'var(--text-mute)',
                }}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill={activeStars >= n ? 'currentColor' : 'none'}
                  stroke="currentColor"
                  strokeWidth="1.5"
                >
                  <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" />
                </svg>
              </button>
            ))}
            <span className="mono ms-2 text-[var(--text-dim)]">
              {activeStars > 0 ? STAR_LABELS[activeStars] : t('tapToRate')}
            </span>
          </div>

          <textarea
            className="w-full resize-none rounded-field border border-[var(--line)] bg-[var(--bg-0)] px-3 py-2.5 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text-mute)] focus:border-[var(--primary)]"
            placeholder={t('composerPlaceholder')}
            value={draftText}
            onChange={(e) => setDraftText(e.target.value)}
            rows={3}
            maxLength={600}
          />

          {submitError && (
            <div
              className="mt-3 rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-3 py-2 text-sm text-[var(--text)]"
              role="alert"
            >
              {submitError}
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <span className="mono text-[var(--text-mute)]">
              {draftText.length} / 600
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => {
                  setDraftStars(0)
                  setDraftText('')
                }}
                disabled={!draftText && !draftStars}
              >
                {t('clear')}
              </Button>
              <Button
                size="sm"
                className="min-h-11"
                onClick={submitReview}
                disabled={!draftText.trim() || draftStars === 0 || submitting}
              >
                {submitting ? t('posting') : t('postReview')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loadError && (
        <div
          className="mb-5 rounded-lg border border-[var(--destructive)] bg-[var(--destructive)]/10 px-4 py-3 text-sm text-[var(--text)]"
          role="alert"
        >
          {t('loadError', { error: loadError ?? '' })}
        </div>
      )}

      {/* Reviews list */}
      <div className="space-y-0">
        {reviews.map((r) => {
          const isMine = r.user_id === userId
          const name = r.profiles?.display_name || t('anonymous')
          const initials = name.slice(0, 2).toUpperCase()

          return (
            <div
              key={r.id}
              className={`border-t border-[var(--line)] py-5 ${isMine ? 'rounded-card border-transparent bg-[var(--bg-1)] px-4' : ''}`}
            >
              <div className="mb-2 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium"
                    style={
                      isMine
                        ? {
                            background: 'var(--primary)',
                            color: 'var(--primary-foreground)',
                          }
                        : {
                            background: 'var(--bg-3)',
                            color: 'var(--text-dim)',
                          }
                    }
                  >
                    {initials}
                  </div>
                  <div>
                    <div className="text-[13px] font-medium">
                      {name}
                      {isMine && (
                        <span className="mono ms-2 text-[var(--primary)]">
                          {t('yoursBadge')}
                        </span>
                      )}
                    </div>
                    <div className="mono text-[var(--text-mute)]">
                      {new Date(r.created_at).toLocaleDateString(dateLocale, {
                        month: 'short',
                        year: 'numeric',
                      })}
                    </div>
                  </div>
                </div>
                <div
                  role="img"
                  aria-label={t('starsAria', { n: r.stars })}
                  className="flex items-center gap-0.5 text-[var(--primary)]"
                >
                  {[...Array(5)].map((_, j) => (
                    <svg
                      key={j}
                      width="11"
                      height="11"
                      viewBox="0 0 24 24"
                      fill={j < r.stars ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <polygon points="12 2 15 9 22 9.3 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9.3 9 9" />
                    </svg>
                  ))}
                </div>
              </div>
              <p className="text-[14px] leading-relaxed text-[var(--text-dim)]">
                {r.body}
              </p>
            </div>
          )
        })}
        {reviews.length === 0 && (
          <div className="py-10 text-center text-[var(--text-mute)]">
            {t('emptyMessage')}
          </div>
        )}
      </div>
    </div>
  )
}
