/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        bliss: {
          // Outdoor garden palette
          cream: '#FAF7F2',
          linen: '#F5F0E8',
          petal: '#EDE7DB',
          // Primary: forest/sage greens
          sage: '#7A9E7E',
          'sage-dark': '#4D7A52',
          'sage-deep': '#3A6040',
          'sage-light': '#B8D4BA',
          'sage-mist': '#E8F0E8',
          // Accent: warm terracotta/clay
          terra: '#C4856C',
          'terra-dark': '#A66B54',
          'terra-light': '#E8C4B4',
          'terra-mist': '#F5E8E0',
          // Supporting
          gold: '#C9A96E',
          'gold-light': '#EDD9A3',
          sky: '#8EB4D4',
          'sky-light': '#D8E8F4',
          lavender: '#B4A0C8',
          'lavender-light': '#E8E0F0',
          // Neutrals
          ink: '#2A3228',
          'ink-light': '#4A5648',
          muted: '#8A9488',
          border: '#D8D0C8',
          surface: '#FDFBF8',
        },
      },
      fontFamily: {
        sans: ['var(--font-nunito)', 'system-ui', 'sans-serif'],
        serif: ['var(--font-cormorant)', 'Georgia', 'serif'],
      },
      borderRadius: {
        warm: '12px',
        'warm-lg': '20px',
        'warm-xl': '28px',
        organic: '30% 70% 70% 30% / 30% 30% 70% 70%',
      },
      boxShadow: {
        warm: '0 2px 12px rgba(42, 50, 40, 0.06)',
        'warm-md': '0 4px 20px rgba(42, 50, 40, 0.08)',
        'warm-lg': '0 8px 32px rgba(42, 50, 40, 0.10)',
        'warm-xl': '0 16px 48px rgba(42, 50, 40, 0.14)',
        'glow-sage': '0 0 24px rgba(122, 158, 126, 0.25)',
        'glow-terra': '0 0 24px rgba(196, 133, 108, 0.25)',
        leaf: '4px 4px 0 rgba(122, 158, 126, 0.15)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(24px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        checkmark: {
          '0%': { transform: 'scale(0)' },
          '50%': { transform: 'scale(1.2)' },
          '100%': { transform: 'scale(1)' },
        },
        confetti: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(-200px) rotate(720deg)', opacity: '0' },
        },
        sway: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        grow: {
          '0%': { transform: 'scaleY(0)', opacity: '0' },
          '100%': { transform: 'scaleY(1)', opacity: '1' },
        },
        leafDrift: {
          '0%': { transform: 'translateY(-20px) rotate(0deg)', opacity: '0' },
          '20%': { opacity: '1' },
          '100%': { transform: 'translateY(100vh) rotate(360deg)', opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.6s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.4s ease-out',
        'checkmark': 'checkmark 0.3s ease-out',
        'confetti': 'confetti 1.5s ease-out forwards',
        'sway': 'sway 4s ease-in-out infinite',
        'float': 'float 3.5s ease-in-out infinite',
        'grow': 'grow 0.5s ease-out',
        'leaf-drift': 'leafDrift 8s ease-in-out infinite',
      },
      backgroundImage: {
        'gradient-garden': 'linear-gradient(160deg, #E8F0E8 0%, #FAF7F2 40%, #F5E8E0 100%)',
        'gradient-forest': 'linear-gradient(180deg, #E8F0E8 0%, #FAF7F2 100%)',
        'gradient-dawn': 'linear-gradient(135deg, #F5E8E0 0%, #FAF7F2 50%, #D8E8F4 100%)',
        'gradient-meadow': 'linear-gradient(to bottom, #E8F0E8 0%, #FAF7F2 60%, #EDE7DB 100%)',
      },
    },
  },
}
