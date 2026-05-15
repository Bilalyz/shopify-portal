'use server'

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-sonnet-4-6'

export async function analyzeImages(
  imageUrls: string[],
  context: { title: string; productType: string; language: string }
): Promise<string[]> {
  if (imageUrls.length === 0) return []

  const client = new Anthropic()
  const langLabel =
    context.language === 'he' ? 'Hebrew' :
    context.language === 'ar' ? 'Arabic' : 'English'

  const altTexts: string[] = []

  for (const url of imageUrls) {
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 128,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url } },
          {
            type: 'text',
            text: `Write a concise, factual alt text (1-2 sentences) for this product image.
Product: "${context.title}"${context.productType ? ` (${context.productType})` : ''}.
Describe exactly what you see: garment type, view angle (front/back/detail), colors, patterns, fabric texture, visible construction details.
Write in ${langLabel}. No marketing language — just factual visual description.`,
          },
        ],
      }],
    })
    altTexts.push((msg.content[0] as { type: 'text'; text: string }).text.trim())
  }

  return altTexts
}

export type EnrichResult = {
  description: string
}

export async function enrichProduct(data: {
  title: string
  productType: string
  imageDescriptions: string[]
  tags: string[]
  sizes: string[]
  colors: string[]
  brandVoice: string
  language: string
}): Promise<EnrichResult> {
  const client = new Anthropic()
  const langLabel =
    data.language === 'he' ? 'Hebrew' :
    data.language === 'ar' ? 'Arabic' : 'English'

  const imageContext = data.imageDescriptions.length > 0
    ? `Visual details from product images:\n${data.imageDescriptions.map((d, i) => `- Image ${i + 1}: ${d}`).join('\n')}`
    : ''

  const sizesLine = data.sizes.length > 0 ? `Available sizes: ${data.sizes.join(', ')}` : ''
  const colorsLine = data.colors.length > 0 ? `Available colors: ${data.colors.join(', ')}` : ''
  const toneLine = data.brandVoice ? `Brand tone: ${data.brandVoice}` : ''

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    messages: [{
      role: 'user',
      content: `You are an e-commerce SEO content writer. Your job is to ALWAYS write a product description — never refuse, never ask questions, never flag mismatches.

Use this priority when writing:
- 60% weight: image descriptions (what the product actually looks like)
- 20% weight: product title (use as the SEO keyword anchor)
- 20% weight: any other context provided

If image details conflict with the title, base the description on what the images show and still use the title as the keyword. Never comment on inconsistencies.

--- PRODUCT DATA ---
Title: ${data.title}
Type: ${data.productType || 'fashion item'}
${sizesLine}
${colorsLine}
${imageContext}
${toneLine}
--- END DATA ---

Write the description following these rules:
- Open with the product title as the first keyword, followed by its most specific visual characteristic from the images
- Include concrete details from the images: colors, silhouette, fabric texture, cut, construction details
- Integrate the title and natural keyword variants organically throughout
- 150-200 words, plain prose, no bullet points, no headings
- Write in ${langLabel}
- NEVER use: "elevate", "effortlessly", "timeless", "versatile", "luxurious", "stunning", "beautiful", "perfect for", "must-have", "chic", "sophisticated", or any generic phrase that could describe any product

Return ONLY the description text — no labels, no JSON, no preamble, no explanation.`,
    }],
  })

  const description = (msg.content[0] as { type: 'text'; text: string }).text.trim()

  return { description }
}
