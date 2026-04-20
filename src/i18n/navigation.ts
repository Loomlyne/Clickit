import { createNavigation } from 'next-intl/navigation'
import { routing } from './routing'

/**
 * Locale-aware navigation primitives for Clickit Story.
 *
 * Phase 13 will swap roughly 16 call sites across src/app and src/components
 * from `next/navigation` / `next/link` imports to this module. Every helper
 * here automatically prefixes the active locale onto outgoing URLs, so
 * a click in the /ar/ segment stays in the /ar/ segment.
 *
 * Do NOT import `Link`, `useRouter`, `redirect`, `usePathname`,
 * `getPathname`, or `permanentRedirect` from `next/navigation` or `next/link`
 * in pages or components that must preserve the URL locale prefix — use this
 * module instead.
 */
export const { Link, useRouter, redirect, usePathname, getPathname, permanentRedirect } =
  createNavigation(routing)
