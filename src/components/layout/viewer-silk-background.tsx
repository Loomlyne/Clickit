'use client'

import dynamic from 'next/dynamic'

const Silk = dynamic(() => import('@/components/Silk'), { ssr: false })

export function ViewerSilkBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 48,
        opacity: 0.35,
        mixBlendMode: 'screen',
        pointerEvents: 'none',
        width: '100%',
        height: '100%',
      }}
    >
      <Silk speed={2.5} scale={1.1} color="#3B82F6" noiseIntensity={1.7} rotation={0} />
    </div>
  )
}
