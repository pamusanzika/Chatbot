export function normalizePhone(p?: string | null): string {
  const d = (p || '').replace(/\D/g, '')
  return d.replace(/^0/, '').replace(/^94/, '')
}
