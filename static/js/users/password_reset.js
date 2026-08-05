document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('resetForm');
    const usernameInput = document.getElementById('username');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    // --- MODIFICATION : Récupération dynamique de l'URL et des traductions ---
    const apiResetUrl = resetForm ? resetForm.getAttribute('data-reset-url') : null;
    const msgErrorDefault = resetForm ? resetForm.dataset.msgErrorDefault : "Erreur lors de l'envoi du lien.";
    const msgErrorTech = resetForm ? resetForm.dataset.msgErrorTech : "Une erreur est survenue. Veuillez réessayer.";

    if (resetForm) {
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
                // Vérification de sécurité avant l'envoi
                if (!apiResetUrl) {
                    throw new Error("L'URL de réinitialisation est introuvable dans le DOM.");
                }

                const response = await fetch(apiResetUrl, {
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
                        // Succès : Affichage en vert (data.message est déjà traduit par le backend Python)
                        messageBox.textContent = data.message;
                        messageBox.classList.remove('text-red-600');
                        messageBox.classList.add('text-green-600');
                        resetForm.reset(); // Vider le formulaire
                    } else {
                        // Erreur métier : Affichage en rouge
                        messageBox.textContent = data.message || msgErrorDefault;
                        messageBox.classList.remove('text-green-600');
                        messageBox.classList.add('text-red-600');
                    }
                } else {
                    // Erreur technique (HTML renvoyé)
                    const textResponse = await response.text();
                    console.error("Réponse serveur invalide (non-JSON):", textResponse);
                    throw new Error("Le serveur a renvoyé une réponse invalide.");
                }

            } catch (error) {
                console.error('Erreur technique:', error);
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
    }
});