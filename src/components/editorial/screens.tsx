'use client'

import Link from 'next/link'
import { useState } from 'react'
import { EditorialHeader } from './primitives/header'
import { EditorialFooter } from './primitives/footer'
import { EditorialRail } from './primitives/rail'
import { EditorialPoster } from './primitives/poster'
import { Icon } from './primitives/icons'
import type { EditorialShow } from '@/lib/editorial/adapter'

// ---------- Search ----------
export function EditorialSearch({
  allShows,
  initialQuery = '',
}: {
  allShows: EditorialShow[]
  initialQuery?: string
}) {
  const [q, setQ] = useState(initialQuery)
  const results = q
    ? allShows.filter(
        (s) =>
          s.title.toLowerCase().includes(q.toLowerCase()) ||
          s.genre.toLowerCase().includes(q.toLowerCase()) ||
          s.synopsis.toLowerCase().includes(q.toLowerCase()),
      )
    : allShows

  return (
    <div className="page-enter">
      <EditorialHeader />
      <section className="search-page" style={{ padding: '120px 40px 80px' }}>
        <div className="mono" style={{ marginBottom: 8 }}>Search</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 32px' }}>
          Find your next watch.
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '18px 22px',
            border: '1px solid var(--line-2)',
            borderRadius: 4,
            background: 'var(--bg-1)',
            marginBottom: 40,
          }}
        >
          <Icon.Search size={18} />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Show title, genre, or keyword"
            autoFocus
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text)',
              fontFamily: 'var(--font-ui)',
              fontSize: 17,
            }}
          />
          {q && (
            <button type="button" onClick={() => setQ('')} aria-label="Clear" style={{ color: 'var(--text-dim)' }}>
              <Icon.Close />
            </button>
          )}
        </div>
        <div className="mono" style={{ marginBottom: 20, color: 'var(--text-dim)' }}>
          {results.length} {results.length === 1 ? 'result' : 'results'}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
          {results.map((s) => (
            <EditorialPoster key={s.id} show={s} />
          ))}
        </div>
      </section>
      <EditorialFooter />
    </div>
  )
}

// ---------- My List ----------
export function EditorialMyList({
  shows,
  myList,
  onToggleList,
}: {
  shows: EditorialShow[]
  myList: string[]
  onToggleList?: (id: string) => void
}) {
  const listed = shows.filter((s) => myList.includes(s.id))
  return (
    <div className="page-enter">
      <EditorialHeader />
      <section style={{ padding: '120px 40px 40px' }}>
        <div className="mono" style={{ marginBottom: 8 }}>Your saved shows</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 40px' }}>
          My list.
        </h1>
        {listed.length === 0 ? (
          <div style={{ color: 'var(--text-dim)', maxWidth: 420 }}>
            Nothing saved yet. Browse the catalog and tap the plus button on any show to save it here.
            <div style={{ marginTop: 20 }}>
              <Link href="/browse" className="btn btn-primary">Browse catalog</Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 24 }}>
            {listed.map((s) => (
              <EditorialPoster key={s.id} show={s} inList onToggleList={onToggleList} />
            ))}
          </div>
        )}
      </section>
      <EditorialFooter />
    </div>
  )
}

// ---------- Profile ----------
export function EditorialProfile({
  email,
  displayName,
  onSignOut,
}: {
  email?: string
  displayName?: string
  onSignOut?: () => void
}) {
  return (
    <div className="page-enter">
      <EditorialHeader />
      <section style={{ padding: '120px 40px 80px', maxWidth: 720, margin: '0 auto' }}>
        <div className="mono" style={{ marginBottom: 8 }}>Account</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 56, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 40px' }}>
          Profile.
        </h1>
        <div style={{ display: 'grid', gap: 24 }}>
          <div>
            <div className="label">Display name</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 24 }}>{displayName ?? 'You'}</div>
          </div>
          {email && (
            <div>
              <div className="label">Email</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{email}</div>
            </div>
          )}
          <div style={{ paddingTop: 24, borderTop: '1px solid var(--line)' }}>
            {onSignOut ? (
              <button type="button" className="btn btn-outline" onClick={onSignOut}>
                Sign out
              </button>
            ) : (
              <Link href="/auth" className="btn btn-outline">Manage sign in</Link>
            )}
          </div>
        </div>
      </section>
      <EditorialFooter />
    </div>
  )
}

// ---------- Coming Soon ----------
export function EditorialComingSoon({
  comingSoon,
  myList,
  onToggleList,
}: {
  comingSoon: EditorialShow[]
  myList?: string[]
  onToggleList?: (id: string) => void
}) {
  return (
    <div className="page-enter">
      <EditorialHeader active="coming-soon" />
      <section style={{ padding: '120px 40px 40px' }}>
        <div className="mono" style={{ marginBottom: 8 }}>In production</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 32px' }}>
          Coming soon.
        </h1>
        <p style={{ color: 'var(--text-dim)', maxWidth: 560, marginBottom: 40, fontSize: 16 }}>
          The next wave of Clickit Story originals — save any to your list to get notified the moment they drop.
        </p>
      </section>
      {comingSoon.length > 0 ? (
        <EditorialRail
          title="Coming soon"
          eyebrow="Save for later"
          items={comingSoon}
          landscape
          myList={myList}
          onToggleList={onToggleList}
        />
      ) : (
        <div style={{ padding: '0 40px 80px', color: 'var(--text-dim)' }}>
          No upcoming shows announced yet. Check back next week.
        </div>
      )}
      <EditorialFooter />
    </div>
  )
}

// ---------- Support ----------
export function EditorialSupport() {
  const topics = [
    { h: 'Getting started', b: 'How to browse, pick an episode, and pick up where you left off.' },
    { h: 'Account & sign in', b: 'Email verification, password reset, profile management.' },
    { h: 'Playback & quality', b: 'Video quality, bilingual subtitles, captions, offline.' },
    { h: 'Devices', b: 'Which phones, tablets, TVs, and browsers are supported.' },
    { h: 'Content', b: 'Episode release schedule, seasons, and catalog updates.' },
    { h: 'Contact us', b: 'Reach the Clickit Story team directly.' },
  ]
  return (
    <div className="page-enter">
      <EditorialHeader active="support" />
      <section style={{ padding: '120px 40px 80px' }}>
        <div className="mono" style={{ marginBottom: 8 }}>Help center</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 64, fontWeight: 400, letterSpacing: '-0.02em', margin: '0 0 32px' }}>
          We&apos;re here to help.
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20, maxWidth: 1040 }}>
          {topics.map((t) => (
            <div
              key={t.h}
              style={{
                border: '1px solid var(--line)',
                padding: 24,
                borderRadius: 6,
                background: 'var(--bg-1)',
              }}
            >
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, margin: '0 0 10px' }}>
                {t.h}
              </h3>
              <p style={{ color: 'var(--text-dim)', fontSize: 14, margin: 0, lineHeight: 1.55 }}>{t.b}</p>
            </div>
          ))}
        </div>
      </section>
      <EditorialFooter />
    </div>
  )
}
