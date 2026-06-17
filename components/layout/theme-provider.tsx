'use client'
import { createContext, useContext, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export const FONT_SIZES = {
  'Small (12px)': '12px',
  'Medium (14px)': '14px',
  'Large (16px)': '16px',
} as const

export type FontSizeLabel = keyof typeof FONT_SIZES

interface ThemeCtx {
  theme: Theme
  setTheme: (t: Theme) => void
  toggle: () => void
  accent: string
  setAccent: (c: string) => void
  fontSize: FontSizeLabel
  setFontSize: (f: FontSizeLabel) => void
}

const Ctx = createContext<ThemeCtx>({
  theme: 'light', setTheme: () => {}, toggle: () => {},
  accent: '#7c6dfa', setAccent: () => {},
  fontSize: 'Medium (14px)', setFontSize: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeRaw] = useState<Theme>('light')
  const [accent, setAccentRaw] = useState('#7c6dfa')
  const [fontSize, setFontSizeRaw] = useState<FontSizeLabel>('Medium (14px)')

  useEffect(() => {
    const saved = localStorage.getItem('fb_theme') as Theme | null
    const sys = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const savedAccent = localStorage.getItem('fb_accent')
    const savedFontSize = localStorage.getItem('fb_font_size') as FontSizeLabel | null
    setThemeRaw(saved ?? sys)
    if (savedAccent) setAccentRaw(savedAccent)
    if (savedFontSize && savedFontSize in FONT_SIZES) setFontSizeRaw(savedFontSize)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    document.documentElement.style.setProperty('--accent', accent)
  }, [accent])

  useEffect(() => {
    document.documentElement.style.setProperty('--font-size-base', FONT_SIZES[fontSize])
  }, [fontSize])

  const setTheme = (t: Theme) => {
    setThemeRaw(t)
    localStorage.setItem('fb_theme', t)
  }

  const toggle = () => setTheme(theme === 'dark' ? 'light' : 'dark')

  const setAccent = (c: string) => {
    setAccentRaw(c)
    localStorage.setItem('fb_accent', c)
  }

  const setFontSize = (f: FontSizeLabel) => {
    setFontSizeRaw(f)
    localStorage.setItem('fb_font_size', f)
  }

  return <Ctx.Provider value={{ theme, setTheme, toggle, accent, setAccent, fontSize, setFontSize }}>{children}</Ctx.Provider>
}

export const useTheme = () => useContext(Ctx)
