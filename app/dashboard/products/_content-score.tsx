'use client'

export type ContentScoreProps = {
  hasTitle: boolean
  descriptionWordCount: number
  seoTitle: string
  seoDescription: string
  tagCount: number
  imageCount: number
  allImagesHaveAltText: boolean
  variantCount: number
  hasPrice: boolean
}

type Check = { label: string; points: number; pass: boolean }

function buildChecks(p: ContentScoreProps): Check[] {
  const seoTitleLen = p.seoTitle.trim().length
  const seoDescLen = p.seoDescription.trim().length
  return [
    { label: 'Has title',                 points: 1, pass: p.hasTitle },
    { label: 'Description (150+ words)',  points: 2, pass: p.descriptionWordCount >= 150 },
    { label: 'SEO title (< 60 chars)',    points: 1, pass: seoTitleLen > 0 && seoTitleLen < 60 },
    { label: 'Meta description (120–155 chars)', points: 1, pass: seoDescLen >= 120 && seoDescLen <= 155 },
    { label: '3–5 tags selected',         points: 1, pass: p.tagCount >= 3 && p.tagCount <= 5 },
    { label: 'At least 1 image',          points: 1, pass: p.imageCount > 0 },
    { label: 'All images have alt text',  points: 1, pass: p.imageCount > 0 && p.allImagesHaveAltText },
    { label: 'At least 1 variant',        points: 1, pass: p.variantCount > 0 },
    { label: 'Has price',                 points: 1, pass: p.hasPrice },
  ]
}

export default function ContentScore(props: ContentScoreProps) {
  const checks = buildChecks(props)
  const score = checks.reduce((sum, c) => sum + (c.pass ? c.points : 0), 0)
  const max = checks.reduce((sum, c) => sum + c.points, 0)
  const pct = Math.round((score / max) * 100)

  const color =
    score >= 8 ? 'emerald' :
    score >= 5 ? 'amber' : 'rose'

  const barClass = {
    emerald: 'bg-emerald-500',
    amber:   'bg-amber-400',
    rose:    'bg-rose-500',
  }[color]

  const textClass = {
    emerald: 'text-emerald-700',
    amber:   'text-amber-700',
    rose:    'text-rose-700',
  }[color]

  const bgClass = {
    emerald: 'bg-emerald-50 border-emerald-200',
    amber:   'bg-amber-50 border-amber-200',
    rose:    'bg-rose-50 border-rose-200',
  }[color]

  const missing = checks.filter((c) => !c.pass)

  return (
    <section className={`border rounded-xl p-5 ${bgClass}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900">Content quality</h2>
        <span className={`text-lg font-bold tabular-nums ${textClass}`}>{score}/{max}</span>
      </div>

      <div className="w-full bg-white/60 rounded-full h-2 mb-3 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {missing.length > 0 && (
        <ul className="space-y-1">
          {missing.map((c) => (
            <li key={c.label} className="flex items-center gap-1.5 text-xs text-gray-600">
              <svg className="w-3.5 h-3.5 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              {c.label}
            </li>
          ))}
        </ul>
      )}

      {missing.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium">All quality checks passed.</p>
      )}
    </section>
  )
}
