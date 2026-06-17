import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'var(--font-dm-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'monospace'],
      },
      colors: {
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        'accent-hover': 'var(--accent-hover)',
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-2': 'var(--surface-2)',
        sidebar: 'var(--sidebar)',
        border: 'var(--border)',
        'border-soft': 'var(--border-soft)',
        'border-faint': 'var(--border-faint)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-muted': 'var(--text-muted)',
        'row-hover': 'var(--row-hover)',
      },
      borderRadius: {
        DEFAULT: '12px',
      },
      boxShadow: {
        card: 'var(--shadow)',
        lg: 'var(--shadow-lg)',
      },
    },
  },
  plugins: [],
}

export default config
