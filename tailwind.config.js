/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        terra:       '#C4622D',
        'terra-l':   '#E8845A',
        'terra-pale':'#F5E6DC',
        cream:       '#FBF6EE',
        warm:        '#F0E4D0',
        gold:        '#C9943A',
        'gold-l':    '#E8C06A',
        brown:       '#5C3317',
        'brown-d':   '#2A1200',
        green:       '#4A6741',
      },
      fontFamily: {
        display:    ["'Playfair Display'", 'serif'],
        cormorant:  ["'Cormorant Garamond'", 'serif'],
        body:       ["'Jost'", 'sans-serif'],
      },
    },
  },
  plugins: [],
}
