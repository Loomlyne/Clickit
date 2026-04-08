'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Check, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateProfile } from '@/app/(viewer)/profile/actions'

interface ProfileFormProps {
  displayName: string
}

export function ProfileForm({ displayName }: ProfileFormProps) {
  const [name, setName] = useState(displayName)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const lastSavedRef = useRef(displayName)

  const save = useCallback(async (value: string) => {
    if (value === lastSavedRef.current) return
    setStatus('saving')
    try {
      await updateProfile({ display_name: value })
      lastSavedRef.current = value
      setStatus('saved')
      setTimeout(() => setStatus((s) => s === 'saved' ? 'idle' : s), 2000)
    } catch {
      toast.error('Failed to save')
      setStatus('idle')
    }
  }, [])

  function handleChange(value: string) {
    setName(value)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => save(value), 800)
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <Label htmlFor="display-name" className="text-white/60">
            Display Name
          </Label>
          {status === 'saving' && (
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <Loader2 className="size-3 animate-spin" />
              Saving
            </span>
          )}
          {status === 'saved' && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400/80">
              <Check className="size-3" />
              Saved
            </span>
          )}
        </div>
        <Input
          id="display-name"
          value={name}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="Your name"
          className="mt-1.5"
        />
      </div>
    </div>
  )
}
