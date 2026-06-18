import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

export async function ComingSoonSplash() {
  const t = await getTranslations('comingSoon')

  return (
    <div className="relative flex min-h-[calc(100dvh-4.5rem)] flex-col items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(112,130,255,0.14),transparent_55%),radial-gradient(ellipse_60%_50%_at_50%_100%,rgba(255,255,255,0.04),transparent_60%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent"
      />

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-center text-center">
        <Image
          src="/brand/cit-story.png"
          alt="Clickit Story"
          width={640}
          height={434}
          priority
          className="h-auto w-[min(72vw,420px)] object-contain drop-shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
        />

        <p className="mono mt-10 text-[11px] tracking-[0.28em] text-[var(--text-mute)] uppercase">
          {t('gateEyebrow')}
        </p>

        <h1 className="font-display mt-4 text-[clamp(2.75rem,10vw,5.5rem)] leading-[0.95] font-normal tracking-[-0.03em] text-white">
          {t('gateHeading')}
        </h1>

        <p className="mt-5 max-w-md text-[15px] leading-relaxed text-[var(--text-dim)] md:text-[17px]">
          {t('gateDescription')}
        </p>
      </div>
    </div>
  )
}
