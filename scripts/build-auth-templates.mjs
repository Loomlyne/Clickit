#!/usr/bin/env node

/**
 * Builds the five Supabase auth email templates (Phase 5, plan 05-10; MAIL-01).
 *
 *   npm run emails:build:auth
 *
 * Writes, from src/emails/auth/templates.ts on the 05-07 shell:
 *   supabase/templates/<name>.html        production set (media-host logo); Koss pastes
 *                                         these into the dashboard (05-35) and
 *                                         scripts/auth-config-check.mjs compares them
 *   supabase/templates/subjects.json      the five subject lines (Go locale branch)
 *   supabase/templates/local/<name>.html  local stack only (dev-server logo), used through
 *                                         supabase/config.toml
 *
 * Each file is {{ if eq .Data.locale "ar" }}<AR document>{{ else }}<EN document>{{ end }}
 * assembled as plain text, so a user without a locale gets English. Go values are swapped
 * in for the sentinels after React has rendered. Never `supabase config push` these.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { LOGO_URL } from '../src/emails/brand.ts'
import { renderEmail } from '../src/emails/components.ts'
import {
  AUTH_TEMPLATE_NAMES,
  SENTINELS,
  authLink,
  authMessage,
  authTemplateElement,
} from '../src/emails/auth/templates.ts'

export { SENTINELS }

export const LOCAL_LOGO_URL = 'http://localhost:3000/brand/email-logo-white.png'

const IF_AR = '{{ if eq .Data.locale "ar" }}'
const ELSE = '{{ else }}'
const END = '{{ end }}'

const GO_VALUES = {
  [SENTINELS.token]: '{{ .Token }}',
  [SENTINELS.tokenHash]: '{{ .TokenHash }}',
  [SENTINELS.redirect]: '{{ .RedirectTo }}',
  [SENTINELS.email]: '{{ .Email }}',
  [SENTINELS.newEmail]: '{{ .NewEmail }}',
}

const root = fileURLToPath(new URL('..', import.meta.url))

function branch(arPart, enPart) {
  return `${IF_AR}${arPart}${ELSE}${enPart}${END}`
}

/** React writes & as &amp; inside the sentinel link; Go needs the plain &. */
function unescapeLinks(html, name) {
  let link
  try {
    link = authLink(name)
  } catch {
    return html
  }
  return html.split(link.replaceAll('&', '&amp;')).join(link)
}

function fillGoValues(text) {
  let out = text
  for (const [sentinel, go] of Object.entries(GO_VALUES)) {
    out = out.split(sentinel).join(go)
  }
  return out
}

/**
 * @param {{ logoUrl?: string }} [options] logoUrl defaults to the media-host logo
 * @returns {Promise<{ name: string, html: string, subject: string }[]>}
 */
export async function buildAuthTemplates(options = {}) {
  const logoUrl = options.logoUrl ?? LOGO_URL
  const out = []
  for (const name of AUTH_TEMPLATE_NAMES) {
    const arHtml = unescapeLinks(
      (await renderEmail(authTemplateElement(name, 'ar', { logoUrl }))).html,
      name
    )
    const enHtml = unescapeLinks(
      (await renderEmail(authTemplateElement(name, 'en', { logoUrl }))).html,
      name
    )
    const html = fillGoValues(branch(arHtml, enHtml))
    const subject = branch(
      authMessage(name, 'ar').subject,
      authMessage(name, 'en').subject
    )
    out.push({ name, html, subject })
  }
  return out
}

function writeSet(dir, templates) {
  mkdirSync(dir, { recursive: true })
  for (const t of templates) {
    writeFileSync(`${dir}/${t.name}.html`, t.html)
  }
}

async function main() {
  const prod = await buildAuthTemplates({ logoUrl: LOGO_URL })
  const local = await buildAuthTemplates({ logoUrl: LOCAL_LOGO_URL })
  const dir = `${root}supabase/templates`
  writeSet(dir, prod)
  writeSet(`${dir}/local`, local)
  const subjects = Object.fromEntries(prod.map((t) => [t.name, t.subject]))
  writeFileSync(`${dir}/subjects.json`, `${JSON.stringify(subjects, null, 2)}\n`)
  console.log(
    `wrote ${prod.length} production + ${local.length} local templates and subjects.json to supabase/templates`
  )
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
