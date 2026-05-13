'use client'

import { useActionState, startTransition, useState, useRef } from 'react'
import { createProduct, type ProductFormState } from '@/app/actions/products'
import { createClient } from '@/lib/supabase/client'

type Preview = { objectUrl: string; file: File }

type VariantRow = {
  id: string
  option1_value: string
  option2_value: string
  price: string
  sku: string
  inventory_qty: string
}

function toTitleCase(s: string): string {
  return s.trim().replace(/\b\w/g, (c) => c.toUpperCase())
}

function emptyVariant(): VariantRow {
  return {
    id: crypto.randomUUID(),
    option1_value: '', option2_value: '',
    price: '', sku: '', inventory_qty: '',
  }
}

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function NewProductForm() {
  const [state, dispatch, pending] = useActionState<ProductFormState, FormData>(
    createProduct,
    undefined
  )
  const [previews, setPreviews] = useState<Preview[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Shared option names — defined once, applied to all variant rows
  const [option1Name, setOption1Name] = useState('')
  const [hasOption2, setHasOption2] = useState(false)
  const [option2Name, setOption2Name] = useState('')
  const [variants, setVariants] = useState<VariantRow[]>([])

  function handleHasOption2Change(checked: boolean) {
    setHasOption2(checked)
    if (!checked) {
      setVariants((prev) => prev.map((v) => ({ ...v, option2_value: '' })))
    }
  }

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()])
  }

  function removeVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id))
  }

  function updateVariant(id: string, field: keyof Omit<VariantRow, 'id'>, value: string) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
  }

  function addFiles(files: File[]) {
    const valid = files.filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
    if (valid.length === 0) return
    setPreviews((prev) => [...prev, ...valid.map((file) => ({ file, objectUrl: URL.createObjectURL(file) }))])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function removePreview(index: number) {
    URL.revokeObjectURL(previews[index].objectUrl)
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)

    const formData = new FormData(e.currentTarget)

    // Re-inject shared option names into every variant row before serialising.
    // The server action and Shopify CSV export both expect option1_name per row.
    const enriched = variants.map((v) => ({
      ...v,
      option1_name: option1Name.trim() || null,
      option2_name: hasOption2 ? (option2Name.trim() || null) : null,
      option2_value: hasOption2 ? v.option2_value : '',
    }))
    formData.set('variants_json', JSON.stringify(enriched))

    if (previews.length > 0) {
      setUploading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setUploadError('Not signed in.')
        setUploading(false)
        return
      }

      for (const { file } of previews) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { data, error } = await supabase.storage.from('product-images').upload(path, file)
        if (error) {
          setUploadError(`Upload failed for "${file.name}": ${error.message}`)
          setUploading(false)
          return
        }
        formData.append('image_path', data.path)
      }
      setUploading(false)
    }

    startTransition(() => { dispatch(formData) })
  }

  const busy = uploading || pending
  const buttonLabel = uploading ? 'Uploading images…' : pending ? 'Saving…' : 'Save product'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Product Details */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Product details</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className={labelClass}>Title <span className="text-rose-500">*</span></label>
            <input id="title" name="title" type="text" required placeholder="e.g. Silk Evening Blouse" className={inputClass} />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea
              id="description"
              name="description"
              rows={4}
              placeholder="Describe your product…"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="product_type" className={labelClass}>Product type</label>
              <input id="product_type" name="product_type" type="text" placeholder="e.g. Tops" className={inputClass} />
            </div>
            <div>
              <label htmlFor="vendor" className={labelClass}>Vendor</label>
              <input id="vendor" name="vendor" type="text" placeholder="e.g. Mona Moda" className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="tags" className={labelClass}>Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
            <input id="tags" name="tags" type="text" placeholder="e.g. silk, evening, summer" className={inputClass} />
          </div>

          <div>
            <label htmlFor="status" className={labelClass}>Status</label>
            <select id="status" name="status" defaultValue="draft" className={inputClass}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Pricing</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="price" className={labelClass}>Price</label>
            <input id="price" name="price" type="number" min="0" step="0.01" defaultValue="0" className={inputClass} />
          </div>
          <div>
            <label htmlFor="compare_at_price" className={labelClass}>Compare at price</label>
            <input id="compare_at_price" name="compare_at_price" type="number" min="0" step="0.01" placeholder="—" className={inputClass} />
          </div>
        </div>
      </section>

      {/* Images */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Images</h2>

        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors duration-150 cursor-pointer ${
            isDragging ? 'border-gray-400 bg-gray-50' : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
          }`}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-5-5L5 21" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-700 font-medium">Click to upload or drag and drop</p>
              <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, WebP</p>
            </div>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileChange} className="sr-only" />

        {previews.length > 0 && (
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-3 mt-4">
            {previews.map(({ objectUrl, file }, i) => (
              <div key={objectUrl} className="relative group aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={objectUrl} alt={file.name} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePreview(i) }}
                  aria-label={`Remove ${file.name}`}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-lg flex items-center justify-center cursor-pointer"
                >
                  <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Variants */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Variants</h2>

        {/* Option names — defined once, shared across all rows */}
        <div className="space-y-3 pb-5 mb-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="w-32 shrink-0 text-sm text-gray-600">Option 1 name</span>
            <input
              type="text"
              value={option1Name}
              onChange={(e) => setOption1Name(e.target.value)}
              placeholder="e.g. Size"
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white w-48"
            />
          </div>

          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={hasOption2}
              onChange={(e) => handleHasOption2Change(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 accent-gray-900 cursor-pointer"
            />
            <span className="text-sm text-gray-600">Add second option</span>
          </label>

          {hasOption2 && (
            <div className="flex items-center gap-3">
              <span className="w-32 shrink-0 text-sm text-gray-600">Option 2 name</span>
              <input
                type="text"
                value={option2Name}
                onChange={(e) => setOption2Name(e.target.value)}
                placeholder="e.g. Color"
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white w-48"
              />
            </div>
          )}
        </div>

        {/* Variant rows */}
        {variants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2 mb-4">
            No variants yet.
          </p>
        ) : (
          <div className="space-y-3 mb-4">
            {variants.map((v, i) => (
              <VariantCard
                key={v.id}
                variant={v}
                index={i}
                option1Name={option1Name}
                hasOption2={hasOption2}
                option2Name={option2Name}
                onUpdate={updateVariant}
                onRemove={() => removeVariant(v.id)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addVariant}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add variant
        </button>
      </section>

      {/* Errors & Submit */}
      {uploadError && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3">{uploadError}</p>
      )}
      {state?.error && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3">{state.error}</p>
      )}

      <div className="flex justify-end pb-8">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy && (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          )}
          {buttonLabel}
        </button>
      </div>
    </form>
  )
}

function VariantCard({
  variant: v,
  index,
  option1Name,
  hasOption2,
  option2Name,
  onUpdate,
  onRemove,
}: {
  variant: VariantRow
  index: number
  option1Name: string
  hasOption2: boolean
  option2Name: string
  onUpdate: (id: string, field: keyof Omit<VariantRow, 'id'>, value: string) => void
  onRemove: () => void
}) {
  const ic = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'
  const lc = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Variant {index + 1}</span>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove variant"
          className="text-gray-400 hover:text-rose-500 transition-colors duration-150 cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Option values — labels come from the shared option names above */}
      <div className={`grid gap-3 mb-3 ${hasOption2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label className={lc}>{option1Name || 'Option 1'}</label>
          <input
            type="text"
            placeholder="e.g. Small"
            value={v.option1_value}
            onChange={(e) => onUpdate(v.id, 'option1_value', e.target.value)}
            onBlur={(e) => onUpdate(v.id, 'option1_value', toTitleCase(e.target.value))}
            className={ic}
          />
        </div>
        {hasOption2 && (
          <div>
            <label className={lc}>{option2Name || 'Option 2'}</label>
            <input
              type="text"
              placeholder="e.g. Red"
              value={v.option2_value}
              onChange={(e) => onUpdate(v.id, 'option2_value', e.target.value)}
              onBlur={(e) => onUpdate(v.id, 'option2_value', toTitleCase(e.target.value))}
              className={ic}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={lc}>Price</label>
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={v.price}
            onChange={(e) => onUpdate(v.id, 'price', e.target.value)}
            className={ic}
          />
        </div>
        <div>
          <label className={lc}>SKU</label>
          <input
            type="text"
            placeholder="SKU-001"
            value={v.sku}
            onChange={(e) => onUpdate(v.id, 'sku', e.target.value)}
            className={ic}
          />
        </div>
        <div>
          <label className={lc}>Inventory</label>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={v.inventory_qty}
            onChange={(e) => onUpdate(v.id, 'inventory_qty', e.target.value)}
            className={ic}
          />
        </div>
      </div>
    </div>
  )
}
