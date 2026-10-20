/**
 * Email colour tokens, light and dark (Q7 = C, Koss 2026-10-20: emails follow the
 * reader's colour scheme: light by default, dark via @media (prefers-color-scheme: dark)).
 *
 * Literal hex only, NO imports and NO CSS variables: mail clients do not resolve
 * var() and do not blend rgba, so `#1d1d1d` is the solid of rgba(255,255,255,.08)
 * over #090909.
 *
 * Source: Phase 5 picture
 * origin/claude/phase-05-accounts-and-email-61ece8:.planning/phases/05-accounts-and-email/mockups/05-mockups.html
 * (.m-light / .m-dark). Phase 5 may refine these when it signs its picture; changes go
 * through this module and tests/unit/email-tokens.test.ts.
 */
export const EMAIL_TOKENS = {
  light: {
    header: '#090909',
    headerText: '#F4F4F4',
    body: '#ffffff',
    heading: '#111111',
    text: '#333333',
    codeBg: '#f6f6f6',
    codeBorder: '#e5e5e5',
    codeText: '#090909',
    footerText: '#767676',
    divider: '#eeeeee',
  },
  dark: {
    page: '#090909',
    body: '#090909',
    header: '#090909',
    heading: '#F4F4F4',
    text: '#CCCCCC',
    headerDivider: '#1d1d1d',
    codeBg: '#191919',
    codeBorder: '#2A2A2A',
    codeText: '#ffcc00',
    footerText: '#A1A1A1',
    divider: '#1d1d1d',
  },
  /** Same in both schemes. */
  button: {
    bg: '#ffcc00',
    ink: '#090909',
    radius: '999px',
  },
} as const
