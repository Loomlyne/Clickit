// Reads every row of a query past the PostgREST 1000-row cap (PR #27 review,
// finding 6). The caller builds the query with a stable order (e.g.
// .order('id')) and applies .range(from, to) to it; the loop asks for pages
// of PAGE_SIZE until one comes back shorter. Any page error stops the read and
// is returned, so a caller never treats a partial read as the whole table.
// Framework-free and alias-free so node --test loads it directly.

export const PAGE_SIZE = 1000

type PageResult<T> = PromiseLike<{
  data: T[] | null
  error: { message: string } | null
}>

export type AllPagesResult<T> =
  | { data: T[]; error: null }
  | { data: null; error: { message: string } }

export async function readAllPages<T>(
  page: (from: number, to: number) => PageResult<T>,
  pageSize: number = PAGE_SIZE
): Promise<AllPagesResult<T>> {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('pageSize must be a positive integer')
  const out: T[] = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1)
    if (error) return { data: null, error }
    const rows = data ?? []
    out.push(...rows)
    if (rows.length < pageSize) return { data: out, error: null }
  }
}
