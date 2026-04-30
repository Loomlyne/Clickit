---
status: complete
phase: 13-route-restructure-auth-safety
source:
  - 13-01-SUMMARY.md
  - 13-02-SUMMARY.md
  - 13-03a-SUMMARY.md
  - 13-03b-SUMMARY.md
  - 13-04-SUMMARY.md
  - 13-05-SUMMARY.md
  - 13-06-SUMMARY.md
started: 2026-04-24T00:00:00Z
updated: 2026-04-24T00:10:00Z
test_url: https://clickitstory.com
---

## Current Test

[testing complete]

## Tests

### 1. Root URL redirects to /en/
expected: Visit clickitstory.com/ — URL redirects to /en/ and landing page renders (no 404, no loop)
result: pass

### 2. Arabic locale loads
expected: Visit clickitstory.com/ar/ — same landing page renders with /ar/ in the URL bar (shows load, no 404)
result: pass

### 3. Client navigation preserves locale
expected: From /ar/ landing page, click any show card or footer link — destination URL starts with /ar/... (not /en/ or bare path)
result: pass

### 4. Auth guard is locale-aware
expected: While logged OUT, visit clickitstory.com/ar/my-list — redirected to /ar/auth (not bare /auth or /en/auth)
result: pass

### 5. Session cookie survives root redirect
expected: While logged IN, visit clickitstory.com/ — redirected to /en/ AND still logged in (avatar visible, not kicked to sign-in)
result: pass

### 6. Sign-in from Arabic locale lands on /ar/
expected: While logged OUT, sign in via clickitstory.com/ar/auth — after sign-in, landing URL starts with /ar/ (not /en/ or bare path)
result: pass

### 7. Language switcher changes URL
expected: Visit /en/profile → switch to Arabic → page navigates to /ar/profile; switching back returns to /en/profile
result: pass

### 8. Sitemap hreflang alternates
expected: Visit clickitstory.com/sitemap.xml — XML contains hreflang="en" AND hreflang="ar" alternate links for at least one URL
result: pass

## Summary

total: 8
passed: 8
issues: 0
skipped: 0
blocked: 0
pending: 0

## Gaps

[none]
