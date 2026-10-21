// Email constants that client code may import (Phase 5, plan 05-11). No imports at all,
// so a client component (05-28's contact form) can read them without pulling src/emails/*
// into a browser bundle.

/** Support reply promise in hours (G25 = A, signed 2026-10-20 ~19:45 CET). */
export const SUPPORT_REPLY_HOURS = 48
