/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-brand-primary)',
          secondary: 'var(--color-brand-secondary)',
        },
        ide: {
          bg: 'var(--color-ide-bg)',
          sidebar: 'var(--color-ide-sidebar)',
          panel: 'var(--color-ide-panel)',
          border: 'var(--color-ide-border)',
          text: 'var(--color-ide-text)',
          'text-muted': 'var(--color-ide-text-muted)',
          accent: 'var(--color-ide-accent)',
          success: 'var(--color-ide-success)',
          warning: 'var(--color-ide-warning)',
          error: 'var(--color-ide-error)',
          keyword: 'var(--color-ide-keyword)',
          string: 'var(--color-ide-string)',
          comment: 'var(--color-ide-comment)',
        },
      },
      fontFamily: {
        'mono': ['Consolas', 'Monaco', 'Courier New', 'monospace'],
      },
    },
  },
  plugins: [],
}
