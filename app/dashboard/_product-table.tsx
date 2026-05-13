'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { deleteProducts } from '@/app/actions/products'
import { exportSelectedProductsCsv } from '@/app/actions/export'
import DeleteButton from './_delete-button'

export type DashboardProduct = {
  id: string
  title: string
  status: string
  price: number
  thumbUrl: string | null
  variantCount: number
  created_at: string
}

function relativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60_000)
  const diffHr = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHr / 24)

  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  if (diffHr < 24) return `${diffHr} hour${diffHr !== 1 ? 's' : ''} ago`
  if (diffDay === 1) return 'yesterday'
  if (diffDay < 30) return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProductTable({ products }: { products: DashboardProduct[] }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isDeleting, startDeleteTransition] = useTransition()
  const [isExporting, setIsExporting] = useState(false)

  const allSelected = products.length > 0 && selectedIds.size === products.length
  const indeterminate = selectedIds.size > 0 && !allSelected

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(products.map((p) => p.id)))
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleExportSelected() {
    setIsExporting(true)
    try {
      const csv = await exportSelectedProductsCsv([...selectedIds])
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `products-selected-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setSelectedIds(new Set())
    } catch {
      alert('Export failed. Please try again.')
    } finally {
      setIsExporting(false)
    }
  }

  function handleDeleteSelected() {
    const count = selectedIds.size
    if (!confirm(`Delete ${count} product${count !== 1 ? 's' : ''}? This cannot be undone.`)) return
    startDeleteTransition(async () => {
      await deleteProducts([...selectedIds])
      setSelectedIds(new Set())
    })
  }

  if (products.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl px-6 py-16 text-center">
        <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 21V9" />
          </svg>
        </div>
        <h3 className="text-sm font-medium text-gray-900 mb-1">No products yet</h3>
        <p className="text-sm text-gray-500 mb-5">Get started by adding your first product.</p>
        <Link
          href="/dashboard/products/new"
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors duration-150"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add first product
        </Link>
      </div>
    )
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="py-3 px-4 w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = indeterminate }}
                  onChange={toggleAll}
                  aria-label="Select all"
                  className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-gray-900"
                />
              </th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4 w-16" />
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Product</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Status</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4">Price</th>
              <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider py-3 px-4 hidden sm:table-cell">Variants</th>
              <th className="py-3 px-4 w-28" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {products.map((p) => {
              const selected = selectedIds.has(p.id)
              return (
                <tr
                  key={p.id}
                  className={`transition-colors duration-100 group ${
                    selected ? 'bg-gray-100 hover:bg-gray-100' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="py-3 px-4">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleOne(p.id)}
                      aria-label={`Select ${p.title}`}
                      className="w-4 h-4 rounded border-gray-300 cursor-pointer accent-gray-900"
                    />
                  </td>
                  <td className="py-3 px-4">
                    {p.thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.thumbUrl}
                        alt={p.title}
                        width={40}
                        height={40}
                        className="w-10 h-10 object-cover rounded-lg border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                        <svg className="w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="m21 15-5-5L5 21" />
                        </svg>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/dashboard/products/${p.id}/edit`}
                      className="text-sm font-medium text-gray-900 hover:text-gray-600 transition-colors duration-150"
                    >
                      {p.title}
                    </Link>
                    <p className="text-xs text-gray-400 mt-0.5" suppressHydrationWarning>
                      Added {relativeTime(p.created_at)}
                    </p>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      p.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-700">
                    {Number(p.price).toFixed(2)}
                  </td>
                  <td className="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">
                    {p.variantCount > 0
                      ? `${p.variantCount} variant${p.variantCount !== 1 ? 's' : ''}`
                      : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        href={`/dashboard/products/${p.id}/edit`}
                        className="text-xs font-medium text-gray-600 border border-gray-200 px-2.5 py-1 rounded-md hover:bg-gray-50 hover:text-gray-900 transition-colors duration-150"
                      >
                        Edit
                      </Link>
                      <DeleteButton productId={p.id} />
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Floating action bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 bg-gray-900 text-white px-3 py-2.5 rounded-2xl shadow-2xl ring-1 ring-white/10 whitespace-nowrap">
          <span className="text-sm font-medium px-1.5 tabular-nums">
            {selectedIds.size} selected
          </span>

          <div className="w-px h-4 bg-white/20 mx-1 shrink-0" />

          <button
            onClick={handleExportSelected}
            disabled={isExporting || isDeleting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isExporting ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            {isExporting ? 'Exporting…' : 'Export CSV'}
          </button>

          <div className="w-px h-4 bg-white/20 mx-1 shrink-0" />

          <button
            onClick={handleDeleteSelected}
            disabled={isDeleting || isExporting}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-rose-400 hover:text-rose-300 hover:bg-white/10 rounded-lg transition-colors duration-150 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isDeleting ? (
              <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
              </svg>
            )}
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>

          <button
            onClick={() => setSelectedIds(new Set())}
            aria-label="Clear selection"
            className="ml-1 p-1.5 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-lg transition-colors duration-150 cursor-pointer"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </>
  )
}
