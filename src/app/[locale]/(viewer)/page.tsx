import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function LocaleRootPage() {
  const locale = await getLocale()
  redirect({ href: '/portfolio', locale })
}
