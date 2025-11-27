document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('resetForm');
    const usernameInput = document.getElementById('username');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // CONFIGURATION : URL de l'API
    // [CORRECTION] L'URL doit correspondre à votre urls.py.
    // Votre vue gère le POST sur la même URL que l'affichage : '/users/password-reset/'
    // Nous retirons '/api/' qui n'existe pas dans vos routes.
    const API_URL = '/password-reset/'; 

    resetForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // 1. UI : Afficher chargement et désactiver bouton
        loadingIndicator.classList.remove('hidden');
        messageBox.textContent = '';
        messageBox.className = 'text-sm font-medium';
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-50', 'cursor-not-allowed');

        const username = usernameInput.value;
        
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
                body: JSON.stringify({ username })
            });

            // 3. Vérifier le type de contenu avant de parser le JSON
            const contentType = response.headers.get("content-type");
            
            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();

                if (response.ok && data.success) {
                    // Succès : Affichage en vert
                    messageBox.textContent = data.message;
                    messageBox.classList.remove('text-red-600');
                    messageBox.classList.add('text-green-600');
                    resetForm.reset(); // Vider le formulaire
                } else {
                    // Erreur métier : Affichage en rouge
                    messageBox.textContent = data.message || 'Erreur lors de l\'envoi du lien.';
                    messageBox.classList.remove('text-green-600');
                    messageBox.classList.add('text-red-600');
                }
            } else {
                // Erreur technique (HTML renvoyé)
                const textResponse = await response.text();
                console.error("Réponse serveur invalide (non-JSON):", textResponse);
                throw new Error("Le serveur a renvoyé une page HTML (probablement une erreur 404 ou 500). Vérifiez l'URL et les logs serveur.");
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