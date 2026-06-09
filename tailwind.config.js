/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        verde: '#1B5E20', 'verde-m': '#2E7D32', 'verde-l': '#4CAF50', 'verde-pale': '#E8F5E9',
        rosso: '#B71C1C', 'rosso-m': '#C62828', 'rosso-l': '#EF5350', 'rosso-pale': '#FFEBEE',
        bianco: '#FFFFFF', 'bianco-w': '#F9F6F0', 'bianco-c': '#F0EBE0',
        nero: '#1A1A1A', 'nero-m': '#2D2D2D', grigio: '#757575', 'grigio-l': '#BDBDBD',
        oro: '#D4A843', 'oro-l': '#F0C040', 'hero-bg': '#0D1F0D',
      },
      fontFamily: {
        playfair: ['Playfair Display', 'serif'],
        cormorant: ['Cormorant Garamond', 'serif'],
        jost: ['Jost', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
