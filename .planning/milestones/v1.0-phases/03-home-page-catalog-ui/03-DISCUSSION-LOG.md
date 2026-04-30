# Phase 3: Home Page & Catalog UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-31
**Phase:** 3 — Home Page & Catalog UI
**Areas discussed:** Hero banner treatment, Show card design, Brand ribbon implementation, Sparse data strategy

---

## Hero Banner Treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Full viewport (100vh) | Completely fills the screen on landing — most immersive | ✓ |
| Netflix-style (~65-70vh) | Large but shows hint of content rails below the fold | |
| Compact (~45-50vh) | Leaves more page visible above the fold | |

**Hero content rotation:**

| Option | Description | Selected |
|--------|-------------|----------|
| Single featured show (static) | Curated single hero, no JS complexity | |
| Auto-rotating carousel (2-3 shows) | Netflix/Disney+ style, cycles automatically | ✓ |
| Manual arrow navigation | User controls rotation with prev/next | |

**Hero background:**

| Option | Description | Selected |
|--------|-------------|----------|
| Full-bleed artwork + dark gradient overlay | Standard streaming approach | |
| Full-bleed artwork + ambient color glow | Show's brand color radiates as background glow | ✓ |
| Split layout: artwork right, text left | More structured, less immersive | |

**Hero text overlay:**

| Option | Description | Selected |
|--------|-------------|----------|
| Show title + tagline + Watch Now | The essentials, clean and focused | ✓ |
| Show title + genre/metadata chips + Watch Now + My List | Richer Netflix-style | |
| Show title only + Watch Now (minimal) | Very clean but sparse | |

**Carousel transition indicator:**

| Option | Description | Selected |
|--------|-------------|----------|
| Dot indicators + crossfade | Most common streaming approach | |
| Dot indicators + slide/pan | More dynamic, horizontal motion | |
| Progress bar + crossfade | Thin bar fills over timer, modern and unique | ✓ |
| No indicator + crossfade | Cleanest but no position awareness | |

**Hero bottom edge:**

| Option | Description | Selected |
|--------|-------------|----------|
| Gradient fade to background at bottom | Hero bleeds into page — seamless cinematic feel | ✓ |
| Hard edge with section padding | Clean break between hero and rails | |

**Hero hover pause:**

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pause on hover | User can stop rotation to read, accessible | ✓ |
| No — always auto-rotate | Simpler implementation | |

---

## Show Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Portrait 2:3 (movie poster style) | Tall poster cards like Netflix series | |
| Landscape 16:9 (video thumbnail) | Wide thumbnail, cinematic proportions | ✓ |
| Square 1:1 (editorial tile) | Unusual for streaming | |

**Card information:**

| Option | Description | Selected |
|--------|-------------|----------|
| Artwork + title + genre chip + episode count | Balanced info density | ✓ |
| Artwork + title only (minimal) | Clean, image-focused | |
| Artwork + title + full metadata row | Maximum density, can feel cluttered | |

**Show logo on card:**

| Option | Description | Selected |
|--------|-------------|----------|
| On artwork, bottom-left corner | Prominent, overlaid on thumbnail | ✓ |
| Below artwork in text area | Smaller, keeps artwork clean | |
| No logo on cards — title text only | Logos on detail page instead | |

**Card hover state:**

| Option | Description | Selected |
|--------|-------------|----------|
| Scale 1.05 + overlay with Watch button | Standard streaming hover, uses `motion` | ✓ |
| Scale up only (no overlay) | Simple, elegant, faster to implement | |
| Brightness boost + scale + overlay | Most energetic hover | |

---

## Brand Ribbon Implementation

**Ribbon placement:**

| Option | Description | Selected |
|--------|-------------|----------|
| Top border strip (3-4px colored line at top) | Minimal, premium, distinct per show | ✓ |
| Genre chip uses show's brand color as background | Functional coloring, no decorative strip | |
| Colored left-side border strip (vertical accent) | Vertical rhythm when scanning a row | |

**Pattern texture:**

| Option | Description | Selected |
|--------|-------------|----------|
| Color only for now — patterns deferred | Use brand color only, defer SVG patterns | ✓ |
| Pattern as subtle background texture on ribbon | Authentic to brand guideline, requires assets | |
| Pattern as full-card watermark texture | Very subtle brand presence | |

**Brand color assignment:**

| Option | Description | Selected |
|--------|-------------|----------|
| Manually assigned per show in mock data | `brandColor` field per show, set by admin later | ✓ |
| Auto-assigned by genre category | Genre → color mapping | |
| Auto-assigned by show index (index % 5) | Deterministic, no data field | |

---

## Sparse Data Strategy

**Content rails approach:**

| Option | Description | Selected |
|--------|-------------|----------|
| One 'Now Streaming' rail only + hero | Simple and clean with sparse data | |
| All rails with some shows in multiple rails | 2-3 cards per rail, shows repeated | |
| All rails with graceful minimum-fill placeholders | Placeholder cards fill gaps — looks full | ✓ |

**Mock show content:**

| Option | Description | Selected |
|--------|-------------|----------|
| 5 real CIT shows with placeholder artwork (solid color) | Real names, no external images | ✓ |
| 5 real CIT shows with Lorem Picsum stock images | More visually convincing, requires network | |
| 3-5 fictional placeholder shows | Generic names, avoids confusion | |

**Series listing page:**

| Option | Description | Selected |
|--------|-------------|----------|
| /series — responsive grid (4/3/2/1 columns) | Standard catalog page, same card component | ✓ |
| /series — wider cards with more detail | Richer browsing view than rail cards | |
| /browse or /catalog route | Different route naming | |

