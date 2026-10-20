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
 *         only looks like a waiver inside a string literal. A string, quoted
 *         identifier, block comment or dollar quote left open at the end of
 *         the file also fails (the scan cannot be trusted past it).
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
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { posix } from 'node:path'
import process from 'node:process'

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
    to: 'c87bf539d731d8a42bd7058fb2725273bbb356f3',
  },
  'supabase/migrations/20260401000003_seed_data.sql': {
    from: '8d09bdfd3edea72a8a6a37a7016cab248fdae71d',
    to: 'e6f0cd77d26e56c720059fd02e43412d7c292bc3',
  },
  'supabase/migrations/20260425000001_seed_example_shorts.sql': {
    from: 'd3ce94e3fe5520f2341953f586cc17e3db734e3a',
    to: '0fcbc891c664fcc1fed44a866e6b48cfe0a5b7f4',
  },
  'supabase/migrations/20260506115421_seed_fake_show_cast.sql': {
    from: '79cac51acb7b1b7caec86e76d54f5e0c77923f68',
    to: '01af38c04c45402dfa7a191ae35f83af3e2b3245',
  },
  'supabase/migrations/20260506120139_add_fake_cast_images.sql': {
    from: '37be8e857084ae1243570657ce46276edcd185b0',
    to: '8477b0d4ec5502ca0b454a473e828a260ba5b025',
  },
}

const WAIVER_RE = /^\s*safe-drop:\s*(\S.*)$/i

/**
 * Scan SQL text for destructive statements.
 *
 * Produces a blanked copy of the text with the same length: `--` and nested
 * block comments become spaces (newlines kept). Single-quoted strings (E'..'
 * honours backslash escapes), double-quoted identifiers and $tag$ dollar-quoted
 * bodies stay in the text, so dynamic SQL such as `execute 'drop table x'` and
 * function bodies are scanned.
 *
 * Each $tag$ body is its own region: it ends at the first matching closing
 * tag (as in Postgres), is scanned with fresh quote state (so comments inside
 * plpgsql bodies are still stripped and waivers there still work), and every
 * string, identifier and comment inside it is clamped to the body. A stray
 * `'` or `"` inside a body (`$$it's$$`) therefore cannot change how the code
 * after the closing tag is read.
 *
 * Fail closed: a string, quoted identifier, block comment or dollar quote
 * still open at the end of the FILE is returned in `unterminated` and the
 * guard treats it as a violation. Inside a body an open quote simply runs to
 * the closing tag, which is valid text (`comment on t is $$it's$$`).
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

  const unterminated = []
  // Anything left open at the end of a region: fatal at file level, harmless
  // inside a dollar body (the body is text up to its closing tag).
  const open = (kind, at, topLevel) => {
    if (topLevel) unterminated.push({ line: lineOf(at), kind })
  }

  /** Scan text[start, end) with fresh quote state. */
  const scanRegion = (start, end, topLevel) => {
    let i = start
    while (i < end) {
      const ch = text[i]
      const next = i + 1 < end ? text[i + 1] : undefined

      if (ch === '-' && next === '-') {
        let stop = text.indexOf('\n', i)
        if (stop === -1 || stop > end) stop = end
        const comment = text.slice(i + 2, stop).replace(/\r$/, '')
        const match = WAIVER_RE.exec(comment)
        if (match) waivers.set(lineOf(i), match[1].trim())
        blank(i, stop)
        i = stop
        continue
      }

      if (ch === '/' && next === '*') {
        let depth = 1
        let k = i + 2
        while (k < end && depth > 0) {
          if (text[k] === '/' && k + 1 < end && text[k + 1] === '*') {
            depth += 1
            k += 2
          } else if (text[k] === '*' && k + 1 < end && text[k + 1] === '/') {
            depth -= 1
            k += 2
          } else {
            k += 1
          }
        }
        if (depth > 0) open('unterminated block comment', i, topLevel)
        blank(i, Math.min(k, end))
        i = Math.min(k, end)
        continue
      }

      if (ch === "'") {
        const prev = text[i - 1]
        const escapes =
          (prev === 'E' || prev === 'e') && !isWordChar(text[i - 2])
        let k = i + 1
        let closed = false
        while (k < end) {
          if (escapes && text[k] === '\\') {
            k += 2
          } else if (text[k] === "'") {
            if (k + 1 < end && text[k + 1] === "'") k += 2
            else {
              closed = true
              break
            }
          } else {
            k += 1
          }
        }
        if (!closed) open('unterminated string', i, topLevel)
        i = Math.min(k + 1, end)
        continue
      }

      if (ch === '"') {
        let k = i + 1
        let closed = false
        while (k < end) {
          if (text[k] === '"') {
            if (k + 1 < end && text[k + 1] === '"') k += 2
            else {
              closed = true
              break
            }
          } else {
            k += 1
          }
        }
        if (!closed) open('unterminated quoted identifier', i, topLevel)
        i = Math.min(k + 1, end)
        continue
      }

      if (ch === '$' && !isWordChar(text[i - 1])) {
        const tag = /^\$(?:[A-Za-z_\u0080-￿][A-Za-z0-9_\u0080-￿]*)?\$/.exec(
          text.slice(i, Math.min(i + 64, end)),
        )
        if (tag) {
          // The body ends at the first matching closing tag inside this region
          // and is scanned as its own region, so its quotes cannot leak out.
          const bodyStart = i + tag[0].length
          const close = text.indexOf(tag[0], bodyStart)
          if (close === -1 || close + tag[0].length > end) {
            open(`unterminated dollar quote ${tag[0]}`, i, topLevel)
            scanRegion(bodyStart, end, false)
            i = end
          } else {
            scanRegion(bodyStart, close, false)
            i = close + tag[0].length
          }
          continue
        }
      }

      i += 1
    }
  }

  scanRegion(0, n, true)

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
  return { findings, waived, unterminated }
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

const NAME_RE = /^\d{14}_[a-z0-9_]+\.sql$/
const VERSION_RE = /^(\d{14})_/

/** Error for bad arguments or a failing git command (CLI exit code 2). */
export class GuardError extends Error {}

function runGit(cwd, args) {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    const detail = String(error?.stderr || error?.message || error).trim()
    throw new GuardError(`git ${args[0]} failed: ${detail.split('\n')[0]}`)
  }
}

function existsOn(cwd, rev, path) {
  try {
    execFileSync('git', ['cat-file', '-e', `${rev}:${path}`], {
      cwd,
      stdio: ['ignore', 'ignore', 'ignore'],
    })
    return true
  } catch {
    return false
  }
}

function blobSha(cwd, rev, path) {
  return runGit(cwd, ['rev-parse', `${rev}:${path}`]).trim()
}

function describeStatus(status) {
  if (status === 'M') return 'modified'
  if (status === 'D') return 'deleted'
  if (status.startsWith('R')) return 'renamed'
  return `changed (${status})`
}

/**
 * Check the migrations changed between base and head (committed changes only).
 * Rules in order: name (A), applied-file immutability (everything but A),
 * destructive SQL (A and M .sql), ordering warning (A).
 */
export function runGuard({
  cwd,
  base,
  head,
  dir = 'supabase/migrations',
  allowList = PHASE1_NEUTRALISATION,
}) {
  for (const rev of [base, head]) {
    if (!rev || rev.startsWith('-')) throw new GuardError(`invalid revision: ${rev}`)
  }
  const violations = []
  const warnings = []

  const diff = runGit(cwd, [
    'diff',
    '--name-status',
    '-z',
    '--find-renames',
    `${base}...${head}`,
    '--',
    dir,
  ])
  const changes = classifyChanges(diff)

  const baseVersions = runGit(cwd, ['ls-tree', '--name-only', base, `${dir}/`])
    .split('\n')
    .map((line) => VERSION_RE.exec(posix.basename(line))?.[1])
    .filter(Boolean)
  const highestBase = baseVersions.sort().pop()

  for (const change of changes) {
    // A copy creates a new file; treat it like an addition.
    const added = change.status === 'A' || change.status.startsWith('C')
    const name = posix.basename(change.path)

    if (added && !NAME_RE.test(name)) {
      violations.push({
        path: change.path,
        reason: 'bad migration file name (need 14-digit version, snake_case, .sql)',
      })
      continue
    }

    if (!added) {
      const oldPath = change.oldPath ?? change.path
      if (existsOn(cwd, base, oldPath)) {
        const entry = allowList?.[change.path]
        const allowed =
          change.status === 'M' &&
          entry &&
          entry.to &&
          blobSha(cwd, base, change.path) === entry.from &&
          blobSha(cwd, head, change.path) === entry.to
        if (!allowed) {
          violations.push({
            path: change.path,
            reason: `applied migration ${describeStatus(change.status)} (D-05): migrations on the base branch are immutable`,
          })
          continue
        }
      }
    }

    const scannable =
      (added || change.status === 'M') && change.path.endsWith('.sql')
    if (scannable) {
      const sql = runGit(cwd, ['show', `${head}:${change.path}`])
      const scan = scanSql(sql)
      for (const open of scan.unterminated) {
        violations.push({
          path: change.path,
          line: open.line,
          reason: `${open.kind} still open at end of file: the guard cannot tell code from text after it; close it`,
        })
      }
      for (const finding of scan.findings) {
        violations.push({
          path: change.path,
          line: finding.line,
          reason: `${finding.kind} without \`-- safe-drop: <reason>\` (D-04): ${finding.text}`,
        })
      }
    }

    if (added) {
      const version = VERSION_RE.exec(name)?.[1]
      if (version && highestBase && version <= highestBase) {
        warnings.push({
          path: change.path,
          reason:
            'version sorts before applied migrations; the apply workflow will refuse it',
        })
      }
    }
  }

  return { violations, warnings, checked: changes.length }
}

function parseArgs(argv) {
  const opts = { base: 'origin/main', head: 'HEAD', dir: 'supabase/migrations' }
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    if (flag === '--base' || flag === '--head' || flag === '--dir') {
      const value = argv[i + 1]
      if (!value) throw new GuardError(`${flag} needs a value`)
      opts[flag.slice(2)] = value
      i += 1
    } else {
      throw new GuardError(
        `unknown argument: ${flag}\nusage: migration-guard.mjs [--base <rev>] [--head <rev>] [--dir <path>]`,
      )
    }
  }
  return opts
}

function main() {
  const ci = process.env.GITHUB_ACTIONS === 'true'
  try {
    const opts = parseArgs(process.argv.slice(2))
    const { violations, warnings, checked } = runGuard({ cwd: process.cwd(), ...opts })
    for (const v of violations) {
      console.log(`${v.path}${v.line ? `:${v.line}` : ''}: ${v.reason}`)
      if (ci) {
        const where = v.line ? `file=${v.path},line=${v.line}` : `file=${v.path}`
        console.log(`::error ${where}::${v.reason}`)
      }
    }
    for (const w of warnings) {
      console.log(`warning: ${w.path}: ${w.reason}`)
      if (ci) console.log(`::warning file=${w.path}::${w.reason}`)
    }
    console.log(
      `migration-guard: ${checked} files checked, ${violations.length} violations, ${warnings.length} warnings`,
    )
    process.exit(violations.length ? 1 : 0)
  } catch (error) {
    if (error instanceof GuardError) {
      console.error(`migration-guard: ${error.message}`)
      process.exit(2)
    }
    throw error
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
}
