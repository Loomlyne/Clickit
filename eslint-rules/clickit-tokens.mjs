// Local ESLint plugin: Phase 4 design-token guard (DS-02).
// Flags raw hex, non-neutral rgb(), hsl()/oklch()-style colour functions,
// named colours in arbitrary values, bracket radius, bracket shadow and raw
// Tailwind palette classes in string literals and template strings.
// Waive only for data-driven values, with a disable-next-line comment that
// ends in " -- <reason>" (the report message shows the exact form). A waiver
// without a reason is itself reported.

const RULE_ID = 'clickit/no-raw-design-values'

// Class start; variants like hover: or data-[x]: end in ':'
const V = String.raw`(?:^|[\s"'\`:!])(?:[a-z0-9-]+:)*`

// Utilities that take a colour, including side and modifier prefixes
const COLOR_UTIL = String.raw`(?:bg|text|border(?:-[tblrxyse])?|ring(?:-offset)?|inset-ring|from|via|to|fill|stroke|shadow|inset-shadow|drop-shadow|outline|divide|decoration|accent|caret|placeholder)`

const PALETTE = String.raw`(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone|mauve|olive|mist|taupe)`

// CSS named colours (transparent, currentColor, inherit, white and black stay allowed)
const NAMED = String.raw`(?:aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|whitesmoke|yellow|yellowgreen)`

// rgb() separators: commas, spaces, or Tailwind's `_` inside arbitrary values
const SEP = String.raw`(?:\s*,\s*|[\s_]+)`

export const PATTERNS = {
  // #RGB, #RRGGBB, #RRGGBBAA only; prose like "Item #123" and fragment links are filtered in isProse/isLinkValue
  hex: /(?<![&\w#])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/,
  // neutral overlays rgba(0,0,0,..) / rgb(255 255 255 / ..) / rgb(0_0_0/..) pass; rgb(0 0 0.5) does not;
  // `rgba(${r}` never matches (needs a digit)
  rgb: new RegExp(
    String.raw`\brgba?\(\s*(?!0${SEP}0${SEP}0(?![.\d%])|255${SEP}255${SEP}255(?![.\d%]))\d`,
    'i',
  ),
  // hsl()/oklch()/lab()... with a literal channel; hsl(var(--x)) passes
  colorfn: /\b(?:hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-+.\d]/i,
  // a named colour inside a colour utility's arbitrary value: bg-[red], border-t-[color:navy]
  named: new RegExp(
    V +
      COLOR_UTIL +
      String.raw`-\[[^\]\s]*?(?<![\w./#-])${NAMED}(?![\w.(-])[^\]\s]*\]`,
    'i',
  ),
  radius: new RegExp(
    V +
      String.raw`rounded(?:-(?:s|e|t|r|b|l|ss|se|ee|es|tl|tr|br|bl))?-\[(?!var\()`,
  ),
  shadow: new RegExp(
    V + String.raw`(?:shadow|drop-shadow|inset-shadow)-\[(?!var\()`,
  ),
  palette: new RegExp(
    V + COLOR_UTIL + '-' + PALETTE + String.raw`-\d{2,3}(?![\w-])`,
  ),
}

const HINTS = {
  hex: 'var(--token), a theme colour class, or a brand/status class',
  rgb: 'a token (rgb(var(--ink-*-rgb) / a), --scrim-*), bg-background/NN, or white/NN black/NN',
  colorfn: 'var(--token) or a theme colour class',
  named: 'a theme colour class (bg-primary, text-foreground, status-*, brand-*)',
  radius:
    'rounded-chip|control|shell|field|card|media|panel|hairline or the standard scale',
  shadow:
    'shadow-soft|panel|popover|modal|bar|inset-hairline|live-dot|cta-glow, drop-shadow-splash',
  palette: 'bg-primary, bg-destructive, bg-live-dot, brand-* or status-* classes',
}

// Words that put a digits-only hex in CSS context ("1px solid #333", "0 2px 4px #000")
const CSS_WORDS = /(?:\b(?:solid|dashed|dotted|double|groove|ridge|inset|outset|color|background|border|fill|stroke)|\d(?:px|em|rem|%))\s$/i

// "Item #123", "Order #555", "tag #bad": a 3-char or digits-only hex right after a word and a space.
// Waivers: the rule reports a next-line waiver without a reason; a block or same-line
// disable would hide that report, so tests/unit/design-no-legacy.test.ts scans every form.
function isProse(s, m) {
  const body = m[0].slice(1)
  if (body.length !== 3 && !/^\d+$/.test(body)) return false
  const before = s.slice(0, m.index)
  return /[A-Za-z]\s$/.test(before) && !CSS_WORDS.test(before)
}

const LINK_ATTRS = new Set(['href', 'to', 'id', 'htmlFor', 'aria-controls', 'aria-describedby', 'aria-labelledby'])

// href="#add", { href: '#face' }: a fragment link, not a colour
function isLinkValue(node, s) {
  if (!/^#[\w-]*$/.test(s)) return false
  const p = node.parent
  if (!p) return false
  if (p.type === 'JSXAttribute') return LINK_ATTRS.has(p.name?.name)
  if (p.type === 'Property' && p.value === node) {
    const k = p.key?.name ?? p.key?.value
    return LINK_ATTRS.has(k)
  }
  return false
}

export const rule = {
  meta: {
    type: 'problem',
    schema: [],
    docs: {
      description:
        'Disallow raw hex/rgb/hsl colours, named colours in arbitrary values, bracket radius or shadow values and raw Tailwind palette classes; use the design tokens.',
    },
    messages: {
      raw: 'Raw {{kind}} value "{{text}}". Use {{hint}}. Waive only for data-driven values: eslint-disable-next-line clickit/no-raw-design-values -- <reason>',
      noReason:
        'A clickit/no-raw-design-values waiver needs a reason: eslint-disable-next-line clickit/no-raw-design-values -- <reason>',
    },
  },
  create(context) {
    const check = (node, s) => {
      for (const [kind, re] of Object.entries(PATTERNS)) {
        const m = re.exec(s)
        if (!m) continue
        if (kind === 'hex' && (isLinkValue(node, s) || isProse(s, m))) continue
        context.report({
          node,
          messageId: 'raw',
          data: { kind, text: m[0].trim(), hint: HINTS[kind] },
        })
      }
    }
    return {
      Program() {
        const comments = context.sourceCode?.getAllComments?.() ?? []
        for (const c of comments) {
          const text = c.value.trim()
          if (!/^eslint-disable/.test(text) || !text.includes(RULE_ID)) continue
          const reason = text.split(/\s--\s/)[1]
          if (!reason || reason.trim().length < 3) {
            context.report({ loc: c.loc, messageId: 'noReason' })
          }
        }
      },
      Literal(n) {
        if (typeof n.value === 'string') check(n, n.value)
      },
      TemplateElement(n) {
        check(n, n.value.cooked ?? n.value.raw)
      },
    }
  },
}

export default { rules: { 'no-raw-design-values': rule } }
