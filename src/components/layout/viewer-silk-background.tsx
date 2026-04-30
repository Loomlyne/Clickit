'use client'

import { Silk } from '@/components/ui/silk'

export function ViewerSilkBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        opacity: 0.40,
        pointerEvents: 'none',
      }}
    >
      <Silk speed={5} scale={1.1} color="#3B82F6" noiseIntensity={1.7} rotation={0} />
    </div>
  )
}
