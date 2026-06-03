/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
        thermal: ['"DM Mono"', '"JetBrains Mono"', 'Consolas', 'monospace']
      },
      colors: {
        ink: {
          950: '#080a12',
          900: '#0b0e17',
          850: '#0f131f',
          800: '#141a28',
          700: '#1c2435',
          600: '#283044',
          500: '#3a4456'
        },
        brand: {
          DEFAULT: '#6366f1',
          50: '#eef2ff',
          100: '#e0e7ff',
          200: '#c7d2fe',
          300: '#a5b4fc',
          400: '#818cf8',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
          800: '#3730a3',
          900: '#312e81'
        },
        accent: {
          green: '#22c55e',
          amber: '#f59e0b',
          red: '#ef4444',
          cyan: '#06b6d4',
          violet: '#8b5cf6'
        }
      },
      boxShadow: {
        glass: '0 8px 32px rgba(0, 0, 0, 0.37)',
        'glass-sm': '0 4px 16px rgba(0, 0, 0, 0.25)',
        glow: '0 0 24px rgba(99, 102, 241, 0.35)'
      },
      backdropBlur: {
        xs: '2px'
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        'paper-feed': {
          '0%': { transform: 'translateY(-100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.8)', opacity: '0.8' },
          '100%': { transform: 'scale(2.4)', opacity: '0' }
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' }
        }
      },
      animation: {
        'fade-in': 'fade-in 0.35s ease-out',
        'paper-feed': 'paper-feed 0.6s cubic-bezier(0.22, 1, 0.36, 1)',
        'pulse-ring': 'pulse-ring 1.6s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        shimmer: 'shimmer 2s infinite'
      }
    }
  },
  plugins: []
}
