'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Shield, LogOut } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'
import { updateProfile } from '@/app/(viewer)/profile/actions'

interface ProfileFormProps {
  email: string
  displayName: string
  avatarUrl: string | null
  isAdmin: boolean
}

export function ProfileForm({ email, displayName, avatarUrl, isAdmin }: ProfileFormProps) {
  const router = useRouter()
  const [name, setName] = useState(displayName)
  const [saving, setSaving] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateProfile({ display_name: name })
      toast.success('Profile updated')
    } catch (err) {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      {/* Email (read-only) */}
      <div>
        <Label className="text-white/60">Email</Label>
        <Input
          value={email}
          disabled
          className="mt-1.5 opacity-60 cursor-not-allowed"
        />
      </div>

      {/* Display name */}
      <div>
        <Label htmlFor="display-name">Display Name</Label>
        <Input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-1.5"
        />
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || name === displayName}
        className="w-full rounded-full bg-white px-7 py-3 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>

      <Separator className="my-2" />

      {/* Admin link */}
      {isAdmin && (
        <Link
          href="/admin"
          className="flex items-center justify-center gap-2 w-full rounded-full border border-white/25 bg-white/5 px-7 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10"
        >
          <Shield className="size-4" />
          Admin Dashboard
        </Link>
      )}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={signingOut}
        className="flex items-center justify-center gap-2 w-full rounded-full border border-red-500/30 bg-red-500/10 px-7 py-3 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:opacity-50"
      >
        <LogOut className="size-4" />
        {signingOut ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  )
}
