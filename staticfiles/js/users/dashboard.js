document.addEventListener('DOMContentLoaded', () => {
    
    // Récupération sécurisée du Token CSRF depuis le champ caché
    const csrfTokenInput = document.getElementById('csrf-token');
    const CSRF_TOKEN = csrfTokenInput ? csrfTokenInput.value : '';

    // =====================================================================
    // --- 0. GÉOLOCALISATION POST-CONNEXION (Étudiants uniquement) ---
    // =====================================================================
    const urlParams = new URLSearchParams(window.location.search);
    const configDiv = document.getElementById('dashboard-config');
    
    // Vérification du drapeau de connexion et de la présence de la configuration HTML
    if (urlParams.get('geolocate') === '1' && configDiv) {
        
        // Récupération des traductions et de l'URL depuis le HTML
        const geoUrl = configDiv.getAttribute('data-geo-url');
        const msgGeoUnsupported = configDiv.getAttribute('data-msg-geo-unsupported');
        const msgGeoError = configDiv.getAttribute('data-msg-geo-error');
        const msgGeoFail = configDiv.getAttribute('data-msg-geo-fail');

        // 1. Nettoyage de l'URL (Magie silencieuse) : efface ?geolocate=1 de l'historique
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);

        // 2. Lancement de la géolocalisation
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;

                    try {
                        const response = await fetch(geoUrl, {
                            method: 'POST',
                            credentials: 'same-origin', // Autorise le transfert du cookie de session à Django
                            headers: {
                                'Content-Type': 'application/json',
                                'X-CSRFToken': CSRF_TOKEN,
                            },
                            body: JSON.stringify({ latitude: latitude, longitude: longitude })
                        });

                        // Vérifie que le serveur n'a pas planté en renvoyant du HTML (erreur 403, 500, etc.)
                        const contentType = response.headers.get("content-type");
                        if (!contentType || !contentType.includes("application/json")) {
                            throw new Error("Invalid response format (not JSON)");
                        }

                        const result = await response.json();
                        
                        // Les messages de succès ou d'erreur "métier" sont déjà traduits 
                        // côté Python dans votre vue `api_save_student_location` via _('...')
                        if (!result.success) {
                            console.warn(result.message);
                        }
                    } catch (error) {
                        // Utilisation du texte technique traduit depuis le HTML
                        console.error(`${msgGeoError}`, error);
                    }
                },
                (error) => {
                    // Utilisation du texte technique traduit depuis le HTML
                    console.warn(`${msgGeoFail} ${error.code}) :`, error.message);
                },
                {
                    timeout: 10000,
                    maximumAge: 0,             // Force le recalcul de la position réelle (Ignore le cache Android)
                    enableHighAccuracy: true   // Force l'utilisation de la puce GPS
                }
            );
        } else {
            console.warn(msgGeoUnsupported);
        }
    }


    // =====================================================================
    // --- 1. GESTION SÉLECTEUR D'ÉCOLE (SuperAdmin) ---
    // =====================================================================
    const schoolSelector = document.getElementById('school-selector');
    if (schoolSelector) {
        // Les textes sont bien récupérés dynamiquement depuis les data-attributs du sélecteur HTML
        const msgErrorSchool = schoolSelector.dataset.msgErrorSchool || "Error:";
        const msgErrorNetwork = schoolSelector.dataset.msgErrorNetwork || "Network error.";

        schoolSelector.addEventListener('change', async (event) => {
            const schoolId = event.target.value;
            const url = schoolSelector.getAttribute('data-url');
            
            schoolSelector.disabled = true;
            schoolSelector.classList.add('opacity-50', 'cursor-wait');

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CSRF_TOKEN,
                    },
                    body: JSON.stringify({ school_id: schoolId })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    window.location.reload();
                } else {
                    alert(`${msgErrorSchool} ${result.message}`);
                    schoolSelector.disabled = false;
                    schoolSelector.classList.remove('opacity-50', 'cursor-wait');
                }
            } catch (error) {
                console.error("Erreur:", error);
                alert(msgErrorNetwork);
                schoolSelector.disabled = false;
                schoolSelector.classList.remove('opacity-50', 'cursor-wait');
            }
        });
    }

    // =====================================================================
    // --- 2. GESTION SÉLECTEUR D'ENFANT (Parent) ---
    // =====================================================================
    const childSelector = document.getElementById('child-selector');
    if (childSelector) {
        // Les textes sont bien récupérés dynamiquement depuis les data-attributs du sélecteur HTML
        const msgErrorChild = childSelector.dataset.msgErrorChild || "Error:";
        const msgErrorNetwork = childSelector.dataset.msgErrorNetwork || "Network error.";

        childSelector.addEventListener('change', async (event) => {
            const childId = event.target.value;
            const url = childSelector.getAttribute('data-url');
            
            childSelector.disabled = true;
            childSelector.classList.add('opacity-50', 'cursor-wait');

            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CSRF_TOKEN,
                    },
                    body: JSON.stringify({ child_id: childId })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    window.location.reload();
                } else {
                    alert(`${msgErrorChild} ${result.message}`);
                    childSelector.disabled = false;
                    childSelector.classList.remove('opacity-50', 'cursor-wait');
                }
            } catch (error) {
                console.error("Erreur:", error);
                alert(msgErrorNetwork);
                childSelector.disabled = false;
                childSelector.classList.remove('opacity-50', 'cursor-wait');
            }
        });
    }
});