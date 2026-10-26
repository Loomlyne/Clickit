import { Skeleton } from '@/components/ui/skeleton'

/**
 * UI-SPEC 6.14: matches the unified sign-in page. Hero pane (lg+) and the form
 * column with a 24px title bar, a 14px subline bar, a 44px field and a 44px
 * pill button, all --bg-2.
 */
export default function AuthLoading() {
  return (
    <div className="-mt-16 flex min-h-[calc(100dvh-4rem)] overflow-hidden">
      <div aria-hidden className="hidden w-1/2 bg-[var(--bg-1)] lg:block" />

      <div className="flex w-full items-center justify-center bg-[var(--bg-0)] px-4 py-8 sm:px-6 md:py-12 lg:w-1/2 lg:py-16">
        <div className="w-full max-w-[420px]" aria-hidden>
          <Skeleton className="h-6 w-3/4 rounded-field bg-[var(--bg-2)]" />
          <Skeleton className="mt-2 mb-6 h-[14px] w-full rounded-field bg-[var(--bg-2)]" />
          <Skeleton className="h-11 w-full rounded-field bg-[var(--bg-2)]" />
          <Skeleton className="mt-6 h-11 w-full rounded-full bg-[var(--bg-2)]" />
        </div>
      </div>
    </div>
  )
}
