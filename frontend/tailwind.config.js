/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        aura: {
          bg: '#08090A',
          panel: '#0E0F11',
          surface: '#141519',
          hover: '#1A1B20',
          border: '#222228',
          'border-hi': '#333340',
          text: '#E8E8EC',
          'text-dim': '#9090A0',
          'text-muted': '#555566',
          cyan: '#00D4FF',
          green: '#00E676',
          red: '#FF3B30',
          amber: '#FFB300',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      }
    },
  },
  plugins: [],
}
