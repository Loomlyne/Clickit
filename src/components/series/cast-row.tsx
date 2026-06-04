import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tr } from '@/components/i18n/tr'

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
    <section className="mt-10 px-6 md:px-12">
      <h2 className="font-display text-foreground text-xl font-medium">
        <Tr k="cast" />
      </h2>
      <div className="mt-4 flex gap-6 overflow-x-auto pb-2">
        {cast.map((member) => {
          const initials = member.name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .slice(0, 2)
          return (
            <div
              key={member.name}
              className="flex min-w-[80px] flex-col items-center gap-2"
            >
              <Avatar className="size-20 rounded-full">
                <AvatarFallback className="text-muted-foreground rounded-full bg-[var(--bg-2)] text-lg font-medium">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <p className="text-foreground text-center text-sm font-medium">
                {member.name}
              </p>
              <p className="text-muted-foreground text-center text-xs">
                {member.role}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
