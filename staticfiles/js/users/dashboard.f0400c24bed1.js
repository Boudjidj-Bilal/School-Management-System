document.addEventListener('DOMContentLoaded', () => {
    
    // Récupération de la configuration (URLs, Token) injectée depuis le HTML
    // Cela remplace les balises {% url %} et {{ csrf_token }}
    const CONFIG = window.DASHBOARD_CONFIG || {};
    const CSRF_TOKEN = CONFIG.csrfToken;

    // --- 1. GESTION SÉLECTEUR D'ÉCOLE (SuperAdmin) ---
    const schoolSelector = document.getElementById('school-selector');
    if (schoolSelector) {
        schoolSelector.addEventListener('change', async (event) => {
            const schoolId = event.target.value;
            
            // Feedback visuel : on désactive le select pendant le chargement
            schoolSelector.disabled = true;
            schoolSelector.classList.add('opacity-50', 'cursor-wait');

            try {
                const response = await fetch(CONFIG.selectSchoolUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CSRF_TOKEN,
                    },
                    body: JSON.stringify({ school_id: schoolId })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Rechargement pour appliquer le contexte de l'école
                    window.location.reload();
                } else {
                    alert("Erreur lors du changement d'école : " + result.message);
                    // En cas d'erreur, on réactive le select
                    schoolSelector.disabled = false;
                    schoolSelector.classList.remove('opacity-50', 'cursor-wait');
                }
            } catch (error) {
                console.error("Erreur:", error);
                alert("Erreur de communication avec le serveur.");
                schoolSelector.disabled = false;
                schoolSelector.classList.remove('opacity-50', 'cursor-wait');
            }
        });
    }

    // --- 2. GESTION SÉLECTEUR D'ENFANT (Parent) ---
    const childSelector = document.getElementById('child-selector');
    if (childSelector) {
        childSelector.addEventListener('change', async (event) => {
            const childId = event.target.value;
            
            // Feedback visuel
            childSelector.disabled = true;
            childSelector.classList.add('opacity-50', 'cursor-wait');

            try {
                const response = await fetch(CONFIG.selectChildUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CSRF_TOKEN,
                    },
                    body: JSON.stringify({ child_id: childId })
                });
                
                const result = await response.json();
                
                if (result.success) {
                    // Rechargement pour appliquer le contexte de l'enfant
                    window.location.reload();
                } else {
                    alert("Erreur : " + result.message);
                    // En cas d'erreur, on réactive
                    childSelector.disabled = false;
                    childSelector.classList.remove('opacity-50', 'cursor-wait');
                }
            } catch (error) {
                console.error("Erreur:", error);
                alert("Erreur de communication avec le serveur.");
                childSelector.disabled = false;
                childSelector.classList.remove('opacity-50', 'cursor-wait');
            }
        });
    }
});