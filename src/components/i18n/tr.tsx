'use client'

import { useTranslations } from 'next-intl'

/**
 * Tiny client-side translation island. Lets Server Components render a
 * translated label without converting the whole component to a Client
 * Component (which would bloat the client bundle). Use for small inline
 * labels inside server-rendered cards/rows.
 */
export function Tr({
  ns = 'show',
  k,
  values,
}: {
  ns?: string
  k: string
  values?: Record<string, string | number>
}) {
  const t = useTranslations(ns)
  return <>{t(k, values)}</>
}
