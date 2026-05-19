import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function BrowseRedirectPage({
  searchParams,
}: {
  searchParams?: Promise<{ category?: string }>
}) {
  const locale = await getLocale()
  const params = await searchParams
  const category = params?.category?.trim()
  redirect({
    href: category
      ? `/watch?category=${encodeURIComponent(category)}`
      : '/watch',
    locale,
  })
}
