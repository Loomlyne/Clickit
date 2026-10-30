'use client'

import * as React from 'react'
import { Switch as SwitchPrimitive } from 'radix-ui'

import { cn } from '@/lib/utils'

/**
 * Switch (UI-SPEC 6.9). The 44px wrapper reserves the hit area; the root's
 * ::after stretches the click target over it without touching neighbours.
 * Always pair it with a label (aria-labelledby) and help text
 * (aria-describedby) at the call site.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <span className="flex size-11 shrink-0 items-center justify-center">
      <SwitchPrimitive.Root
        data-slot="switch"
        className={cn(
          'peer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border outline-none',
          'border-[var(--text-mute)] bg-[var(--bg-3)] data-[state=checked]:border-[var(--primary)] data-[state=checked]:bg-[var(--primary)]',
          'transition-colors duration-120 ease-[var(--ease)] motion-reduce:transition-none',
          'after:absolute after:inset-x-0 after:-inset-y-[10px] after:content-[""]',
          'focus-visible:ring-2 focus-visible:ring-[var(--primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-1)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        {...props}
      >
        <SwitchPrimitive.Thumb
          data-slot="switch-thumb"
          className={cn(
            'pointer-events-none ms-px block size-5 rounded-full bg-[var(--text-mute)] data-[state=checked]:bg-[var(--primary-foreground)]',
            'translate-x-0 data-[state=checked]:translate-x-5 rtl:data-[state=checked]:-translate-x-5',
            'transition-transform duration-120 ease-[var(--ease)] motion-reduce:transition-none'
          )}
        />
      </SwitchPrimitive.Root>
    </span>
  )
}

export { Switch }
