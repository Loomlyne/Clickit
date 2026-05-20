import { PageTransition } from '@/components/layout/page-transition'

export default function ViewerTemplate({
  children,
}: {
  children: React.ReactNode
}) {
  return <PageTransition>{children}</PageTransition>
}
