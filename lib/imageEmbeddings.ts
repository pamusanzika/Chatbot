const EMBED_API_KEY = process.env.EMBED_API_KEY ?? ''
const EMBED_MODEL = process.env.EMBED_MODEL ?? 'voyage-multimodal-3'

function l2Normalize(vec: number[]): number[] {
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0))
  if (norm === 0) return vec
  return vec.map((v) => v / norm)
}

async function callVoyage(content: Array<Record<string, unknown>>): Promise<number[]> {
  const res = await fetch('https://api.voyageai.com/v1/multimodalembeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${EMBED_API_KEY}`,
    },
    body: JSON.stringify({
      model: EMBED_MODEL,
      inputs: [{ content }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Embedding API error ${res.status}: ${text}`)
  }

  const json = await res.json()
  const embedding: number[] = json.data?.[0]?.embedding
  if (!embedding) throw new Error('No embedding returned from API')
  return l2Normalize(embedding)
}

export async function embedImage(input: { base64: string; mimeType: string }): Promise<number[]> {
  return callVoyage([
    { type: 'image', image: input.base64, media_type: input.mimeType },
  ])
}

export async function embedImageFromUrl(url: string): Promise<number[]> {
  return callVoyage([
    { type: 'image', image_url: url },
  ])
}
