/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          50: 'var(--bg-main)',
          100: 'var(--bg-card-2)',
          200: 'var(--border)',
          300: 'var(--border)',
          400: 'var(--text-muted)',
          500: 'var(--text-muted)',
          600: 'var(--text-secondary)',
          700: 'var(--text-primary)',
          800: 'var(--text-primary)',
          900: 'var(--text-primary)'
        }
      }
    },
  },
  plugins: [],
}
