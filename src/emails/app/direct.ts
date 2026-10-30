// The direct React path for app emails (Phase 5, plan 05-11). BUILD AND TEST ONLY: the
// Worker uses render-app.ts (fill path). This path renders the same builders with the
// row's real values; the parity test proves both give the same HTML.
import { renderEmail } from '../components.ts'
import { ar } from '../messages/ar.ts'
import { en } from '../messages/en.ts'
import { buildAppEmailModel } from './model.ts'
import type { AppEmailCtx, AppEmailModel, AppEmailRow } from './model.ts'
import type { SlotValues } from './template-fill.ts'
import { appEmailElement, appSubject } from './templates.ts'
import type { AppView, ShowView } from './templates.ts'

export type RenderedAppEmail = {
  subject: string
  html: string
  text: string
  replyTo?: string
}

function v(values: SlotValues, name: string): string {
  const slot = values[name]
  if (!slot) throw new Error(`missing slot ${name}`)
  return slot.value
}

/** Turns the shared model into a view with real values. */
export function viewFromModel(model: AppEmailModel): AppView {
  const { values, locale } = model
  const common = { locale, logo: v(values, 'logo'), origin: v(values, 'origin') }
  switch (model.kind) {
    case 'welcome':
      return { kind: 'welcome', ...common, browse: v(values, 'browse') }
    case 'support_ack':
      return { kind: 'support_ack', ...common }
    case 'support_admin':
      return {
        kind: 'support_admin',
        ...common,
        name: v(values, 'name'),
        email: v(values, 'email'),
        subject: v(values, 'subject'),
        message: v(values, 'message'),
        preheader: v(values, 'preheader'),
        admin: v(values, 'admin'),
      }
    case 'newsletter_confirm':
      return { kind: 'newsletter_confirm', ...common, confirm: v(values, 'confirm') }
    case 'digest': {
      const shows: ShowView[] = (model.shows ?? []).map((s) => ({
        row: s.row,
        title: v(s.values, 'title'),
        ...(s.row === 'show' ? { image: v(s.values, 'image') } : {}),
        episodes: s.episodes.map((e) => ({
          line: v(e.values, 'line'),
          watch: v(e.values, 'watch'),
        })),
      }))
      return {
        kind: 'digest',
        ...common,
        profile: v(values, 'profile'),
        unsubscribe: v(values, 'unsubscribe'),
        ...(model.variant === 'more' ? { seeall: v(values, 'seeall') } : {}),
        shows,
      }
    }
  }
}

/** Renders one outbox row through React (build and test only). */
export async function renderAppEmailDirect(
  row: AppEmailRow,
  ctx: AppEmailCtx
): Promise<RenderedAppEmail> {
  const m = row.locale === 'ar' ? ar : en
  const model = await buildAppEmailModel(row, ctx, {
    episodeLine: m.e7.episodeLine,
    e9Preheader: m.e9.preheader,
  })
  const { html, text } = await renderEmail(appEmailElement(viewFromModel(model)))
  const subject = appSubject(model.kind, model.locale, model.values.subject?.value)
  return model.replyTo === undefined
    ? { subject, html, text }
    : { subject, html, text, replyTo: model.replyTo }
}
