# Clickit Design System

## Direction

Clickit should feel like a premium streaming product — cinematic on the viewer side, operational on the admin side.

- Viewer experience: immersive, content-led, dark cinematic, UAE cultural identity
- Admin experience: precise, dense, calm, tool-like
- Core rule: show artwork carries the expressive color; product chrome stays disciplined

## Brand Principles

- Use near-black cinematic canvases with per-show brand color glow accents
- Typography is display-weight and bold on hero areas, clean and readable on catalog
- CIT brand colors are for show identity, category ribbons, and hover glows — not global UI chrome
- Prefer rounded glassmorphic cards with subtle translucent surfaces
- Hero layout anchors content bottom-left — cinematic, not centered

## Typography

- Display / hero: Montreal (sans-serif) — Bold and ExtraBold at large sizes
- Body: Inter or system sans — Regular at 15-17px, relaxed line-height
- Logo mark: Arthead FREE for the "story" portion of the wordmark
- `font-display` maps to Montreal with tight tracking for hero headings
- Arabic content: Daken Black (headlines) + Avenir Arabic (body) — RTL deferred to v2

## Color System

### Product Shell (dark cinematic)
- Background: `#000000` / near-black `#06070A`
- Surface 1: `#0B0D12` — `#11131A`
- Surface 2: `#171A22` — `#1E2230`
- Border subtle: `rgba(255,255,255,0.08)`
- Border strong: `rgba(255,255,255,0.14)`
- Text primary: `#F5F7FA`
- Text secondary: `#B7C0CF`
- Text muted: `#7E8798`
- Primary accent (CTA, focus): `#6073FF`

### CIT Brand Colors (show identity only)
- Innovative Blue: `#2C3569`
- Royal Purple: `#9F54A0`
- Oasis Green: `#50A258`
- Crimson Red: `#DB3F34`
- Sunset Orange: `#EA8C2E`
- Desert Sand: `#F8C623`

Do not use brand colors for global buttons, layout backgrounds, or form chrome.
Safe tints are used for metadata badges, status cues, and card glow effects.

### Color Harmony Rules
- Set 1: Royal Purple + Oasis Green
- Set 2: Crimson Red + Desert Sand
- Set 3: Royal Purple + Sunset Orange
- Innovative Blue + White are neutral — pair with any set

## Surfaces and Radius

- Default component radius: 10px
- Cards and feature panels: 20-24px (rounded glassmorphic)
- Pills: CTAs, segmented controls, compact filters
- Panels use translucent dark surfaces with thin border and soft shadow
- No sharp-edge components — the rounded glassmorphic aesthetic is the CIT identity

## Motion

- Use 180-260ms transitions for hover, focus, and reveal states
- Prefer opacity and transform transitions
- Respect `prefers-reduced-motion` — gate animations and video autoplay accordingly
- Avoid exaggerated scale or parallax on core navigation and admin UI
- Hero entrance animations use cinema-curve easing at 500-600ms

## Viewer Rules

- Hero areas present one show at a time, anchored bottom-left, with CTA focus
- Card glow effects use per-show brand color at reduced opacity on hover
- Metadata reads as editorial product information — uppercase labels, clean hierarchy
- Content rails scroll horizontally, touch/swipe friendly
- UAE-inspired pattern ribbons on category and show branding

## Admin Rules

- Admin pages feel like a calm control room
- Compact panels, quiet stats blocks, strong table hierarchy, clear actions
- Tables, forms, sheets, and drawers share the same token system as the viewer shell
- Keep status color purposeful and sparse
- Media pickers use the same upload pattern as ArtworkUploadZone (form-state, not save-first)

## Component Rules

- Buttons: indigo primary, subdued secondary, translucent outline, minimal ghost
- Inputs: dark filled fields with restrained borders and strong focus rings
- Cards: rounded dark surfaces (20-24px) with soft outline and brand color glow on hover
- Tables: uppercase headers, airy rows, clear hover and selection states
- Drawers and dialogs: darker overlays, framed panels, generous spacing

## Patterns

UAE-inspired patterns for category ribbons and show branding:
- Islamic geometric patterns (Oasis Green, Royal Purple)
- Arabic calligraphy motifs
- 3D geometric / parametric patterns (Innovative Blue)
- Abu Dhabi skyline silhouette (Crimson Red)

Each program gets a branded ribbon — pattern + color combination from the 5 brand colors.

## Hero Media

Each show can have per-responsive-variant hero media:
- Desktop: 16:9 image (1920×1080) or landscape MP4/YouTube video
- Mobile: 9:16 image (1080×1920) or portrait MP4/YouTube video
- Fallback chain: mobile video → desktop video → mobile image → desktop image → bloom only
- Video backgrounds are muted and autoPlay (respect `prefers-reduced-motion`)

## Accessibility

- Minimum 4.5:1 contrast for body text
- Maintain 44×44px touch targets where interaction is primary
- Visible keyboard focus for all interactive elements
- Never encode meaning with color alone
- Decorative backgrounds and video layers use `aria-hidden`
- Respect `prefers-reduced-motion` — disable Ken Burns, reduce animation, pause video autoplay
