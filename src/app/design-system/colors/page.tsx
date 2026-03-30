const brandColors = [
  { className: 'bg-brand-blue', name: 'Innovative Blue', hex: '#2C3569' },
  { className: 'bg-brand-purple', name: 'Royal Purple', hex: '#9F54A0' },
  { className: 'bg-brand-green', name: 'Oasis Green', hex: '#50A258' },
  { className: 'bg-brand-red', name: 'Crimson Red', hex: '#DB3F34' },
  { className: 'bg-brand-orange', name: 'Sunset Orange', hex: '#EA8C2E' },
  {
    className: 'bg-brand-yellow',
    name: 'Desert Sand & Yellow',
    hex: '#F8C623',
  },
]

const safeTints = [
  {
    className: 'text-brand-blue-safe',
    name: 'Blue (text-safe)',
    hex: '#7C82A2',
    contrast: '5.24:1',
  },
  {
    className: 'text-brand-purple-safe',
    name: 'Purple (text-safe)',
    hex: '#AC6CAD',
    contrast: '5.18:1',
  },
  {
    className: 'text-brand-green-safe',
    name: 'Green (text-safe)',
    hex: '#50A258',
    contrast: '6.25:1',
  },
  {
    className: 'text-brand-red-safe',
    name: 'Red (text-safe)',
    hex: '#DF544A',
    contrast: '5.18:1',
  },
  {
    className: 'text-brand-orange-safe',
    name: 'Orange (text-safe)',
    hex: '#EA8C2E',
    contrast: '7.80:1',
  },
  {
    className: 'text-brand-yellow-safe',
    name: 'Yellow (text-safe)',
    hex: '#F8C623',
    contrast: '12.31:1',
  },
]

export default function ColorsPage() {
  return (
    <div className="space-y-12">
      {/* Section A: Brand Colors (Original) */}
      <section>
        <h2 className="text-xl font-bold text-foreground">
          Brand Colors &mdash; Original
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Decorative use only. Background fills on buttons, badges, ribbons,
          progress bars. Never as text on dark backgrounds.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {brandColors.map((color) => (
            <div key={color.hex}>
              <div className={`${color.className} h-24 rounded-lg`} />
              <p className="mt-2 text-sm font-medium text-foreground">
                {color.name}
              </p>
              <p className="font-mono text-xs text-text-muted">{color.hex}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section B: WCAG AA-Safe Tints */}
      <section>
        <h2 className="text-xl font-bold text-foreground">
          Brand Colors &mdash; WCAG AA-Safe Tints
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Text-safe variants passing 4.5:1 contrast on all dark surfaces
          (#000000 through #1A1A22).
        </p>
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {safeTints.map((tint) => (
            <div key={tint.hex} className="rounded-lg bg-surface-2 p-6">
              <p className={`${tint.className} text-sm font-medium`}>
                {tint.name}
              </p>
              <p className="mt-1 font-mono text-xs text-text-muted">
                {tint.hex}
              </p>
              <p className="font-mono text-xs text-text-muted">
                {tint.contrast} on #0A0A0F
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Section C: Dark Theme Surfaces */}
      <section>
        <h2 className="text-xl font-bold text-foreground">
          Dark Theme Surfaces
        </h2>
        <div className="mt-4 rounded-lg border border-border bg-background p-6">
          <p className="font-mono text-sm text-text-secondary">
            Background #0A0A0F
          </p>
          <div className="mt-4 rounded-lg border border-border bg-surface-1 p-6">
            <p className="font-mono text-sm text-text-secondary">
              Surface-1 #111116
            </p>
            <div className="mt-4 rounded-lg border border-border bg-surface-2 p-6">
              <p className="font-mono text-sm text-text-secondary">
                Surface-2 #1A1A22
              </p>
              <div className="mt-4 rounded-lg border border-border bg-surface-3 p-6">
                <p className="font-mono text-sm text-text-secondary">
                  Surface-3 #242430
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section D: Text Colors */}
      <section>
        <h2 className="text-xl font-bold text-foreground">Text Hierarchy</h2>
        <div className="mt-4 space-y-4 rounded-lg border border-border bg-background p-6">
          <div>
            <p className="text-lg text-text-primary">Primary Text</p>
            <p className="font-mono text-xs text-text-muted">
              text-primary #FFFFFF &mdash; 19.75:1
            </p>
          </div>
          <div>
            <p className="text-lg text-text-secondary">Secondary Text</p>
            <p className="font-mono text-xs text-text-muted">
              text-secondary #A1A1B5 &mdash; 7.09:1
            </p>
          </div>
          <div>
            <p className="text-lg text-text-muted">
              Muted Text (large text only)
            </p>
            <p className="font-mono text-xs text-text-muted">
              text-muted #6B6B80 &mdash; 3.52:1
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
