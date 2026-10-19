/* In-memory Supabase fake for unit tests. Test-only; never bundled. */
import { randomUUID } from 'node:crypto'

type Row = Record<string, any>
type Tables = Record<string, Row[]>
type Op = 'select' | 'insert' | 'update' | 'delete'
type FailRule = {
  table?: string
  op?: Op
  rpc?: string
  nth: number
  kind: 'error' | 'throw'
}
type Filter =
  | { kind: 'eq' | 'neq' | 'gt' | 'lt'; col: string; value: any }
  | { kind: 'in'; col: string; value: any[] }
  | { kind: 'is'; col: string; value: any }
  | { kind: 'notnull'; col: string }
export type FakeCall = {
  table: string
  op: Op | 'rpc'
  filters: Filter[]
  patch?: any
}
type RpcHandler = (
  args: any,
  tables: Tables
) => { data: any; error: any } | Promise<{ data: any; error: any }>

// Unique constraints emulated (migrations): shows.slug, episodes
// (season_id, episode_number) including archived, show_categories.show_id.
const UNIQUE: Record<string, string[][]> = {
  shows: [['slug']],
  episodes: [['season_id', 'episode_number']],
  show_categories: [['show_id']],
}

const clone = <T>(v: T): T => structuredClone(v)

function getValue(row: Row, col: string): any {
  if (col.includes('->>')) {
    const [a, b] = col.split('->>')
    const v = row[a]?.[b]
    return v == null ? v : String(v)
  }
  return row[col]
}

function matches(row: Row, f: Filter): boolean {
  const v = getValue(row, f.col)
  switch (f.kind) {
    case 'eq':
      return v === f.value
    case 'neq':
      return v !== f.value
    case 'gt':
      return v > f.value
    case 'lt':
      return v < f.value
    case 'in':
      return f.value.includes(v)
    case 'is':
      return f.value === null ? v == null : v === f.value
    case 'notnull':
      return v != null
  }
}

function violatesUnique(table: string, rows: Row[]): boolean {
  for (const cols of UNIQUE[table] ?? []) {
    const seen = new Set<string>()
    for (const r of rows) {
      const vals = cols.map((c) => r[c])
      if (vals.some((x) => x == null)) continue
      const key = JSON.stringify(vals)
      if (seen.has(key)) return true
      seen.add(key)
    }
  }
  return false
}

export function createFakeSupabase(initial: Tables = {}) {
  const tables: Tables = {}
  for (const [k, v] of Object.entries(initial)) tables[k] = clone(v)
  if (!tables.admin_audit_log) tables.admin_audit_log = []
  const calls: FakeCall[] = []
  const rules: FailRule[] = []
  const counters = new Map<string, number>()
  const rpcs = new Map<string, RpcHandler>()
  let clock = Date.parse('2026-01-01T00:00:00.000Z')
  const tick = () => new Date((clock += 1)).toISOString()

  const tableRows = (t: string) => (tables[t] ??= [])

  function bump(key: string): number {
    const n = (counters.get(key) ?? 0) + 1
    counters.set(key, n)
    return n
  }

  function checkRule(
    where: { table?: string; op?: Op; rpc?: string },
    n: number
  ): FailRule | undefined {
    return rules.find(
      (r) =>
        r.nth === n &&
        (where.rpc
          ? r.rpc === where.rpc
          : r.table === where.table && r.op === where.op)
    )
  }

  class Builder {
    private op: Op = 'select'
    private filters: Filter[] = []
    private patch: any
    private rowsIn: Row[] = []
    private returning = false
    private head = false
    private wantCount = false
    private orderBy: { col: string; asc: boolean } | null = null
    private max: number | null = null
    private mode: 'many' | 'single' | 'maybe' = 'many'

    private table: string
    constructor(table: string) {
      this.table = table
    }

    select(_cols?: string, opts?: { count?: string; head?: boolean }) {
      if (this.op === 'select') {
        this.head = !!opts?.head
        this.wantCount = opts?.count === 'exact'
      } else this.returning = true
      return this
    }
    insert(rows: Row | Row[]) {
      this.op = 'insert'
      this.rowsIn = Array.isArray(rows) ? rows : [rows]
      return this
    }
    update(patch: Row) {
      this.op = 'update'
      this.patch = patch
      return this
    }
    delete() {
      this.op = 'delete'
      return this
    }
    eq(col: string, value: any) {
      this.filters.push({ kind: 'eq', col, value })
      return this
    }
    neq(col: string, value: any) {
      this.filters.push({ kind: 'neq', col, value })
      return this
    }
    gt(col: string, value: any) {
      this.filters.push({ kind: 'gt', col, value })
      return this
    }
    lt(col: string, value: any) {
      this.filters.push({ kind: 'lt', col, value })
      return this
    }
    in(col: string, value: any[]) {
      this.filters.push({ kind: 'in', col, value })
      return this
    }
    is(col: string, value: any) {
      this.filters.push({ kind: 'is', col, value })
      return this
    }
    not(col: string, operator: string, value: any) {
      if (operator === 'is' && value === null)
        this.filters.push({ kind: 'notnull', col })
      else throw new Error(`fake-supabase: unsupported not(${operator})`)
      return this
    }
    order(col: string, opts?: { ascending?: boolean }) {
      this.orderBy = { col, asc: opts?.ascending !== false }
      return this
    }
    limit(n: number) {
      this.max = n
      return this
    }
    single() {
      this.mode = 'single'
      return this
    }
    maybeSingle() {
      this.mode = 'maybe'
      return this
    }

    then<T1 = any, T2 = never>(
      onF?: ((v: any) => T1 | PromiseLike<T1>) | null,
      onR?: ((e: any) => T2 | PromiseLike<T2>) | null
    ) {
      return Promise.resolve()
        .then(() => this.exec())
        .then(onF, onR)
    }

    private shape(rows: Row[], count?: number) {
      let out = rows
      if (this.orderBy) {
        const { col, asc } = this.orderBy
        out = [...out].sort((a, b) => {
          const x = a[col]
          const y = b[col]
          if (x === y) return 0
          return (x > y ? 1 : -1) * (asc ? 1 : -1)
        })
      }
      if (this.max != null) out = out.slice(0, this.max)
      out = clone(out)
      if (this.mode === 'single') {
        if (out.length !== 1)
          return {
            data: null,
            error: {
              code: 'PGRST116',
              message: 'JSON object requested, multiple (or no) rows returned',
            },
            count: count ?? null,
          }
        return { data: out[0], error: null, count: count ?? null }
      }
      if (this.mode === 'maybe') {
        if (out.length > 1)
          return {
            data: null,
            error: { code: 'PGRST116', message: 'multiple rows returned' },
            count: count ?? null,
          }
        return { data: out[0] ?? null, error: null, count: count ?? null }
      }
      return { data: out, error: null, count: count ?? null }
    }

    private exec() {
      calls.push({
        table: this.table,
        op: this.op,
        filters: this.filters,
        patch: this.patch ?? (this.rowsIn.length ? this.rowsIn : undefined),
      })
      const n = bump(`${this.table}:${this.op}`)
      const rule = checkRule({ table: this.table, op: this.op }, n)
      if (rule?.kind === 'throw') throw new Error('forced throw')
      if (rule) {
        return {
          data: null,
          error: { message: 'forced failure' },
          count: null,
        }
      }

      const rows = tableRows(this.table)
      const hit = (r: Row) => this.filters.every((f) => matches(r, f))

      if (this.op === 'select') {
        const found = rows.filter(hit)
        if (this.head)
          return { data: null, error: null, count: found.length }
        return this.shape(found, this.wantCount ? found.length : undefined)
      }

      if (this.op === 'insert') {
        const fresh = this.rowsIn.map((r) => ({
          id: randomUUID(),
          created_at: tick(),
          ...clone(r),
        }))
        if (violatesUnique(this.table, [...rows, ...fresh]))
          return this.uniqueError()
        rows.push(...fresh)
        return this.returning
          ? this.shape(fresh)
          : { data: null, error: null, count: null }
      }

      if (this.op === 'update') {
        const next = rows.map((r) => (hit(r) ? { ...r, ...clone(this.patch) } : r))
        if (violatesUnique(this.table, next)) return this.uniqueError()
        const changed: Row[] = []
        rows.forEach((r, i) => {
          if (hit(r)) {
            Object.assign(r, next[i])
            changed.push(r)
          }
        })
        return this.returning
          ? this.shape(changed)
          : { data: null, error: null, count: null }
      }

      // delete
      const gone = rows.filter(hit)
      tables[this.table] = rows.filter((r) => !hit(r))
      return this.returning
        ? this.shape(gone)
        : { data: null, error: null, count: null }
    }

    private uniqueError() {
      return {
        data: null,
        error: {
          code: '23505',
          message: `duplicate key value violates unique constraint on ${this.table}`,
        },
        count: null,
      }
    }
  }

  const client = {
    from: (table: string) => new Builder(table),
    async rpc(name: string, args: any) {
      calls.push({ table: name, op: 'rpc', filters: [], patch: args })
      const n = bump(`rpc:${name}`)
      const rule = checkRule({ rpc: name }, n)
      if (rule?.kind === 'throw') throw new Error('forced throw')
      if (rule)
        return { data: null, error: { message: 'forced failure' }, count: null }
      const handler = rpcs.get(name)
      if (!handler)
        return {
          data: null,
          error: { code: 'PGRST202', message: 'function not found' },
          count: null,
        }
      const res = await handler(clone(args), tables)
      return { count: null, ...res }
    },
  }

  return {
    client,
    tables,
    calls,
    failOn(rule: Omit<FailRule, 'kind'>) {
      rules.push({ ...rule, kind: 'error' })
    },
    throwOn(rule: Omit<FailRule, 'kind'>) {
      rules.push({ ...rule, kind: 'throw' })
    },
    snapshot(opts: { exclude?: string[] } = {}): Tables {
      const out: Tables = {}
      for (const [k, v] of Object.entries(tables))
        if (!opts.exclude?.includes(k)) out[k] = clone(v)
      return out
    },
    async auditWriter(args: {
      adminUserId: string
      action: string
      entity: string
      entityId?: string | null
      diff?: Record<string, unknown>
    }): Promise<{ error: string | null }> {
      const res = await new Builder('admin_audit_log').insert({
        admin_user_id: args.adminUserId,
        action_type: args.action,
        entity_type: args.entity,
        entity_id: args.entityId ?? null,
        diff: args.diff ?? null,
      })
      return { error: res.error ? res.error.message : null }
    },
    auditRows(): Row[] {
      return [...tableRows('admin_audit_log')].sort((a, b) =>
        String(a.created_at).localeCompare(String(b.created_at))
      )
    },
    registerRpc(name: string, handler: RpcHandler) {
      rpcs.set(name, handler)
    },
  }
}
