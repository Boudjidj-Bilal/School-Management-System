document.addEventListener('DOMContentLoaded', () => {
    
    // Récupération sécurisée du Token CSRF depuis le champ caché
    const csrfTokenInput = document.getElementById('csrf-token');
    const CSRF_TOKEN = csrfTokenInput ? csrfTokenInput.value : '';

    // --- 1. GESTION SÉLECTEUR D'ÉCOLE (SuperAdmin) ---
    const schoolSelector = document.getElementById('school-selector');
    if (schoolSelector) {
        // NOUVEAU : Récupération des traductions depuis les data-attributes du select
        const msgErrorSchool = schoolSelector.dataset.msgErrorSchool || "Erreur lors du changement d'école :";
        const msgErrorNetwork = schoolSelector.dataset.msgErrorNetwork || "Erreur de communication avec le serveur.";

        schoolSelector.addEventListener('change', async (event) => {
            const schoolId = event.target.value;
            // Récupération de l'URL depuis l'attribut data-url
            const url = schoolSelector.getAttribute('data-url');
            
            // Feedback visuel : on désactive le select pendant le chargement
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
                    // Rechargement pour appliquer le contexte de l'école
                    window.location.reload();
                } else {
                    // Utilisation du texte traduit
                    alert(`${msgErrorSchool} ${result.message}`);
                    // En cas d'erreur, on réactive le select
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

    // --- 2. GESTION SÉLECTEUR D'ENFANT (Parent) ---
    const childSelector = document.getElementById('child-selector');
    if (childSelector) {
        // NOUVEAU : Récupération des traductions depuis les data-attributes du select
        const msgErrorChild = childSelector.dataset.msgErrorChild || "Erreur :";
        const msgErrorNetwork = childSelector.dataset.msgErrorNetwork || "Erreur de communication avec le serveur.";

        childSelector.addEventListener('change', async (event) => {
            const childId = event.target.value;
            // Récupération de l'URL depuis l'attribut data-url
            const url = childSelector.getAttribute('data-url');
            
            // Feedback visuel
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
                    // Rechargement pour appliquer le contexte de l'enfant
                    window.location.reload();
                } else {
                    // Utilisation du texte traduit
                    alert(`${msgErrorChild} ${result.message}`);
                    // En cas d'erreur, on réactive
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