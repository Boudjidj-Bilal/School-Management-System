/**
 * Script de gestion pour la modification d'une école.
 * Gère la soumission du formulaire via AJAX.
 * VERSION SÉCURISÉE (CSP Compliant)
 */

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('edit-school-form');
    const submitBtn = document.getElementById('submit-btn');
    
    if (!form) return;

    // 1. Récupération de la configuration depuis le DOM (Data Attributes)
    const updateUrl = form.getAttribute('data-update-url');
    const dashboardUrl = form.getAttribute('data-dashboard-url');
    
    // Récupération du token CSRF interne au formulaire
    const csrfInput = form.querySelector('[name=csrfmiddlewaretoken]');
    const csrfToken = csrfInput ? csrfInput.value : '';

    if (!updateUrl) {
        console.error("Erreur configuration : URL de mise à jour manquante.");
        return;
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // 2. Feedback Visuel (Loading)
        const originalBtnContent = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-wait');
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Enregistrement...';

        // 3. Récupération des données
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
            // 4. Envoi de la requête
            const response = await fetch(updateUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                // 5. Succès
                submitBtn.innerHTML = '<i class="fas fa-check mr-2"></i> Succès !';
                submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
                submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');
                
                setTimeout(() => {
                    // Redirection vers le dashboard (ou l'URL fournie)
                    window.location.href = dashboardUrl || '/dashboard/';
                }, 500);

            } else {
                // 6. Erreur Métier (ex: email déjà pris)
                alert("Erreur : " + (result.message || "Une erreur est survenue."));
                resetButton(originalBtnContent);
            }

        } catch (error) {
            // 7. Erreur Technique
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