#!/usr/bin/env node

/**
 * Migration guard for supabase/migrations (SAFE-02, decisions D-04 / D-05).
 *
 * Two deterministic rules, run by CI and by `npm run gate:local`:
 *
 *   D-04  A migration that is added or changed must not contain destructive
 *         SQL (drop, truncate, delete from, merge ... then delete) unless the
 *         SAME line carries a waiver comment with a reason:
 *
 *           drop policy if exists p on t; -- safe-drop: recreated below
 *
 *         Not waived: an empty reason, a waiver on another line, or text that
 *         only looks like a waiver inside a string literal.
 *
 *   D-05  A migration that already exists on the base branch is immutable:
 *         editing, renaming or deleting it fails, unless an exact
 *         path + from-blob + to-blob entry in PHASE1_NEUTRALISATION matches.
 *
 * Only files that are added or changed between base and head are scanned, and
 * only COMMITTED changes are compared (git diff base...head). Uncommitted
 * edits are not seen by a local run: commit first.
 *
 *   node scripts/migration-guard.mjs [--base <rev>] [--head <rev>] [--dir supabase/migrations]
 *   npm run guard:migrations
 *
 * Defaults: --base origin/main --head HEAD. Exit 0 clean, 1 on any violation,
 * 2 on usage or git error.
 *
 * This is a safety net for mistakes, not a security boundary: obfuscated SQL
 * (string concatenation that builds a keyword, format() tricks) is not
 * caught. The real gate for live DDL is the CLI dry-run plus approval.
 *
 * The file is deliberately self-contained (only node: imports) so CI can run
 * a lone copy of the BASE branch's version of it.
 */

/**
 * Destructive-SQL patterns, applied to comment-stripped text, case-insensitive.
 * Every `drop` is flagged except the four non-destructive column-attribute
 * forms; `delete` only as DML so `on delete cascade`, `for delete` policies and
 * `deleted_at` need no waiver; `truncate` always.
 */
export const PATTERNS = [
  ['drop', /\bdrop\b(?!\s+(?:not\s+null|default|identity|expression)\b)/gi],
  ['truncate', /\btruncate\b/gi],
  ['delete-from', /\bdelete\s+from\b/gi],
  ['then-delete', /\bthen\s+delete\b/gi],
]

/**
 * One-off allow-list for the five Phase 1 edits to already-applied migrations
 * (SAFE-01 neutralisation). An entry allows one in-place edit only when the
 * status is M, the base blob equals `from` and the head blob equals `to`.
 * Plan 03 of Phase 1 fills `to` after the final edit (null never matches).
 * After the Phase 1 PR merges, the base blob equals `to`, never `from`, so
 * the entry becomes inert and any later edit fails D-05 again.
 */
export const PHASE1_NEUTRALISATION = {
  'supabase/migrations/20260401000000_create_schema.sql': {
    from: '6155411336273554b90dc4ac784a011520815879',
    to: null,
  },
  'supabase/migrations/20260401000003_seed_data.sql': {
    from: '8d09bdfd3edea72a8a6a37a7016cab248fdae71d',
    to: null,
  },
  'supabase/migrations/20260425000001_seed_example_shorts.sql': {
    from: 'd3ce94e3fe5520f2341953f586cc17e3db734e3a',
    to: null,
  },
  'supabase/migrations/20260506115421_seed_fake_show_cast.sql': {
    from: '79cac51acb7b1b7caec86e76d54f5e0c77923f68',
    to: null,
  },
  'supabase/migrations/20260506120139_add_fake_cast_images.sql': {
    from: '37be8e857084ae1243570657ce46276edcd185b0',
    to: null,
  },
}

const WAIVER_RE = /^\s*safe-drop:\s*(\S.*)$/i

/**
 * Scan SQL text for destructive statements.
 *
 * Single pass over the text producing a blanked copy of the same length:
 * `--` and nested block comments become spaces (newlines kept). Single-quoted
 * strings (E'..' honours backslash escapes), double-quoted identifiers and
 * $tag$ dollar-quoted bodies stay in the text, so dynamic SQL such as
 * `execute 'drop table x'` and function bodies are scanned. Quotes only
 * decide where a comment marker is NOT a comment; a misread quote can add
 * findings but never hides one.
 */
export function scanSql(sql) {
  const text = String(sql)
  const n = text.length
  const out = text.split('')
  const newlines = []
  for (let k = 0; k < n; k += 1) if (text[k] === '\n') newlines.push(k)

  const lineOf = (offset) => {
    let lo = 0
    let hi = newlines.length
    while (lo < hi) {
      const mid = (lo + hi) >> 1
      if (newlines[mid] < offset) lo = mid + 1
      else hi = mid
    }
    return lo + 1
  }

  const waivers = new Map()
  const blank = (from, to) => {
    for (let k = from; k < to; k += 1) if (out[k] !== '\n') out[k] = ' '
  }
  const isWordChar = (ch) => ch !== undefined && /[A-Za-z0-9_$\u0080-￿]/.test(ch)

  let i = 0
  while (i < n) {
    const ch = text[i]
    const next = text[i + 1]

    if (ch === '-' && next === '-') {
      let end = text.indexOf('\n', i)
      if (end === -1) end = n
      const comment = text.slice(i + 2, end).replace(/\r$/, '')
      const match = WAIVER_RE.exec(comment)
      if (match) waivers.set(lineOf(i), match[1].trim())
      blank(i, end)
      i = end
      continue
    }

    if (ch === '/' && next === '*') {
      let depth = 1
      let k = i + 2
      while (k < n && depth > 0) {
        if (text[k] === '/' && text[k + 1] === '*') {
          depth += 1
          k += 2
        } else if (text[k] === '*' && text[k + 1] === '/') {
          depth -= 1
          k += 2
        } else {
          k += 1
        }
      }
      blank(i, k)
      i = k
      continue
    }

    if (ch === "'") {
      const prev = text[i - 1]
      const escapes =
        (prev === 'E' || prev === 'e') && !isWordChar(text[i - 2])
      let k = i + 1
      while (k < n) {
        if (escapes && text[k] === '\\') {
          k += 2
        } else if (text[k] === "'") {
          if (text[k + 1] === "'") k += 2
          else break
        } else {
          k += 1
        }
      }
      i = Math.min(k + 1, n)
      continue
    }

    if (ch === '"') {
      let k = i + 1
      while (k < n) {
        if (text[k] === '"') {
          if (text[k + 1] === '"') k += 2
          else break
        } else {
          k += 1
        }
      }
      i = Math.min(k + 1, n)
      continue
    }

    if (ch === '$' && !isWordChar(text[i - 1])) {
      // Dollar-quote tags are emitted as normal code: the body is scanned and
      // its comments are stripped, so a waiver works inside function bodies.
      const tag = /^\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/.exec(
        text.slice(i, i + 64),
      )
      if (tag) {
        i += tag[0].length
        continue
      }
    }

    i += 1
  }

  const blanked = out.join('')
  const lines = text.split('\n')
  const hits = []
  for (const [kind, re] of PATTERNS) {
    for (const match of blanked.matchAll(re)) {
      hits.push({ offset: match.index, kind })
    }
  }
  hits.sort((a, b) => a.offset - b.offset)

  const findings = []
  const waived = []
  for (const { offset, kind } of hits) {
    const line = lineOf(offset)
    if (waivers.has(line)) {
      waived.push({ line, kind, reason: waivers.get(line) })
    } else {
      findings.push({
        line,
        kind,
        text: (lines[line - 1] ?? '').replace(/\r$/, '').trim(),
      })
    }
  }
  return { findings, waived }
}

/**
 * Parse `git diff --name-status -z` output. Renames/copies (R100, C75) carry
 * two paths (old, new); every other status carries one.
 */
export function classifyChanges(nameStatusZ) {
  const tokens = String(nameStatusZ).split('\0')
  if (tokens.length && tokens[tokens.length - 1] === '') tokens.pop()
  const changes = []
  let i = 0
  while (i < tokens.length) {
    const status = tokens[i]
    if (status.startsWith('R') || status.startsWith('C')) {
      changes.push({ status, path: tokens[i + 2], oldPath: tokens[i + 1] })
      i += 3
    } else {
      changes.push({ status, path: tokens[i + 1] })
      i += 2
    }
  }
  return changes
}
