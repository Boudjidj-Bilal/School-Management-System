document.addEventListener('DOMContentLoaded', function() {
    // Sélectionne tous les boutons d'onglets
    const tabButtons = document.querySelectorAll('[data-action="switch-term"]');
    
    tabButtons.forEach(button => {
        button.addEventListener('click', function() {
            // 1. Gestion visuelle des boutons (Onglets)
            // Désactive tous les boutons (remet le style gris par défaut)
            tabButtons.forEach(btn => {
                btn.classList.remove('border-indigo-500', 'text-indigo-600');
                btn.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            
            // Active le bouton cliqué (style indigo)
            this.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            this.classList.add('border-indigo-500', 'text-indigo-600');
            
            // 2. Gestion de l'affichage du contenu
            const targetSelector = this.dataset.target; // ex: #term-1
            const targetContent = document.querySelector(targetSelector);
            
            if (targetContent) {
                // Masque tous les blocs de contenu de trimestre
                document.querySelectorAll('.term-content').forEach(content => {
                    content.classList.add('hidden');
                });
                
                // Affiche le contenu correspondant à l'onglet cliqué
                targetContent.classList.remove('hidden');
            }
        });
    });
});