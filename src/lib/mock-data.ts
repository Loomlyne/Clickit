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

// ---------------------------------------------------------------------------
// Season & Episode types (Phase 4)
// ---------------------------------------------------------------------------

export interface Season {
  id: string
  showId: string
  seasonNumber: number
  title: string
  episodeCount: number
}

export interface Episode {
  id: string
  showId: string
  seasonId: string
  episodeNumber: number
  title: string
  description: string
  duration: number // minutes
  status: 'published' | 'coming-soon' | 'locked'
  youtubeId?: string
}

// ---------------------------------------------------------------------------
// Mock Seasons (9 total)
// ---------------------------------------------------------------------------

export const MOCK_SEASONS: Season[] = [
  // Last Call — 2 seasons, 5 episodes each
  { id: 's1-1', showId: '1', seasonNumber: 1, title: 'Season 1', episodeCount: 5 },
  { id: 's1-2', showId: '1', seasonNumber: 2, title: 'Season 2', episodeCount: 5 },
  // Review Documentary — 1 season, 6 episodes
  { id: 's2-1', showId: '2', seasonNumber: 1, title: 'Season 1', episodeCount: 6 },
  // Doctor Care — 2 seasons, 4 episodes each
  { id: 's3-1', showId: '3', seasonNumber: 1, title: 'Season 1', episodeCount: 4 },
  { id: 's3-2', showId: '3', seasonNumber: 2, title: 'Season 2', episodeCount: 4 },
  // Saturn Podcast — 3 seasons, 5 episodes each
  { id: 's4-1', showId: '4', seasonNumber: 1, title: 'Season 1', episodeCount: 5 },
  { id: 's4-2', showId: '4', seasonNumber: 2, title: 'Season 2', episodeCount: 5 },
  { id: 's4-3', showId: '4', seasonNumber: 3, title: 'Season 3', episodeCount: 5 },
  // Poets Platform — 1 season, 4 episodes
  { id: 's5-1', showId: '5', seasonNumber: 1, title: 'Season 1', episodeCount: 4 },
]

// ---------------------------------------------------------------------------
// Mock Episodes (43 total)
// ---------------------------------------------------------------------------

export const MOCK_EPISODES: Episode[] = [
  // ── Last Call  Season 1 (5 eps) ── 8 published, 1 coming-soon, 1 locked across both seasons
  { id: 'e1-1-1', showId: '1', seasonId: 's1-1', episodeNumber: 1, title: 'Late Night in Abu Dhabi', description: 'Street interviews after midnight in the capital city.', duration: 25, status: 'published' },
  { id: 'e1-1-2', showId: '1', seasonId: 's1-1', episodeNumber: 2, title: 'The Corniche Confessions', description: 'People share their deepest thoughts along the waterfront.', duration: 22, status: 'published' },
  { id: 'e1-1-3', showId: '1', seasonId: 's1-1', episodeNumber: 3, title: 'Desert Voices', description: 'Stories from travellers passing through the Al Dhafra region.', duration: 28, status: 'published' },
  { id: 'e1-1-4', showId: '1', seasonId: 's1-1', episodeNumber: 4, title: 'Market After Dark', description: 'Exploring the vibrant night markets of Abu Dhabi.', duration: 24, status: 'published' },
  { id: 'e1-1-5', showId: '1', seasonId: 's1-1', episodeNumber: 5, title: 'Island Nights', description: 'Late-night adventures on Yas Island with locals and tourists.', duration: 26, status: 'published' },
  // ── Last Call  Season 2 (5 eps)
  { id: 'e1-2-1', showId: '1', seasonId: 's1-2', episodeNumber: 1, title: 'Return to the Streets', description: 'Season two kicks off with a fresh round of street encounters.', duration: 25, status: 'published' },
  { id: 'e1-2-2', showId: '1', seasonId: 's1-2', episodeNumber: 2, title: 'Festival Frenzy', description: 'Capturing the energy of Abu Dhabi festival season.', duration: 23, status: 'published' },
  { id: 'e1-2-3', showId: '1', seasonId: 's1-2', episodeNumber: 3, title: 'The Last Bus Home', description: 'Stories from the final bus routes of the evening.', duration: 27, status: 'published' },
  { id: 'e1-2-4', showId: '1', seasonId: 's1-2', episodeNumber: 4, title: 'Midnight Majlis', description: 'A special gathering under the stars with surprise guests.', duration: 30, status: 'coming-soon' },
  { id: 'e1-2-5', showId: '1', seasonId: 's1-2', episodeNumber: 5, title: 'Season Finale: One More Call', description: 'The most memorable moments from season two.', duration: 35, status: 'locked' },

  // ── Review Documentary  Season 1 (6 eps) ── 5 published, 1 coming-soon
  { id: 'e2-1-1', showId: '2', seasonId: 's2-1', episodeNumber: 1, title: 'The Forgotten Oasis', description: 'An ancient oasis reveals centuries of hidden history.', duration: 42, status: 'published' },
  { id: 'e2-1-2', showId: '2', seasonId: 's2-1', episodeNumber: 2, title: 'Pearl Divers of the Gulf', description: 'Following the last generation of traditional pearl divers.', duration: 38, status: 'published' },
  { id: 'e2-1-3', showId: '2', seasonId: 's2-1', episodeNumber: 3, title: 'Silk Roads Reimagined', description: 'Tracing modern trade routes that echo the ancient Silk Road.', duration: 45, status: 'published' },
  { id: 'e2-1-4', showId: '2', seasonId: 's2-1', episodeNumber: 4, title: 'Guardians of the Mangroves', description: 'Conservation efforts saving Abu Dhabi\'s coastal ecosystems.', duration: 40, status: 'published' },
  { id: 'e2-1-5', showId: '2', seasonId: 's2-1', episodeNumber: 5, title: 'Voices of the Desert', description: 'Bedouin communities share their stories of adaptation.', duration: 44, status: 'published' },
  { id: 'e2-1-6', showId: '2', seasonId: 's2-1', episodeNumber: 6, title: 'The Future Heritage', description: 'How the UAE preserves its past while building the future.', duration: 42, status: 'coming-soon' },

  // ── Doctor Care  Season 1 (4 eps) ── 6 published, 1 coming-soon, 1 locked across both seasons
  { id: 'e3-1-1', showId: '3', seasonId: 's3-1', episodeNumber: 1, title: 'Heart Health 101', description: 'Understanding cardiovascular health with leading cardiologists.', duration: 45, status: 'published' },
  { id: 'e3-1-2', showId: '3', seasonId: 's3-1', episodeNumber: 2, title: 'Sleep Science', description: 'Why quality sleep is the foundation of good health.', duration: 40, status: 'published' },
  { id: 'e3-1-3', showId: '3', seasonId: 's3-1', episodeNumber: 3, title: 'Nutrition Myths Debunked', description: 'Separating fact from fiction in everyday nutrition.', duration: 42, status: 'published' },
  { id: 'e3-1-4', showId: '3', seasonId: 's3-1', episodeNumber: 4, title: 'Mental Wellness in the Gulf', description: 'Breaking stigma around mental health in the region.', duration: 50, status: 'published' },
  // ── Doctor Care  Season 2 (4 eps)
  { id: 'e3-2-1', showId: '3', seasonId: 's3-2', episodeNumber: 1, title: 'Children\'s Health Guide', description: 'A comprehensive look at paediatric wellness.', duration: 44, status: 'published' },
  { id: 'e3-2-2', showId: '3', seasonId: 's3-2', episodeNumber: 2, title: 'Fitness for Every Age', description: 'Exercise plans tailored for different life stages.', duration: 38, status: 'published' },
  { id: 'e3-2-3', showId: '3', seasonId: 's3-2', episodeNumber: 3, title: 'The Hydration Episode', description: 'Why staying hydrated matters more in desert climates.', duration: 35, status: 'coming-soon' },
  { id: 'e3-2-4', showId: '3', seasonId: 's3-2', episodeNumber: 4, title: 'Preventive Medicine', description: 'Early detection and screening programmes in the UAE.', duration: 48, status: 'locked' },

  // ── Saturn Podcast  Season 1 (5 eps) ── 12 published, 2 coming-soon, 1 locked across 3 seasons
  { id: 'e4-1-1', showId: '4', seasonId: 's4-1', episodeNumber: 1, title: 'The AI Revolution', description: 'How artificial intelligence is reshaping life in the Gulf.', duration: 25, status: 'published' },
  { id: 'e4-1-2', showId: '4', seasonId: 's4-1', episodeNumber: 2, title: 'Space Dreams', description: 'The UAE\'s ambitious plans for Mars and beyond.', duration: 28, status: 'published' },
  { id: 'e4-1-3', showId: '4', seasonId: 's4-1', episodeNumber: 3, title: 'Crypto Culture', description: 'Cryptocurrency adoption in the Middle East tech scene.', duration: 24, status: 'published' },
  { id: 'e4-1-4', showId: '4', seasonId: 's4-1', episodeNumber: 4, title: 'Green Tech Pioneers', description: 'Startups building sustainable technology solutions.', duration: 26, status: 'published' },
  { id: 'e4-1-5', showId: '4', seasonId: 's4-1', episodeNumber: 5, title: 'Robotics in Daily Life', description: 'How robots are entering homes and workplaces across the UAE.', duration: 22, status: 'published' },
  // ── Saturn Podcast  Season 2 (5 eps)
  { id: 'e4-2-1', showId: '4', seasonId: 's4-2', episodeNumber: 1, title: 'Metaverse Realities', description: 'Exploring virtual worlds being built in the region.', duration: 25, status: 'published' },
  { id: 'e4-2-2', showId: '4', seasonId: 's4-2', episodeNumber: 2, title: 'Quantum Computing 101', description: 'A beginner-friendly deep dive into quantum technology.', duration: 30, status: 'published' },
  { id: 'e4-2-3', showId: '4', seasonId: 's4-2', episodeNumber: 3, title: 'Digital Health Frontiers', description: 'Wearables, telemedicine, and the future of healthcare tech.', duration: 27, status: 'published' },
  { id: 'e4-2-4', showId: '4', seasonId: 's4-2', episodeNumber: 4, title: 'Cybersecurity Essentials', description: 'Protecting yourself in an increasingly connected world.', duration: 24, status: 'published' },
  { id: 'e4-2-5', showId: '4', seasonId: 's4-2', episodeNumber: 5, title: 'The Drone Economy', description: 'Commercial drone applications transforming industries.', duration: 26, status: 'coming-soon' },
  // ── Saturn Podcast  Season 3 (5 eps)
  { id: 'e4-3-1', showId: '4', seasonId: 's4-3', episodeNumber: 1, title: 'Neural Interfaces', description: 'Brain-computer interfaces and what they mean for humanity.', duration: 28, status: 'published' },
  { id: 'e4-3-2', showId: '4', seasonId: 's4-3', episodeNumber: 2, title: 'Fusion Energy Update', description: 'The latest breakthroughs in nuclear fusion research.', duration: 25, status: 'published' },
  { id: 'e4-3-3', showId: '4', seasonId: 's4-3', episodeNumber: 3, title: 'Smart Cities of 2030', description: 'How UAE cities are becoming fully connected ecosystems.', duration: 30, status: 'published' },
  { id: 'e4-3-4', showId: '4', seasonId: 's4-3', episodeNumber: 4, title: 'Biotech Breakthroughs', description: 'Gene editing and personalised medicine in the Gulf.', duration: 27, status: 'coming-soon' },
  { id: 'e4-3-5', showId: '4', seasonId: 's4-3', episodeNumber: 5, title: 'The Singularity Debate', description: 'Will machines ever surpass human intelligence?', duration: 32, status: 'locked' },

  // ── Poets Platform  Season 1 (4 eps) ── 0 published, 3 coming-soon, 1 locked
  { id: 'e5-1-1', showId: '5', seasonId: 's5-1', episodeNumber: 1, title: 'Voices of the Dunes', description: 'Opening night featuring celebrated Emirati poets.', duration: 80, status: 'coming-soon' },
  { id: 'e5-1-2', showId: '5', seasonId: 's5-1', episodeNumber: 2, title: 'Verses in the Wind', description: 'Poetry performances inspired by Gulf nature and heritage.', duration: 75, status: 'coming-soon' },
  { id: 'e5-1-3', showId: '5', seasonId: 's5-1', episodeNumber: 3, title: 'The Modern Qasida', description: 'Contemporary poets reimagine classical Arabic forms.', duration: 78, status: 'coming-soon' },
  { id: 'e5-1-4', showId: '5', seasonId: 's5-1', episodeNumber: 4, title: 'Grand Finale Gala', description: 'The season culminates in a grand celebration of Arabic verse.', duration: 80, status: 'locked' },
]

// ---------------------------------------------------------------------------
// Helper functions (Phase 4)
// ---------------------------------------------------------------------------

export function getShowBySlug(slug: string): Show | undefined {
  return MOCK_SHOWS.find((s) => s.slug === slug)
}

export function getSeasonsByShowId(showId: string): Season[] {
  return MOCK_SEASONS.filter((s) => s.showId === showId).sort(
    (a, b) => a.seasonNumber - b.seasonNumber
  )
}

export function getEpisodesBySeasonId(seasonId: string): Episode[] {
  return MOCK_EPISODES.filter((e) => e.seasonId === seasonId).sort(
    (a, b) => a.episodeNumber - b.episodeNumber
  )
}

export function getComingSoonEpisodesFromStreamingShows(): (Episode & {
  showTitle: string
  showSlug: string
  showBrandColor: Show['brandColor']
})[] {
  const streamingShows = MOCK_SHOWS.filter((s) => s.status === 'streaming')
  return MOCK_EPISODES.filter(
    (e) =>
      e.status === 'coming-soon' &&
      streamingShows.some((s) => s.id === e.showId)
  ).map((e) => {
    const show = streamingShows.find((s) => s.id === e.showId)!
    return {
      ...e,
      showTitle: show.title,
      showSlug: show.slug,
      showBrandColor: show.brandColor,
    }
  })
}
