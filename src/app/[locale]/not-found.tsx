import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'
import { Button } from '@/components/ui/button'

export default async function NotFound() {
  const t = await getTranslations('notFound')
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-brand-blue-safe text-8xl font-black">{t('code')}</p>
      <h1 className="text-foreground mt-4 text-2xl font-bold">
        {t('heading')}
      </h1>
      <p className="text-muted-foreground mt-2">{t('description')}</p>
      <div className="mt-8 flex gap-4">
        <Button variant="default" asChild>
          <Link href="/portfolio">{t('goHome')}</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/watch">{t('watchShows')}</Link>
        </Button>
      </div>
    </div>
  )
}
