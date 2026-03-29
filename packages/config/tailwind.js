/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        bliss: {
          // Warm cream & rose palette
          cream: '#FDF8F3',
          petal: '#F9EDE8',
          rose: '#E8B4A8',
          'rose-dark': '#C8766A',
          sage: '#8FAE8A',
          'sage-dark': '#5C7A57',
          gold: '#C9A96E',
          'gold-light': '#EDD9A3',
          // Neutrals
          ink: '#2C2420',
          'ink-light': '#5C4E48',
          muted: '#9C8E8A',
          border: '#E8DDD8',
          surface: '#FFFCFA',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-playfair)', 'Georgia', 'serif'],
      },
      borderRadius: {
        warm: '12px',
        'warm-lg': '20px',
      },
      boxShadow: {
        warm: '0 2px 12px rgba(44, 36, 32, 0.08)',
        'warm-lg': '0 8px 32px rgba(44, 36, 32, 0.12)',
      },
    },
  },
}
