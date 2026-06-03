/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        r: { DEFAULT: '#C41E3A', dark: '#9B1530', light: '#FF3B5C' },
        g: { DEFAULT: '#2D7A3A', dark: '#1A5C28', light: '#4CAF60' },
        gold: { DEFAULT: '#D4A843', light: '#F0C060' },
        cream: '#FFFDF8',
        warm: '#FFF5E6',
        dark: { DEFAULT: '#1A0A0A', 2: '#2C1010' },
      },
      fontFamily: {
        display: ["'Playfair Display'", 'serif'],
        body: ["'Jost'", 'sans-serif'],
        italic: ["'Cormorant Garamond'", 'serif'],
      },
    },
  },
  plugins: [],
}
