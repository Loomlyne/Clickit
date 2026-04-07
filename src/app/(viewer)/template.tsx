'use client'

import { motion } from 'motion/react'
import { CINEMA_EASE } from '@/lib/cinema'

export default function ViewerTemplate({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: CINEMA_EASE }}
    >
      {children}
    </motion.div>
  )
}
