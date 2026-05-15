'use client'

import { useState, useRef, useEffect } from 'react'

type Props = {
  presets: string[]
  selected: string[]
  onChange: (tags: string[]) => void
}

export default function TagPicker({ presets, selected, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (presets.length === 0) {
    return (
      <p className="text-sm text-gray-400 py-1">
        No tag presets configured.{' '}
        <a href="/dashboard/settings" className="underline hover:text-gray-600 transition-colors">
          Add them in Settings.
        </a>
      </p>
    )
  }

  const filtered = presets.filter((t) =>
    t.toLowerCase().includes(query.toLowerCase())
  )

  function toggle(tag: string) {
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag]
    )
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected pills */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-gray-900 text-white text-xs rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggle(tag)}
                aria-label={`Remove ${tag}`}
                className="ml-0.5 text-gray-400 hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown trigger */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-left bg-white hover:border-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
      >
        <span className={selected.length > 0 ? 'text-gray-600' : 'text-gray-400'}>
          {selected.length > 0
            ? `${selected.length} tag${selected.length === 1 ? '' : 's'} selected`
            : 'Select tags…'}
        </span>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform duration-150 shrink-0 ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-10 overflow-hidden">
          <div className="p-2 border-b border-gray-100">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setQuery('') }
              }}
              placeholder="Search tags…"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              className="w-full px-2 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
            />
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-gray-400">No tags match.</li>
            ) : (
              filtered.map((tag) => (
                <li key={tag}>
                  <label className="flex items-center gap-2.5 px-3 py-2 hover:bg-gray-50 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selected.includes(tag)}
                      onChange={() => toggle(tag)}
                      className="w-3.5 h-3.5 rounded border-gray-300 accent-gray-900 cursor-pointer"
                    />
                    <span className="text-sm text-gray-800">{tag}</span>
                  </label>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
