import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getScheduleShows } from '@/lib/queries'
import { BRAND_COLOR_HEX } from '@/lib/brand-colors'
import { SectionHeader } from '@/components/primitives/section-header'
import { ScrollReveal } from '@/components/primitives/scroll-reveal'

export const metadata: Metadata = {
  title: 'Schedule | Clickit Story',
  description: 'Broadcast schedule for Clickit Story shows',
}

const DAY_ORDER = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
]

export default async function SchedulePage() {
  const scheduleShows = await getScheduleShows()

  // Group shows by broadcast day
  const showsByDay = scheduleShows.reduce(
    (acc, show) => {
      const day = show.broadcastDay ?? 'Unscheduled'
      if (!acc[day]) acc[day] = []
      acc[day].push(show)
      return acc
    },
    {} as Record<string, typeof scheduleShows>
  )

  // Sort days in day order
  const sortedDays = DAY_ORDER.filter((day) => showsByDay[day])

  return (
    <div className="pb-16">
      {/* Page header */}
      <div className="relative py-20 px-6 md:px-12 text-center overflow-hidden">
        {/* Purple radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse 60% 80% at 50% 100%, rgba(159,84,160,0.15), transparent)',
          }}
        />
        <div className="relative">
          <p
            className="text-sm tracking-[0.3em] uppercase mb-4"
            style={{ color: 'var(--color-brand-purple-safe)' }}
          >
            Tune In
          </p>
          <h1 className="font-display font-bold text-3xl sm:text-4xl md:text-5xl text-white leading-tight">
            Schedule
          </h1>
          <p className="text-white/50 text-lg mt-3 max-w-md mx-auto">
            Broadcast times for our shows
          </p>
        </div>
      </div>

      {/* Schedule content */}
      {sortedDays.length > 0 ? (
        <div className="px-6 md:px-12 space-y-10">
          {sortedDays.map((day) => (
            <ScrollReveal key={day}>
              <div>
                {/* Day header */}
                <p className="text-xs uppercase tracking-[0.24em] text-white/40 mb-1">
                  Broadcast Day
                </p>
                <h2 className="text-2xl font-display font-bold text-white mb-5">
                  {day}
                </h2>

                {/* Show rows for this day */}
                <div className="space-y-3">
                  {showsByDay[day].map((show) => {
                    const brandHex = BRAND_COLOR_HEX[show.brandColor]
                    return (
                      <Link
                        key={show.id}
                        href={`/series/${show.slug}`}
                        className="group flex items-center gap-4 rounded-xl p-4 bg-white/[0.03] border border-white/[0.06] transition-colors duration-200 hover:bg-white/[0.06]"
                      >
                        {/* Show poster thumbnail */}
                        <div
                          className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
                          style={{
                            background: `linear-gradient(135deg, ${brandHex}30, ${brandHex}10)`,
                          }}
                        >
                          {show.posterUrl ? (
                            <Image
                              src={show.posterUrl}
                              alt={show.title}
                              fill
                              className="object-cover"
                              sizes="64px"
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full w-full">
                              <span
                                className="text-lg font-bold"
                                style={{ color: `${brandHex}90` }}
                              >
                                {show.title.charAt(0)}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Show info */}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-semibold text-white truncate group-hover:text-white/90">
                            {show.title}
                          </h3>
                          <p className="text-sm text-white/40 truncate">
                            {show.genre}
                          </p>
                        </div>

                        {/* Time badge */}
                        {show.broadcastTime && (
                          <span
                            className="rounded-full px-3 py-1 text-xs font-medium flex-shrink-0"
                            style={{
                              background: `${brandHex}25`,
                              color: brandHex,
                              border: `1px solid ${brandHex}30`,
                            }}
                          >
                            {show.broadcastTime}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      ) : (
        <div className="px-6 md:px-12">
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <h3 className="text-xl font-bold text-white">
              No broadcasts scheduled.
            </h3>
            <p className="mt-2 text-sm text-white/50">
              Check back soon for broadcast times.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
