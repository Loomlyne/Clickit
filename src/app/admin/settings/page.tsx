import { createClient } from '@/lib/supabase/server'
import { HeroVideoManager } from '@/components/admin/hero-video-manager'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('app_config')
    .select('hero_video_url, hero_video_type')
    .eq('id', 1)
    .single()

  const currentVideo = data?.hero_video_url
    ? { url: data.hero_video_url, type: data.hero_video_type as 'mp4' | 'youtube' }
    : null

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage site-wide configuration for the landing page.
        </p>
      </div>

      <section className="rounded-[24px] border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="mb-1 text-lg font-semibold text-white">Hero Video</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Upload an MP4 or paste a YouTube URL. This video plays as the background on the landing page hero.
        </p>
        <HeroVideoManager currentVideo={currentVideo} />
      </section>
    </div>
  )
}
