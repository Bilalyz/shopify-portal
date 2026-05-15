'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { getOrgContext } from '@/lib/auth/org'

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

  const orgContext = await getOrgContext()
  if (!orgContext) {
    return { error: 'No organization selected. Please select an organization first.' }
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
      org_id: orgContext.current.orgId,
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
  const imageAltTexts = formData.getAll('image_alt_text') as string[]
  if (imagePaths.length > 0) {
    const { error: imgError } = await supabase.from('product_images').insert(
      imagePaths.map((path, i) => ({
        product_id: product.id,
        image_url: path,
        position: i,
        alt_text: imageAltTexts[i]?.trim() || null,
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
      v.option1_value?.trim() || v.option2_value?.trim() ||
      v.sku?.trim() || parseFloat(v.price) > 0 || parseInt(v.inventory_qty) > 0
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

export async function updateProduct(
  productId: string,
  _prevState: ProductFormState,
  formData: FormData
): Promise<ProductFormState> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const orgContext = await getOrgContext()
  if (!orgContext) return { error: 'No organization selected.' }

  const title = (formData.get('title') as string).trim()
  if (!title) return { error: 'Title is required.' }

  const priceRaw = formData.get('price') as string
  const compareRaw = formData.get('compare_at_price') as string
  const price = priceRaw ? parseFloat(priceRaw) : 0
  const compare_at_price = compareRaw ? parseFloat(compareRaw) : null

  if (isNaN(price) || price < 0) return { error: 'Price must be a valid non-negative number.' }
  if (compare_at_price !== null && (isNaN(compare_at_price) || compare_at_price < 0)) {
    return { error: 'Compare at price must be a valid non-negative number.' }
  }

  const tagsRaw = (formData.get('tags') as string).trim()
  const tags = tagsRaw ? tagsRaw.split(',').map((t) => t.trim()).filter(Boolean) : []

  const status = formData.get('status') as string
  if (status !== 'draft' && status !== 'active') return { error: 'Status must be draft or active.' }

  const { error: updateError } = await supabase
    .from('products')
    .update({
      title,
      description: (formData.get('description') as string).trim() || null,
      product_type: (formData.get('product_type') as string).trim() || null,
      vendor: (formData.get('vendor') as string).trim() || null,
      tags,
      status,
      price,
      compare_at_price,
    })
    .eq('id', productId)
    .eq('org_id', orgContext.current.orgId)

  if (updateError) return { error: updateError.message }

  // Remove images the user deleted
  const removedImageIds: string[] = JSON.parse(
    (formData.get('removed_image_ids') as string) || '[]'
  )
  if (removedImageIds.length > 0) {
    const { data: imgRows } = await supabase
      .from('product_images')
      .select('image_url')
      .in('id', removedImageIds)
    if (imgRows?.length) {
      await supabase.storage.from('product-images').remove(imgRows.map((r) => r.image_url))
    }
    await supabase.from('product_images').delete().in('id', removedImageIds)
  }

  // Update alt texts for existing images
  const existingAltTextsRaw = formData.get('existing_image_alt_texts') as string | null
  if (existingAltTextsRaw) {
    const altTextMap: Record<string, string> = JSON.parse(existingAltTextsRaw)
    for (const [imgId, altText] of Object.entries(altTextMap)) {
      await supabase
        .from('product_images')
        .update({ alt_text: altText.trim() || null })
        .eq('id', imgId)
        .eq('product_id', productId)
    }
  }

  // Add new uploaded images
  const imagePaths = formData.getAll('image_path') as string[]
  const imageAltTexts = formData.getAll('image_alt_text') as string[]
  if (imagePaths.length > 0) {
    const { data: lastImg } = await supabase
      .from('product_images')
      .select('position')
      .eq('product_id', productId)
      .order('position', { ascending: false })
      .limit(1)
      .single()
    const startPosition = (lastImg?.position ?? -1) + 1
    await supabase.from('product_images').insert(
      imagePaths.map((path, i) => ({
        product_id: productId,
        image_url: path,
        position: startPosition + i,
        alt_text: imageAltTexts[i]?.trim() || null,
      }))
    )
  }

  // Sync variants
  type VariantInput = {
    id: string
    dbId?: string
    option1_name: string; option1_value: string
    option2_name: string; option2_value: string
    price: string; sku: string; inventory_qty: string
  }
  const variantsJson = formData.get('variants_json') as string | null
  const variantInputs: VariantInput[] = variantsJson ? JSON.parse(variantsJson) : []

  const { data: dbVariants } = await supabase
    .from('variants')
    .select('id')
    .eq('product_id', productId)

  const dbVariantIds = new Set((dbVariants ?? []).map((v) => v.id))
  const submittedDbIds = new Set(
    variantInputs.filter((v) => v.dbId).map((v) => v.dbId!)
  )

  // Delete removed variants
  const toDelete = [...dbVariantIds].filter((id) => !submittedDbIds.has(id))
  if (toDelete.length > 0) {
    await supabase.from('variants').delete().in('id', toDelete)
  }

  // Update existing variants
  for (const v of variantInputs.filter((v) => v.dbId && dbVariantIds.has(v.dbId))) {
    await supabase.from('variants').update({
      option1_name:  v.option1_name.trim()  || null,
      option1_value: v.option1_value.trim() || null,
      option2_name:  v.option2_name.trim()  || null,
      option2_value: v.option2_value.trim() || null,
      price:         parseFloat(v.price)    || 0,
      sku:           v.sku.trim()           || null,
      inventory_qty: parseInt(v.inventory_qty) || 0,
    }).eq('id', v.dbId!)
  }

  // Insert new variants
  const toInsert = variantInputs
    .filter((v) => !v.dbId && (
      v.option1_value?.trim() || v.option2_value?.trim() ||
      v.sku?.trim() || parseFloat(v.price) > 0 || parseInt(v.inventory_qty) > 0
    ))
    .map((v) => ({
      product_id:    productId,
      option1_name:  v.option1_name.trim()  || null,
      option1_value: v.option1_value.trim() || null,
      option2_name:  v.option2_name.trim()  || null,
      option2_value: v.option2_value.trim() || null,
      price:         parseFloat(v.price)    || 0,
      sku:           v.sku.trim()           || null,
      inventory_qty: parseInt(v.inventory_qty) || 0,
    }))
  if (toInsert.length > 0) {
    await supabase.from('variants').insert(toInsert)
  }

  redirect(`/dashboard/products/${productId}/edit?saved=1`)
}

export async function deleteProduct(productId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const orgContext = await getOrgContext()
  if (!orgContext) return

  // Fetch storage paths before cascade delete removes the rows
  const { data: images } = await supabase
    .from('product_images')
    .select('image_url')
    .eq('product_id', productId)

  await supabase
    .from('products')
    .delete()
    .eq('id', productId)
    .eq('org_id', orgContext.current.orgId)

  if (images?.length) {
    await supabase.storage.from('product-images').remove(images.map((img) => img.image_url))
  }

  revalidatePath('/dashboard')
}

export async function deleteProducts(productIds: string[]): Promise<void> {
  if (productIds.length === 0) return

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const orgContext = await getOrgContext()
  if (!orgContext) return

  // Fetch all storage paths before cascade delete removes the rows
  const { data: images } = await supabase
    .from('product_images')
    .select('image_url')
    .in('product_id', productIds)

  await supabase
    .from('products')
    .delete()
    .in('id', productIds)
    .eq('org_id', orgContext.current.orgId)

  if (images?.length) {
    await supabase.storage.from('product-images').remove(images.map((img) => img.image_url))
  }

  revalidatePath('/dashboard')
}
