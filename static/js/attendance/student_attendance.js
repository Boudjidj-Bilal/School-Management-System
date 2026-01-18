/**
 * student_attendance.js
 * Gestion de l'affichage du tableau de bord élève (Navigation par onglets/Tabs)
 */

document.addEventListener('DOMContentLoaded', function() {
    
    // Sélection de tous les boutons de navigation (Onglets)
    const tabButtons = document.querySelectorAll('[data-action="switch-term"]');
    
    // Sélection de tous les contenus
    const contents = document.querySelectorAll('.term-content');

    if (tabButtons.length === 0) return;

    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 1. Désactiver visuellement tous les boutons
            tabButtons.forEach(btn => {
                // Classes "Actives" à retirer
                btn.classList.remove('border-indigo-500', 'text-indigo-600');
                
                // Classes "Inactives" à ajouter
                btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            
            // 2. Activer visuellement le bouton cliqué
            // Classes "Inactives" à retirer
            this.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            
            // Classes "Actives" à ajouter
            this.classList.add('border-indigo-500', 'text-indigo-600');
            
            // 3. Masquer tous les contenus
            contents.forEach(content => {
                content.classList.add('hidden');
            });

            // 4. Afficher le contenu ciblé
            const targetSelector = this.dataset.target; // ex: "#term-1"
            const targetContent = document.querySelector(targetSelector);
            
            if (targetContent) {
                targetContent.classList.remove('hidden');
                
                // Animation douce d'apparition (optionnel)
                targetContent.animate([
                    { opacity: 0, transform: 'translateY(10px)' },
                    { opacity: 1, transform: 'translateY(0)' }
                ], {
                    duration: 300,
                    easing: 'ease-out'
                });
            }
        });
    });
});