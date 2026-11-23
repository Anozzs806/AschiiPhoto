/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: '#FAFAFA',
          white: '#FFFFFF',
          card: '#FFFFFF',
          border: '#E5E5E5',
          borderDark: '#D4D4D4',
          text: '#171717',
          muted: '#737373',
          dim: '#A3A3A3',
          dark: '#0A0A0A',
          cameraBg: '#080808',
        }
      },
      fontFamily: {
        sans: ['"Inter"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"Fira Code"', '"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      animation: {
        'blink': 'blink 1.2s step-end infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        }
      }
    },
  },
  plugins: [],
}
