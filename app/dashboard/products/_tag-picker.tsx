'use client'

import { useState } from 'react'

type Props = {
  presets: string[]
  selected: string[]
  onChange: (tags: string[]) => void
}

export default function TagPicker({ presets, selected, onChange }: Props) {
  const [customInput, setCustomInput] = useState('')

  function toggle(tag: string) {
    onChange(
      selected.includes(tag)
        ? selected.filter((t) => t !== tag)
        : [...selected, tag]
    )
  }

  function addCustom() {
    const tag = customInput.trim()
    if (!tag) return
    if (!selected.includes(tag)) onChange([...selected, tag])
    setCustomInput('')
  }

  // Tags the user added manually (not from the preset list)
  const customTags = selected.filter((t) => !presets.includes(t))

  const ic =
    'flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'

  return (
    <div className="space-y-2.5">
      {/* Preset toggle pills */}
      {presets.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {presets.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => toggle(tag)}
              className={`px-2.5 py-1 rounded-full text-sm font-medium transition-colors duration-100 cursor-pointer ${
                selected.includes(tag)
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* Custom tags (not from presets) */}
      {customTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-800 text-sm rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => toggle(tag)}
                aria-label={`Remove ${tag}`}
                className="ml-0.5 text-gray-400 hover:text-gray-700 cursor-pointer"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Custom tag input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }}
          placeholder={presets.length > 0 ? 'Add custom tag…' : 'e.g. silk, evening, summer'}
          className={ic}
        />
        <button
          type="button"
          onClick={addCustom}
          disabled={!customInput.trim()}
          className="px-3 py-2.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
        >
          Add
        </button>
      </div>
    </div>
  )
}
