export function normalizePaymentMethod(pm?: string | null): string {
  return (pm || '').toLowerCase().replace(/[\s_-]+/g, '_').trim()
}

export function isBankTransfer(pm?: string | null): boolean {
  return normalizePaymentMethod(pm).includes('bank')
}
