'use client'

import { useActionState } from 'react'
import { createProduct, type ProductFormState } from '@/app/actions/products'

const field: React.CSSProperties = { marginBottom: 16 }
const label: React.CSSProperties = { display: 'block', marginBottom: 4, fontWeight: 500 }
const input: React.CSSProperties = { width: '100%', padding: '6px 8px', fontSize: 14, boxSizing: 'border-box' }

export default function NewProductForm() {
  const [state, action, pending] = useActionState<ProductFormState, FormData>(
    createProduct,
    undefined
  )

  return (
    <form action={action}>
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

      {state?.error && (
        <p style={{ color: 'red', marginBottom: 16 }}>{state.error}</p>
      )}

      <button type="submit" disabled={pending} style={{ padding: '8px 20px', fontSize: 14 }}>
        {pending ? 'Saving…' : 'Save product'}
      </button>
    </form>
  )
}
