const uiColors = [
  {
    className: 'bg-background',
    name: 'Canvas',
    hex: '#05070C',
    note: 'Global page background',
  },
  {
    className: 'bg-card',
    name: 'Surface',
    hex: '#121621',
    note: 'Default elevated panel',
  },
  {
    className: 'bg-secondary',
    name: 'Subtle Surface',
    hex: '#1A2130',
    note: 'Nested cards and controls',
  },
  {
    className: 'bg-primary',
    name: 'Primary Accent',
    hex: '#C7D2FE',
    note: 'Focused actions and active states',
  },
]

const textColors = [
  {
    className: 'text-foreground',
    name: 'Primary Text',
    hex: '#F5F7FB',
    contrast: 'Passes body copy contrast',
  },
  {
    className: 'text-muted-foreground',
    name: 'Secondary Text',
    hex: '#9EA7BB',
    contrast: 'Used for metadata and helper copy',
  },
]

const showColors = [
  { className: 'bg-brand-blue', name: 'Blue Show Accent', hex: '#2C3569' },
  { className: 'bg-brand-purple', name: 'Purple Show Accent', hex: '#9F54A0' },
  { className: 'bg-brand-green', name: 'Green Show Accent', hex: '#50A258' },
  { className: 'bg-brand-red', name: 'Red Show Accent', hex: '#DB3F34' },
  { className: 'bg-brand-orange', name: 'Orange Show Accent', hex: '#EA8C2E' },
  { className: 'bg-brand-yellow', name: 'Yellow Show Accent', hex: '#F8C623' },
]

export default function ColorsPage() {
  return (
    <div className="space-y-8">
      <section className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Core UI colors
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          The product shell stays near-black, with restrained indigo emphasis
          and minimal surface separation. This is the palette used for chrome,
          forms, dialogs, cards, and admin density.
        </p>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {uiColors.map((color) => (
            <div
              key={color.hex}
              className="rounded-[12px] border border-white/10 bg-black/20 p-4"
            >
              <div
                className={`${color.className} h-28 rounded-[12px] border border-white/10`}
              />
              <p className="text-foreground mt-4 text-sm font-medium">
                {color.name}
              </p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {color.hex}
              </p>
              <p className="text-muted-foreground mt-3 text-xs leading-6">
                {color.note}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
          <h2 className="text-foreground text-2xl font-semibold tracking-tight">
            Text hierarchy
          </h2>
          <div className="mt-6 space-y-4">
            {textColors.map((color) => (
              <div
                key={color.hex}
                className="rounded-[12px] border border-white/10 bg-black/20 p-5"
              >
                <p className={`${color.className} text-lg`}>{color.name}</p>
                <p className="text-muted-foreground mt-2 font-mono text-xs">
                  {color.hex}
                </p>
                <p className="text-muted-foreground mt-3 text-sm">
                  {color.contrast}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
          <h2 className="text-foreground text-2xl font-semibold tracking-tight">
            Surface stack
          </h2>
          <div className="bg-background mt-6 rounded-[12px] border border-white/10 p-5">
            <div className="bg-card rounded-[12px] border border-white/10 p-5">
              <div className="bg-secondary rounded-[12px] border border-white/10 p-5">
                <p className="text-muted-foreground font-mono text-xs">
                  {'Nested elevation stays subtle.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Content-only show accents
        </h2>
        <p className="text-muted-foreground mt-2 max-w-2xl text-sm">
          Legacy multi-color brand hues remain available for posters, hero
          artwork, and show identity. They should not become general UI chrome.
        </p>
        <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          {showColors.map((color) => (
            <div
              key={color.hex}
              className="rounded-[12px] border border-white/10 bg-black/20 p-4"
            >
              <div className={`${color.className} h-24 rounded-full`} />
              <p className="text-foreground mt-4 text-sm font-medium">
                {color.name}
              </p>
              <p className="text-muted-foreground mt-1 font-mono text-xs">
                {color.hex}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[12px] border border-white/10 bg-white/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.24)] md:p-8">
        <h2 className="text-foreground text-2xl font-semibold tracking-tight">
          Usage rules
        </h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[12px] border border-white/10 bg-black/20 p-5">
            <p className="text-foreground text-sm font-medium">Do</p>
            <p className="text-muted-foreground mt-2 text-sm leading-7">
              Use the indigo accent for primary calls to action, focus rings,
              and selected states. Keep borders thin and translucent.
            </p>
          </div>
          <div className="rounded-[12px] border border-white/10 bg-black/20 p-5">
            <p className="text-foreground text-sm font-medium">Avoid</p>
            <p className="text-muted-foreground mt-2 text-sm leading-7">
              Avoid turning every component into a branded gradient. The shell
              stays quiet so artwork and titles carry the emotion.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
