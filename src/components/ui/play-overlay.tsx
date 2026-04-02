import { Play } from 'lucide-react'

export function PlayOverlay() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 transition-transform duration-200 group-hover:scale-110">
        <Play className="size-5 fill-white text-white" />
      </div>
    </div>
  )
}
