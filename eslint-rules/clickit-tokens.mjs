// Local ESLint plugin: Phase 4 design-token guard (DS-02).
// Flags raw hex, non-neutral rgb(), bracket radius, bracket shadow and raw
// Tailwind palette classes in string literals and template strings.
// Waive only for data-driven values, with a disable-next-line comment that
// ends in " -- <reason>" (the report message shows the exact form).

// Class start; variants like hover: or data-[x]: end in ':'
const V = String.raw`(?:^|[\s"'\`:!])(?:[a-z0-9-]+:)*`

export const PATTERNS = {
  hex: /(?<![&\w])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/,
  // neutral overlays rgba(0,0,0,..) / rgba(255,255,255,..) pass; `rgba(${r}` never matches (needs a digit)
  rgb: /\brgba?\(\s*(?!0\s*[, ]\s*0\s*[, ]\s*0\b|255\s*[, ]\s*255\s*[, ]\s*255\b)\d/i,
  radius: new RegExp(
    V +
      String.raw`rounded(?:-(?:s|e|t|r|b|l|ss|se|ee|es|tl|tr|br|bl))?-\[(?!var\()`,
  ),
  shadow: new RegExp(
    V + String.raw`(?:shadow|drop-shadow|inset-shadow)-\[(?!var\()`,
  ),
  palette: new RegExp(
    V +
      String.raw`(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|outline|divide|decoration|accent|caret)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|slate|gray|zinc|neutral|stone)-\d{2,3}(?![\w-])`,
  ),
}

const HINTS = {
  hex: 'var(--token), a theme colour class, or a brand/status class',
  rgb: 'a token (rgb(var(--ink-*-rgb) / a), --scrim-*), bg-background/NN, or white/NN black/NN',
  radius:
    'rounded-chip|control|shell|field|card|media|panel|hairline or the standard scale',
  shadow:
    'shadow-soft|panel|popover|modal|bar|inset-hairline|live-dot|cta-glow, drop-shadow-splash',
  palette: 'bg-primary, bg-destructive, bg-live-dot, brand-* or status-* classes',
}

export const rule = {
  meta: {
    type: 'problem',
    schema: [],
    docs: {
      description:
        'Disallow raw hex/rgb colours, bracket radius or shadow values and raw Tailwind palette classes; use the design tokens.',
    },
    messages: {
      raw: 'Raw {{kind}} value "{{text}}". Use {{hint}}. Waive only for data-driven values: eslint-disable-next-line clickit/no-raw-design-values -- <reason>',
    },
  },
  create(context) {
    const check = (node, s) => {
      for (const [kind, re] of Object.entries(PATTERNS)) {
        const m = re.exec(s)
        if (m) {
          context.report({
            node,
            messageId: 'raw',
            data: { kind, text: m[0].trim(), hint: HINTS[kind] },
          })
        }
      }
    }
    return {
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
