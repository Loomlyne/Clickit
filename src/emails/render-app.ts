// Worker-safe app email renderer (Phase 5, plan 05-11; MAIL-03..06).
//
// The queue consumer (05-16 deps.ts, 05-19) calls renderAppEmail(row, ctx) per claimed
// outbox row. Nothing is rendered here: the HTML and text were rendered at build time by
// scripts/build-app-templates.mjs into src/generated/app-email-templates.json; this module
// only fills the slots with escaped values in one pass (template-fill.ts). It stays under
// the Workers Free CPU limit and never loads React.
//
// Must NOT import react, react-email, @react-email/*, ./components.ts, ./app/templates.ts,
// ./app/direct.ts or ./messages/* (the parity test walks the import graph; the esbuild
// check in the plan lists the allowed inputs). Relative .ts imports only.
import templatesJson from '../generated/app-email-templates.json' with { type: 'json' }
import { SUPPORT_REPLY_HOURS } from '../lib/email-constants.ts'
import { APP_EMAIL_KINDS, buildAppEmailModel } from './app/model.ts'
import type { AppEmailCtx, AppEmailRow } from './app/model.ts'
import {
  fillHtml,
  fillSubject,
  fillText,
  renderRows,
} from './app/template-fill.ts'
import type {
  AppTemplateFile,
  RowTemplate,
  TrustedBlock,
} from './app/template-fill.ts'

export { APP_EMAIL_KINDS, SUPPORT_REPLY_HOURS }
export type { AppEmailCtx, AppEmailRow }

export type RenderedAppEmail = {
  subject: string
  html: string
  text: string
  replyTo?: string
}

// The inferred JSON type cannot be indexed by a template-literal key; this is the one cast.
const FILE = templatesJson as unknown as AppTemplateFile

function own<T>(record: Record<string, T>, key: string): T | undefined {
  return Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined
}

/**
 * Renders one claimed outbox row. Throws on an unknown kind, a bad payload, an unsafe URL
 * or a missing template; the consumer records the row as failed or retrying.
 * The admin copy's language is the row locale (the RPC sets the admin's profiles.locale).
 */
export async function renderAppEmail(
  row: AppEmailRow,
  ctx: AppEmailCtx
): Promise<RenderedAppEmail> {
  const locale = row.locale === 'ar' ? 'ar' : 'en'
  const model = await buildAppEmailModel(row, ctx, FILE.strings[locale])
  const key = `${model.kind}:${model.variant}:${model.locale}`
  const tpl = own(FILE.templates, key)
  if (!tpl) throw new Error(`missing template ${key}`)

  const blocks: Record<string, TrustedBlock> = {}
  if (model.kind === 'digest') {
    const rows: Record<string, RowTemplate> = FILE.rows[model.locale]
    const pick = (name: string): RowTemplate => {
      const t = own(rows, name)
      if (!t) throw new Error(`missing row template ${name}`)
      return t
    }
    blocks.shows = renderRows(
      pick,
      (model.shows ?? []).map((show) => ({
        row: show.row,
        values: show.values,
        blocks: {
          episodes: renderRows(
            pick,
            show.episodes.map((e) => ({ row: 'episode', values: e.values }))
          ),
        },
      }))
    )
  }

  const subject = fillSubject(tpl.subject, model.values)
  const html = fillHtml(tpl.html, model.values, blocks)
  const text = fillText(tpl.text, model.values, blocks)
  return model.replyTo === undefined
    ? { subject, html, text }
    : { subject, html, text, replyTo: model.replyTo }
}
