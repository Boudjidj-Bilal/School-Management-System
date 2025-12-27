document.addEventListener('DOMContentLoaded', () => {
    const passwordConfirmForm = document.getElementById('passwordConfirmForm');
    const newPasswordInput = document.getElementById('new_password');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // CONFIGURATION : URL de l'API
    // L'URL de confirmation contient des tokens dynamiques (uidb64/token).
    // fetch(window.location.href) est le moyen le plus sûr d'envoyer le POST à la même URL que celle affichée.
    const API_URL = window.location.href; 

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
            const response = await fetch(API_URL, {
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
                    // Redirection vers la page de connexion après un succès (avec un délai pour lire le message)
                    setTimeout(() => {
                        window.location.href = '/'; 
                    }, 1500);
                } else {
                    messageBox.textContent = data.message || 'Erreur lors de la mise à jour du mot de passe.';
                    messageBox.classList.remove('text-green-600');
                    messageBox.classList.add('text-red-600');
                }
            } else {
                // Erreur technique (HTML renvoyé)
                const textResponse = await response.text();
                console.error("Réponse serveur invalide (non-JSON):", textResponse);
                throw new Error("Le serveur a renvoyé une page HTML au lieu du JSON. Vérifiez la console pour les détails.");
            }

        } catch (error) {
            console.error('Erreur technique:', error);
            messageBox.textContent = 'Une erreur de connexion est survenue. Veuillez réessayer.';
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