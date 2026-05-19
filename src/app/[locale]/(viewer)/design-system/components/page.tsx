'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function ComponentsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          {'Buttons'}
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Primary actions feel bright and decisive. Secondary actions recede
          into the dark shell. Ghost usage stays limited to local row actions
          and low-risk controls.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <Button variant="default">{'Watch now'}</Button>
          <Button variant="outline">{'Watch catalog'}</Button>
          <Button variant="secondary">{'Secondary action'}</Button>
          <Button variant="ghost">{'Row action'}</Button>
          <Button variant="destructive">{'Delete'}</Button>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{'Form controls'}</CardTitle>
            <CardDescription>
              Inputs use the same rounded geometry and translucent borders as
              panels and dialogs.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder={'Search shows, genres, or creators'} />
            <Input value="viewer@clickit.app" readOnly />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{'Status badges'}</CardTitle>
            <CardDescription>
              Status colors are softened into tinted pills so dense admin tables
              stay readable.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Badge className="rounded-[12px] border-emerald-400/25 bg-emerald-500/14 px-2.5 py-1 text-[11px] text-emerald-200">
              {'Now Streaming'}
            </Badge>
            <Badge className="rounded-[12px] border-amber-400/25 bg-amber-500/14 px-2.5 py-1 text-[11px] text-amber-100">
              {'Coming Soon'}
            </Badge>
            <Badge className="text-muted-foreground rounded-[12px] border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px]">
              Draft
            </Badge>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <p className="text-muted-foreground text-xs tracking-[0.24em] uppercase">
            {'Empty state'}
          </p>
          <p className="text-foreground mt-4 text-2xl font-semibold tracking-tight">
            {'No saved shows yet'}
          </p>
          <p className="text-muted-foreground mt-3 max-w-sm text-sm leading-7">
            Empty states stay calm, centered, and action-oriented. They explain
            what is missing and offer one obvious next step.
          </p>
          <div className="mt-6">
            <Button variant="outline">{'Watch shows'}</Button>
          </div>
        </div>

        <div className="rounded-[12px] border border-red-500/20 bg-red-500/6 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.24)]">
          <p className="text-xs tracking-[0.24em] text-red-100/80 uppercase">
            {'Error state'}
          </p>
          <p className="mt-4 text-2xl font-semibold tracking-tight text-red-50">
            {'Playback failed'}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-7 text-red-100/75">
            Errors should stay compact and legible. Red is reserved for
            destructive actions and actual failures, not for general emphasis.
          </p>
        </div>
      </section>
    </div>
  )
}
