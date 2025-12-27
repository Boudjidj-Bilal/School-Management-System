/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
      './templates/*.html',
      './**/templates/**/*.html',
      './**/forms.py', 
      './static/js/**/*.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}