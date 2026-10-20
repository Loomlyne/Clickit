/**
 * Email colour tokens, light and dark (Q7 = C, Koss 2026-10-20: emails follow the
 * reader's colour scheme: light by default, dark via @media (prefers-color-scheme: dark)).
 *
 * Literal hex only, NO imports and NO CSS variables: mail clients do not resolve
 * custom properties and do not blend rgba, so `#1d1d1d` is the solid of rgba(255,255,255,.08)
 * over #090909.
 *
 * Source: Koss's signed Phase 5 picture 05-q12-schemes (D-27 = Q12 C), every colour role it
 * shows. Phase 5 maps its templates to these names and defines no hex of its own; changes go
 * through this module and tests/unit/email-tokens.test.ts.
 */
export const EMAIL_TOKENS = {
  light: {
    page: '#F4F4F4',
    card: '#FFFFFF',
    header: '#090909',
    heading: '#111111',
    body: '#333333',
    hint: '#555555',
    codeBox: '#F6F6F6',
    codeBorder: '#E5E5E5',
    /** Code digits on the light code box (not drawn as a separate role in the picture; kept from the first pin). */
    code: '#090909',
    rule: '#E5E5E5',
    footer: '#767676',
  },
  dark: {
    page: '#090909',
    card: '#101010',
    cardBorder: '#222222',
    header: '#101010',
    headerRule: '#222222',
    heading: '#F4F4F4',
    body: '#CCCCCC',
    hint: '#A1A1A1',
    codeBox: '#191919',
    codeBorder: '#2A2A2A',
    code: '#ffcc00',
    footer: '#A1A1A1',
  },
  /** Same in both schemes. */
  button: {
    bg: '#ffcc00',
    ink: '#090909',
    radius: '999px',
  },
} as const
