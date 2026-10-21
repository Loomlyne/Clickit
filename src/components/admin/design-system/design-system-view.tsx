'use client'

import { useId, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Check, CircleAlert, Loader2, Minus, Palette, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'

import { AdminPanel } from '@/components/admin/admin-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  SIGNED_TOKENS,
  canonicalCssValue,
  contrastRatio,
  normalizeCssValue,
  resolveSignedValue,
} from '@/lib/design-truth'
import { cn } from '@/lib/utils'
import {
  BRAND_PAIRS,
  RADIUS_SAMPLES,
  SHADOW_SAMPLES,
  STATUS_SAMPLES,
  TOKEN_GROUPS,
  type TokenGroup,
} from './token-groups'

/* ------------------------------------------------------------------ */
/* Live reading: custom properties and a rendered radius, no state.   */
/* ------------------------------------------------------------------ */

const SEP = '\u0001'

const ALL_TOKENS: readonly string[] = Array.from(
  new Set<string>([
    ...Object.keys(SIGNED_TOKENS),
    ...TOKEN_GROUPS.flatMap((group) => group.tokens),
    ...RADIUS_SAMPLES.map((sample) => sample.token),
    ...SHADOW_SAMPLES.elevation.map((sample) => sample.token),
    ...SHADOW_SAMPLES.utility.map((sample) => sample.token),
  ])
)

// One re-read after the first paint. The snapshots below are joined strings, so React
// compares primitives and never loops.
function subscribe(onChange: () => void) {
  const frame = requestAnimationFrame(onChange)
  return () => cancelAnimationFrame(frame)
}

function readStyles(): string {
  const style = getComputedStyle(document.documentElement)
  return ALL_TOKENS.map((name) => style.getPropertyValue(name).trim()).join(SEP)
}

function readRadii(): string {
  return RADIUS_SAMPLES.map((sample) => {
    const el = document.querySelector(`[data-radius-sample="${sample.role}"]`)
    return el ? getComputedStyle(el).borderTopLeftRadius : ''
  }).join(SEP)
}

function readNothing(): string {
  return ''
}

type Styles = Readonly<Record<string, string>>

/** null while the live styles have not been read yet (server render and hydration). */
function useLiveStyles(): Styles | null {
  const snapshot = useSyncExternalStore(subscribe, readStyles, readNothing)
  return useMemo(() => {
    if (snapshot === '') return null
    const values = snapshot.split(SEP)
    return Object.fromEntries(ALL_TOKENS.map((name, i) => [name, values[i] ?? '']))
  }, [snapshot])
}

/** Radius of the real sample element per role, measured from the DOM, not from the variable. */
function useRenderedRadii(): Readonly<Record<string, string>> | null {
  const snapshot = useSyncExternalStore(subscribe, readRadii, readNothing)
  return useMemo(() => {
    if (snapshot === '') return null
    const values = snapshot.split(SEP)
    return Object.fromEntries(RADIUS_SAMPLES.map((sample, i) => [sample.role, values[i] ?? '']))
  }, [snapshot])
}

/* ------------------------------------------------------------------ */
/* Small shared pieces                                                 */
/* ------------------------------------------------------------------ */

const SPECIMEN = 'Aa'
const READING_VALUE = '…'

const chipBase = 'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-bold'
const okChip = 'border-status-success/35 bg-status-success/8 text-status-success'
const badChip = 'border-status-danger/35 bg-status-danger/8 text-status-danger'

const TONE_CHIP = {
  success: 'border-status-success/35 bg-status-success/8 text-status-success',
  warning: 'border-status-warning/35 bg-status-warning/8 text-status-warning',
  danger: 'border-status-danger/35 bg-status-danger/8 text-status-danger',
  neutral: 'border-status-neutral-line text-status-neutral',
} as const

const TONE_ICON = {
  success: Check,
  warning: TriangleAlert,
  danger: CircleAlert,
  neutral: Minus,
} as const

const overline = 'text-[11px] font-bold tracking-[0.14em] text-[var(--text-mute)] uppercase'
const noteText = 'text-sm text-[var(--text-dim)]'

function Ltr({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={className}>
      {children}
    </bdi>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20 space-y-6">
      <h2 id={`${id}-heading`} className="text-[20px] leading-tight font-bold text-[var(--text)]">
        {title}
      </h2>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

function PanelTitle({ children }: { children: ReactNode }) {
  return <h3 className={cn(overline, 'mb-4')}>{children}</h3>
}

/** The printed value of one token: "…" while reading, the missing chip when empty. */
function ValueLine({ styles, name }: { styles: Styles | null; name: string }) {
  const t = useTranslations('admin.designSystem')
  if (!styles) return <Ltr>{READING_VALUE}</Ltr>
  const value = styles[name] ?? ''
  if (value === '') {
    return (
      <span className={cn(chipBase, badChip, 'font-normal')}>
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        {t('tokenMissing')}
      </span>
    )
  }
  return <Ltr className="break-all">{normalizeCssValue(value)}</Ltr>
}

type SwatchLook = { fill: string; ink?: string; rule?: boolean }

/** Which box a token is drawn in (UI-SPEC 1.3). Everything else is a plain fill. */
function swatchLook(group: TokenGroup['id'], name: string): SwatchLook {
  if (group === 'lines') return { fill: 'var(--bg-1)', rule: true }
  if (group === 'text') return { fill: 'var(--bg-1)', ink: `var(${name})` }
  if (name === '--primary-foreground') return { fill: 'var(--primary)', ink: `var(${name})` }
  if (name === '--destructive-foreground') return { fill: 'var(--destructive)', ink: `var(${name})` }
  return { fill: `var(${name})` }
}

function Swatch({
  name,
  look,
  styles,
  children,
}: {
  name: string
  look: SwatchLook
  styles: Styles | null
  children?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <div
        aria-hidden
        className="flex h-16 items-center justify-center rounded-field border border-[var(--line-2)]"
        style={{ background: look.fill }}
      >
        {look.ink ? (
          <span className="text-[20px] leading-tight font-bold" style={{ color: look.ink }}>
            {SPECIMEN}
          </span>
        ) : null}
        {look.rule ? (
          <span className="block h-px w-3/4" style={{ background: `var(${name})` }} />
        ) : null}
      </div>
      <p className="mt-2 text-sm text-[var(--text)]">
        <Ltr className="break-all">{name}</Ltr>
      </p>
      <p className="mt-1 text-[11px] text-[var(--text-mute)]">
        <ValueLine styles={styles} name={name} />
      </p>
      {children}
    </div>
  )
}

function ContrastLine({ styles, name }: { styles: Styles | null; name: string }) {
  const t = useTranslations('admin.designSystem')
  if (!styles || !styles[name] || !styles['--bg-1']) return null
  let ratio: number
  try {
    ratio = contrastRatio(styles[name], styles['--bg-1'])
  } catch {
    return null
  }
  const passes = ratio >= 4.5
  const Icon = passes ? Check : TriangleAlert
  return (
    <p className={cn(chipBase, passes ? okChip : badChip, 'mt-2 font-normal')}>
      <Icon className="size-4 shrink-0" aria-hidden />
      {t('contrastLabel', { ratio: ratio.toFixed(1) })}
    </p>
  )
}

const swatchGrid = 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'

/* ------------------------------------------------------------------ */
/* Summary line                                                        */
/* ------------------------------------------------------------------ */

function SummaryLine({ styles }: { styles: Styles | null }) {
  const t = useTranslations('admin.designSystem')

  const result = useMemo(() => {
    if (!styles) return null
    const rows = Object.keys(SIGNED_TOKENS).map((name) => ({
      name,
      live: styles[name] ?? '',
      signed: resolveSignedValue(name) ?? '',
    }))
    const differing = rows.filter((row) => canonicalCssValue(row.live) !== canonicalCssValue(row.signed))
    return { matching: rows.length - differing.length, differing }
  }, [styles])

  return (
    <div aria-live="polite" className="space-y-3">
      {!result ? (
        <p className="inline-flex items-center gap-2 text-sm text-[var(--text-dim)]">
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />
          {t('reading')}
        </p>
      ) : result.differing.length === 0 ? (
        <p className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold', okChip)}>
          <Check className="size-4 shrink-0" aria-hidden />
          {t('matchSummary', { count: result.matching })}
        </p>
      ) : (
        <>
          <p className={cn('inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold', badChip)}>
            <TriangleAlert className="size-4 shrink-0" aria-hidden />
            {t('matchDiffer', { count: result.differing.length })}
          </p>
          <ul className="space-y-1 text-sm text-[var(--text-dim)]">
            {result.differing.map((row) => (
              <li key={row.name}>
                <Ltr className="break-all">{row.name}</Ltr>
                {': '}
                {t('liveValue')}{' '}
                {row.live === '' ? t('tokenMissing') : <Ltr className="break-all">{row.live}</Ltr>}
                {', '}
                {t('signedValue')} <Ltr className="break-all">{row.signed}</Ltr>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function ColourSection({ styles }: { styles: Styles | null }) {
  const t = useTranslations('admin.designSystem')

  return (
    <Section id="colour" title={t('sectionColour')}>
      {TOKEN_GROUPS.filter((group) => group.id !== 'brand').map((group) => (
        <AdminPanel key={group.id}>
          <PanelTitle>{t(group.labelKey)}</PanelTitle>
          <div className={swatchGrid}>
            {group.tokens.map((name) => {
              const tone = group.id === 'status' ? STATUS_SAMPLES.find((s) => s.token === name) : undefined
              const ToneIcon = tone ? TONE_ICON[tone.tone] : null
              return (
                <Swatch key={name} name={name} look={swatchLook(group.id, name)} styles={styles}>
                  {group.id === 'text' ? <ContrastLine styles={styles} name={name} /> : null}
                  {tone && ToneIcon ? (
                    <p className={cn(chipBase, TONE_CHIP[tone.tone], 'mt-2')}>
                      <ToneIcon className="size-4 shrink-0" aria-hidden />
                      {t(tone.labelKey)}
                    </p>
                  ) : null}
                </Swatch>
              )
            })}
          </div>
        </AdminPanel>
      ))}

      <AdminPanel>
        <PanelTitle>{t('groupBrand')}</PanelTitle>
        <div className={swatchGrid}>
          {BRAND_PAIRS.map((pair) => (
            <div key={pair.nameKey} className="min-w-0">
              <div
                aria-hidden
                className="overflow-hidden rounded-field border border-[var(--line-2)]"
              >
                <div className="h-8" style={{ background: `var(${pair.base})` }} />
                <div className="h-8" style={{ background: `var(${pair.safe})` }} />
              </div>
              <p className="mt-2 text-sm font-bold text-[var(--text)]">{t(pair.nameKey)}</p>
              {[
                { label: t('baseColour'), name: pair.base },
                { label: t('safeTint'), name: pair.safe },
              ].map((line) => (
                <div key={line.name} className="mt-1">
                  <p className="text-sm text-[var(--text)]">
                    {line.label} <Ltr className="break-all">{line.name}</Ltr>
                  </p>
                  <p className="text-[11px] text-[var(--text-mute)]">
                    <ValueLine styles={styles} name={line.name} />
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className={cn(noteText, 'mt-4')}>{t('brandNote')}</p>
        <p className={cn(noteText, 'mt-2')}>{t('categoryNote')}</p>
      </AdminPanel>
    </Section>
  )
}

type TypeRow = {
  roleKey: string
  size: number
  lineHeight: string
  weights: readonly (400 | 700)[]
  sizeClass: string
  family: string
}

const TYPE_ROWS: readonly TypeRow[] = [
  { roleKey: 'roleLabel', size: 11, lineHeight: '1.4', weights: [400], sizeClass: 'text-[11px] leading-[1.4]', family: 'var(--font-app)' },
  { roleKey: 'roleBody', size: 14, lineHeight: '1.5', weights: [400, 700], sizeClass: 'text-sm leading-normal', family: 'var(--font-app)' },
  { roleKey: 'roleHeading', size: 20, lineHeight: '1.25', weights: [700], sizeClass: 'text-[20px] leading-tight', family: 'var(--font-title)' },
  { roleKey: 'roleDisplay', size: 24, lineHeight: '1.2', weights: [700], sizeClass: 'text-[24px] leading-[1.2]', family: 'var(--font-title)' },
]

const LEGACY_ROWS = [
  { size: '13 / 13.5 / 12.5 / 12 / 15px', key: 'legacy13' },
  { size: '16px', key: 'legacy16' },
  { size: '30px', key: 'legacy30' },
  { size: '36px+', key: 'legacy36' },
] as const

function TypeSection() {
  const t = useTranslations('admin.designSystem')

  return (
    <Section id="type" title={t('sectionType')}>
      <AdminPanel className="space-y-3">
        <p className="text-sm text-[var(--text)]">{t('typeFont')}</p>
        <p className={noteText}>{t('renderedNote')}</p>
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-full border border-[var(--line-2)] px-3 py-1 text-[11px] text-[var(--text-dim)]">
            {t('weightRegular')}
          </span>
          <span className="inline-flex rounded-full border border-[var(--line-2)] px-3 py-1 text-[11px] font-bold text-[var(--text)]">
            {t('weightBold')}
          </span>
        </div>
      </AdminPanel>

      <AdminPanel>
        <PanelTitle>{t('typeScaleNew')}</PanelTitle>
        <div className="space-y-4">
          {TYPE_ROWS.map((row, index) => (
            <div key={row.roleKey} className={cn('space-y-3', index > 0 && 'border-t border-[var(--line)] pt-4')}>
              <p className={overline}>
                {t(row.roleKey)}{' '}
                <Ltr>
                  {row.size}px · {row.weights.join('/')} · {row.lineHeight}
                </Ltr>
              </p>
              {row.weights.map((weight) => (
                <div key={weight} className="grid gap-3 sm:grid-cols-2">
                  <p
                    lang="en"
                    dir="ltr"
                    className={cn(row.sizeClass, weight === 700 ? 'font-bold' : 'font-normal', 'text-start text-[var(--text)]')}
                    style={{ fontFamily: row.family }}
                  >
                    {t('typeSampleEn')}
                  </p>
                  <p
                    lang="ar"
                    dir="rtl"
                    className={cn(row.sizeClass, weight === 700 ? 'font-bold' : 'font-normal', 'text-start text-[var(--text)]')}
                    style={{ fontFamily: row.family }}
                  >
                    {t('typeSampleAr')}
                  </p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel>
        <PanelTitle>{t('typeScaleLegacy')}</PanelTitle>
        <dl>
          {LEGACY_ROWS.map((row, index) => (
            <div
              key={row.key}
              className={cn(
                'flex min-h-11 items-center gap-4 py-2',
                index > 0 && 'border-t border-[var(--line)]'
              )}
            >
              <dt className="w-48 shrink-0 text-sm text-[var(--text)]">
                <Ltr>{row.size}</Ltr>
              </dt>
              <dd className={noteText}>{t(row.key)}</dd>
            </div>
          ))}
        </dl>
        <p className={cn(noteText, 'mt-4 border-t border-[var(--line)] pt-4')}>
          {t.rich('mixedSample', {
            title: t('mixedTitle'),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
      </AdminPanel>
    </Section>
  )
}

function RadiusSection({ styles }: { styles: Styles | null }) {
  const t = useTranslations('admin.designSystem')
  const rendered = useRenderedRadii()

  return (
    <Section id="radius" title={t('sectionRadius')}>
      <AdminPanel>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {RADIUS_SAMPLES.map((sample) => {
            const token = styles?.[sample.token] ?? ''
            const measured = rendered?.[sample.role] ?? ''
            const known = Boolean(styles) && measured !== ''
            const equal = known && Number.parseFloat(measured) === Number.parseFloat(token)
            return (
              <div key={sample.role} className="min-w-0">
                <div
                  aria-hidden
                  data-radius-sample={sample.role}
                  className={cn('h-16 w-full border border-[var(--line-2)] bg-[var(--bg-2)]', sample.utility)}
                />
                <p className="mt-2 text-sm text-[var(--text)]">{t(sample.labelKey)}</p>
                <p className="mt-1 text-[11px] text-[var(--text-mute)]">
                  <Ltr>{sample.utility}</Ltr>
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-mute)]">
                  {t('tokenCol')}{' '}
                  <Ltr className="break-all">
                    {sample.token} = {styles ? token || '—' : READING_VALUE}
                  </Ltr>
                </p>
                <p className="mt-1 text-[11px] text-[var(--text-mute)]">
                  {t('renderedCol')} <Ltr>{known ? measured : READING_VALUE}</Ltr>
                </p>
                {known ? (
                  <p className={cn(chipBase, equal ? okChip : badChip, 'mt-2')}>
                    {equal ? (
                      <Check className="size-4 shrink-0" aria-hidden />
                    ) : (
                      <TriangleAlert className="size-4 shrink-0" aria-hidden />
                    )}
                    {equal ? t('chipMatch') : t('chipDiffer')}
                  </p>
                ) : null}
                <p className={cn(noteText, 'mt-2')}>{t(sample.useKey)}</p>
              </div>
            )
          })}
        </div>
        <p className={cn(noteText, 'mt-4 border-t border-[var(--line)] pt-4')}>
          {t('radiusBase')}{' '}
          <Ltr>
            --radius = {styles ? styles['--radius'] || '—' : READING_VALUE}
          </Ltr>
        </p>
      </AdminPanel>
    </Section>
  )
}

function SurfacesSection({ styles }: { styles: Styles | null }) {
  const t = useTranslations('admin.designSystem')
  const valueOf = (name: string) => (styles ? styles[name] || '—' : READING_VALUE)

  return (
    <Section id="surfaces" title={t('sectionSurfaces')}>
      <AdminPanel>
        <PanelTitle>{t('panelElevation')}</PanelTitle>
        <div className="grid grid-cols-1 gap-6 rounded-card bg-[var(--bg-0)] p-6 sm:grid-cols-2 lg:grid-cols-4">
          {SHADOW_SAMPLES.elevation.map((sample) => (
            <div key={sample.utility} className="min-w-0">
              <div
                aria-hidden
                className={cn('h-24 rounded-card border border-[var(--line)] bg-[var(--bg-1)]', sample.utility)}
              />
              <p className="mt-3 text-sm text-[var(--text)]">
                <Ltr>{sample.utility}</Ltr>
              </p>
              <p className={cn(noteText, 'mt-1')}>{t(sample.useKey)}</p>
              <p className="mt-1 text-[11px] break-words text-[var(--text-mute)]">
                <Ltr>{valueOf(sample.token)}</Ltr>
              </p>
            </div>
          ))}
        </div>
        <p className={cn(noteText, 'mt-4')}>{t('glassNote')}</p>
      </AdminPanel>

      <AdminPanel>
        <PanelTitle>{t('panelUtilityShadows')}</PanelTitle>
        <ul>
          {SHADOW_SAMPLES.utility.map((sample, index) => (
            <li
              key={sample.utility}
              className={cn(
                'flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4',
                index > 0 && 'border-t border-[var(--line)]'
              )}
            >
              <p className="w-56 shrink-0 text-sm text-[var(--text)]">
                <Ltr>{sample.utility}</Ltr>
              </p>
              <p className={cn(noteText, 'sm:w-64 sm:shrink-0')}>{t(sample.useKey)}</p>
              <p className="min-w-0 text-[11px] break-words text-[var(--text-mute)]">
                <Ltr>{valueOf(sample.token)}</Ltr>
              </p>
            </li>
          ))}
        </ul>
      </AdminPanel>
    </Section>
  )
}

const BUTTON_VARIANTS = [
  { variant: 'default', labelKey: 'btnDefault' },
  { variant: 'secondary', labelKey: 'btnSecondary' },
  { variant: 'outline', labelKey: 'btnOutline' },
  { variant: 'ghost', labelKey: 'btnGhost' },
  { variant: 'destructive', labelKey: 'btnDestructive' },
  { variant: 'link', labelKey: 'btnLink' },
] as const

const TEXT_BUTTON_SIZES = ['xs', 'sm', 'default', 'lg'] as const
const ICON_BUTTON_SIZES = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const
const BADGE_VARIANTS = ['default', 'secondary', 'destructive', 'outline', 'ghost', 'link'] as const

const rowClass = 'flex flex-wrap items-center gap-2'

function ComponentsSection() {
  const t = useTranslations('admin.designSystem')
  const inputBase = useId()
  const invalidMessageId = `${inputBase}-invalid-message`

  return (
    <Section id="components" title={t('sectionComponents')}>
      <AdminPanel className="space-y-4">
        <PanelTitle>{t('groupButtonVariants')}</PanelTitle>
        <div className={rowClass}>
          {BUTTON_VARIANTS.map((item) => (
            <Button key={item.variant} variant={item.variant}>
              {t(item.labelKey)}
            </Button>
          ))}
        </div>
        <p className={noteText}>{t('primaryHoverNote')}</p>
      </AdminPanel>

      <AdminPanel className="space-y-4">
        <PanelTitle>{t('groupButtonSizes')}</PanelTitle>
        <div className={rowClass}>
          {TEXT_BUTTON_SIZES.map((size) => (
            <Button key={size} size={size}>
              <Ltr>{size}</Ltr>
            </Button>
          ))}
          {ICON_BUTTON_SIZES.map((size) => (
            <Button key={size} size={size} aria-label={size}>
              <Palette className="size-4" aria-hidden />
            </Button>
          ))}
        </div>
        <p className={noteText}>{t('buttonSizesNote')}</p>
      </AdminPanel>

      <AdminPanel className="space-y-4">
        <PanelTitle>{t('groupButtonStates')}</PanelTitle>
        <div className="space-y-3">
          <div className={rowClass}>
            <span className={cn(overline, 'w-24')}>{t('stateRest')}</span>
            <Button>{t('btnDefault')}</Button>
            <Button variant="outline">{t('btnOutline')}</Button>
          </div>
          <div className={rowClass}>
            <span className={cn(overline, 'w-24')}>{t('stateDisabled')}</span>
            <Button disabled>{t('btnDefault')}</Button>
            <Button variant="outline" disabled>
              {t('btnOutline')}
            </Button>
          </div>
        </div>
        <p className={noteText}>{t('focusNote')}</p>
      </AdminPanel>

      <AdminPanel>
        <PanelTitle>{t('groupInput')}</PanelTitle>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="w-full max-w-sm">
            <label htmlFor={`${inputBase}-rest`} className={cn(overline, 'mb-2 block')}>
              {t('stateRest')}
            </label>
            <Input id={`${inputBase}-rest`} placeholder={t('inputPlaceholder')} />
          </div>
          <div className="w-full max-w-sm">
            <label htmlFor={`${inputBase}-filled`} className={cn(overline, 'mb-2 block')}>
              {t('stateFilled')}
            </label>
            <Input id={`${inputBase}-filled`} defaultValue={t('inputFilled')} />
          </div>
          <div className="w-full max-w-sm">
            <label htmlFor={`${inputBase}-invalid`} className={cn(overline, 'mb-2 block')}>
              {t('stateInvalid')}
            </label>
            <Input
              id={`${inputBase}-invalid`}
              placeholder={t('inputPlaceholder')}
              aria-invalid
              aria-describedby={invalidMessageId}
            />
            <p id={invalidMessageId} className="mt-2 text-sm text-status-danger">
              {t('inputInvalidMessage')}
            </p>
          </div>
          <div className="w-full max-w-sm">
            <label htmlFor={`${inputBase}-disabled`} className={cn(overline, 'mb-2 block')}>
              {t('stateDisabled')}
            </label>
            <Input id={`${inputBase}-disabled`} placeholder={t('inputPlaceholder')} disabled />
          </div>
        </div>
      </AdminPanel>

      <AdminPanel className="space-y-4">
        <PanelTitle>{t('groupBadge')}</PanelTitle>
        <div className={rowClass}>
          {BADGE_VARIANTS.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </AdminPanel>

      <AdminPanel className="space-y-4">
        <PanelTitle>{t('groupSelect')}</PanelTitle>
        <Select defaultValue="1">
          <SelectTrigger className="w-full max-w-[16rem]" aria-label={t('selectAria')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((n) => (
              <SelectItem key={n} value={String(n)}>
                {t('selectItem', { n })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </AdminPanel>

      <AdminPanel className="space-y-4">
        <PanelTitle>{t('groupToast')}</PanelTitle>
        <Button variant="outline" onClick={() => toast(t('toastMessage'))}>
          {t('toastButton')}
        </Button>
      </AdminPanel>
    </Section>
  )
}

/* ------------------------------------------------------------------ */
/* View                                                                */
/* ------------------------------------------------------------------ */

const SECTION_LINKS = [
  { id: 'colour', labelKey: 'sectionColour' },
  { id: 'type', labelKey: 'sectionType' },
  { id: 'radius', labelKey: 'sectionRadius' },
  { id: 'surfaces', labelKey: 'sectionSurfaces' },
  { id: 'components', labelKey: 'sectionComponents' },
] as const

export function DesignSystemView() {
  const t = useTranslations('admin.designSystem')
  const styles = useLiveStyles()

  return (
    <div className="space-y-8">
      <SummaryLine styles={styles} />

      <nav aria-label={t('sectionNavAria')}>
        <div className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4">
          {SECTION_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-[var(--line)] px-4 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
            >
              {t(link.labelKey)}
            </a>
          ))}
        </div>
      </nav>

      <ColourSection styles={styles} />
      <TypeSection />
      <RadiusSection styles={styles} />
      <SurfacesSection styles={styles} />
      <ComponentsSection />
    </div>
  )
}
