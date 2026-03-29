/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bliss: {
          cream: '#FDF8F3',
          petal: '#F9EDE8',
          rose: '#E8B4A8',
          'rose-dark': '#C8766A',
          sage: '#8FAE8A',
          'sage-dark': '#5C7A57',
          gold: '#C9A96E',
          'gold-light': '#EDD9A3',
          ink: '#2C2420',
          'ink-light': '#5C4E48',
          muted: '#9C8E8A',
          border: '#E8DDD8',
          surface: '#FFFCFA',
        },
      },
    },
  },
  plugins: [],
}
