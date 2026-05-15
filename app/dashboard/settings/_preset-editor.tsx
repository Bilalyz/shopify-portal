'use client'

import { useState, useTransition, useRef } from 'react'
import { addArrayItem, removeArrayItem, type ArrayField } from '@/app/actions/settings'

type Props = {
  field: ArrayField
  initialItems: string[]
  label: string
  placeholder: string
}

export default function PresetEditor({ field, initialItems, label, placeholder }: Props) {
  const [items, setItems] = useState<string[]>(initialItems)
  const [inputValue, setInputValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  function handleAdd() {
    const value = inputValue.trim()
    if (!value) return
    if (items.includes(value)) {
      setError('Already in the list')
      return
    }

    setItems((prev) => [...prev, value])
    setInputValue('')
    setError(null)

    startTransition(async () => {
      const result = await addArrayItem(field, value)
      if (result.error) {
        setItems((prev) => prev.filter((v) => v !== value))
        setError(result.error)
      }
    })

    inputRef.current?.focus()
  }

  function handleRemove(item: string) {
    setItems((prev) => prev.filter((v) => v !== item))
    setError(null)

    startTransition(async () => {
      const result = await removeArrayItem(field, item)
      if (result.error) {
        setItems((prev) => [...prev, item])
        setError(result.error)
      }
    })
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAdd()
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-3">{label}</label>

      {/* Pills */}
      <div className="flex flex-wrap gap-2 mb-3 min-h-8">
        {items.length === 0 && (
          <span className="text-sm text-gray-400 italic">No items yet</span>
        )}
        {items.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-800 text-sm rounded-full"
          >
            {item}
            <button
              type="button"
              onClick={() => handleRemove(item)}
              disabled={isPending}
              className="ml-0.5 text-gray-400 hover:text-gray-700 transition-colors disabled:opacity-40 cursor-pointer"
              aria-label={`Remove ${item}`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
      </div>

      {/* Add input */}
      <div className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => { setInputValue(e.target.value); setError(null) }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isPending}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white disabled:opacity-60"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={isPending || !inputValue.trim()}
          className="px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          Add
        </button>
      </div>

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
