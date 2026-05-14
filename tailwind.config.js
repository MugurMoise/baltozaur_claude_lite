/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        body: ['"DM Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        lake: {
          50: '#e0f7ff',
          100: '#b3edff',
          200: '#66d9ff',
          300: '#1ac6ff',
          400: '#00b3f0',
          500: '#0099cc',
          600: '#007aa3',
          700: '#005c7a',
          800: '#003d52',
          900: '#001f29',
        },
        mud: {
          900: '#0a0d0f',
          800: '#0f1419',
          700: '#151c24',
          600: '#1c2630',
          500: '#243040',
        },
      },
      backgroundImage: {
        'mesh-dark': 'radial-gradient(at 20% 30%, #001f29 0px, transparent 50%), radial-gradient(at 80% 70%, #003d52 0px, transparent 50%)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.4s ease-out forwards',
        'ripple': 'ripple 2s ease-out infinite',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
        slideUp: { from: { opacity: '0', transform: 'translateY(16px)' }, to: { opacity: '1', transform: 'translateY(0)' } },
        ripple: {
          '0%': { transform: 'scale(1)', opacity: '0.4' },
          '100%': { transform: 'scale(2.5)', opacity: '0' },
        },
      },
    },
  },
  plugins: [],
}
