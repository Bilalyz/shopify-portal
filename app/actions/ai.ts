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
      content: `You are an e-commerce SEO content writer. Write a product description optimized for Google search — factual, specific, and natural-sounding. NOT marketing copy.

Product title: ${data.title}
Product type: ${data.productType || 'fashion item'}
${sizesLine}
${colorsLine}
${imageContext}
${toneLine}

Requirements:
- Open with the product name and its most specific defining characteristic (fabric, cut, or key detail)
- Include concrete specifics: silhouette, fit, fabric/material, notable construction or design details
- Integrate the product title and natural keyword variants organically throughout
- 150-200 words, plain flowing prose, no bullet points, no headings
- Write in ${langLabel}

STRICTLY FORBIDDEN: "elevate", "effortlessly", "timeless", "versatile", "luxurious", "stunning", "beautiful", "perfect for", "must-have", "chic", "sophisticated", or any phrase that could describe any product without being specific to this one.

Return ONLY the description text — no labels, no JSON, no extra formatting.`,
    }],
  })

  const description = (msg.content[0] as { type: 'text'; text: string }).text.trim()

  return { description }
}
