import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface CastMember {
  name: string
  role: string
  avatarUrl?: string
}

interface CastRowProps {
  cast: CastMember[]
}

export function CastRow({ cast }: CastRowProps) {
  if (!cast || cast.length === 0) return null

  return (
    <section className="px-6 md:px-12 mt-10">
      <h2 className="font-display text-xl font-medium text-foreground">Cast</h2>
      <div className="mt-4 flex gap-6 overflow-x-auto pb-2">
        {cast.map((member) => {
          const initials = member.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
          return (
            <div key={member.name} className="flex min-w-[80px] flex-col items-center gap-2">
              <Avatar className="size-20 rounded-[4px]">
                <AvatarFallback className="rounded-[4px] bg-[var(--bg-2)] text-lg font-medium text-muted-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <p className="text-center text-sm font-medium text-foreground">{member.name}</p>
              <p className="text-center text-xs text-muted-foreground">{member.role}</p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
