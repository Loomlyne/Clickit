import { Link } from '@/i18n/navigation'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'

export default async function SeriesNotFound() {
  const t = await getTranslations('notFound')
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <h1 className="text-4xl font-bold text-foreground">{t('showHeading')}</h1>
      <p className="text-muted-foreground mt-4 max-w-md">
        {t('showDescription')}
      </p>
      <Button variant="default" className="mt-8" asChild>
        <Link href="/watch">{t('watchAllShows')}</Link>
      </Button>
    </div>
  )
}
