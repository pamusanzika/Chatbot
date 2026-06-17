'use client'
import { createContext, useContext, useState } from 'react'
import { fmtCurrency } from '@/lib/constants'

interface CurrencyCtx {
  currency: string
  setCurrency: (c: string) => void
  fmt: (n: number) => string
}

const Ctx = createContext<CurrencyCtx>({
  currency: 'LKR',
  setCurrency: () => {},
  fmt: (n) => fmtCurrency(n, 'LKR'),
})

export function CurrencyProvider({ currency: initial, children }: { currency: string; children: React.ReactNode }) {
  const [currency, setCurrency] = useState(initial)
  const fmt = (n: number) => fmtCurrency(n, currency)
  return <Ctx.Provider value={{ currency, setCurrency, fmt }}>{children}</Ctx.Provider>
}

export const useCurrency = () => useContext(Ctx)
