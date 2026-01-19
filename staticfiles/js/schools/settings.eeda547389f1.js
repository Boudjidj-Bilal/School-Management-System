/**
 * Gestion des paramètres de l'école.
 * - Mise à jour dynamique du code couleur lors de la sélection.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Sélecteur pour l'input de type couleur généré par Django
    // (Django utilise généralement <input type="color"> pour les ColorField)
    const colorInput = document.querySelector('input[type="color"]');
    const colorCode = document.getElementById('color-code');
    
    if(colorInput && colorCode) {
        // Initialisation (au cas où le navigateur garde une valeur différente du HTML)
        colorCode.textContent = colorInput.value;

        // Mise à jour en temps réel
        colorInput.addEventListener('input', (e) => {
            // Affiche le code HEX (ex: #4f46e5) à côté du sélecteur
            colorCode.textContent = e.target.value;
        });
    }
});