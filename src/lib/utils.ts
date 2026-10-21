import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge the named theme keys from src/styles/globals.css so
// `cn('rounded-lg', 'rounded-card')` resolves to the later class.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['chip', 'control', 'shell', 'field', 'card', 'media', 'panel', 'hairline'],
      shadow: ['soft', 'panel', 'popover', 'modal', 'bar', 'inset-hairline', 'live-dot', 'cta-glow'],
      'drop-shadow': ['splash'],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
