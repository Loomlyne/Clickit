# Clickit Design System

## Direction

Clickit should feel like a premium streaming product with the calm restraint of Apple on the viewer side and the operational clarity of Linear on the admin side.

- Viewer experience: cinematic, spacious, content-led, premium
- Admin experience: precise, dense, calm, tool-like
- Core rule: show artwork carries the expressive color; product chrome stays disciplined

## Brand Principles

- Use near-black canvases with soft tonal separation instead of loud gradients
- Keep typography clean and engineered with Inter only
- Use one indigo interaction accent across the product shell
- Preserve Clickit show colors for content labeling, hover glows, and metadata only
- Prefer framed sections, quiet borders, and subtle depth over decorative effects

## Typography

- Font family: Inter
- Display: 48-72px, weight 600, tight tracking
- Heading: 24-36px, weight 600
- Body: 15-17px, weight 400, relaxed line-height
- Labels and metadata: 11-13px, uppercase or compact sentence case as needed
- `font-display` should map to Inter with tighter tracking, not a second font family

## Color System

### Product Shell
- Background: `#06070A`
- Background alt: `#0B0D12`
- Surface 1: `#11131A`
- Surface 2: `#171A22`
- Surface 3: `#1E2230`
- Border subtle: `rgba(255,255,255,0.08)`
- Border strong: `rgba(255,255,255,0.14)`
- Text primary: `#F5F7FA`
- Text secondary: `#B7C0CF`
- Text muted: `#7E8798`
- Primary accent: `#6073FF`
- Primary hover: `#7C8CFF`
- Focus ring: `rgba(96,115,255,0.38)`

### Show Colors
- Keep the existing Clickit palette for show identity only
- Do not use the show palette for global buttons, layout backgrounds, or form chrome
- Safe tints can remain for readable metadata and state cues

## Surfaces and Radius

- Default component radius: 10px
- Large feature panels: 18-24px
- Pills: reserved for CTAs, segmented controls, and compact filters
- Most panels should use translucent dark surfaces with a thin border and soft shadow

## Motion

- Use 180-260ms transitions for hover, focus, and reveal states
- Prefer opacity and transform transitions
- Respect `prefers-reduced-motion`
- Avoid exaggerated scale or parallax on core navigation and admin UI

## Viewer Rules

- Build strong vertical rhythm with framed sections and wide horizontal gutters
- Hero areas should present one show at a time with disciplined copy and strong CTA focus
- Cards should feel like product tiles, not neon posters
- Metadata should read as editorial product information
- Search, support, profile, and auth should use the same shell as content pages

## Admin Rules

- Admin pages should feel like a calm control room
- Use compact panels, quiet stats blocks, strong table hierarchy, and clear actions
- Tables, forms, sheets, and dialogs should share the same token system as the viewer shell
- Keep status color purposeful and sparse

## Component Rules

- Buttons: indigo primary, subdued secondary, translucent outline, minimal ghost
- Inputs: filled dark fields with restrained borders and strong focus rings
- Cards: layered dark surfaces with soft outline and subtle interior highlight
- Tables: uppercase headers, airy rows, clear hover and selection states
- Drawers and dialogs: darker overlays, framed panels, generous spacing

## Accessibility

- Minimum 4.5:1 contrast for body text
- Maintain 44x44px touch targets where interaction is primary
- Preserve visible keyboard focus for all interactive elements
- Never encode meaning with color alone
