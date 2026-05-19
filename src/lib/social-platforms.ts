import {
  AtSign,
  Briefcase,
  Camera,
  Ghost,
  ImageIcon,
  MessageCircle,
  Music2,
  PlaySquare,
  Send,
  Users,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type SocialPlatform = {
  id: string
  label: string
  Icon: LucideIcon
}

export const SOCIAL_PLATFORMS: SocialPlatform[] = [
  { id: 'instagram', label: 'Instagram', Icon: Camera },
  { id: 'x', label: 'X (Twitter)', Icon: AtSign },
  { id: 'youtube', label: 'YouTube', Icon: PlaySquare },
  { id: 'tiktok', label: 'TikTok', Icon: Music2 },
  { id: 'facebook', label: 'Facebook', Icon: Users },
  { id: 'linkedin', label: 'LinkedIn', Icon: Briefcase },
  { id: 'snapchat', label: 'Snapchat', Icon: Ghost },
  { id: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { id: 'telegram', label: 'Telegram', Icon: Send },
  { id: 'pinterest', label: 'Pinterest', Icon: ImageIcon },
]

export const PLATFORM_MAP = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p.id, p])
) as Record<string, SocialPlatform>
