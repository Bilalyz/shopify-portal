'use server'

import { createClient } from '@/lib/supabase/server'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Unicode-safe slug: keeps letters from any script (Hebrew, Latin, etc.),
// digits, and hyphens. Spaces become hyphens.
function slugify(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[\s ]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Format a price value to 2 decimal places, empty string for null/undefined.
function fmtPrice(v: number | string | null | undefined): string {
  if (v === null || v === undefined || v === '') return ''
  const n = parseFloat(String(v))
  return isNaN(n) ? '' : n.toFixed(2)
}

// RFC 4180 field escaping: quote if the value contains comma, double-quote,
// CR, or LF. Internal double-quotes are doubled.
function esc(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  return s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s
}

// ── Column definition (exact Shopify order, 107 columns) ─────────────────────

const HEADERS = [
  'Handle',
  'Title',
  'Body (HTML)',
  'Vendor',
  'Product Category',
  'Type',
  'Tags',
  'Published',
  'Option1 Name',
  'Option1 Value',
  'Option1 Linked To',
  'Option2 Name',
  'Option2 Value',
  'Option2 Linked To',
  'Option3 Name',
  'Option3 Value',
  'Option3 Linked To',
  'Variant SKU',
  'Variant Grams',
  'Variant Inventory Tracker',
  'Variant Inventory Policy',
  'Variant Fulfillment Service',
  'Variant Price',
  'Variant Compare At Price',
  'Variant Requires Shipping',
  'Variant Taxable',
  'Unit Price Total Measure',
  'Unit Price Total Measure Unit',
  'Unit Price Base Measure',
  'Unit Price Base Measure Unit',
  'Variant Barcode',
  'Image Src',
  'Image Position',
  'Image Alt Text',
  'Gift Card',
  'SEO Title',
  'SEO Description',
  'Google Shopping / Google Product Category',
  'Google Shopping / Gender',
  'Google Shopping / Age Group',
  'Google Shopping / MPN',
  'Google Shopping / Condition',
  'Google Shopping / Custom Product',
  'Google Shopping / Custom Label 0',
  'Google Shopping / Custom Label 1',
  'Google Shopping / Custom Label 2',
  'Google Shopping / Custom Label 3',
  'Google Shopping / Custom Label 4',
  'subcategory (product.metafields.custom.subcategory)',
  'Google: Custom Product (product.metafields.mm-google-shopping.custom_product)',
  'Accessory size (product.metafields.shopify.accessory-size)',
  'Activewear clothing features (product.metafields.shopify.activewear-clothing-features)',
  'Activity (product.metafields.shopify.activity)',
  'Age group (product.metafields.shopify.age-group)',
  'Bag/Case features (product.metafields.shopify.bag-case-features)',
  'Bag/Case material (product.metafields.shopify.bag-case-material)',
  'Bag/Case storage features (product.metafields.shopify.bag-case-storage-features)',
  'Best uses (product.metafields.shopify.best-uses)',
  'Boot style (product.metafields.shopify.boot-style)',
  'Care instructions (product.metafields.shopify.care-instructions)',
  'Carry options (product.metafields.shopify.carry-options)',
  'Closure type (product.metafields.shopify.closure-type)',
  'Clothing accessory material (product.metafields.shopify.clothing-accessory-material)',
  'Clothing features (product.metafields.shopify.clothing-features)',
  'Color (product.metafields.shopify.color-pattern)',
  'Costume theme (product.metafields.shopify.costume-theme)',
  'Cup size (product.metafields.shopify.cup-size)',
  'Dress occasion (product.metafields.shopify.dress-occasion)',
  'Dress style (product.metafields.shopify.dress-style)',
  'Fabric (product.metafields.shopify.fabric)',
  'Fit (product.metafields.shopify.fit)',
  'Footwear material (product.metafields.shopify.footwear-material)',
  'Handle color (product.metafields.shopify.handle-color)',
  'Handle material (product.metafields.shopify.handle-material)',
  'Heel height type (product.metafields.shopify.heel-height-type)',
  'Heel shoe type (product.metafields.shopify.heel-shoe-type)',
  'Intimate apparel features (product.metafields.shopify.intimate-apparel-features)',
  'Neckline (product.metafields.shopify.neckline)',
  'Occasion style (product.metafields.shopify.occasion-style)',
  'One-piece style (product.metafields.shopify.one-piece-style)',
  'Outerwear clothing features (product.metafields.shopify.outerwear-clothing-features)',
  'Pants length type (product.metafields.shopify.pants-length-type)',
  'Scarf/Shawl style (product.metafields.shopify.scarf-shawl-style)',
  'Shapewear support level (product.metafields.shopify.shapewear-support-level)',
  'Shoe features (product.metafields.shopify.shoe-features)',
  'Shoe size (product.metafields.shopify.shoe-size)',
  'Size (product.metafields.shopify.size)',
  'Skirt/Dress length type (product.metafields.shopify.skirt-dress-length-type)',
  'Skirt style (product.metafields.shopify.skirt-style)',
  'Sleeve length type (product.metafields.shopify.sleeve-length-type)',
  'Target gender (product.metafields.shopify.target-gender)',
  'Toe style (product.metafields.shopify.toe-style)',
  'Top length type (product.metafields.shopify.top-length-type)',
  'Toy/Game material (product.metafields.shopify.toy-game-material)',
  'Waist rise (product.metafields.shopify.waist-rise)',
  'Complementary products (product.metafields.shopify--discovery--product_recommendation.complementary_products)',
  'Related products (product.metafields.shopify--discovery--product_recommendation.related_products)',
  'Related products settings (product.metafields.shopify--discovery--product_recommendation.related_products_display)',
  'Search product boosts (product.metafields.shopify--discovery--product_search_boost.queries)',
  'Variant Image',
  'Variant Weight Unit',
  'Variant Tax Code',
  'Cost per item',
  'Included / Israel',
  'Price / Israel',
  'Compare At Price / Israel',
  'Status',
] as const

type Col = typeof HEADERS[number]
type Row = Partial<Record<Col, string>>

function rowToLine(row: Row): string {
  return HEADERS.map((h) => esc(row[h] ?? '')).join(',')
}

// ── Row-section builders ──────────────────────────────────────────────────────

type VariantData = {
  option1_name: string | null
  option1_value: string | null
  option2_name: string | null
  option2_value: string | null
  price: number | string | null
  sku: string | null
}

// compareAtPrice is the product-level field; only passed for the first row.
function variantCols(v: VariantData, compareAtPrice: string): Row {
  return {
    'Option1 Name':             v.option1_name  ?? '',
    'Option1 Value':            v.option1_value ?? '',
    'Option1 Linked To':        '',
    'Option2 Name':             v.option2_name  ?? '',
    'Option2 Value':            v.option2_value ?? '',
    'Option2 Linked To':        '',
    'Option3 Name':             '',
    'Option3 Value':            '',
    'Option3 Linked To':        '',
    'Variant SKU':              v.sku ?? '',
    'Variant Grams':            '0',
    'Variant Inventory Tracker':   'shopify',
    'Variant Inventory Policy':    'deny',
    'Variant Fulfillment Service': 'manual',
    'Variant Price':            fmtPrice(v.price),
    'Variant Compare At Price': compareAtPrice,
    'Variant Requires Shipping': 'true',
    'Variant Taxable':          'true',
    'Variant Weight Unit':      'kg',
  }
}

type ImageData = {
  image_url: string
  position: number
  alt_text: string | null
}

function imageCols(img: ImageData, publicUrl: string): Row {
  return {
    'Image Src':      publicUrl,
    'Image Position': String(img.position + 1), // Shopify uses 1-based positions
    'Image Alt Text': img.alt_text ?? '',
  }
}

// ── Exported server action ────────────────────────────────────────────────────

export async function exportProductsCsv(): Promise<string> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: products, error } = await supabase
    .from('products')
    .select(`
      id, title, description, vendor, product_type, tags, status, price, compare_at_price,
      variants(option1_name, option1_value, option2_name, option2_value, price, sku),
      product_images(image_url, position, alt_text)
    `)
    .order('created_at', { ascending: true })

  if (error) throw new Error(error.message)

  const getPublicUrl = (path: string) =>
    supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl

  const lines: string[] = [HEADERS.join(',')]

  for (const p of products ?? []) {
    const handle = slugify(p.title)
    const variants = (p.variants ?? []) as VariantData[]
    const images = ([...(p.product_images ?? [])] as ImageData[])
      .sort((a, b) => a.position - b.position)

    const compareAtPrice = fmtPrice(p.compare_at_price)

    // When a product has no variants, synthesise a default variant so the
    // product-level price still appears in the Variant Price column.
    const effectiveVariants: VariantData[] =
      variants.length > 0
        ? variants
        : [{
            option1_name: null, option1_value: null,
            option2_name: null, option2_value: null,
            price: p.price,
            sku: null,
          }]

    // ── First row: all product fields + first variant + first image ───────────
    lines.push(rowToLine({
      'Handle':           handle,
      'Title':            p.title,
      'Body (HTML)':      p.description ?? '',
      'Vendor':           p.vendor ?? '',
      'Product Category': '',
      'Type':             p.product_type ?? '',
      'Tags':             (p.tags ?? []).join(', '),
      'Published':        p.status === 'active' ? 'true' : 'false',
      'Gift Card':        'false',
      'Status':           p.status,
      ...variantCols(effectiveVariants[0], compareAtPrice),
      ...(images[0] ? imageCols(images[0], getPublicUrl(images[0].image_url)) : {}),
    }))

    // ── Additional variant rows: Handle + variant columns only ────────────────
    for (let i = 1; i < effectiveVariants.length; i++) {
      lines.push(rowToLine({
        'Handle': handle,
        // compareAtPrice blank for additional rows — no per-variant field in our schema
        ...variantCols(effectiveVariants[i], ''),
      }))
    }

    // ── Additional image rows: Handle + image columns only ────────────────────
    for (let i = 1; i < images.length; i++) {
      lines.push(rowToLine({
        'Handle': handle,
        ...imageCols(images[i], getPublicUrl(images[i].image_url)),
      }))
    }
  }

  // UTF-8 BOM ensures Excel and other tools correctly display Hebrew and other
  // non-Latin characters without needing an explicit encoding selection.
  return '﻿' + lines.join('\r\n')
}
