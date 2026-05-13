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

  const { data: product, error } = await supabase
    .from('products')
    .insert({
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
    .select('id')
    .single()

  if (error) {
    return { error: error.message }
  }

  // image_path entries are storage paths appended by the browser before dispatch
  const imagePaths = formData.getAll('image_path') as string[]
  if (imagePaths.length > 0) {
    const { error: imgError } = await supabase.from('product_images').insert(
      imagePaths.map((path, i) => ({
        product_id: product.id,
        image_url: path,
        position: i,
      }))
    )
    if (imgError) {
      console.error('product_images insert failed:', imgError.message)
    }
  }

  // variants_json is serialized client-side from controlled inputs
  type VariantInput = {
    id: string
    option1_name: string; option1_value: string
    option2_name: string; option2_value: string
    price: string; sku: string; inventory_qty: string
  }
  const variantsJson = formData.get('variants_json') as string | null
  const variantInputs: VariantInput[] = variantsJson ? JSON.parse(variantsJson) : []

  const variantRows = variantInputs
    .filter((v) =>
      v.option1_name.trim() || v.option1_value.trim() ||
      v.option2_name.trim() || v.option2_value.trim() ||
      v.sku.trim() || parseFloat(v.price) > 0 || parseInt(v.inventory_qty) > 0
    )
    .map((v) => ({
      product_id: product.id,
      option1_name:  v.option1_name.trim()  || null,
      option1_value: v.option1_value.trim() || null,
      option2_name:  v.option2_name.trim()  || null,
      option2_value: v.option2_value.trim() || null,
      price:         parseFloat(v.price)    || 0,
      sku:           v.sku.trim()           || null,
      inventory_qty: parseInt(v.inventory_qty) || 0,
    }))

  if (variantRows.length > 0) {
    const { error: varError } = await supabase.from('variants').insert(variantRows)
    if (varError) {
      console.error('variants insert failed:', varError.message)
    }
  }

  redirect('/dashboard')
}
