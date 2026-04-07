interface EpisodeBreadcrumbProps {
  seasonNumber: number
  episodeNumber: number
}

export function EpisodeBreadcrumb({
  seasonNumber,
  episodeNumber,
}: EpisodeBreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-2 text-sm">
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
