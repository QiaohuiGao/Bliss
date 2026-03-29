import type { Config } from 'tailwindcss'
import baseConfig from '@bliss/config/tailwind'

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  presets: [baseConfig],
  theme: {
    extend: {},
  },
  plugins: [],
}

export default config
