'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export type ProductFormState = {
  error?: string
} | undefined

export async function createProduct(
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: 'You must be signed in to create a product.' }
  }

  const title = (formData.get('title') as string).trim()
  if (!title) {
    return { error: 'Title is required.' }
  }

  const priceRaw = formData.get('price') as string
  const compareRaw = formData.get('compare_at_price') as string
  const price = priceRaw ? parseFloat(priceRaw) : 0
  const compare_at_price = compareRaw ? parseFloat(compareRaw) : null

  if (isNaN(price) || price < 0) {
    return { error: 'Price must be a valid non-negative number.' }
  }
  if (compare_at_price !== null && (isNaN(compare_at_price) || compare_at_price < 0)) {
    return { error: 'Compare at price must be a valid non-negative number.' }
  }

  const tagsRaw = (formData.get('tags') as string).trim()
  const tags = tagsRaw
    ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean)
    : []

  const status = formData.get('status') as string
  if (status !== 'draft' && status !== 'active') {
    return { error: 'Status must be draft or active.' }
  }

  const { error } = await supabase.from('products').insert({
    user_id: user.id,
    title,
    description: (formData.get('description') as string).trim() || null,
    product_type: (formData.get('product_type') as string).trim() || null,
    vendor: (formData.get('vendor') as string).trim() || null,
    tags,
    status,
    price,
    compare_at_price,
  })

  if (error) {
    return { error: error.message }
  }

  redirect('/dashboard')
}
