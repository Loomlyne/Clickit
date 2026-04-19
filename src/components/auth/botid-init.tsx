'use client'

import { useEffect } from 'react'
import { initBotId } from 'botid/client/core'

/**
 * Initializes BotID on the client. Placed on /auth so the challenge token
 * is collected before a user attempts sign-in or sign-up. The Server Actions
 * in src/app/(viewer)/auth/actions.ts verify the resulting headers.
 *
 * `protect` is a list of (path, method) pairs BotID should challenge. Auth
 * forms post to Server Actions, which Next.js exposes at the same path the
 * form rendered on, so protecting POST /auth covers both sign-in and sign-up.
 */
export function BotIdInit() {
  useEffect(() => {
    initBotId({
      protect: [
        { path: '/auth', method: 'POST' },
      ],
    })
  }, [])
  return null
}
