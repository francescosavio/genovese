import { useState } from 'react'
import type { CumulativePoint } from '@/domain/summary'

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

const SHORT_MONTH = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  timeZone: 'UTC',
})

const FULL_DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

const asDate = (key: string) =>
  new Date(`${key.length === 7 ? `${key}-01` : key}T00:00:00Z`)

// Ticks are thinned to fit, but every point is still drawn. A month gets day
// numbers; anything longer gets the first of each month.
function axisLabel(key: string, index: number, count: number): string | null {
  if (key.length === 7) return SHORT_MONTH.format(asDate(key))
  if (count <= 31) {
    const day = index + 1
    return day === 1 || day % 5 === 0 ? String(day) : null
  }
  return key.endsWith('-01') ? SHORT_MONTH.format(asDate(key)) : null
}

export function SpendOverTime({ points }: { points: CumulativePoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null)
  // The running total only grows, so the last point is always the peak.
  const peak = points.at(-1)?.total ?? 0

  if (points.length === 0 || peak === 0) {
    return (
      <p className="text-muted-foreground py-12 text-center text-sm">
        No spending to plot in this period.
      </p>
    )
  }

  const x = (index: number) => ((index + 0.5) / points.length) * 100
  const y = (amount: number) => 100 - (amount / peak) * 100

  const line = points.map((p, i) => `${x(i)},${y(p.total)}`).join(' ')
  const shown = hovered === null ? null : points[hovered]

  // At 365 points a per-point hit target would be ~2px wide, so the nearest
  // point is found from the pointer position instead.
  function track(event: React.MouseEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - box.left) / box.width
    const index = Math.round(ratio * points.length - 0.5)
    setHovered(Math.min(points.length - 1, Math.max(0, index)))
  }

  return (
    <section aria-label="Spending over time" className="space-y-2">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground text-xs">
          {shown ? FULL_DATE.format(asDate(shown.key)) : 'Spent so far'}
        </span>
        <span className="tabular-nums">
          <span className="font-medium">
            {EUR.format(shown ? shown.total : peak)}
          </span>
          {shown && shown.spent > 0 && (
            <span className="text-muted-foreground ml-2 text-xs">
              +{EUR.format(shown.spent)} that day
            </span>
          )}
        </span>
      </div>

      <div
        className="border-border relative h-40 border-b"
        onMouseMove={track}
        onMouseLeave={() => {
          setHovered(null)
        }}
      >
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          role="img"
          aria-label={`Cumulative spending, ending at ${EUR.format(peak)}`}
        >
          <polyline
            points={line}
            fill="none"
            stroke="var(--chart-3)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            // Without this the stroke would stretch with the box and the
            // line would be thicker horizontally than vertically.
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {shown && hovered !== null && (
          <>
            <span
              className="bg-border pointer-events-none absolute top-0 bottom-0 w-px"
              style={{ left: `${x(hovered)}%` }}
            />
            <span
              className="bg-chart-1 ring-background pointer-events-none absolute size-2.5 rounded-full ring-2"
              style={{
                left: `${x(hovered)}%`,
                top: `${y(shown.total)}%`,
                transform: 'translate(-50%, -50%)',
              }}
            />
          </>
        )}
      </div>

      <div className="text-muted-foreground flex text-[11px]">
        {points.map((point, index) => (
          <span key={point.key} className="flex-1 text-center tabular-nums">
            {axisLabel(point.key, index, points.length)}
          </span>
        ))}
      </div>
    </section>
  )
}
