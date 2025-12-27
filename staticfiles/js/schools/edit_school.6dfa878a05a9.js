/**
 * Script de gestion pour la modification d'une école.
 * Gère la soumission du formulaire via AJAX.
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('edit-school-form');
    const submitBtn = document.getElementById('submit-btn');
    
    // Récupération de la configuration injectée dans le HTML
    const config = window.SCHOOL_CONFIG;

    if (!form || !config) {
        console.error("Formulaire ou configuration manquante.");
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 1. Feedback Visuel (Loading)
        const originalBtnContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-wait');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enregistrement...';

        // 2. Récupération des données
        // On construit l'objet manuellement pour gérer proprement les types (booléen)
        const formData = {
            name: document.getElementById('name').value.trim(),
            type: document.getElementById('type').value,
            email: document.getElementById('email').value.trim(),
            phone_number: document.getElementById('phone_number').value.trim(),
            address: document.getElementById('address').value.trim(),
            is_active: document.getElementById('is_active').checked // Important : true/false
        };

        try {
            // 3. Envoi de la requête
            const response = await fetch(config.updateUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': config.csrfToken
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                // 4. Succès
                // On utilise un petit délai pour que l'utilisateur voit le succès avant la redirection
                submitBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Succès !';
                submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                
                setTimeout(() => {
                    window.location.href = config.dashboardUrl;
                }, 500);

            } else {
                // 5. Erreur Métier (ex: email déjà pris)
                alert("Erreur : " + (result.message || "Une erreur est survenue."));
                resetButton(originalBtnContent);
            }

        } catch (error) {
            // 6. Erreur Technique
            console.error("Erreur technique:", error);
            alert("Erreur de communication avec le serveur.");
            resetButton(originalBtnContent);
        }
    });

    /**
     * Remet le bouton dans son état initial en cas d'erreur.
     */
    function resetButton(originalContent) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('opacity-75', 'cursor-wait');
        submitBtn.innerHTML = originalContent;
    }
});