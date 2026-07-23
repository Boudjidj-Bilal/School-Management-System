document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');

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
        
        let latitude = null;
        let longitude = null;

        if (navigator.geolocation) {
            await new Promise((resolve) => {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        latitude = position.coords.latitude;
                        longitude = position.coords.longitude;
                        console.log("GPS récupéré avec succès :", latitude, longitude);
                        resolve();
                    },
                    (error) => {
                        console.warn("Échec de la géolocalisation (Code " + error.code + ") :", error.message);
                        resolve();
                    },
                    { 
                        timeout: 10000,          // 10 secondes max
                        maximumAge: Infinity,    // Accepte la position en cache mémorisée par le navigateur
                        enableHighAccuracy: false // Plus rapide et moins strict en local
                    }
                );
            });
        }

        try {
            const response = await fetch(loginUrl, { 
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({ 
                    username: username, 
                    password: password, 
                    latitude: latitude, 
                    longitude: longitude 
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                messageBox.textContent = data.message;
                messageBox.classList.remove('text-red-600');
                messageBox.classList.add('text-green-600');
                
                const targetUrl = data.redirect_url || successUrl;
                window.location.href = targetUrl;

            } else {
                messageBox.textContent = data.message || 'Erreur de connexion.';
                messageBox.classList.remove('text-green-600');
                messageBox.classList.add('text-red-600');
                loadingIndicator.classList.add('hidden');
                submitBtn.disabled = false;
            }
        } catch (error) {
            console.error('Erreur:', error);
            messageBox.textContent = 'Une erreur est survenue. Veuillez réessayer.';
            messageBox.classList.remove('text-green-600');
            messageBox.classList.add('text-red-600');
            loadingIndicator.classList.add('hidden');
            submitBtn.disabled = false;
        }
    });
});