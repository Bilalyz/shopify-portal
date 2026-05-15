'use server'

import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic()
const MODEL = 'claude-sonnet-4-6'

export async function analyzeImages(
  imageUrls: string[],
  context: { title: string; productType: string; language: string }
): Promise<string[]> {
  if (imageUrls.length === 0) return []

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
            text: `Write a concise alt text (1-2 sentences) for this product image.
Product: "${context.title}"${context.productType ? ` (${context.productType})` : ''}.
Focus on: garment type, view angle (front/back/detail), visible colors/patterns, styling details.
Write in ${langLabel}. No headings, no labels — just the description.`,
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
  const langLabel =
    data.language === 'he' ? 'Hebrew' :
    data.language === 'ar' ? 'Arabic' : 'English'

  const imagesText = data.imageDescriptions.length > 0
    ? data.imageDescriptions.map((d, i) => `Image ${i + 1}: ${d}`).join('\n')
    : 'No image descriptions available.'

  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `You are a fashion copywriter. Return a JSON object with exactly this 1 key.

Product title: ${data.title}
Product type: ${data.productType || 'Fashion item'}
Available sizes: ${data.sizes.length > 0 ? data.sizes.join(', ') : 'N/A'}
Available colors: ${data.colors.length > 0 ? data.colors.join(', ') : 'N/A'}
Image descriptions:\n${imagesText}
Brand voice: ${data.brandVoice || 'Professional and elegant'}

Return ONLY valid JSON, no markdown fences, no explanation:
{
  "description": "150-300 word product description in ${langLabel}, SEO-optimized, benefit-focused, no generic filler phrases"
}`,
    }],
  })

  const raw = (msg.content[0] as { type: 'text'; text: string }).text.trim()
  const json = JSON.parse(raw) as Record<string, unknown>

  return {
    description: String(json.description ?? ''),
  }
}
