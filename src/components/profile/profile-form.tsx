'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile } from '@/app/(viewer)/profile/actions'

interface ProfileFormProps {
  displayName: string
}

export function ProfileForm({ displayName }: ProfileFormProps) {
  const [name, setName] = useState(displayName)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      await updateProfile({ display_name: name })
      toast.success('Profile updated')
    } catch {
      toast.error('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <Label htmlFor="display-name" className="text-white/60">
          Display Name
        </Label>
        <Input
          id="display-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          className="mt-1.5"
        />
      </div>
      <button
        onClick={handleSave}
        disabled={saving || name === displayName}
        className="rounded-full bg-white px-7 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
