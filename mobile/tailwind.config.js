/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('nativewind/preset')],
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './constants/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        fitso: {
          bg: '#000000',
          surface: '#1C1C1E',
          surfaceAlt: '#121212',
          border: '#2C2C2E',
          label: '#A0A0A0',
          cta: '#E63946',
          ctaDark: '#B71C1C',
          cyan: '#00E5FF',
          yellow: '#FFD600',
          purple: '#B388FF',
          energy: '#E63946',
          recovery: '#00E5FF',
          recoveryAlt: '#FFD600',
          sleep: '#B388FF',
          health: '#00E5FF',
          white: '#FFFFFF',
        },
      },
      borderRadius: {
        '2.5xl': '1.5rem',
        '3xl': '1.5rem',
        '4xl': '1.5rem',
      },
      fontFamily: {
        sans: ['System', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
