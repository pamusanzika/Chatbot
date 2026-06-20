function getApiKey() { return process.env.EMBED_API_KEY ?? '' }
function getModel() { return process.env.EMBED_MODEL ?? 'voyage-multimodal-3' }

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
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: getModel(),
      inputs: [{ content }],
      input_type: 'document',
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
    { type: 'image_base64', image_base64: input.base64, media_type: input.mimeType },
  ])
}

export async function embedImageFromUrl(url: string): Promise<number[]> {
  return callVoyage([
    { type: 'image_url', image_url: url },
  ])
}
