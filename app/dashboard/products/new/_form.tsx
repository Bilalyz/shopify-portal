'use client'

import { useActionState, startTransition, useState, useEffect } from 'react'
import { createProduct, type ProductFormState } from '@/app/actions/products'
import { createClient } from '@/lib/supabase/client'

const field: React.CSSProperties = { marginBottom: 16 }
const label: React.CSSProperties = { display: 'block', marginBottom: 4, fontWeight: 500 }
const input: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 14, boxSizing: 'border-box' }

type Preview = { objectUrl: string; file: File }

export default function NewProductForm() {
  const [state, dispatch, pending] = useActionState<ProductFormState, FormData>(
    createProduct,
    undefined
  )
  const [previews, setPreviews] = useState<Preview[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Revoke object URLs when previews change to avoid memory leaks
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.objectUrl))
    }
  }, [previews])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    previews.forEach((p) => URL.revokeObjectURL(p.objectUrl))
    setPreviews(selected.map((file) => ({ file, objectUrl: URL.createObjectURL(file) })))
  }

  function removePreview(index: number) {
    URL.revokeObjectURL(previews[index].objectUrl)
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setUploadError(null)

    const formData = new FormData(e.currentTarget)

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

        const { data, error } = await supabase.storage
          .from('product-images')
          .upload(path, file)

        if (error) {
          setUploadError(`Upload failed for "${file.name}": ${error.message}`)
          setUploading(false)
          return
        }

        // Append each path separately so server action can read getAll('image_path')
        formData.append('image_path', data.path)
      }

      setUploading(false)
    }

    startTransition(() => {
      dispatch(formData)
    })
  }

  const busy = uploading || pending
  const buttonLabel = uploading ? 'Uploading images…' : pending ? 'Saving…' : 'Save product'

  return (
    <form onSubmit={handleSubmit}>
      <div style={field}>
        <label style={label} htmlFor="title">Title *</label>
        <input style={input} id="title" name="title" type="text" required />
      </div>

      <div style={field}>
        <label style={label} htmlFor="description">Description</label>
        <textarea
          style={{ ...input, height: 100, resize: 'vertical' }}
          id="description"
          name="description"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={label} htmlFor="product_type">Product type</label>
          <input style={input} id="product_type" name="product_type" type="text" />
        </div>
        <div>
          <label style={label} htmlFor="vendor">Vendor</label>
          <input style={input} id="vendor" name="vendor" type="text" />
        </div>
      </div>

      <div style={field}>
        <label style={label} htmlFor="tags">Tags (comma-separated)</label>
        <input style={input} id="tags" name="tags" type="text" placeholder="e.g. cotton, summer, sale" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <div>
          <label style={label} htmlFor="price">Price ($)</label>
          <input style={input} id="price" name="price" type="number" min="0" step="0.01" defaultValue="0" />
        </div>
        <div>
          <label style={label} htmlFor="compare_at_price">Compare at price ($)</label>
          <input style={input} id="compare_at_price" name="compare_at_price" type="number" min="0" step="0.01" />
        </div>
      </div>

      <div style={field}>
        <label style={label} htmlFor="status">Status</label>
        <select style={input} id="status" name="status" defaultValue="draft">
          <option value="draft">Draft</option>
          <option value="active">Active</option>
        </select>
      </div>

      {/* ── Image upload ── */}
      <div style={{ marginBottom: 20 }}>
        <label style={label} htmlFor="images">Images</label>
        <input
          id="images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={handleFileChange}
          style={{ fontSize: 14 }}
        />

        {previews.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {previews.map(({ objectUrl, file }, i) => (
              <div key={objectUrl} style={{ position: 'relative' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={objectUrl}
                  alt={file.name}
                  width={80}
                  height={80}
                  style={{ objectFit: 'cover', display: 'block', border: '1px solid #ddd' }}
                />
                <button
                  type="button"
                  onClick={() => removePreview(i)}
                  aria-label={`Remove ${file.name}`}
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 18,
                    height: 18,
                    padding: 0,
                    lineHeight: '16px',
                    fontSize: 12,
                    cursor: 'pointer',
                    background: 'rgba(0,0,0,0.55)',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 2,
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {uploadError && <p style={{ color: 'red', marginBottom: 12 }}>{uploadError}</p>}
      {state?.error && <p style={{ color: 'red', marginBottom: 12 }}>{state.error}</p>}

      <button type="submit" disabled={busy} style={{ padding: '8px 20px', fontSize: 14 }}>
        {buttonLabel}
      </button>
    </form>
  )
}
