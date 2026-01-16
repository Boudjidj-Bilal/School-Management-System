/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
      './templates/*.html',
      './**/templates/**/*.html',
      './**/forms.py', 
      './static/js/**/*.js',
      './static/js/*.js',
  ],
  theme: {
    extend: {
      // AJOUT DES COULEURS PERSONNALISÉES ICI
      colors: {
        'primary-blue': '#1e40af',  // Le bleu foncé/violet que tu utilisais
        'primary-light': '#eff6ff', // Le fond bleu très clair
        'accent-green': '#10b981',  // Le vert pour les messages de succès
      }
    },
  },
  plugins: [],
}