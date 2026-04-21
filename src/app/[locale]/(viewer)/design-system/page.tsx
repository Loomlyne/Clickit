import { getLocale } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'

export default async function DesignSystemPage() {
  const locale = await getLocale()
  redirect({ href: '/design-system/colors', locale })
}
