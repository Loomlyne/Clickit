/**
 * Renders admin-authored plain-text legal content.
 * Blank lines become paragraph breaks; single newlines become line breaks.
 */
export function LegalPageContent({
  content,
  updatedAt,
}: {
  content: string
  updatedAt?: string
}) {
  const paragraphs = content
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)

  return (
    <div className="prose prose-invert max-w-none space-y-6 text-[15px] leading-relaxed text-[var(--text-dim)]">
      {paragraphs.map((para, i) => (
        <p key={i} style={{ whiteSpace: 'pre-wrap' }}>
          {para}
        </p>
      ))}
      {updatedAt && (
        <p className="mono border-t border-[var(--line)] pt-8 text-[11px] text-[var(--text-mute)]">
          Last updated:{' '}
          {new Date(updatedAt).toLocaleDateString('en-GB', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}
