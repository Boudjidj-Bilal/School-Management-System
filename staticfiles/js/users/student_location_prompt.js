document.addEventListener('DOMContentLoaded', () => {
    // 1. Récupération des éléments du DOM
    const btnGeolocate = document.getElementById('btn-geolocate');
    const btnSkip = document.getElementById('btn-skip');
    const feedbackBox = document.getElementById('feedback-box');
    const configData = document.getElementById('geo-config');
    const csrfTokenInput = document.querySelector('input[name="csrfmiddlewaretoken"]');

    if (!btnGeolocate || !configData || !csrfTokenInput) return;

    const CSRF_TOKEN = csrfTokenInput.value;

    // 2. Récupération de la configuration et des traductions depuis le HTML
    const apiUrl = configData.getAttribute('data-api-url');
    const dashboardUrl = configData.getAttribute('data-dashboard-url');
    const msgLoading = configData.getAttribute('data-msg-loading');
    const msgSuccess = configData.getAttribute('data-msg-success');
    const msgDenied = configData.getAttribute('data-msg-denied');
    const msgTimeout = configData.getAttribute('data-msg-timeout');
    const msgUnsupported = configData.getAttribute('data-msg-unsupported');
    const msgServerError = configData.getAttribute('data-msg-server-error');

    // 3. Fonction pour afficher les messages à l'utilisateur
    const showFeedback = (message, type) => {
        feedbackBox.classList.remove('hidden', 'bg-red-50', 'text-red-600', 'border-red-200', 'bg-green-50', 'text-green-600', 'border-green-200', 'bg-blue-50', 'text-blue-600', 'border-blue-200');
        feedbackBox.textContent = message;

        if (type === 'error') {
            feedbackBox.classList.add('bg-red-50', 'text-red-600', 'border-red-200');
        } else if (type === 'success') {
            feedbackBox.classList.add('bg-green-50', 'text-green-600', 'border-green-200');
        } else if (type === 'loading') {
            feedbackBox.classList.add('bg-blue-50', 'text-blue-600', 'border-blue-200');
        }
    };

    // 4. Fonction pour bloquer/débloquer les boutons pendant le chargement
    const setLoadingState = (isLoading) => {
        if (isLoading) {
            btnGeolocate.disabled = true;
            btnGeolocate.classList.add('opacity-75', 'cursor-not-allowed');
            // Remplace l'icône par un spinner
            btnGeolocate.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> ${msgLoading}`;
            btnSkip.classList.add('pointer-events-none', 'opacity-50');
        } else {
            btnGeolocate.disabled = false;
            btnGeolocate.classList.remove('opacity-75', 'cursor-not-allowed');
            // Remet l'icône originale (on récupère le texte original depuis le bouton lui-même dans le html si besoin, ou on hardcode l'icône)
            btnGeolocate.innerHTML = `<i class="fas fa-location-arrow me-2"></i> ${btnGeolocate.textContent.trim()}`;
            btnSkip.classList.remove('pointer-events-none', 'opacity-50');
        }
    };

    // 5. L'événement principal au clic
    btnGeolocate.addEventListener('click', async () => {
        if (!navigator.geolocation) {
            showFeedback(msgUnsupported, 'error');
            return;
        }

        setLoadingState(true);
        showFeedback(msgLoading, 'loading');

        // Appel natif du GPS
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                // SUCCÈS GPS : On a les coordonnées
                const latitude = position.coords.latitude;
                const longitude = position.coords.longitude;

                try {
                    // Envoi au backend Django
                    const response = await fetch(apiUrl, {
                        method: 'POST',
                        credentials: 'same-origin', // Autorise le cookie CSRF et Session
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': CSRF_TOKEN,
                        },
                        body: JSON.stringify({ latitude: latitude, longitude: longitude })
                    });

                    // Sécurité anti-crash
                    const contentType = response.headers.get("content-type");
                    if (!contentType || !contentType.includes("application/json")) {
                        throw new Error("Invalid format");
                    }

                    const result = await response.json();

                    if (result.success) {
                        // SUCCÈS TOTAL : Enregistré en base
                        showFeedback(msgSuccess, 'success');
                        
                        // Redirection automatique après une petite pause (UX fluide)
                        setTimeout(() => {
                            window.location.href = dashboardUrl;
                        }, 1000);
                        
                    } else {
                        // Erreur renvoyée par le backend (ex: compte inactif)
                        showFeedback(result.message || msgServerError, 'error');
                        setLoadingState(false);
                    }

                } catch (error) {
                    console.error("Erreur serveur :", error);
                    showFeedback(msgServerError, 'error');
                    setLoadingState(false);
                }
            },
            (error) => {
                // ERREUR GPS : L'utilisateur a refusé ou problème réseau
                setLoadingState(false);
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        // L'élève a cliqué sur "Bloquer"
                        showFeedback(msgDenied, 'error');
                        break;
                    case error.POSITION_UNAVAILABLE:
                    case error.TIMEOUT:
                        // Pas de signal ou délai dépassé
                        showFeedback(msgTimeout, 'error');
                        break;
                    default:
                        showFeedback(msgServerError, 'error');
                        break;
                }
            },
            {
                timeout: 10000,            // 10 secondes pour trouver le signal
                maximumAge: 0,             // CORRECTIF : on force la vraie position actuelle
                enableHighAccuracy: true   // On force la puce GPS pour plus de précision
            }
        );
    });
});