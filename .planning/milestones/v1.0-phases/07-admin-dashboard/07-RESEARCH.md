# Phase 7: Admin Dashboard - Research

**Researched:** 2026-04-03
**Domain:** Admin CRUD dashboard (Next.js App Router + Supabase + shadcn/ui + react-hook-form)
**Confidence:** HIGH

## Summary

Phase 7 builds a protected admin dashboard at `/admin` for managing all CIT platform content -- shows, seasons, and episodes. The backend foundation (Phase 6) is fully in place: database schema with shows/seasons/episodes tables, RLS policies with `is_admin()` function, Supabase Storage bucket (`show-artwork`) with admin-only upload policies, and four Supabase client utilities (server, client, admin, middleware). The admin dashboard needs no schema changes except adding an `archived` boolean column to the `shows` and `episodes` tables.

The technical challenge is moderate: standard CRUD forms using react-hook-form + Zod validation inside shadcn Sheet drawers, data tables with server-side data fetching, Server Actions using `createAdminClient()` for all write operations, and client-side file uploads to Supabase Storage. The YouTube URL extraction is a pure client-side regex utility. Episode reordering uses simple swap-and-renumber Server Actions (no drag-and-drop library needed).

The primary architectural concern is the form/upload interaction: artwork uploads happen immediately on file selection (client-side to Supabase Storage), but the storage path is persisted to the database only when the form saves. This creates a two-step flow where the upload zone is a side-effect component within the form, not a form field that submits with the form.

**Primary recommendation:** Use `createAdminClient()` (service role, bypasses RLS) in all Server Actions for mutations. Use the browser Supabase client (`createClient` from `client.ts`) for artwork uploads in client components (RLS policies already allow authenticated admin uploads). Install shadcn components `sheet`, `dialog`, `table`, and `field` before building any admin UI.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Show list at `/admin` -- table view listing all active shows. Clicking a show navigates to its detail page (`/admin/shows/[id]`).
- **D-02:** Show detail page organizes seasons using tabs (Season 1, Season 2...). Same tabs pattern used for viewers in Phase 4.
- **D-03:** Show list is a table with columns: show name, genre, status badge, episode count, broadcast day, and per-row actions (Edit, Archive). No card grid.
- **D-04:** Archive section accessible via secondary nav link: `Shows | Archive`. Archive table lists soft-deleted shows with Restore and Permanently Delete actions.
- **D-05:** All create/edit forms use a slide-out drawer (shadcn Sheet component). Uniform pattern for shows, seasons, and episodes.
- **D-06:** After saving in the drawer -- close drawer + sonner toast confirmation. List refreshes with updated data.
- **D-07:** Episode and season drawers use same pattern as show drawers. No modal/inline exceptions.
- **D-08:** Up/down arrow buttons on each episode row for reordering. No drag-and-drop, no dnd-kit.
- **D-09:** Three upload zones inside show editing drawer: Poster, Hero banner, Logo. Current image shown with Replace/Upload button.
- **D-10:** Files upload immediately on file selection to Supabase Storage. DB record update (storing storage path) happens on form save.
- **D-11:** Artwork paths follow: `shows/{show_id}/poster.webp`, `shows/{show_id}/hero.webp`, `shows/{show_id}/logo.png`.
- **D-12:** `/admin` route protected via server component check: `auth.uid() === ADMIN_USER_ID`. Non-admin redirected to `/`.
- **D-13:** "Admin" link added to nav avatar dropdown, conditional on logged-in user being admin. Touches Phase 2 nav component.
- **D-14:** Admin logs in via existing `/auth` page -- no separate admin login page.
- **D-15:** Archive-first pattern. Delete button archives (soft delete), not permanently deletes.
- **D-16:** `archived: boolean DEFAULT false` column added to `shows` and `episodes` tables via DB migration.
- **D-17:** Archived shows hidden from viewer-facing pages (RLS or query filter on `archived = false`).
- **D-18:** Confirmation dialog before archiving with Cancel / Archive buttons.
- **D-19:** Permanent delete from Archive section with confirmation dialog. Cascade deletes show + seasons + episodes.
- **D-20:** Same dark CIT theme but table-focused functional layout. Reuses Phase 1 design system tokens.

### Claude's Discretion
- Exact table column widths and responsive breakpoints for admin tables
- Form field order within each drawer (beyond what ADMN-01 through ADMN-07 specify)
- Toast message copy ("Show saved" vs "Changes saved" etc.)
- Drawer width (standard shadcn Sheet sizing)
- Whether to add `form.tsx` / `field.tsx` and `dialog.tsx` shadcn components or use native HTML elements
- Middleware-level admin route protection vs server component check (either approach achieves D-12)
- Pagination or scroll on the show list (unlikely needed for 15 shows)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ADMN-01 | Admin can create, edit, and delete series (title, description, artwork, genre, status) | Show form drawer with react-hook-form + Zod, Server Actions via createAdminClient(), archive-first delete flow |
| ADMN-02 | Admin can create, edit, and delete seasons within a series | Season form drawer (simpler form: title, title_ar, season_number), Server Actions |
| ADMN-03 | Admin can create, edit, and delete episodes (title, description, YouTube URL, episode number, status) | Episode form drawer with YouTubeUrlInput component, Server Actions |
| ADMN-04 | Admin can set show status: draft, coming soon, now streaming | Select dropdown in show form mapped to DB CHECK constraint values: 'draft', 'coming-soon', 'now-streaming' |
| ADMN-05 | Admin can set episode status: draft, coming soon, published | Select dropdown in episode form mapped to: 'draft', 'coming-soon', 'published' |
| ADMN-06 | Admin can upload show artwork (poster, hero banner, logo) to Supabase Storage | ArtworkUploadZone client component using browser Supabase client `storage.from('show-artwork').upload()` with upsert option |
| ADMN-07 | Admin can set broadcast schedule (day and time) for each show | Broadcast day select + time input in show form, stored as `broadcast_day` text + `broadcast_time` time columns |
| ADMN-08 | Admin can reorder episodes within a season | Up/down arrow buttons trigger Server Action that swaps `episode_number` values between adjacent episodes |
| ADMN-09 | YouTube video ID extracted automatically from pasted URL | Client-side regex in `src/lib/youtube.ts` supporting youtu.be, watch?v=, embed/, shorts/ formats; thumbnail preview from img.youtube.com |
| ADMN-10 | Admin dashboard protected -- only accessible by admin user | Server component auth check in `/admin/layout.tsx` comparing auth.uid() against app_config.admin_user_id; redirect to `/` if non-admin |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **Stack locked:** Next.js 16 (App Router) + Supabase + Tailwind CSS v4 + shadcn/ui
- **Forms:** react-hook-form ^7.72.x + @hookform/resolvers ^5.2.x + zod ^4.3.x (all installed)
- **Toasts:** sonner (already installed and wired in root layout `<Toaster theme="dark" />`)
- **Supabase clients:** server.ts (RSC/Server Actions), client.ts (browser), admin.ts (service_role bypass RLS), middleware.ts (token refresh)
- **Admin identification:** `is_admin()` SQL function reads from `app_config` table (not env var directly -- env var was the Phase 6 CONTEXT wording, but actual implementation uses app_config lookup)
- **No Prisma, no NextAuth, no Redux** -- Supabase JS client handles all DB operations
- **Verification:** Deploy to Vercel, never localhost. Use `npx tsc --noEmit` for type checking. Do not run Playwright tests in executor agents.
- **GSD Workflow:** All edits must go through GSD commands

## Standard Stack

### Core (Already Installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-hook-form | 7.72.0 | Form state management | Uncontrolled inputs, minimal re-renders. All admin forms. |
| @hookform/resolvers | 5.2.2 | Schema resolver bridge | Connects Zod v4 schemas to react-hook-form. Import: `import { zodResolver } from '@hookform/resolvers/zod'` |
| zod | 4.3.6 | Schema validation | Shared schemas for client + server validation. TypeScript type inference. |
| sonner | 2.0.7 | Toast notifications | Already in root layout. Call `toast()` or `toast.success()` from client components. |
| @supabase/supabase-js | 2.101.0 | Supabase client | DB queries, storage uploads, auth checks |
| @supabase/ssr | 0.10.0 | SSR auth integration | Cookie-based session for server/browser clients |
| lucide-react | 1.7.0 | Icons | ChevronUp, ChevronDown, Upload, Loader2, Trash2, Archive, RotateCcw, Plus, Pencil, X |

### shadcn Components to Install
| Component | CLI Command | Purpose |
|-----------|-------------|---------|
| sheet | `npx shadcn@latest add sheet` | Slide-out drawer for all CRUD forms (D-05) |
| dialog | `npx shadcn@latest add dialog` | Confirmation dialogs for archive/delete (D-18, D-19) |
| table | `npx shadcn@latest add table` | Data tables for show list, episode list, archive |
| field | `npx shadcn@latest add field` | Form field layout (label, error, description) for react-hook-form integration |

**Install command (batch):**
```bash
npx shadcn@latest add sheet dialog table field
```

**Note on shadcn Form vs Field:** As of late 2025, shadcn/ui shifted from the `Form` wrapper component to a `Field` component that is form-library-agnostic. The `Field` component provides layout primitives (label, error, description) while you bring your own form library (react-hook-form). Use `Field` + `FieldLabel` + `FieldError` with `Controller` from react-hook-form. If `field` is not available in the registry, fall back to `form` which provides the older `FormField`/`FormItem`/`FormLabel`/`FormMessage` pattern that also works with react-hook-form.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Action file upload | Client-side Supabase upload | Server Actions have 1MB body limit by default. Client-side upload avoids this entirely and enables instant preview (D-10). Decision: client-side upload. |
| dnd-kit for reordering | Up/down arrow buttons | D-08 explicitly prohibits drag-and-drop. Arrow buttons are simpler, no library needed. |
| Signed upload URLs | Direct authenticated upload | Direct upload with browser Supabase client works because RLS policies on storage.objects already allow admin INSERT. Signed URLs add unnecessary complexity for a single admin user. |
| TanStack Table | Plain shadcn Table | Only 15 shows, no need for virtual rows, sorting, or filtering. Plain HTML table with shadcn styling is sufficient. |

## Architecture Patterns

### Route Structure
```
src/app/admin/
  layout.tsx          # Server: auth check (D-12), admin shell, hides viewer navbar
  page.tsx            # Server: fetches active shows, renders ShowsTable
  actions.ts          # Server Actions: all CRUD operations via createAdminClient()
  shows/
    [id]/
      page.tsx        # Server: fetches show + seasons + episodes, renders detail view
  archive/
    page.tsx          # Server: fetches archived shows, renders ArchiveTable
```

### Component Structure
```
src/components/admin/
  admin-header.tsx        # Server: "CIT Admin" branding + nav tabs
  shows-table.tsx         # Client: data table with actions
  episodes-table.tsx      # Client: episode list with reorder
  season-tabs.tsx         # Client: tab navigation between seasons
  show-form-drawer.tsx    # Client: Sheet + react-hook-form for show CRUD
  season-form-drawer.tsx  # Client: Sheet + react-hook-form for season CRUD
  episode-form-drawer.tsx # Client: Sheet + react-hook-form for episode CRUD
  artwork-upload-zone.tsx # Client: file picker + Supabase Storage upload
  youtube-url-input.tsx   # Client: URL input + video ID extraction + thumbnail
  archive-table.tsx       # Client: archived shows with restore/delete
  confirm-dialog.tsx      # Client: reusable confirmation dialog (archive/delete)
  status-badge.tsx        # Server: maps status string to colored badge
  empty-state.tsx         # Server: empty state with heading, body, optional CTA
```

### Utility Structure
```
src/lib/
  youtube.ts            # extractYouTubeId(url: string): string | null
  admin.ts              # isAdmin(userId: string): Promise<boolean> (optional helper)
```

### Pattern 1: Admin Layout with Auth Gate
**What:** Server component layout that checks auth before rendering admin content
**When to use:** Every `/admin` route inherits this protection
```typescript
// src/app/admin/layout.tsx (Server Component)
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) redirect('/')
  
  // Check if user is admin via app_config
  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .single()
  
  if (config?.admin_user_id !== user.id) redirect('/')
  
  return (
    // Admin shell -- no viewer Navbar/Footer
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="mx-auto max-w-7xl px-4 md:px-8 py-8">
        {children}
      </div>
    </div>
  )
}
```

### Pattern 2: Server Action with createAdminClient()
**What:** All admin write operations use the service role client that bypasses RLS
**When to use:** Every mutation (create, update, archive, delete, reorder)
```typescript
// src/app/admin/actions.ts
'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod'

// Always verify admin status in Server Actions (defense in depth)
async function assertAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  const { data: config } = await supabase
    .from('app_config')
    .select('admin_user_id')
    .single()
  
  if (config?.admin_user_id !== user.id) throw new Error('Unauthorized')
  return user
}

const showSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().min(1, 'Description is required'),
  genre: z.string().min(1, 'Genre is required'),
  brand_color: z.string(),
  status: z.enum(['draft', 'coming-soon', 'now-streaming']),
  // ... other fields
})

export async function createShow(data: z.input<typeof showSchema>) {
  await assertAdmin()
  const validated = showSchema.parse(data)
  const admin = createAdminClient()
  
  const { data: show, error } = await admin
    .from('shows')
    .insert(validated)
    .select()
    .single()
  
  if (error) throw new Error(error.message)
  revalidatePath('/admin')
  return show
}
```

### Pattern 3: Client-Side Artwork Upload (D-10)
**What:** Upload files directly from browser to Supabase Storage, bypassing Server Action body limits
**When to use:** All three artwork upload zones (poster, hero, logo)
```typescript
// Inside ArtworkUploadZone client component
'use client'
import { createClient } from '@/lib/supabase/client'

async function handleFileUpload(file: File, showId: string, slot: 'poster' | 'hero' | 'logo') {
  const supabase = createClient()
  const extension = slot === 'logo' ? 'png' : 'webp'
  const path = `shows/${showId}/${slot}.${extension}`
  
  const { data, error } = await supabase.storage
    .from('show-artwork')
    .upload(path, file, {
      upsert: true,   // Replace existing file
      contentType: file.type,
      cacheControl: '3600',
    })
  
  if (error) throw error
  
  // Get public URL for preview
  const { data: { publicUrl } } = supabase.storage
    .from('show-artwork')
    .getPublicUrl(path)
  
  return publicUrl
}
```

### Pattern 4: Form in Sheet Drawer with react-hook-form
**What:** Slide-out drawer containing a validated form
**When to use:** All create/edit operations (shows, seasons, episodes)
```typescript
'use client'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'

const schema = z.object({ title: z.string().min(1), /* ... */ })

export function ShowFormDrawer({ open, onOpenChange, show, onSave }) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: show ?? { title: '', /* ... */ },
  })
  
  async function onSubmit(data) {
    try {
      await onSave(data)
      toast.success(show ? 'Show saved' : 'Show created')
      onOpenChange(false)
    } catch {
      toast.error('Failed to save. Check your connection and try again.')
    }
  }
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{show ? 'Edit Show' : 'Create Show'}</SheetTitle>
        </SheetHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-6 py-6">
          {/* Form fields using Controller + Field/Label/Input */}
          <SheetFooter className="sticky bottom-0 bg-card pt-4 border-t">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Discard Changes
            </Button>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              Save Show
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}
```

### Pattern 5: Episode Reorder via Server Action (D-08)
**What:** Swap episode_number values between adjacent episodes
**When to use:** Up/down arrow clicks on episode rows
```typescript
// Server Action
export async function reorderEpisode(episodeId: string, direction: 'up' | 'down') {
  await assertAdmin()
  const admin = createAdminClient()
  
  // Get current episode
  const { data: current } = await admin
    .from('episodes')
    .select('id, episode_number, season_id')
    .eq('id', episodeId)
    .single()
  
  if (!current) throw new Error('Episode not found')
  
  // Find adjacent episode
  const targetNumber = direction === 'up' 
    ? current.episode_number - 1 
    : current.episode_number + 1
  
  const { data: adjacent } = await admin
    .from('episodes')
    .select('id, episode_number')
    .eq('season_id', current.season_id)
    .eq('episode_number', targetNumber)
    .single()
  
  if (!adjacent) return // Already at boundary
  
  // Swap episode numbers (use a temp value to avoid unique constraint violation)
  await admin.from('episodes').update({ episode_number: -1 }).eq('id', current.id)
  await admin.from('episodes').update({ episode_number: current.episode_number }).eq('id', adjacent.id)
  await admin.from('episodes').update({ episode_number: targetNumber }).eq('id', current.id)
  
  revalidatePath(`/admin/shows/${current.show_id ?? ''}`)
}
```

### Pattern 6: YouTube URL Extraction (ADMN-09)
**What:** Client-side regex to extract 11-char video ID from any YouTube URL format
**When to use:** Episode form YouTube URL input field
```typescript
// src/lib/youtube.ts
export function extractYouTubeId(url: string): string | null {
  if (!url) return null
  
  const regex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/
  const match = url.match(regex)
  return match ? match[1] : null
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}
```

### Anti-Patterns to Avoid
- **Using `createAdminClient()` in client components:** Service role key must never be exposed to the browser. Admin client is Server Actions only.
- **Uploading files through Server Actions:** Default 1MB body limit. Use client-side Supabase Storage upload instead (D-10).
- **Using `getSession()` for auth checks:** Always use `getUser()` which validates the JWT against Supabase signing keys. `getSession()` returns unverified data.
- **Dynamic Tailwind class construction:** Always use static class maps (existing project pattern). `bg-${color}` will not work with Tailwind v4 -- use `brandColorBgMap[color]` or inline styles.
- **Forgetting `revalidatePath()` after mutations:** Server Actions must call `revalidatePath('/admin')` to refresh server component data after create/update/delete.
- **Using RLS-authenticated client for mutations:** RLS policies require the user to be authenticated AND admin. The `createAdminClient()` (service role) bypasses RLS entirely, which is simpler and more reliable for admin operations. Still verify admin status in the Server Action before using it (defense in depth).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form state + validation | Custom form handling | react-hook-form + zodResolver | Handles dirty tracking, error states, submission, field arrays. 50+ edge cases. |
| Slide-out drawer | Custom positioned div | shadcn Sheet (Radix Dialog) | Focus trapping, escape handling, click-outside, scroll lock, accessibility. |
| Confirmation dialogs | Custom modal | shadcn Dialog (Radix AlertDialog) | Focus trap, aria-labelledby, portal rendering, keyboard navigation. |
| Data table markup | Custom div grid | shadcn Table (semantic HTML) | Proper `<table>` semantics, accessible headers, responsive patterns built in. |
| Toast notifications | Custom notification system | sonner (already wired) | Queue management, auto-dismiss, animation, stacking, screen reader announcements. |
| YouTube URL parsing | Hardcoded string split | Regex covering all formats | At least 5 URL formats (watch, embed, shorts, live, youtu.be). Edge cases with extra params. |
| File upload progress UI | Custom XMLHttpRequest | Supabase `storage.upload()` + loading state | Handles multipart encoding, retry, content-type detection. |
| Slug generation | Manual regex | `title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')` | Simple utility, but must handle Arabic characters gracefully (strip them for URL slug). |

## Common Pitfalls

### Pitfall 1: Episode Reorder Unique Constraint Violation
**What goes wrong:** Swapping two `episode_number` values directly violates the `unique(season_id, episode_number)` constraint because the intermediate state has a duplicate.
**Why it happens:** The schema has `unique (season_id, episode_number)` on the episodes table.
**How to avoid:** Use a three-step swap: set first to -1 (temporary), update second to first's number, update first to second's number. Or use a single SQL function/RPC call with a transaction.
**Warning signs:** `duplicate key value violates unique constraint` error on episode reorder.

### Pitfall 2: Upload Succeeds but URL Not Saved
**What goes wrong:** Admin uploads artwork (D-10: immediate upload on file selection), then closes the drawer without clicking Save. The file exists in Supabase Storage but the `poster_url`/`hero_url`/`logo_url` columns are not updated.
**Why it happens:** The two-step flow (upload file immediately, save path on form submit) is a deliberate design trade-off.
**How to avoid:** Accept orphaned files as a trade-off (D-10 explicitly accepts this). Optionally, add a cleanup cron later. Never block the upload on form submission.
**Warning signs:** Image visible in Supabase Storage dashboard but not displayed on the platform.

### Pitfall 3: Auth Check Stale After Token Refresh
**What goes wrong:** Admin session expires during a long editing session. Next Server Action call fails with auth error.
**Why it happens:** Supabase JWT tokens expire (default 1 hour). Middleware refreshes them on navigation, but Server Actions triggered from a long-open page may have a stale token.
**How to avoid:** The middleware in `src/lib/supabase/middleware.ts` handles token refresh on every request. Server Actions triggered via `fetch` will go through middleware. Ensure error handling in the form catches auth errors and shows a meaningful toast ("Session expired. Please refresh the page.").
**Warning signs:** Intermittent "Unauthorized" errors after the admin has been on the same page for >1 hour.

### Pitfall 4: Cascade Delete Missing Storage Files
**What goes wrong:** Permanent delete removes DB records via `ON DELETE CASCADE` but leaves orphaned files in Supabase Storage.
**Why it happens:** Database cascades only affect DB rows, not storage objects.
**How to avoid:** The `deleteShowPermanently` Server Action must explicitly delete storage files for the show (`shows/{show_id}/poster.webp`, `hero.webp`, `logo.png`) BEFORE or AFTER deleting the DB record. Use `supabase.storage.from('show-artwork').remove([...paths])`.
**Warning signs:** Storage bucket size grows over time despite shows being deleted.

### Pitfall 5: Admin Layout Hiding Viewer Navbar
**What goes wrong:** The root layout renders `<Navbar />` and `<Footer />` on ALL pages including `/admin`. Admin pages end up with both the viewer navbar and admin header.
**Why it happens:** Root layout wraps all routes including `/admin`.
**How to avoid:** Use a route group structure. Move viewer routes into `(viewer)` route group with its own layout that includes Navbar/Footer. Admin routes get their own layout WITHOUT Navbar/Footer. Alternatively, conditionally render Navbar/Footer based on pathname (less clean but simpler with current structure). The cleanest approach: move Navbar/Footer from root layout to a `(viewer)/layout.tsx` route group.
**Warning signs:** Double headers on admin pages, footer appearing below admin content.

### Pitfall 6: Zod v4 Type Mismatch with @hookform/resolvers
**What goes wrong:** TypeScript error: `Type 'Resolver<input<T>>' is not assignable to type 'Resolver<output<T>>'`
**Why it happens:** Known issue with @hookform/resolvers 5.2.x and Zod v4 when schema input/output types differ (e.g., `z.coerce` or `z.transform`).
**How to avoid:** Keep schemas simple without transforms. If type mismatch occurs, use `z.input<typeof schema>` as the form's generic type. Or add `as any` cast on the resolver as a last resort. The installed versions (resolvers 5.2.2 + zod 4.3.6) should work for basic schemas.
**Warning signs:** TypeScript errors on `resolver: zodResolver(schema)` line.

### Pitfall 7: `show_id` Not Available for New Shows During Artwork Upload
**What goes wrong:** When creating a NEW show, the show doesn't have an ID yet, so the artwork path `shows/{show_id}/poster.webp` can't be constructed.
**Why it happens:** The show is not yet inserted into the database when the admin starts uploading artwork in the "Create Show" drawer.
**How to avoid:** Generate a UUID client-side before the form opens (e.g., `crypto.randomUUID()`) and use that as the future show ID. Pass it to both the artwork upload zone (for the storage path) and the Server Action (as the insert ID). Or upload to a temporary path and rename on save.
**Warning signs:** Artwork upload fails or goes to wrong path for new shows.

## Code Examples

### YouTube URL Extraction Utility
```typescript
// src/lib/youtube.ts
// Verified against known YouTube URL formats

const YOUTUBE_REGEX = /(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/

/**
 * Extract 11-character YouTube video ID from various URL formats:
 * - https://www.youtube.com/watch?v=dQw4w9WgXcQ
 * - https://youtu.be/dQw4w9WgXcQ
 * - https://www.youtube.com/embed/dQw4w9WgXcQ
 * - https://www.youtube.com/shorts/dQw4w9WgXcQ
 * - https://www.youtube.com/live/dQw4w9WgXcQ
 * - https://youtube.com/watch?v=dQw4w9WgXcQ&t=120
 */
export function extractYouTubeId(url: string): string | null {
  if (!url) return null
  const match = url.match(YOUTUBE_REGEX)
  return match?.[1] ?? null
}

export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}
```

### Slug Generation Utility
```typescript
// src/lib/slug.ts
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars (also strips Arabic)
    .replace(/\s+/g, '-')     // Replace spaces with hyphens
    .replace(/-+/g, '-')      // Collapse multiple hyphens
    .replace(/^-|-$/g, '')    // Trim leading/trailing hyphens
}
```

### Status Badge Color Map
```typescript
// src/components/admin/status-badge.tsx
import { Badge } from '@/components/ui/badge'

const statusConfig: Record<string, { label: string; className: string }> = {
  'now-streaming': { label: 'Now Streaming', className: 'bg-[#50A258] text-white hover:bg-[#50A258]' },
  'coming-soon':   { label: 'Coming Soon',   className: 'bg-[#EA8C2E] text-black hover:bg-[#EA8C2E]' },
  'draft':         { label: 'Draft',          className: 'bg-secondary text-muted-foreground hover:bg-secondary' },
  'published':     { label: 'Published',      className: 'bg-[#50A258] text-white hover:bg-[#50A258]' },
  'archived':      { label: 'Archived',       className: 'bg-destructive text-white hover:bg-destructive' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] ?? statusConfig['draft']
  return (
    <Badge className={config.className} aria-label={`Status: ${config.label}`}>
      {config.label}
    </Badge>
  )
}
```

### Confirm Dialog Pattern (Reusable)
```typescript
// src/components/admin/confirm-dialog.tsx
'use client'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  onConfirm: () => void
  destructive?: boolean
  loading?: boolean
}

export function ConfirmDialog({
  open, onOpenChange, title, description,
  confirmLabel, onConfirm, destructive, loading
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Processing...' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| shadcn Form wrapper | shadcn Field component (form-library-agnostic) | October 2025 | Use `Field`/`FieldLabel`/`FieldError` with `Controller` from RHF instead of `FormField`/`FormItem`/`FormLabel`/`FormMessage`. If `field` not in registry, `form` still works. |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Already using correct package (0.10.0). Never import auth-helpers. |
| framer-motion package | motion package | 2024 | Already using correct package. Import from `motion/react`. |
| Tailwind v3 config.js | Tailwind v4 CSS-first config | Jan 2025 | Already on v4. No `tailwind.config.js` -- tokens in `globals.css`. |
| `getSession()` for auth | `getUser()` for auth | 2024 (Supabase security update) | `getUser()` validates JWT server-side. Already used correctly in middleware. |

## DB Migration Required

### New Migration: Add `archived` Column

The `shows` and `episodes` tables need an `archived boolean DEFAULT false` column (D-16). This must also update the public-facing RLS SELECT policies to filter out archived content (D-17).

```sql
-- Migration: add_archived_column.sql

-- Add archived column to shows
ALTER TABLE public.shows ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Add archived column to episodes  
ALTER TABLE public.episodes ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Add index for archived filtering (used on every viewer query)
CREATE INDEX IF NOT EXISTS idx_shows_archived ON public.shows(archived);
CREATE INDEX IF NOT EXISTS idx_episodes_archived ON public.episodes(archived);

-- Update viewer-facing RLS policy to exclude archived shows
DROP POLICY IF EXISTS "Public can view published shows" ON public.shows;
CREATE POLICY "Public can view published shows"
  ON public.shows FOR SELECT
  TO anon, authenticated
  USING (status IN ('now-streaming', 'coming-soon') AND archived = false);

-- Update viewer-facing RLS policy to exclude archived episodes
DROP POLICY IF EXISTS "Public can view published episodes" ON public.episodes;
CREATE POLICY "Public can view published episodes"
  ON public.episodes FOR SELECT
  TO anon, authenticated
  USING (
    status IN ('published', 'coming-soon')
    AND archived = false
    AND EXISTS (
      SELECT 1 FROM public.shows
      WHERE shows.id = episodes.show_id
      AND shows.status IN ('now-streaming', 'coming-soon')
      AND shows.archived = false
    )
  );
```

**Important:** The admin RLS policies ("Admin can view all shows", etc.) do NOT need modification. They use `(select public.is_admin())` with no status/archived filter, so the admin already sees everything.

## Open Questions

1. **shadcn Field vs Form component availability**
   - What we know: shadcn shifted to Field component pattern in late 2025. The UI-SPEC lists `form` as the component to install.
   - What's unclear: Whether `npx shadcn@latest add field` works with the current shadcn version (4.1.1). May need to check registry.
   - Recommendation: Try `field` first. If not available, use `form` (older pattern) which is confirmed to work with react-hook-form. Both patterns achieve the same result.

2. **Route group for hiding viewer Navbar on admin pages**
   - What we know: Root layout currently renders Navbar + Footer on all pages. Admin layout needs its own shell without these.
   - What's unclear: Whether to restructure into `(viewer)` and `admin` route groups (cleaner but larger diff) or to conditionally hide Navbar/Footer.
   - Recommendation: Use route groups. Create `(viewer)/layout.tsx` with Navbar/Footer, move all existing pages into `(viewer)`. Root layout becomes minimal (html/body/fonts/Toaster only). This is the idiomatic Next.js approach.

3. **New show artwork upload (no show_id yet)**
   - What we know: Storage path requires `show_id`: `shows/{show_id}/poster.webp`. New shows don't have an ID until inserted.
   - What's unclear: Best approach -- pre-generate UUID client-side or upload to temp path.
   - Recommendation: Pre-generate UUID with `crypto.randomUUID()` when opening the "Create Show" drawer. Use this UUID as both the show's `id` in the insert and the storage path prefix. Pass it explicitly to `createShow()` Server Action.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Playwright ^1.58.2 (E2E only, no unit test runner) |
| Config file | Not present in project root (Playwright config not created) |
| Quick run command | `npx tsc --noEmit` (type checking -- per project memory, do NOT run Playwright in agents) |
| Full suite command | `npx tsc --noEmit && next build` (type check + build verification) |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMN-01 | Create/edit/delete show | manual (Vercel deploy) | `npx tsc --noEmit` (type safety) | Wave 0: create type-safe schemas |
| ADMN-02 | Create/edit/delete season | manual (Vercel deploy) | `npx tsc --noEmit` | Wave 0 |
| ADMN-03 | Create/edit/delete episode | manual (Vercel deploy) | `npx tsc --noEmit` | Wave 0 |
| ADMN-04 | Show status dropdown | manual (Vercel deploy) | Type check via Zod enum | N/A |
| ADMN-05 | Episode status dropdown | manual (Vercel deploy) | Type check via Zod enum | N/A |
| ADMN-06 | Artwork upload to Storage | manual (Vercel deploy) | `npx tsc --noEmit` | Wave 0 |
| ADMN-07 | Broadcast schedule | manual (Vercel deploy) | Type check via Zod schema | N/A |
| ADMN-08 | Episode reorder | manual (Vercel deploy) | `npx tsc --noEmit` | Wave 0 |
| ADMN-09 | YouTube URL extraction | unit-testable | Can add vitest test for `extractYouTubeId()` | Wave 0: create utility |
| ADMN-10 | Admin route protection | manual (Vercel deploy) | `npx tsc --noEmit` (layout type safety) | Wave 0 |

### Sampling Rate
- **Per task commit:** `npx tsc --noEmit`
- **Per wave merge:** `npx tsc --noEmit && next build`
- **Phase gate:** Full build green + Vercel deploy + manual admin CRUD walkthrough

### Wave 0 Gaps
- [ ] Install shadcn components: `npx shadcn@latest add sheet dialog table field`
- [ ] DB migration for `archived` column on shows and episodes
- [ ] `src/lib/youtube.ts` -- YouTube URL extraction utility (unit-testable)
- [ ] Route group restructure to separate admin/viewer layouts
- [ ] No unit test framework installed -- `extractYouTubeId` is the only pure function worth unit testing. Consider adding vitest for this, or validate via TypeScript compilation + manual verification.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase CLI | DB migration | Yes | 2.84.6 | Remote migration via dashboard |
| Node.js | Next.js runtime | Yes | (system) | -- |
| shadcn CLI | Component installation | Yes | 4.1.1 | -- |
| Supabase project (remote) | Storage, auth, DB | Yes (configured via env vars) | Hosted | -- |
| Vercel CLI | Deployment verification | Yes (via project) | -- | Push to main triggers deploy |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Sources

### Primary (HIGH confidence)
- Supabase database schema: `/Users/koss/Desktop/Develop/Clickit/supabase/migrations/20260401000000_create_schema.sql` -- actual table definitions with columns, constraints, indexes
- Supabase RLS policies: `/Users/koss/Desktop/Develop/Clickit/supabase/migrations/20260401000001_create_rls_policies.sql` -- `is_admin()` function, all admin CRUD policies
- Supabase Storage config: `/Users/koss/Desktop/Develop/Clickit/supabase/migrations/20260401000002_create_storage.sql` -- bucket `show-artwork`, 5MB limit, admin upload policies
- Generated TypeScript types: `/Users/koss/Desktop/Develop/Clickit/src/lib/database.types.ts` -- full Row/Insert/Update types for all tables
- Supabase client files: `src/lib/supabase/admin.ts`, `server.ts`, `client.ts`, `middleware.ts` -- established patterns
- Phase 6 CONTEXT: `/Users/koss/Desktop/Develop/Clickit/.planning/phases/06-backend-foundation/06-CONTEXT.md` -- all DB decisions
- Phase 7 CONTEXT: `/Users/koss/Desktop/Develop/Clickit/.planning/phases/07-admin-dashboard/07-CONTEXT.md` -- all admin decisions
- Phase 7 UI-SPEC: `/Users/koss/Desktop/Develop/Clickit/.planning/phases/07-admin-dashboard/07-UI-SPEC.md` -- complete visual/interaction contract
- Installed package versions verified via `npm ls`

### Secondary (MEDIUM confidence)
- [shadcn/ui Forms - React Hook Form](https://ui.shadcn.com/docs/forms/react-hook-form) -- current Field component pattern
- [Supabase Storage Upload API](https://supabase.com/docs/reference/javascript/storage-from-upload) -- upload method signature and options
- [@hookform/resolvers npm](https://www.npmjs.com/package/@hookform/resolvers) -- Zod v4 compatibility confirmed in v5.1.0+
- [Next.js Server Actions body limit](https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions) -- 1MB default, configurable

### Tertiary (LOW confidence)
- [YouTube URL regex patterns](https://gist.github.com/afeld/1254889) -- community regex patterns, verified against known URL formats

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified, versions confirmed via npm ls
- Architecture: HIGH -- builds on established Phase 6 patterns (Supabase clients, RLS, storage bucket). Route structure follows standard Next.js App Router.
- Pitfalls: HIGH -- identified from actual schema constraints (unique episode_number), known Supabase patterns (getUser vs getSession), and project-specific decisions (D-10 upload flow)
- Forms integration: MEDIUM -- shadcn Field vs Form component shift may require runtime verification during install step. @hookform/resolvers 5.2.x with Zod v4 has known type issues but works for simple schemas.

**Research date:** 2026-04-03
**Valid until:** 2026-05-03 (stable -- all dependencies are pinned and schema is established)
