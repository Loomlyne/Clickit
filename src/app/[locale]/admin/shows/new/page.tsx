import { Link } from '@/i18n/navigation'
import { ArrowLeft } from 'lucide-react'
import { ShowForm } from '@/components/admin/show-form'

export default function NewShowPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1.5 rounded-[4px] border border-[var(--line)] bg-[var(--bg-2)] px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:scale-x-[-1]" />
        Back to Shows
      </Link>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Create Show</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fill in the details to add a new show to the platform.
        </p>
      </div>

      <ShowForm />
    </div>
  )
}
