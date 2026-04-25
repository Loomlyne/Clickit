'use client'

import { useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { addCastMember, deleteCastMember } from '@/app/[locale]/admin/actions'
import { toast } from 'sonner'
import type { Database } from '@/lib/database.types'

type CastMember = Database['public']['Tables']['show_cast']['Row']

interface CastEditorProps {
  showId: string
  cast: CastMember[]
}

export function CastEditor({ showId, cast: initialCast }: CastEditorProps) {
  const [cast, setCast] = useState(initialCast)
  const [adding, setAdding] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleAdd = async () => {
    if (!name.trim()) return
    setAdding(true)
    const result = await addCastMember({
      show_id: showId,
      name: name.trim(),
      role: role.trim() || null,
      image_url: imageUrl.trim() || null,
      sort_order: cast.length,
    })
    setAdding(false)
    if (result.success && result.data) {
      setCast((prev) => [...prev, result.data as CastMember])
      setName('')
      setRole('')
      setImageUrl('')
      setFormOpen(false)
      toast.success('Cast member added')
    } else {
      toast.error(result.error || 'Failed to add')
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    const result = await deleteCastMember(id)
    setDeletingId(null)
    if (result.success) {
      setCast((prev) => prev.filter((c) => c.id !== id))
      toast.success('Cast member removed')
    } else {
      toast.error(result.error || 'Failed to remove')
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium">Cast &amp; Crew</h3>
          <p className="text-xs text-muted-foreground">{cast.length} members</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setFormOpen(!formOpen)}
          className="gap-1.5"
        >
          <Plus className="size-3.5" />
          Add
        </Button>
      </div>

      {/* Add form */}
      {formOpen && (
        <div className="mb-4 rounded border border-[var(--line)] bg-[var(--bg-1)] p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Ahmed Al Mansoori"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <Input
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Host, Director"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Image URL</Label>
            <Input
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleAdd} disabled={!name.trim() || adding}>
              {adding ? <Loader2 className="size-3.5 animate-spin" /> : 'Add member'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Cast grid */}
      {cast.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {cast.map((c) => (
            <div
              key={c.id}
              className="group relative rounded border border-[var(--line)] bg-[var(--bg-1)] p-3 text-center"
            >
              {/* Avatar */}
              {c.image_url ? (
                <img
                  src={c.image_url}
                  alt={c.name}
                  className="mx-auto mb-2 h-16 w-16 rounded-full object-cover"
                />
              ) : (
                <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--bg-3)] text-lg font-medium text-[var(--text-dim)]">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="text-sm font-medium truncate">{c.name}</div>
              {c.role && (
                <div className="mono text-[10px] text-[var(--text-mute)] truncate">{c.role}</div>
              )}
              {/* Delete button */}
              <button
                className="absolute top-1.5 right-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/50 text-red-400 opacity-0 transition-opacity group-hover:opacity-100 hover:text-red-300"
                onClick={() => handleDelete(c.id)}
                disabled={deletingId === c.id}
              >
                {deletingId === c.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <Trash2 className="size-3" />
                )}
              </button>
            </div>
          ))}
        </div>
      ) : (
        !formOpen && (
          <div className="rounded border border-dashed border-[var(--line)] py-8 text-center text-sm text-muted-foreground">
            No cast members yet
          </div>
        )
      )}
    </div>
  )
}
