export interface Show {
  id: string
  title: string
  slug: string
  tagline: string
  description: string
  genre: string
  episodeCount: number
  seasonCount: number
  status: 'streaming' | 'coming-soon'
  brandColor: 'brand-blue' | 'brand-purple' | 'brand-green' | 'brand-red' | 'brand-orange'
}

export const MOCK_SHOWS: Show[] = [
  {
    id: '1',
    title: 'Last Call',
    slug: 'last-call',
    tagline: 'Every night has a story',
    description: 'Late-night entertainment from Abu Dhabi.',
    genre: 'Entertainment',
    episodeCount: 24,
    seasonCount: 2,
    status: 'streaming',
    brandColor: 'brand-purple',
  },
  {
    id: '2',
    title: 'Review Documentary',
    slug: 'review-documentary',
    tagline: 'Stories that shape our world',
    description: 'In-depth documentary series exploring untold stories.',
    genre: 'Documentary',
    episodeCount: 12,
    seasonCount: 1,
    status: 'streaming',
    brandColor: 'brand-blue',
  },
  {
    id: '3',
    title: 'Doctor Care',
    slug: 'doctor-care',
    tagline: 'Your health, simplified',
    description: 'Expert health advice for everyday living.',
    genre: 'Health',
    episodeCount: 18,
    seasonCount: 2,
    status: 'streaming',
    brandColor: 'brand-green',
  },
  {
    id: '4',
    title: 'Saturn Podcast',
    slug: 'saturn-podcast',
    tagline: 'Conversations beyond orbit',
    description: 'Tech and culture conversations with UAE innovators.',
    genre: 'Tech',
    episodeCount: 30,
    seasonCount: 3,
    status: 'streaming',
    brandColor: 'brand-orange',
  },
  {
    id: '5',
    title: 'Poets Platform',
    slug: 'poets-platform',
    tagline: 'Words that move mountains',
    description: 'A stage for the greatest voices in Arabic poetry.',
    genre: 'Poetry',
    episodeCount: 8,
    seasonCount: 1,
    status: 'coming-soon',
    brandColor: 'brand-red',
  },
]

/**
 * Static Tailwind class mappings for brand colors.
 *
 * Required because Tailwind v4 cannot detect dynamically-constructed class names
 * (e.g., `bg-${color}` will NOT be included in the CSS output).
 * These maps ensure all brand color classes are statically present in source code.
 */
export const brandColorBgMap: Record<Show['brandColor'], string> = {
  'brand-blue': 'bg-brand-blue',
  'brand-purple': 'bg-brand-purple',
  'brand-green': 'bg-brand-green',
  'brand-red': 'bg-brand-red',
  'brand-orange': 'bg-brand-orange',
}

export const brandColorTextMap: Record<Show['brandColor'], string> = {
  'brand-blue': 'text-brand-blue',
  'brand-purple': 'text-brand-purple',
  'brand-green': 'text-brand-green',
  'brand-red': 'text-brand-red',
  'brand-orange': 'text-brand-orange',
}

export const brandColorHexMap: Record<Show['brandColor'], string> = {
  'brand-blue': '#2C3569',
  'brand-purple': '#9F54A0',
  'brand-green': '#50A258',
  'brand-red': '#DB3F34',
  'brand-orange': '#EA8C2E',
}

/** Featured shows for hero banner (first 3 streaming shows) */
export const FEATURED_SHOWS = MOCK_SHOWS.filter(
  (s) => s.status === 'streaming'
).slice(0, 3)

/** All currently streaming shows */
export const NOW_STREAMING = MOCK_SHOWS.filter(
  (s) => s.status === 'streaming'
)

/** Shows not yet released */
export const COMING_SOON_SHOWS = MOCK_SHOWS.filter(
  (s) => s.status === 'coming-soon'
)
