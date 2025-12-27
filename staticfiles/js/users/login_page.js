document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Afficher l'indicateur de chargement et désactiver le bouton
        loadingIndicator.classList.remove('hidden');
        messageBox.textContent = '';
        messageBox.className = 'text-sm font-medium';
        submitBtn.disabled = true;

        const username = usernameInput.value;
        const password = passwordInput.value;
        const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;
        
        try {
            const response = await fetch('', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({ username, password })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                messageBox.textContent = data.message;
                messageBox.classList.remove('text-red-600');
                messageBox.classList.add('text-green-600');
                // Rediriger après une connexion réussie
                window.location.href = '/dashboard';
            } else {
                messageBox.textContent = data.message || 'Erreur de connexion.';
                messageBox.classList.remove('text-green-600');
                messageBox.classList.add('text-red-600');
            }
        } catch (error) {
            console.error('Erreur:', error);
            messageBox.textContent = 'Une erreur est survenue. Veuillez réessayer.';
            messageBox.classList.remove('text-green-600');
            messageBox.classList.add('text-red-600');
        } finally {
            // Masquer l'indicateur de chargement et réactiver le bouton
            loadingIndicator.classList.add('hidden');
            submitBtn.disabled = false;
        }
    });
});
