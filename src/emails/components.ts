// Shared email shell and parts (Phase 5, plan 05-07; D-26, D-27 = Q12 C).
//
// Why .ts with createElement (imported as h) and not JSX: `node --test` (strip-types)
// cannot load JSX, and the Worker bundle built from custom-worker.ts would need its own
// JSX setup (research F19). One source then serves the unit tests, the auth template
// export script (05-10) and the queue consumer (05-19).
//
// Gmail rules the shell follows: the logo is a PNG on its own solid plate (it stays a dark
// band with a readable mark when Gmail auto-inverts), the button is a solid bgcolor table
// cell with inline colours, and no text lives inside a transparent image. Light values are
// inline (clients that strip <style> show the light look); the dark values sit in ONE
// <style> block under @media (prefers-color-scheme: dark) with !important class overrides.
//
// Colours come only from ./brand.ts (EMAIL_COLORS, built from Phase 4 EMAIL_TOKENS). No hex
// literal belongs in this file. Relative imports with explicit .ts, no "@/", no server-only.
import { createContext, createElement as h, useContext } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { Head, Html, Preview } from 'react-email'
import { render } from '@react-email/render'
import {
  EMAIL_COLORS,
  EMAIL_FONT_STACK,
  EMAIL_FONT_STACK_AR,
  FOOTER_LINE_1,
  LOGO_URL,
  MONO_STACK,
  SITE_ORIGIN_DEFAULT,
  SUPPORT_PATH,
} from './brand.ts'
import { en } from './messages/en.ts'
import { ar } from './messages/ar.ts'

export type EmailLocale = 'en' | 'ar'

const L = EMAIL_COLORS.light
const D = EMAIL_COLORS.dark
const BTN = EMAIL_COLORS.button

const LocaleContext = createContext<EmailLocale>('en')

/**
 * The one dark-scheme block. Class selectors with !important so they beat the inline light
 * values. Built only from EMAIL_COLORS.dark; no other rule lives in it.
 */
export function darkSchemeCss(): string {
  const rules = [
    `.cs-page{background:${D.page} !important}`,
    `.cs-card{background:${D.card} !important;border:1px solid ${D.cardBorder} !important}`,
    `.cs-header{background:${D.header} !important;border-bottom:1px solid ${D.headerRule} !important}`,
    `.cs-heading{color:${D.heading} !important}`,
    `.cs-text{color:${D.body} !important}`,
    `.cs-hint{color:${D.hint} !important}`,
    `.cs-code{background:${D.codeBg} !important;border:1px solid ${D.codeBorder} !important;color:${D.codeText} !important}`,
    `.cs-box{background:${D.codeBg} !important;border-color:${D.codeBorder} !important}`,
    `.cs-footer{color:${D.footer} !important}`,
    `.cs-rule{border-top:1px solid ${D.rule} !important}`,
  ]
  return `@media (prefers-color-scheme: dark){${rules.join('')}}`
}

function fontFor(locale: EmailLocale): string {
  return locale === 'ar' ? EMAIL_FONT_STACK_AR : EMAIL_FONT_STACK
}

function dirFor(locale: EmailLocale): 'rtl' | 'ltr' {
  return locale === 'ar' ? 'rtl' : 'ltr'
}

function alignFor(locale: EmailLocale): 'right' | 'left' {
  return locale === 'ar' ? 'right' : 'left'
}

export function EmailHeading({ children }: { children?: ReactNode }) {
  return h(
    'h1',
    {
      className: 'cs-heading',
      style: {
        margin: '0 0 12px',
        fontSize: '24px',
        fontWeight: 700,
        lineHeight: 1.25,
        color: L.heading,
      },
    },
    children
  )
}

export function EmailText({
  children,
  small,
}: {
  children?: ReactNode
  small?: boolean
}) {
  return h(
    'p',
    {
      className: 'cs-text',
      style: {
        margin: small ? '16px 0 0' : '0 0 16px',
        fontSize: small ? '12px' : '16px',
        lineHeight: 1.5,
        color: L.body,
      },
    },
    children
  )
}

/** A link in body copy: heading colour, underlined, switches with the scheme. */
export function EmailLink({
  href,
  children,
}: {
  href: string
  children?: ReactNode
}) {
  return h(
    'a',
    {
      href,
      className: 'cs-heading',
      style: { color: L.link, textDecoration: 'underline' },
    },
    children
  )
}

/**
 * Bulletproof button: a solid bgcolor cell, inline ink, the same in both schemes.
 * It is skipped in the plain-text part (data-skip-in-text), so every button must be
 * followed by a FallbackUrl: that line puts the URL alone on its own line in the text.
 */
export function EmailButton({ href, label }: { href: string; label: string }) {
  return h(
    'table',
    {
      role: 'presentation',
      'data-skip-in-text': 'true',
      border: 0,
      cellPadding: 0,
      cellSpacing: 0,
      style: { margin: '8px 0 0', borderCollapse: 'separate' },
    },
    h(
      'tbody',
      null,
      h(
        'tr',
        null,
        h(
          'td',
          {
            bgcolor: BTN.bg,
            style: { backgroundColor: BTN.bg, borderRadius: BTN.radius },
          },
          h(
            'a',
            {
              href,
              style: {
                display: 'inline-block',
                padding: '12px 32px',
                fontSize: '16px',
                fontWeight: 700,
                lineHeight: '24px',
                color: BTN.ink,
                textDecoration: 'none',
                borderRadius: BTN.radius,
              },
            },
            label
          )
        )
      )
    )
  )
}

/** The plain URL line under a button: same href as the button. */
export function FallbackUrl({ href, label }: { href: string; label: string }) {
  return h(
    'p',
    {
      className: 'cs-hint',
      style: {
        margin: '10px 0 18px',
        fontSize: '12px',
        lineHeight: 1.5,
        color: L.hint,
        wordBreak: 'break-all',
      },
    },
    label,
    h('br'),
    h(
      'a',
      {
        href,
        dir: 'ltr',
        className: 'cs-hint',
        style: { color: L.hint, textDecoration: 'underline' },
      },
      href
    )
  )
}

/** The six-digit code: always left-to-right, mono, even in Arabic. */
export function CodeBlock({ code }: { code: string }) {
  return h(
    'table',
    {
      role: 'presentation',
      width: '100%',
      border: 0,
      cellPadding: 0,
      cellSpacing: 0,
      style: { margin: '0 0 16px', borderCollapse: 'separate' },
    },
    h(
      'tbody',
      null,
      h(
        'tr',
        null,
        h(
          'td',
          {
            className: 'cs-code',
            dir: 'ltr',
            align: 'center',
            style: {
              backgroundColor: L.codeBg,
              border: `1px solid ${L.codeBorder}`,
              borderRadius: '8px',
              color: L.codeText,
              fontFamily: MONO_STACK,
              fontSize: '32px',
              fontWeight: 700,
              lineHeight: 1.2,
              letterSpacing: '8px',
              padding: '14px 0 14px 8px',
              textAlign: 'center',
              userSelect: 'all',
            },
          },
          code
        )
      )
    )
  )
}

/** Quoted text (support admin copy): 3px start rule, pre-wrap, escaped by React. */
export function QuoteBox({ children }: { children?: ReactNode }) {
  const locale = useContext(LocaleContext)
  const rtl = locale === 'ar'
  return h(
    'table',
    {
      role: 'presentation',
      width: '100%',
      border: 0,
      cellPadding: 0,
      cellSpacing: 0,
      style: { margin: '0 0 16px', borderCollapse: 'separate' },
    },
    h(
      'tbody',
      null,
      h(
        'tr',
        null,
        h(
          'td',
          {
            className: 'cs-box cs-text',
            style: {
              backgroundColor: L.codeBg,
              border: `1px solid ${L.codeBorder}`,
              [rtl ? 'borderRight' : 'borderLeft']: `3px solid ${L.quoteRule}`,
              borderRadius: '8px',
              color: L.body,
              fontSize: '16px',
              lineHeight: 1.5,
              padding: '12px 16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            },
          },
          children
        )
      )
    )
  )
}

/** Footer: a rule, then line 1 and the support line, then optional extra lines. */
export function Footer({
  locale,
  extra,
  siteOrigin = SITE_ORIGIN_DEFAULT,
}: {
  locale: EmailLocale
  extra?: ReactNode
  siteOrigin?: string
}) {
  const m = locale === 'ar' ? ar : en
  const textStyle = {
    margin: 0,
    fontSize: '12px',
    lineHeight: 1.5,
    color: L.footer,
  }
  return h(
    'tbody',
    null,
    h(
      'tr',
      null,
      h('td', {
        className: 'cs-rule',
        style: {
          fontSize: 0,
          lineHeight: 0,
          height: '1px',
          borderTop: `1px solid ${L.rule}`,
        },
      })
    ),
    h(
      'tr',
      null,
      h(
        'td',
        {
          className: 'cs-footer',
          style: {
            padding: '14px 32px 20px',
            fontSize: '12px',
            lineHeight: 1.5,
            color: L.footer,
            textAlign: alignFor(locale),
          },
        },
        h('p', { style: textStyle }, FOOTER_LINE_1),
        h(
          'p',
          { style: textStyle },
          `${m.footer.help} `,
          h(
            'a',
            {
              href: `${siteOrigin.replace(/\/+$/, '')}${SUPPORT_PATH}`,
              dir: 'ltr',
              className: 'cs-footer',
              // text part prints the display text only, not "text url"
              'data-text-only': 'true',
              style: { color: L.footer, textDecoration: 'underline' },
            },
            m.footer.helpLink
          )
        ),
        extra
      )
    )
  )
}

export interface EmailShellProps {
  locale: EmailLocale
  preheader: string
  children?: ReactNode
  /** Extra footer lines (digest reason, unsubscribe, postal line). */
  footerExtra?: ReactNode
  /** Defaults to LOGO_URL; app emails pass logoUrlFor(siteOrigin). */
  logoUrl?: string
  siteOrigin?: string
}

/**
 * html > head (meta, one style block) > body (cs-page) > 600px table > card (header,
 * body cell, footer). lang and dir sit on <html> and on the content table.
 */
export function EmailShell({
  locale,
  preheader,
  children,
  footerExtra,
  logoUrl = LOGO_URL,
  siteOrigin = SITE_ORIGIN_DEFAULT,
}: EmailShellProps) {
  const dir = dirFor(locale)
  const align = alignFor(locale)
  const font = fontFor(locale)
  const m = locale === 'ar' ? ar : en
  const css = `:root{color-scheme:light dark}${darkSchemeCss()}`

  return h(
    LocaleContext.Provider,
    { value: locale },
    h(
      Html,
      { lang: locale, dir },
      h(
        Head,
        null,
        h('meta', { name: 'color-scheme', content: 'light dark' }),
        h('meta', { name: 'supported-color-schemes', content: 'light dark' }),
        h('meta', {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1',
        }),
        h('title', null, m.logoAlt),
        h('style', null, css)
      ),
      h(
        'body',
        {
          className: 'cs-page',
          style: {
            margin: 0,
            padding: 0,
            backgroundColor: L.page,
            fontFamily: font,
          },
        },
        h(Preview, { useTitleTag: false, children: preheader }),
        h(
          'table',
          {
            role: 'presentation',
            className: 'cs-page',
            width: '100%',
            border: 0,
            cellPadding: 0,
            cellSpacing: 0,
            bgcolor: L.page,
            style: { backgroundColor: L.page },
          },
          h(
            'tbody',
            null,
            h(
              'tr',
              null,
              h(
                'td',
                { align: 'center', style: { padding: '24px 16px' } },
                h(
                  'table',
                  {
                    role: 'presentation',
                    lang: locale,
                    dir,
                    width: '100%',
                    border: 0,
                    cellPadding: 0,
                    cellSpacing: 0,
                    className: 'cs-card',
                    bgcolor: L.card,
                    style: {
                      width: '100%',
                      maxWidth: '600px',
                      backgroundColor: L.card,
                      borderRadius: '12px',
                      borderCollapse: 'separate',
                      overflow: 'hidden',
                      direction: dir,
                      textAlign: align,
                      fontFamily: font,
                    },
                  },
                  h(
                    'tbody',
                    null,
                    h(
                      'tr',
                      null,
                      h(
                        'td',
                        {
                          className: 'cs-header',
                          bgcolor: L.header,
                          style: {
                            backgroundColor: L.header,
                            padding: '24px',
                            textAlign: align,
                            // alt text stays readable on the dark plate with images off
                            color: D.heading,
                            fontSize: '18px',
                            fontWeight: 700,
                          },
                        },
                        h('img', {
                          src: logoUrl,
                          alt: m.logoAlt,
                          width: 136,
                          style: {
                            display: 'block',
                            border: 0,
                            color: D.heading,
                          },
                        })
                      )
                    ),
                    h(
                      'tr',
                      null,
                      h(
                        'td',
                        {
                          style: {
                            padding: '32px',
                            textAlign: align,
                            fontFamily: font,
                          },
                        },
                        children
                      )
                    )
                  ),
                  h(Footer, { locale, extra: footerExtra, siteOrigin })
                )
              )
            )
          )
        )
      )
    )
  )
}

/**
 * Renders an element to { html, text }. The text part is the plain-text render with a
 * "--" line inserted before the footer (UI-SPEC 7.2: heading, body, code or url alone on a
 * line, fine print, --, footer lines).
 */
export async function renderEmail(
  element: ReactElement
): Promise<{ html: string; text: string }> {
  // React marks the document with comment placeholders; they carry no meaning in mail.
  const html = (await render(element)).replace(
    /<!--(?:\$|\/\$|html|head|body)-->/g,
    ''
  )
  const raw = await render(element, {
    plainText: true,
    htmlToTextOptions: {
      selectors: [
        { selector: 'h1', options: { uppercase: false } },
        {
          selector: 'a[data-text-only=true]',
          format: 'anchor',
          options: { ignoreHref: true },
        },
      ],
    },
  })
  const at = raw.lastIndexOf(FOOTER_LINE_1)
  let text = raw.trim()
  if (at >= 0) {
    const before = raw.slice(0, at).trimEnd()
    const after = raw.slice(at).trim()
    text = `${before}\n\n--\n${after}`
  }
  return { html, text: `${text}\n` }
}
