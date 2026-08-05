document.addEventListener('DOMContentLoaded', () => {
    const passwordConfirmForm = document.getElementById('passwordConfirmForm');
    const newPasswordInput = document.getElementById('new_password');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');

    if (!passwordConfirmForm) return;

    // Récupération des URLs
    const apiConfirmUrl = passwordConfirmForm.getAttribute('data-confirm-url');
    const successUrl = passwordConfirmForm.getAttribute('data-success-url');

    // --- MODIFICATION : Récupération des traductions ---
    const msgErrorDefault = passwordConfirmForm.dataset.msgErrorDefault || 'Erreur lors de la mise à jour du mot de passe.';
    const msgErrorTech = passwordConfirmForm.dataset.msgErrorTech || 'Une erreur de connexion est survenue. Veuillez réessayer.';

    passwordConfirmForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // 1. UI : Afficher chargement et désactiver bouton
        loadingIndicator.classList.remove('hidden');
        messageBox.textContent = '';
        messageBox.className = 'text-sm font-medium';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

        const newPassword = newPasswordInput.value;
        
        // 2. Récupérer le token CSRF depuis le formulaire
        const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
        const csrfToken = csrfInput ? csrfInput.value : '';
        
        try {
            // Utilisation de l'URL fournie par le template (request.path)
            const response = await fetch(apiConfirmUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({ new_password: newPassword })
            });

            // 3. Vérifier le type de contenu avant de parser le JSON
            const contentType = response.headers.get("content-type");
            
            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();

                if (response.ok && data.success) {
                    messageBox.textContent = data.message;
                    messageBox.classList.remove('text-red-600');
                    messageBox.classList.add('text-green-600');
                    
                    // On utilise l'URL de login définie par Django, au lieu de '/' en dur.
                    setTimeout(() => {
                        window.location.href = successUrl; 
                    }, 1500);
                } else {
                    // Utilisation du message traduit par défaut
                    messageBox.textContent = data.message || msgErrorDefault;
                    messageBox.classList.remove('text-green-600');
                    messageBox.classList.add('text-red-600');
                }
            } else {
                // Erreur technique (HTML renvoyé)
                const textResponse = await response.text();
                console.error("Réponse serveur invalide (non-JSON):", textResponse);
                throw new Error("Le serveur a renvoyé une page HTML invalide.");
            }

        } catch (error) {
            console.error('Erreur technique:', error);
            // Utilisation du message traduit pour les erreurs techniques
            messageBox.textContent = msgErrorTech;
            messageBox.classList.remove('text-green-600');
            messageBox.classList.add('text-red-600');
        } finally {
            // 4. Masquer l'indicateur de chargement et réactiver le bouton
            loadingIndicator.classList.add('hidden');
            submitBtn.disabled = false;
            submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    });
});