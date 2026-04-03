export function EmptyState({
  heading,
  body,
  action,
}: {
  heading: string
  body: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-[20px] font-semibold text-foreground">{heading}</h3>
      <p className="mt-2 text-[16px] text-muted-foreground max-w-sm">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
