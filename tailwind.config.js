/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // VYRO VR brand palette — adjust to final brand guide.
        brand: {
          50: '#eef6ff',
          100: '#d9eaff',
          200: '#bcdaff',
          300: '#8ec3ff',
          400: '#59a1ff',
          500: '#327dff',
          600: '#1b5cf5',
          700: '#1647e1',
          800: '#193bb6',
          900: '#1a378f',
          950: '#142357'
        },
        surface: {
          DEFAULT: '#0e1118',
          raised: '#161b26',
          border: '#252c3a'
        }
      }
    }
  },
  plugins: []
}
