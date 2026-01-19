/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./templates/**/*.html",
    "./**/templates/**/*.html",
    "./**/*.html",
    "./**/*.js",
    "./**/*.py",
  ],
  theme: {
    extend: {
      colors: {
        'primary-blue': '#1e40af',
        'primary-light': '#eff6ff',
        'accent-green': '#10b981',
      }
    },
  },
  plugins: [],
}