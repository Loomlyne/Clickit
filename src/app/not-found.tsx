import { Link } from '@/i18n/navigation'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-8xl font-black text-brand-blue-safe">404</p>
      <h1 className="mt-4 text-2xl font-bold text-foreground">Page Not Found</h1>
      <p className="mt-2 text-muted-foreground">
        We couldn&apos;t find what you were looking for.
      </p>
      <div className="mt-8 flex gap-4">
        <Button variant="default" asChild>
          <Link href="/">Go Home</Link>
        </Button>
        <Button variant="secondary" asChild>
          <Link href="/browse">Browse Shows</Link>
        </Button>
      </div>
    </div>
  )
}
