/**
 * Renders a schema.org JSON-LD <script> for SEO / rich results. Server
 * component — emits a static script tag, no client JS.
 *
 * Uses a text child rather than dangerouslySetInnerHTML: React treats
 * <script> as a raw-text element, so the JSON string is emitted verbatim
 * (not HTML-escaped). The `<` -> < replace prevents a `</script>`
 * sequence inside any data field from breaking out of the element — the
 * standard JSON-LD safety guard. Data here is first-party DB content.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script type="application/ld+json">
      {JSON.stringify(data).replace(/</g, '\\u003c')}
    </script>
  )
}
