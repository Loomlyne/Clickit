import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function SeriesNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <h1 className="text-4xl font-bold text-foreground">Show Not Found</h1>
      <p className="text-muted-foreground mt-4 max-w-md">
        We couldn&apos;t find that series. It may have been removed or the link
        is incorrect.
      </p>
      <Button variant="default" className="mt-8" asChild>
        <Link href="/series">Browse All Series</Link>
      </Button>
    </div>
  )
}
