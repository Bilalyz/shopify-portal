'use client'

import { useActionState, startTransition, useState, useRef } from 'react'
import { updateProduct, type ProductFormState } from '@/app/actions/products'
import { analyzeImages, enrichProduct } from '@/app/actions/ai'
import { createClient } from '@/lib/supabase/client'
import TagPicker from '@/app/dashboard/products/_tag-picker'
import ContentScore from '@/app/dashboard/products/_content-score'

type ExistingImage = { id: string; image_url: string; alt_text: string; publicUrl: string }

type VariantRow = {
  id: string
  dbId?: string
  option1_value: string
  option2_value: string
  price: string
  sku: string
  inventory_qty: string
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

type OrgPresets = {
  tagPresets: string[]
  productTypes: string[]
  sizeOptions: string[]
  colorOptions: string[]
  language: string
  brandVoice: string
}

type Preview = { objectUrl: string; file: File }

type AiTask = 'description' | 'altText' | null

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

function getOptionListId(optionName: string, sizeOptions: string[], colorOptions: string[]): string | undefined {
  const lower = optionName.trim().toLowerCase()
  if (lower === 'size' && sizeOptions.length > 0) return 'size-options-list'
  if (lower === 'color' && colorOptions.length > 0) return 'color-options-list'
  return undefined
}

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'
const labelClass = 'block text-sm font-medium text-gray-700'
const smallInputClass =
  'flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white'

export default function EditProductForm({
  productId,
  initialData,
  initialImages,
  initialVariants,
  initialOption1Name,
  initialHasOption2,
  initialOption2Name,
  presets,
}: {
  productId: string
  initialData: InitialData
  initialImages: ExistingImage[]
  initialVariants: VariantRow[]
  initialOption1Name: string
  initialHasOption2: boolean
  initialOption2Name: string
  presets: OrgPresets
}) {
  const updateProductWithId = updateProduct.bind(null, productId)
  const [state, dispatch, pending] = useActionState<ProductFormState, FormData>(
    updateProductWithId,
    undefined
  )

  const [existingImages, setExistingImages] = useState<ExistingImage[]>(initialImages)
  const [existingAltTexts, setExistingAltTexts] = useState<Record<string, string>>(
    Object.fromEntries(initialImages.map((img) => [img.id, img.alt_text]))
  )
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])
  const [previews, setPreviews] = useState<Preview[]>([])
  const [previewAltTexts, setPreviewAltTexts] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [option1Name, setOption1Name] = useState(initialOption1Name)
  const [hasOption2, setHasOption2] = useState(initialHasOption2)
  const [option2Name, setOption2Name] = useState(initialOption2Name)
  const [variants, setVariants] = useState<VariantRow[]>(initialVariants)

  const [selectedTags, setSelectedTags] = useState<string[]>(initialData.tags ?? [])
  const [title, setTitle] = useState(initialData.title)
  const [productType, setProductType] = useState(initialData.product_type ?? '')
  const [description, setDescription] = useState(initialData.description ?? '')

  const [aiTask, setAiTask] = useState<AiTask>(null)
  const [aiError, setAiError] = useState<string | null>(null)

  const [hasPrice, setHasPrice] = useState(initialData.price > 0)

  async function generateDescription() {
    setAiTask('description')
    setAiError(null)
    try {
      const imageDescriptions = Object.values(existingAltTexts).filter(Boolean)
      const result = await enrichProduct({
        title,
        productType,
        imageDescriptions,
        tags: selectedTags,
        sizes: presets.sizeOptions,
        colors: presets.colorOptions,
        brandVoice: presets.brandVoice,
        language: presets.language,
      })
      setDescription(result.description)
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate description.')
    } finally {
      setAiTask(null)
    }
  }

  async function generateAltTexts() {
    if (existingImages.length === 0) return
    setAiTask('altText')
    setAiError(null)
    try {
      const urls = existingImages.map((img) => img.publicUrl)
      const altTexts = await analyzeImages(urls, { title, productType, language: presets.language })
      const newMap: Record<string, string> = {}
      existingImages.forEach((img, i) => { if (altTexts[i]) newMap[img.id] = altTexts[i] })
      setExistingAltTexts((prev) => ({ ...prev, ...newMap }))
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Failed to generate alt text.')
    } finally {
      setAiTask(null)
    }
  }

  function handleHasOption2Change(checked: boolean) {
    setHasOption2(checked)
    if (!checked) setVariants((prev) => prev.map((v) => ({ ...v, option2_value: '' })))
  }

  function addVariant() { setVariants((prev) => [...prev, emptyVariant()]) }
  function removeVariant(id: string) { setVariants((prev) => prev.filter((v) => v.id !== id)) }
  function updateVariant(id: string, field: keyof Omit<VariantRow, 'id' | 'dbId'>, value: string) {
    setVariants((prev) => prev.map((v) => (v.id === id ? { ...v, [field]: value } : v)))
  }

  function removeExistingImage(id: string) {
    setExistingImages((prev) => prev.filter((img) => img.id !== id))
    setExistingAltTexts((prev) => { const n = { ...prev }; delete n[id]; return n })
    setRemovedImageIds((prev) => [...prev, id])
  }

  function addFiles(files: File[]) {
    const valid = files.filter((f) => ['image/jpeg', 'image/png', 'image/webp'].includes(f.type))
    if (valid.length === 0) return
    setPreviews((prev) => [...prev, ...valid.map((file) => ({ file, objectUrl: URL.createObjectURL(file) }))])
    setPreviewAltTexts((prev) => [...prev, ...valid.map(() => '')])
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []))
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }

  function removePreview(index: number) {
    URL.revokeObjectURL(previews[index].objectUrl)
    setPreviews((prev) => prev.filter((_, i) => i !== index))
    setPreviewAltTexts((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)

    const formData = new FormData(e.currentTarget)
    formData.set('tags', selectedTags.join(', '))

    const enriched = variants.map((v) => ({
      ...v,
      option1_name: option1Name.trim() || null,
      option2_name: hasOption2 ? (option2Name.trim() || null) : null,
      option2_value: hasOption2 ? v.option2_value : '',
    }))
    formData.set('variants_json', JSON.stringify(enriched))
    formData.set('removed_image_ids', JSON.stringify(removedImageIds))
    formData.set('existing_image_alt_texts', JSON.stringify(existingAltTexts))

    if (previews.length > 0) {
      setUploading(true)
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setUploadError('Not signed in.'); setUploading(false); return }

      for (let i = 0; i < previews.length; i++) {
        const { file } = previews[i]
        const ext = file.name.split('.').pop() ?? 'jpg'
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`
        const { data, error } = await supabase.storage.from('product-images').upload(path, file)
        if (error) {
          setUploadError(`Upload failed for "${file.name}": ${error.message}`)
          setUploading(false)
          return
        }
        formData.append('image_path', data.path)
        formData.append('image_alt_text', previewAltTexts[i] ?? '')
      }
      setUploading(false)
    }

    startTransition(() => { dispatch(formData) })
  }

  const busy = uploading || pending
  const buttonLabel = uploading ? 'Uploading images…' : pending ? 'Saving…' : 'Save changes'
  const showImageZone = existingImages.length === 0 && previews.length === 0

  const descWords = description.trim().split(/\s+/).filter(Boolean).length
  const totalImages = existingImages.length + previews.length
  const allAltTexts = [...Object.values(existingAltTexts), ...previewAltTexts]
  const allImagesHaveAlt = totalImages > 0 && allAltTexts.every((t) => t.trim().length > 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Datalists for variant option values */}
      {presets.sizeOptions.length > 0 && (
        <datalist id="size-options-list">
          {presets.sizeOptions.map((s) => <option key={s} value={s} />)}
        </datalist>
      )}
      {presets.colorOptions.length > 0 && (
        <datalist id="color-options-list">
          {presets.colorOptions.map((c) => <option key={c} value={c} />)}
        </datalist>
      )}

      {/* Product Details */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Product details</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="title" className={`${labelClass} mb-1.5`}>
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="description" className={labelClass}>Description</label>
              <AiButton
                task="description"
                activeTask={aiTask}
                hasValue={description.length > 0}
                onClick={generateDescription}
              />
            </div>
            <textarea
              id="description"
              name="description"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="product_type" className={`${labelClass} mb-1.5`}>Product type</label>
              <input
                id="product_type"
                name="product_type"
                type="text"
                value={productType}
                onChange={(e) => setProductType(e.target.value)}
                list={presets.productTypes.length > 0 ? 'product-types-list' : undefined}
                className={inputClass}
              />
              {presets.productTypes.length > 0 && (
                <datalist id="product-types-list">
                  {presets.productTypes.map((t) => <option key={t} value={t} />)}
                </datalist>
              )}
            </div>
            <div>
              <label htmlFor="vendor" className={`${labelClass} mb-1.5`}>Vendor</label>
              <input id="vendor" name="vendor" type="text" defaultValue={initialData.vendor ?? ''} className={inputClass} />
            </div>
          </div>

          <div>
            <label className={`${labelClass} mb-1.5`}>Tags</label>
            <TagPicker
              presets={presets.tagPresets}
              selected={selectedTags}
              onChange={setSelectedTags}
            />
          </div>

          <div>
            <label htmlFor="status" className={`${labelClass} mb-1.5`}>Status</label>
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
            <label htmlFor="price" className={`${labelClass} mb-1.5`}>Price</label>
            <input
              id="price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              defaultValue={initialData.price}
              onChange={(e) => setHasPrice(parseFloat(e.target.value) > 0)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="compare_at_price" className={`${labelClass} mb-1.5`}>Compare at price</label>
            <input id="compare_at_price" name="compare_at_price" type="number" min="0" step="0.01" defaultValue={initialData.compare_at_price ?? ''} placeholder="—" className={inputClass} />
          </div>
        </div>
      </section>

      {/* Images */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Images</h2>

        {existingImages.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Current images</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {existingImages.map((img) => (
                <div key={img.id} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.publicUrl} alt={existingAltTexts[img.id] || ''} className="w-full h-full object-cover rounded-lg border border-gray-200" />
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

            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Image alt text</p>
                <AiButton
                  task="altText"
                  activeTask={aiTask}
                  hasValue={Object.values(existingAltTexts).some((t) => t.trim().length > 0)}
                  onClick={generateAltTexts}
                  label="Generate alt text"
                />
              </div>
              {existingImages.map((img, i) => (
                <div key={img.id} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">Image {i + 1}</span>
                  <input
                    type="text"
                    value={existingAltTexts[img.id] ?? ''}
                    onChange={(e) => setExistingAltTexts((prev) => ({ ...prev, [img.id]: e.target.value }))}
                    placeholder="Describe this image…"
                    className={smallInputClass}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {previews.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">New images</p>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
              {previews.map(({ objectUrl, file }, i) => (
                <div key={objectUrl} className="relative group aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={objectUrl} alt={file.name} className="w-full h-full object-cover rounded-lg border-2 border-dashed border-gray-300" />
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

            <div className="mt-4 space-y-2">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Alt text for new images</p>
              {previews.map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-14 shrink-0">Image {existingImages.length + i + 1}</span>
                  <input
                    type="text"
                    value={previewAltTexts[i] ?? ''}
                    onChange={(e) => setPreviewAltTexts((prev) => prev.map((t, j) => (j === i ? e.target.value : t)))}
                    placeholder="Describe this image…"
                    className={smallInputClass}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {showImageZone ? (
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
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

        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleFileChange} className="sr-only" />
      </section>

      {/* Variants */}
      <section className="bg-white border border-gray-200 rounded-xl p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-5">Variants</h2>

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

        {variants.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-2 mb-4">No variants yet.</p>
        ) : (
          <div className="space-y-3 mb-4">
            {variants.map((v, i) => (
              <EditVariantCard
                key={v.id}
                variant={v}
                index={i}
                option1Name={option1Name}
                hasOption2={hasOption2}
                option2Name={option2Name}
                sizeOptions={presets.sizeOptions}
                colorOptions={presets.colorOptions}
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

      {/* Content quality score */}
      <ContentScore
        hasTitle={title.trim().length > 0}
        descriptionWordCount={descWords}
        tagCount={selectedTags.length}
        imageCount={totalImages}
        allImagesHaveAltText={allImagesHaveAlt}
        variantCount={variants.length}
        hasPrice={hasPrice}
      />

      {/* Errors & Submit */}
      {aiError && (
        <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-lg px-4 py-3">{aiError}</p>
      )}
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

function AiButton({
  task,
  activeTask,
  hasValue,
  onClick,
  label,
}: {
  task: AiTask
  activeTask: AiTask
  hasValue: boolean
  onClick: () => void
  label?: string
}) {
  const isLoading = activeTask === task
  const isDisabled = activeTask !== null

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
    >
      {isLoading ? (
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : (
        <span aria-hidden>✨</span>
      )}
      {isLoading
        ? 'Generating…'
        : label
          ? label
          : hasValue ? 'Regenerate' : 'Generate'}
    </button>
  )
}

function EditVariantCard({
  variant: v,
  index,
  option1Name,
  hasOption2,
  option2Name,
  sizeOptions,
  colorOptions,
  onUpdate,
  onRemove,
}: {
  variant: VariantRow
  index: number
  option1Name: string
  hasOption2: boolean
  option2Name: string
  sizeOptions: string[]
  colorOptions: string[]
  onUpdate: (id: string, field: keyof Omit<VariantRow, 'id' | 'dbId'>, value: string) => void
  onRemove: () => void
}) {
  const ic = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent transition-colors bg-white'
  const lc = 'block text-xs font-medium text-gray-500 mb-1'

  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Variant {index + 1}
          {v.dbId && <span className="ml-2 font-normal text-gray-300 normal-case tracking-normal">saved</span>}
        </span>
        <button type="button" onClick={onRemove} aria-label="Remove variant" className="text-gray-400 hover:text-rose-500 transition-colors duration-150 cursor-pointer">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className={`grid gap-3 mb-3 ${hasOption2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2'}`}>
        <div>
          <label className={lc}>{option1Name || 'Option 1'}</label>
          <input
            type="text"
            list={getOptionListId(option1Name, sizeOptions, colorOptions)}
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
              list={getOptionListId(option2Name, sizeOptions, colorOptions)}
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
          <input type="number" min="0" step="0.01" placeholder="0.00" value={v.price} onChange={(e) => onUpdate(v.id, 'price', e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lc}>SKU</label>
          <input type="text" placeholder="SKU-001" value={v.sku} onChange={(e) => onUpdate(v.id, 'sku', e.target.value)} className={ic} />
        </div>
        <div>
          <label className={lc}>Inventory</label>
          <input type="number" min="0" step="1" placeholder="0" value={v.inventory_qty} onChange={(e) => onUpdate(v.id, 'inventory_qty', e.target.value)} className={ic} />
        </div>
      </div>
    </div>
  )
}
