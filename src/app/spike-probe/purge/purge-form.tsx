'use client'

import { useActionState } from 'react'
import { invalidateSpike, purgeSpike } from './actions'

// Two buttons, one per server action; each shows the JSON it got back
// (plan 02.1-01 spike e, deleted in 02.1-06). Fixed probe labels only.
export function SpikePurgeForm() {
  const [invalidated, invalidateAction, invalidating] = useActionState(invalidateSpike, null)
  const [purged, purgeAction, purging] = useActionState(purgeSpike, null)
  return (
    <form>
      <input type="hidden" name="tag" value="spike-a" />
      <button type="submit" formAction={invalidateAction} disabled={invalidating || purging}>
        Invalidate
      </button>
      <button type="submit" formAction={purgeAction} disabled={invalidating || purging}>
        Purge
      </button>
      <pre id="spike-invalidate-result">{JSON.stringify(invalidated)}</pre>
      <pre id="spike-purge-result">{JSON.stringify(purged)}</pre>
    </form>
  )
}
