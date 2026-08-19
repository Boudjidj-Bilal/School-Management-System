document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');

    if (!loginForm) return;

    // --- Récupération des traductions ---
    const msgErrorDefault = loginForm.dataset.msgErrorDefault || 'Erreur de connexion.';
    const msgErrorTech = loginForm.dataset.msgErrorTech || 'Une erreur est survenue. Veuillez réessayer.';

    loginForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        const loginUrl = loginForm.getAttribute('data-login-url');
        const successUrl = loginForm.getAttribute('data-success-url');

        loadingIndicator.classList.remove('hidden');
        messageBox.textContent = '';
        messageBox.className = 'text-sm font-medium';
        submitBtn.disabled = true;

        const username = usernameInput.value;
        const password = passwordInput.value;
        const csrfToken = document.querySelector('input[name="csrfmiddlewaretoken"]').value;

        // LA GÉOLOCALISATION A ÉTÉ ENTIÈREMENT SUPPRIMÉE D'ICI

        try {
            const response = await fetch(loginUrl, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({ 
                    username: username, 
                    password: password 
                    // latitude et longitude retirés
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                messageBox.textContent = data.message;
                messageBox.classList.remove('text-red-600');
                messageBox.classList.add('text-green-600');
                
                let targetUrl = data.redirect_url || successUrl;
                const urlObj = new URL(targetUrl, window.location.origin);
                
                window.location.href = urlObj.toString();

            } else {
                // Erreur métier : Utilisation du message envoyé par Python ou message d'erreur par défaut
                messageBox.textContent = data.message || msgErrorDefault;
                messageBox.classList.remove('text-green-600');
                messageBox.classList.add('text-red-600');
                loadingIndicator.classList.add('hidden');
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Erreur:', error);
            // Erreur technique : Utilisation du message traduit depuis le HTML
            messageBox.textContent = msgErrorTech;
            messageBox.classList.remove('text-green-600');
            messageBox.classList.add('text-red-600');
            loadingIndicator.classList.add('hidden');
            submitBtn.disabled = false;
        }
    });
});