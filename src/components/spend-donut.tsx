import { useState } from 'react'
import type { Slice } from './spend-slices'

const SIZE = 220
const RADIUS = 88
const THICKNESS = 30
const GAP = 0.012 // a surface gap so neighbouring fills never touch

function arc(from: number, to: number): string {
  const r = RADIUS
  const inner = RADIUS - THICKNESS
  const point = (angle: number, radius: number) => {
    const a = angle * 2 * Math.PI - Math.PI / 2
    return [SIZE / 2 + radius * Math.cos(a), SIZE / 2 + radius * Math.sin(a)]
  }
  const large = to - from > 0.5 ? 1 : 0
  const [x1, y1] = point(from, r)
  const [x2, y2] = point(to, r)
  const [x3, y3] = point(to, inner)
  const [x4, y4] = point(from, inner)
  return [
    `M ${x1} ${y1}`,
    `A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ')
}

const EUR = new Intl.NumberFormat('nl-NL', {
  style: 'currency',
  currency: 'EUR',
})

export function SpendDonut({
  slices,
  total,
}: {
  slices: Slice[]
  total: number
}) {
  const [hovered, setHovered] = useState<string | null>(null)
  const shown = slices.find((s) => s.label === hovered)

  if (slices.length === 0) {
    return (
      <div className="text-muted-foreground flex h-[220px] items-center justify-center text-sm">
        No spending in this period.
      </div>
    )
  }

  return (
    <div className="relative w-fit">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={`Spending by category: ${slices
          .map((s) => `${s.label} ${Math.round(s.share * 100)}%`)
          .join(', ')}`}
      >
        {slices.map((slice) => {
          const dimmed = hovered !== null && hovered !== slice.label
          return (
            <path
              key={slice.label}
              d={arc(
                slice.start,
                Math.max(slice.end - GAP, slice.start + 0.001),
              )}
              fill={slice.colour}
              opacity={dimmed ? 0.35 : 1}
              onMouseEnter={() => {
                setHovered(slice.label)
              }}
              onMouseLeave={() => {
                setHovered(null)
              }}
            />
          )
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-muted-foreground text-xs">
          {shown ? shown.label : 'Total spent'}
        </span>
        <span className="text-xl font-semibold tabular-nums">
          {EUR.format(shown ? shown.total : total)}
        </span>
        {shown && (
          <span className="text-muted-foreground text-xs tabular-nums">
            {Math.round(shown.share * 100)}%
          </span>
        )}
      </div>
    </div>
  )
}
