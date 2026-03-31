import Link from 'next/link'

import { Button } from '@/components/ui/button'

export default function EpisodeNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-6">
      <h1 className="text-4xl font-bold text-foreground">Episode Not Found</h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        We couldn&apos;t find that episode. It may have been removed or the link
        is incorrect.
      </p>
      <Button variant="default" className="mt-8" asChild>
        <Link href="/series">Browse All Series</Link>
      </Button>
    </div>
  )
}
