'use client'

import { useActionState, startTransition, useState, useRef } from 'react'
import { updateProduct, type ProductFormState } from '@/app/actions/products'
import { createClient } from '@/lib/supabase/client'

type ExistingImage = { id: string; image_url: string; publicUrl: string }

type VariantRow = {
  id: string
  dbId?: string
  option1_name: string; option1_value: string
  option2_name: string; option2_value: string
  price: string; sku: string; inventory_qty: string
}

type InitialData = {
  title: string
  description: string | null
  product_type: string | null
  vendor: string | null
  tags: string[] | null
  status: string
  price: number
  compare_at_price: number | null
}

type Preview = { objectUrl: string; file: File }

function emptyVariant(): VariantRow {
  return {
    id: crypto.randomUUID(),
    option1_name: '', option1_value: '',
    option2_name: '', option2_value: '',
    price: '', sku: '', inventory_qty: '',
  }
}

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'
const labelClass = 'block text-sm font-medium text-gray-700 mb-1.5'

export default function EditProductForm({
  productId,
  initialData,
  initialImages,
  initialVariants,
}: {
  productId: string
  initialData: InitialData
  initialImages: ExistingImage[]
  initialVariants: VariantRow[]
}) {
  const updateProductWithId = updateProduct.bind(null, productId)
  const [state, dispatch, pending] = useActionState<ProductFormState, FormData>(
    updateProductWithId,
    undefined
  )

  const [existingImages, setExistingImages] = useState<ExistingImage[]>(initialImages)
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const [previews, setPreviews] = useState<Preview[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [variants, setVariants] = useState<VariantRow[]>(initialVariants)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function removeExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((img) => img.id !== id))
    setRemovedImageIds((prev) => [...prev, id])
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

  function addVariant() {
    setVariants((prev) => [...prev, emptyVariant()])
  }

  function removeVariant(id: string) {
    setVariants((prev) => prev.filter((v) => v.id !== id))
  }

  function updateVariant(id: string, field: keyof Omit<VariantRow, 'id' | 'dbId'>, value: string) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('variants_json', JSON.stringify(variants))
    formData.set('removed_image_ids', JSON.stringify(removedImageIds))

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
  const buttonLabel = uploading ? 'Uploading images…' : pending ? 'Saving…' : 'Save changes'

  const showImageZone = existingImages.length === 0 && previews.length === 0

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Product Details */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Product details</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className={labelClass}>Title <span className="text-rose-500">*</span></label>
            <input id="title" name="title" type="text" required defaultValue={initialData.title} className={inputClass} />
          </div>

          <div>
            <label htmlFor="description" className={labelClass}>Description</label>
            <textarea
              id="description"
              name="description"
              rows={4}
              defaultValue={initialData.description ?? ''}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="product_type" className={labelClass}>Product type</label>
              <input id="product_type" name="product_type" type="text" defaultValue={initialData.product_type ?? ''} className={inputClass} />
            </div>
            <div>
              <label htmlFor="vendor" className={labelClass}>Vendor</label>
              <input id="vendor" name="vendor" type="text" defaultValue={initialData.vendor ?? ''} className={inputClass} />
            </div>
          </div>

          <div>
            <label htmlFor="tags" className={labelClass}>Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
            <input id="tags" name="tags" type="text" defaultValue={(initialData.tags ?? []).join(', ')} className={inputClass} />
          </div>

          <div>
            <label htmlFor="status" className={labelClass}>Status</label>
            <select id="status" name="status" defaultValue={initialData.status} className={inputClass}>
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
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input id="price" name="price" type="number" min="0" step="0.01" defaultValue={initialData.price} className={`${inputClass} pl-7`} />
            </div>
          </div>
          <div>
            <label htmlFor="compare_at_price" className={labelClass}>Compare at price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">$</span>
              <input id="compare_at_price" name="compare_at_price" type="number" min="0" step="0.01" defaultValue={initialData.compare_at_price ?? ''} placeholder="—" className={`${inputClass} pl-7`} />
            </div>
          </div>
        </div>
      </section>

      {/* Images */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Images</h2>

        {/* Existing images */}
        {existingImages.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Current images</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {existingImages.map((img) => (
                <div key={img.id} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.publicUrl}
                    alt=""
                    className="w-full h-full object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(img.id)}
                    aria-label="Remove image"
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-150 rounded-lg flex items-center justify-center cursor-pointer"
                  >
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* New images previews */}
        {previews.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">New images</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {previews.map(({ objectUrl, file }, i) => (
                <div key={objectUrl} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={objectUrl}
                    alt={file.name}
                    className="w-full h-full object-cover rounded-lg border-2 border-dashed border-gray-300"
                  />
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
          </div>
        )}

        {/* Drop zone — always shown if no images at all, otherwise a compact add button */}
        {showImageZone ? (
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
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-150 cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add images
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          className="sr-only"
        />
      </section>

      {/* Variants */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-semibold text-gray-900">Variants</h2>
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
        </div>

        {variants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">
            No variants — this product has a single option.
          </p>
        ) : (
          <div className="space-y-3">
            {variants.map((v, i) => (
              <EditVariantCard
                key={v.id}
                variant={v}
                index={i}
                onUpdate={updateVariant}
                onRemove={() => removeVariant(v.id)}
              />
            ))}
          </div>
        )}
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

function EditVariantCard({
  variant: v,
  index,
  onUpdate,
  onRemove,
}: {
  variant: VariantRow
  index: number
  onUpdate: (id: string, field: keyof Omit<VariantRow, 'id' | 'dbId'>, value: string) => void
  onRemove: () => void
}) {
  const inputClass =
    'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'
  const miniLabelClass = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Variant {index + 1}
          {v.dbId && <span className="ml-2 font-normal text-gray-300 normal-case tracking-normal">saved</span>}
        </span>
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

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
        {(
          [
            ['option1_name',  'Option 1 name',  'e.g. Size'],
            ['option1_value', 'Option 1 value', 'e.g. Small'],
            ['option2_name',  'Option 2 name',  'e.g. Color'],
            ['option2_value', 'Option 2 value', 'e.g. Red'],
          ] as const
        ).map(([field, lbl, placeholder]) => (
          <div key={field}>
            <label className={miniLabelClass}>{lbl}</label>
            <input
              type="text"
              placeholder={placeholder}
              value={v[field]}
              onChange={(e) => onUpdate(v.id, field, e.target.value)}
              className={inputClass}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={miniLabelClass}>Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">$</span>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={v.price}
              onChange={(e) => onUpdate(v.id, 'price', e.target.value)}
              className={`${inputClass} pl-6`}
            />
          </div>
        </div>
        <div>
          <label className={miniLabelClass}>SKU</label>
          <input
            type="text"
            placeholder="SKU-001"
            value={v.sku}
            onChange={(e) => onUpdate(v.id, 'sku', e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={miniLabelClass}>Inventory</label>
          <input
            type="number"
            min="0"
            step="1"
            placeholder="0"
            value={v.inventory_qty}
            onChange={(e) => onUpdate(v.id, 'inventory_qty', e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
    </div>
  )
}
