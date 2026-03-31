import Link from 'next/link'

interface EpisodeBreadcrumbProps {
  showTitle: string
  showSlug: string
  seasonNumber: number
  episodeNumber: number
}

export function EpisodeBreadcrumb({
  showTitle,
  showSlug,
  seasonNumber,
  episodeNumber,
}: EpisodeBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm">
        <li>
          <Link
            href={`/series/${showSlug}`}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            {showTitle}
          </Link>
        </li>
        <li aria-hidden="true" className="text-text-muted">
          &gt;
        </li>
        <li className="text-text-muted">Season {seasonNumber}</li>
        <li aria-hidden="true" className="text-text-muted">
          &gt;
        </li>
        <li aria-current="page" className="text-foreground">
          Episode {episodeNumber}
        </li>
      </ol>
    </nav>
  )
}
