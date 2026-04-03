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
  posterUrl?: string
  heroImageUrl?: string
  releaseYear?: number
  languages?: string[]
  imdbRating?: number
  platformRating?: number
  director?: string
  cast?: Array<{ name: string; role: string; avatarUrl?: string }>
  viewCount?: number
  instagramHandle?: string
  instagramUrl?: string
}

export const MOCK_SHOWS: Show[] = [
  {
    id: '1',
    title: 'Last Call',
    slug: 'last-call',
    tagline: 'Every night has a story',
    description: 'Follow host Khalid as he roams the streets of Abu Dhabi after midnight, turning chance encounters into unforgettable conversations. From taxi drivers to CEOs, every night has a story waiting to be told.',
    genre: 'Entertainment',
    episodeCount: 24,
    seasonCount: 2,
    status: 'streaming',
    brandColor: 'brand-purple',
    releaseYear: 2024,
    languages: ['Arabic', 'English'],
    imdbRating: 7.2,
    platformRating: 4.3,
    director: 'Omar Al Rashid',
    cast: [
      { name: 'Khalid Al Ameri', role: 'Host' },
      { name: 'Sara Al Madani', role: 'Co-Host' },
      { name: 'Ahmed Bukhatir', role: 'Field Reporter' },
    ],
    viewCount: 45200,
    instagramHandle: '@lastcall.uae',
    instagramUrl: 'https://www.instagram.com/lastcall.uae',
    posterUrl: '/images/shows/last-call-poster.jpg',
    heroImageUrl: '/images/shows/last-call-hero.jpg',
  },
  {
    id: '2',
    title: 'Review Documentary',
    slug: 'review-documentary',
    tagline: 'Stories that shape our world',
    description: 'An award-winning documentary series that travels across the Gulf region to uncover stories that shaped civilizations. From ancient trade routes to modern megacities, each episode reveals a chapter you never knew existed.',
    genre: 'Documentary',
    episodeCount: 12,
    seasonCount: 1,
    status: 'streaming',
    brandColor: 'brand-blue',
    releaseYear: 2023,
    languages: ['Arabic', 'English', 'French'],
    imdbRating: 8.1,
    platformRating: 4.6,
    director: 'Fatima Al Qadiri',
    cast: [
      { name: 'Nasser Al Dhaheri', role: 'Narrator' },
      { name: 'Layla Al Hashimi', role: 'Researcher' },
      { name: 'Dr. Saeed Al Ghandi', role: 'Historian' },
    ],
    viewCount: 32100,
    instagramHandle: '@reviewdoc.ae',
    instagramUrl: 'https://www.instagram.com/reviewdoc.ae',
    posterUrl: '/images/shows/review-documentary-poster.jpg',
    heroImageUrl: '/images/shows/review-documentary-hero.jpg',
  },
  {
    id: '3',
    title: 'Doctor Care',
    slug: 'doctor-care',
    tagline: 'Your health, simplified',
    description: 'Leading physicians and wellness experts break down complex health topics into practical advice you can use today. From nutrition myths to mental health breakthroughs, Doctor Care puts your wellbeing first.',
    genre: 'Health',
    episodeCount: 18,
    seasonCount: 2,
    status: 'streaming',
    brandColor: 'brand-green',
    releaseYear: 2024,
    languages: ['Arabic', 'English'],
    imdbRating: 7.5,
    platformRating: 4.4,
    director: 'Dr. Hind Al Muhairi',
    cast: [
      { name: 'Dr. Mariam Al Mazrouei', role: 'Lead Physician' },
      { name: 'Dr. Faisal Al Jaber', role: 'Nutritionist' },
      { name: 'Aisha Al Mulla', role: 'Wellness Coach' },
      { name: 'Dr. Rashid Khalfan', role: 'Psychiatrist' },
    ],
    viewCount: 28500,
    instagramHandle: '@doctorcare.ae',
    instagramUrl: 'https://www.instagram.com/doctorcare.ae',
    posterUrl: '/images/shows/doctor-care-poster.jpg',
    heroImageUrl: '/images/shows/doctor-care-hero.jpg',
  },
  {
    id: '4',
    title: 'Saturn Podcast',
    slug: 'saturn-podcast',
    tagline: 'Conversations beyond orbit',
    description: 'Deep-dive conversations with the pioneers shaping the UAE tech scene. From AI startups to space ventures, Saturn Podcast takes you inside the minds of the region\'s most ambitious innovators.',
    genre: 'Tech',
    episodeCount: 30,
    seasonCount: 3,
    status: 'streaming',
    brandColor: 'brand-orange',
    releaseYear: 2023,
    languages: ['Arabic', 'English'],
    imdbRating: 7.8,
    platformRating: 4.5,
    director: 'Yousef Al Obaidly',
    cast: [
      { name: 'Tariq Al Khoori', role: 'Host' },
      { name: 'Dana Al Abdulla', role: 'Tech Analyst' },
      { name: 'Mohammed Al Shamsi', role: 'Guest Curator' },
    ],
    viewCount: 51800,
    instagramHandle: '@saturnpodcast',
    instagramUrl: 'https://www.instagram.com/saturnpodcast',
    posterUrl: '/images/shows/saturn-podcast-poster.jpg',
    heroImageUrl: '/images/shows/saturn-podcast-hero.jpg',
  },
  {
    id: '5',
    title: 'Poets Platform',
    slug: 'poets-platform',
    tagline: 'Words that move mountains',
    description: 'The most electrifying Arabic poetry competition on screen. Emerging and established poets from across the Arab world take the stage to perform original works that celebrate language, identity, and the human spirit.',
    genre: 'Poetry',
    episodeCount: 8,
    seasonCount: 1,
    status: 'coming-soon',
    brandColor: 'brand-red',
    releaseYear: 2025,
    languages: ['Arabic'],
    imdbRating: 6.9,
    platformRating: 4.1,
    director: 'Noura Al Kaabi',
    cast: [
      { name: 'Sultan Al Amimi', role: 'Head Judge' },
      { name: 'Hissa Hilal', role: 'Judge' },
      { name: 'Nabati Al Dhaheri', role: 'Host' },
    ],
    viewCount: 8900,
    instagramHandle: '@poetsplatform.ae',
    instagramUrl: 'https://www.instagram.com/poetsplatform.ae',
    posterUrl: '/images/shows/poets-platform-poster.jpg',
    heroImageUrl: '/images/shows/poets-platform-hero.jpg',
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
  publishedAt?: string // ISO date string
}

export interface ShowReview {
  id: string
  showId: string
  authorName: string
  rating: number
  text: string
  date: string
}

export interface Reel {
  id: string
  showId: string
  title: string
  thumbnailUrl?: string
  duration: number
  postedAt: string
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
// Placeholder YouTube IDs -- swap for real CIT video IDs when available
// ---------------------------------------------------------------------------

const PLACEHOLDER_YOUTUBE_IDS = ['dQw4w9WgXcQ', 'jNQXAC9IVRw', '9bZkp7q19f0'] as const

export const MOCK_EPISODES: Episode[] = [
  // ── Last Call  Season 1 (5 eps) ── 8 published, 1 coming-soon, 1 locked across both seasons
  { id: 'e1-1-1', showId: '1', seasonId: 's1-1', episodeNumber: 1, title: 'Late Night in Abu Dhabi', description: 'Street interviews after midnight in the capital city.', duration: 25, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2025-06-15' },
  { id: 'e1-1-2', showId: '1', seasonId: 's1-1', episodeNumber: 2, title: 'The Corniche Confessions', description: 'People share their deepest thoughts along the waterfront.', duration: 22, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2025-07-01' },
  { id: 'e1-1-3', showId: '1', seasonId: 's1-1', episodeNumber: 3, title: 'Desert Voices', description: 'Stories from travellers passing through the Al Dhafra region.', duration: 28, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-07-15' },
  { id: 'e1-1-4', showId: '1', seasonId: 's1-1', episodeNumber: 4, title: 'Market After Dark', description: 'Exploring the vibrant night markets of Abu Dhabi.', duration: 24, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2025-08-01' },
  { id: 'e1-1-5', showId: '1', seasonId: 's1-1', episodeNumber: 5, title: 'Island Nights', description: 'Late-night adventures on Yas Island with locals and tourists.', duration: 26, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2026-03-30' },
  // ── Last Call  Season 2 (5 eps)
  { id: 'e1-2-1', showId: '1', seasonId: 's1-2', episodeNumber: 1, title: 'Return to the Streets', description: 'Season two kicks off with a fresh round of street encounters.', duration: 25, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-11-10' },
  { id: 'e1-2-2', showId: '1', seasonId: 's1-2', episodeNumber: 2, title: 'Festival Frenzy', description: 'Capturing the energy of Abu Dhabi festival season.', duration: 23, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2025-11-24' },
  { id: 'e1-2-3', showId: '1', seasonId: 's1-2', episodeNumber: 3, title: 'The Last Bus Home', description: 'Stories from the final bus routes of the evening.', duration: 27, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2026-03-28' },
  { id: 'e1-2-4', showId: '1', seasonId: 's1-2', episodeNumber: 4, title: 'Midnight Majlis', description: 'A special gathering under the stars with surprise guests.', duration: 30, status: 'coming-soon' },
  { id: 'e1-2-5', showId: '1', seasonId: 's1-2', episodeNumber: 5, title: 'Season Finale: One More Call', description: 'The most memorable moments from season two.', duration: 35, status: 'locked' },

  // ── Review Documentary  Season 1 (6 eps) ── 5 published, 1 coming-soon
  { id: 'e2-1-1', showId: '2', seasonId: 's2-1', episodeNumber: 1, title: 'The Forgotten Oasis', description: 'An ancient oasis reveals centuries of hidden history.', duration: 42, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-03-10' },
  { id: 'e2-1-2', showId: '2', seasonId: 's2-1', episodeNumber: 2, title: 'Pearl Divers of the Gulf', description: 'Following the last generation of traditional pearl divers.', duration: 38, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2025-04-05' },
  { id: 'e2-1-3', showId: '2', seasonId: 's2-1', episodeNumber: 3, title: 'Silk Roads Reimagined', description: 'Tracing modern trade routes that echo the ancient Silk Road.', duration: 45, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2025-05-12' },
  { id: 'e2-1-4', showId: '2', seasonId: 's2-1', episodeNumber: 4, title: 'Guardians of the Mangroves', description: 'Conservation efforts saving Abu Dhabi\'s coastal ecosystems.', duration: 40, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-06-20' },
  { id: 'e2-1-5', showId: '2', seasonId: 's2-1', episodeNumber: 5, title: 'Voices of the Desert', description: 'Bedouin communities share their stories of adaptation.', duration: 44, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2026-04-01' },
  { id: 'e2-1-6', showId: '2', seasonId: 's2-1', episodeNumber: 6, title: 'The Future Heritage', description: 'How the UAE preserves its past while building the future.', duration: 42, status: 'coming-soon' },

  // ── Doctor Care  Season 1 (4 eps) ── 6 published, 1 coming-soon, 1 locked across both seasons
  { id: 'e3-1-1', showId: '3', seasonId: 's3-1', episodeNumber: 1, title: 'Heart Health 101', description: 'Understanding cardiovascular health with leading cardiologists.', duration: 45, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2025-09-01' },
  { id: 'e3-1-2', showId: '3', seasonId: 's3-1', episodeNumber: 2, title: 'Sleep Science', description: 'Why quality sleep is the foundation of good health.', duration: 40, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-09-15' },
  { id: 'e3-1-3', showId: '3', seasonId: 's3-1', episodeNumber: 3, title: 'Nutrition Myths Debunked', description: 'Separating fact from fiction in everyday nutrition.', duration: 42, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2025-10-01' },
  { id: 'e3-1-4', showId: '3', seasonId: 's3-1', episodeNumber: 4, title: 'Mental Wellness in the Gulf', description: 'Breaking stigma around mental health in the region.', duration: 50, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2025-10-20' },
  // ── Doctor Care  Season 2 (4 eps)
  { id: 'e3-2-1', showId: '3', seasonId: 's3-2', episodeNumber: 1, title: 'Children\'s Health Guide', description: 'A comprehensive look at paediatric wellness.', duration: 44, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2026-01-15' },
  { id: 'e3-2-2', showId: '3', seasonId: 's3-2', episodeNumber: 2, title: 'Fitness for Every Age', description: 'Exercise plans tailored for different life stages.', duration: 38, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2026-03-25' },
  { id: 'e3-2-3', showId: '3', seasonId: 's3-2', episodeNumber: 3, title: 'The Hydration Episode', description: 'Why staying hydrated matters more in desert climates.', duration: 35, status: 'coming-soon' },
  { id: 'e3-2-4', showId: '3', seasonId: 's3-2', episodeNumber: 4, title: 'Preventive Medicine', description: 'Early detection and screening programmes in the UAE.', duration: 48, status: 'locked' },

  // ── Saturn Podcast  Season 1 (5 eps) ── 12 published, 2 coming-soon, 1 locked across 3 seasons
  { id: 'e4-1-1', showId: '4', seasonId: 's4-1', episodeNumber: 1, title: 'The AI Revolution', description: 'How artificial intelligence is reshaping life in the Gulf.', duration: 25, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2025-01-10' },
  { id: 'e4-1-2', showId: '4', seasonId: 's4-1', episodeNumber: 2, title: 'Space Dreams', description: 'The UAE\'s ambitious plans for Mars and beyond.', duration: 28, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-01-25' },
  { id: 'e4-1-3', showId: '4', seasonId: 's4-1', episodeNumber: 3, title: 'Crypto Culture', description: 'Cryptocurrency adoption in the Middle East tech scene.', duration: 24, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2025-02-08' },
  { id: 'e4-1-4', showId: '4', seasonId: 's4-1', episodeNumber: 4, title: 'Green Tech Pioneers', description: 'Startups building sustainable technology solutions.', duration: 26, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2025-02-22' },
  { id: 'e4-1-5', showId: '4', seasonId: 's4-1', episodeNumber: 5, title: 'Robotics in Daily Life', description: 'How robots are entering homes and workplaces across the UAE.', duration: 22, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-03-08' },
  // ── Saturn Podcast  Season 2 (5 eps)
  { id: 'e4-2-1', showId: '4', seasonId: 's4-2', episodeNumber: 1, title: 'Metaverse Realities', description: 'Exploring virtual worlds being built in the region.', duration: 25, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2025-06-01' },
  { id: 'e4-2-2', showId: '4', seasonId: 's4-2', episodeNumber: 2, title: 'Quantum Computing 101', description: 'A beginner-friendly deep dive into quantum technology.', duration: 30, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2025-06-15' },
  { id: 'e4-2-3', showId: '4', seasonId: 's4-2', episodeNumber: 3, title: 'Digital Health Frontiers', description: 'Wearables, telemedicine, and the future of healthcare tech.', duration: 27, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-07-01' },
  { id: 'e4-2-4', showId: '4', seasonId: 's4-2', episodeNumber: 4, title: 'Cybersecurity Essentials', description: 'Protecting yourself in an increasingly connected world.', duration: 24, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2026-03-15' },
  { id: 'e4-2-5', showId: '4', seasonId: 's4-2', episodeNumber: 5, title: 'The Drone Economy', description: 'Commercial drone applications transforming industries.', duration: 26, status: 'coming-soon' },
  // ── Saturn Podcast  Season 3 (5 eps)
  { id: 'e4-3-1', showId: '4', seasonId: 's4-3', episodeNumber: 1, title: 'Neural Interfaces', description: 'Brain-computer interfaces and what they mean for humanity.', duration: 28, status: 'published', youtubeId: 'jNQXAC9IVRw', publishedAt: '2025-12-01' },
  { id: 'e4-3-2', showId: '4', seasonId: 's4-3', episodeNumber: 2, title: 'Fusion Energy Update', description: 'The latest breakthroughs in nuclear fusion research.', duration: 25, status: 'published', youtubeId: '9bZkp7q19f0', publishedAt: '2025-12-15' },
  { id: 'e4-3-3', showId: '4', seasonId: 's4-3', episodeNumber: 3, title: 'Smart Cities of 2030', description: 'How UAE cities are becoming fully connected ecosystems.', duration: 30, status: 'published', youtubeId: 'dQw4w9WgXcQ', publishedAt: '2026-03-20' },
  { id: 'e4-3-4', showId: '4', seasonId: 's4-3', episodeNumber: 4, title: 'Biotech Breakthroughs', description: 'Gene editing and personalised medicine in the Gulf.', duration: 27, status: 'coming-soon' },
  { id: 'e4-3-5', showId: '4', seasonId: 's4-3', episodeNumber: 5, title: 'The Singularity Debate', description: 'Will machines ever surpass human intelligence?', duration: 32, status: 'locked' },

  // ── Poets Platform  Season 1 (4 eps) ── 0 published, 3 coming-soon, 1 locked
  { id: 'e5-1-1', showId: '5', seasonId: 's5-1', episodeNumber: 1, title: 'Voices of the Dunes', description: 'Opening night featuring celebrated Emirati poets.', duration: 80, status: 'coming-soon' },
  { id: 'e5-1-2', showId: '5', seasonId: 's5-1', episodeNumber: 2, title: 'Verses in the Wind', description: 'Poetry performances inspired by Gulf nature and heritage.', duration: 75, status: 'coming-soon' },
  { id: 'e5-1-3', showId: '5', seasonId: 's5-1', episodeNumber: 3, title: 'The Modern Qasida', description: 'Contemporary poets reimagine classical Arabic forms.', duration: 78, status: 'coming-soon' },
  { id: 'e5-1-4', showId: '5', seasonId: 's5-1', episodeNumber: 4, title: 'Grand Finale Gala', description: 'The season culminates in a grand celebration of Arabic verse.', duration: 80, status: 'locked' },
]

// ---------------------------------------------------------------------------
// Mock Reviews
// ---------------------------------------------------------------------------

export const MOCK_REVIEWS: ShowReview[] = [
  // Last Call (showId: '1')
  { id: 'r1-1', showId: '1', authorName: 'Mariam K.', rating: 5, text: 'Absolutely love the late-night vibe. Khalid has a way of making everyone open up. Best show on the platform.', date: '2026-02-15' },
  { id: 'r1-2', showId: '1', authorName: 'Abdulrahman S.', rating: 4, text: 'Great concept and execution. Some episodes are hit or miss but overall fantastic entertainment.', date: '2026-01-20' },
  { id: 'r1-3', showId: '1', authorName: 'Fatima H.', rating: 5, text: 'This show captures the real Abu Dhabi. The street interviews feel so genuine and heartwarming.', date: '2026-03-01' },
  { id: 'r1-4', showId: '1', authorName: 'Omar J.', rating: 4, text: 'Season 2 really stepped up the production quality. The Corniche episode is my all-time favorite.', date: '2025-12-10' },

  // Review Documentary (showId: '2')
  { id: 'r2-1', showId: '2', authorName: 'Noura M.', rating: 5, text: 'Breathtaking cinematography and storytelling. The Pearl Divers episode made me proud of our heritage.', date: '2026-01-05' },
  { id: 'r2-2', showId: '2', authorName: 'Saif A.', rating: 5, text: 'Finally a documentary series that does the Gulf region justice. Every episode is a masterpiece.', date: '2025-11-28' },
  { id: 'r2-3', showId: '2', authorName: 'Latifa R.', rating: 4, text: 'Informative and beautifully shot. I learned so much about our history that I never knew before.', date: '2026-02-20' },

  // Doctor Care (showId: '3')
  { id: 'r3-1', showId: '3', authorName: 'Hamad B.', rating: 5, text: 'Dr. Mariam explains things so clearly. I changed my entire diet after watching the nutrition episode.', date: '2026-03-10' },
  { id: 'r3-2', showId: '3', authorName: 'Amal T.', rating: 4, text: 'Important topics presented in an accessible way. The mental health episode was particularly brave and needed.', date: '2026-01-15' },
  { id: 'r3-3', showId: '3', authorName: 'Yousuf K.', rating: 4, text: 'Very practical advice. I wish they covered more about fitness for office workers in the Gulf heat.', date: '2025-12-22' },
  { id: 'r3-4', showId: '3', authorName: 'Moza N.', rating: 5, text: 'Every family in the UAE should watch this show. The children health guide episode is essential viewing for parents.', date: '2026-02-28' },

  // Saturn Podcast (showId: '4')
  { id: 'r4-1', showId: '4', authorName: 'Rashid D.', rating: 5, text: 'The AI Revolution episode blew my mind. Tariq asks the questions I always wanted to ask these tech founders.', date: '2026-02-05' },
  { id: 'r4-2', showId: '4', authorName: 'Hessa L.', rating: 4, text: 'Great production value and fascinating guests. Some episodes get a bit too technical for casual listeners.', date: '2025-12-15' },
  { id: 'r4-3', showId: '4', authorName: 'Sultan Q.', rating: 5, text: 'This is what the UAE tech scene needed. Real conversations with real innovators, not just hype.', date: '2026-03-18' },

  // Poets Platform (showId: '5')
  { id: 'r5-1', showId: '5', authorName: 'Khaled W.', rating: 5, text: 'Cannot wait for this to premiere. The trailer alone gave me chills. Arabic poetry deserves this platform.', date: '2026-03-25' },
  { id: 'r5-2', showId: '5', authorName: 'Shamsa F.', rating: 4, text: 'The concept is beautiful. Hoping the judges bring diverse perspectives on modern and classical forms.', date: '2026-03-20' },
  { id: 'r5-3', showId: '5', authorName: 'Ibrahim G.', rating: 5, text: 'Finally, a show that celebrates the beauty of Arabic language. This is what our culture needs on screen.', date: '2026-03-28' },
]

// ---------------------------------------------------------------------------
// Mock Reels
// ---------------------------------------------------------------------------

export const MOCK_REELS: Reel[] = [
  // Last Call (showId: '1')
  { id: 'reel-1-1', showId: '1', title: 'Behind the Scenes: Last Call S2', duration: 45, postedAt: '2026-04-03T08:00:00Z' },
  { id: 'reel-1-2', showId: '1', title: 'Best Moments from the Corniche', duration: 30, postedAt: '2026-04-02T14:30:00Z' },
  { id: 'reel-1-3', showId: '1', title: 'Khalid meets a 90-year-old fisherman', duration: 55, postedAt: '2026-03-30T10:00:00Z' },

  // Review Documentary (showId: '2')
  { id: 'reel-2-1', showId: '2', title: 'Drone footage: Abu Dhabi mangroves', duration: 40, postedAt: '2026-04-02T09:00:00Z' },
  { id: 'reel-2-2', showId: '2', title: 'Pearl diving in 60 seconds', duration: 60, postedAt: '2026-03-29T16:00:00Z' },
  { id: 'reel-2-3', showId: '2', title: 'The Silk Road map we discovered', duration: 35, postedAt: '2026-03-25T11:00:00Z' },

  // Doctor Care (showId: '3')
  { id: 'reel-3-1', showId: '3', title: '3 hydration tips for desert living', duration: 25, postedAt: '2026-04-03T06:00:00Z' },
  { id: 'reel-3-2', showId: '3', title: 'Dr. Mariam debunks a food myth', duration: 40, postedAt: '2026-04-01T12:00:00Z' },
  { id: 'reel-3-3', showId: '3', title: 'Quick morning stretch routine', duration: 50, postedAt: '2026-03-28T07:30:00Z' },
  { id: 'reel-3-4', showId: '3', title: 'Sleep hack that changed my life', duration: 35, postedAt: '2026-03-22T20:00:00Z' },

  // Saturn Podcast (showId: '4')
  { id: 'reel-4-1', showId: '4', title: 'AI generated this image in 2 seconds', duration: 20, postedAt: '2026-04-02T18:00:00Z' },
  { id: 'reel-4-2', showId: '4', title: 'Inside a UAE robotics lab', duration: 55, postedAt: '2026-03-31T15:00:00Z' },
  { id: 'reel-4-3', showId: '4', title: 'Smart city tech you use daily', duration: 30, postedAt: '2026-03-27T09:00:00Z' },

  // Poets Platform (showId: '5')
  { id: 'reel-5-1', showId: '5', title: 'Sneak peek: stage setup for Poets Platform', duration: 35, postedAt: '2026-04-03T10:00:00Z' },
  { id: 'reel-5-2', showId: '5', title: 'Sultan Al Amimi reads a classic verse', duration: 60, postedAt: '2026-04-01T08:00:00Z' },
  { id: 'reel-5-3', showId: '5', title: 'What makes a great qasida?', duration: 45, postedAt: '2026-03-26T14:00:00Z' },
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

// ---------------------------------------------------------------------------
// Helper functions (Phase 5)
// ---------------------------------------------------------------------------

/** Resolve full episode context from episode ID (Phase 5) */
export function getEpisodeById(episodeId: string): {
  episode: Episode
  show: Show
  season: Season
  seasons: Season[]
  episodesBySeason: Record<string, Episode[]>
} | undefined {
  const episode = MOCK_EPISODES.find((e) => e.id === episodeId)
  if (!episode) return undefined
  const show = MOCK_SHOWS.find((s) => s.id === episode.showId)
  if (!show) return undefined
  const season = MOCK_SEASONS.find((s) => s.id === episode.seasonId)
  if (!season) return undefined
  const seasons = getSeasonsByShowId(show.id)
  const episodesBySeason: Record<string, Episode[]> = {}
  for (const s of seasons) {
    episodesBySeason[s.id] = getEpisodesBySeasonId(s.id)
  }
  return { episode, show, season, seasons, episodesBySeason }
}

/** Compute prev/next published episodes across season boundaries (Phase 5) */
export function getEpisodeNavigation(
  episodeId: string,
  seasons: Season[],
  episodesBySeason: Record<string, Episode[]>
): { prev: Episode | null; next: Episode | null } {
  const allEpisodes = seasons.flatMap(
    (season) => (episodesBySeason[season.id] ?? []).filter((ep) => ep.status === 'published')
  )
  const currentIndex = allEpisodes.findIndex((ep) => ep.id === episodeId)
  if (currentIndex === -1) return { prev: null, next: null }
  return {
    prev: currentIndex > 0 ? allEpisodes[currentIndex - 1] : null,
    next: currentIndex < allEpisodes.length - 1 ? allEpisodes[currentIndex + 1] : null,
  }
}

// ---------------------------------------------------------------------------
// Helper functions (Reviews, Reels, New Episodes)
// ---------------------------------------------------------------------------

export function getShowReviews(showId: string): ShowReview[] {
  return MOCK_REVIEWS.filter((r) => r.showId === showId).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
}

export function getShowReels(showId: string): Reel[] {
  return MOCK_REELS.filter((r) => r.showId === showId).sort(
    (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
  )
}

export function getNewEpisodes(): (Episode & {
  showTitle: string
  showSlug: string
  showBrandColor: Show['brandColor']
})[] {
  const thirtyDaysAgo = new Date('2026-03-04')
  return MOCK_EPISODES
    .filter((e) => e.status === 'published' && e.publishedAt && new Date(e.publishedAt) >= thirtyDaysAgo)
    .map((e) => {
      const show = MOCK_SHOWS.find((s) => s.id === e.showId)!
      return { ...e, showTitle: show.title, showSlug: show.slug, showBrandColor: show.brandColor }
    })
    .sort((a, b) => new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime())
}

export function isReelFresh(reel: Reel): boolean {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  return new Date(reel.postedAt) >= twentyFourHoursAgo
}
