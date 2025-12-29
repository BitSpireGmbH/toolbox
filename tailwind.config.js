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
        // VS Code inspired dark theme colors
        vscode: {
          bg: '#1e1e1e',
          sidebar: '#252526',
          panel: '#2d2d30',
          border: '#3e3e42',
          text: '#cccccc',
          'text-muted': '#858585',
          active: '#37373d',
          hover: '#2a2d2e',
          accent: '#007acc',
          'accent-hover': '#005a9e',
          success: '#4ec9b0',
          error: '#f48771',
          warning: '#dcdcaa',
        },
      },
      fontFamily: {
        mono: ['Consolas', 'Monaco', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}
