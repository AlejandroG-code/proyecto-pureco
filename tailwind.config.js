/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'brand-blue': '#d0e6ff',
        'brand-dark': '#004b93',
        'brand-green': '#00b050',
      },
      fontFamily: {
        'sans': ['Nunito', 'sans-serif'], // Similar to the rounded font in the mockup
      }
    },
  },
  plugins: [],
}
