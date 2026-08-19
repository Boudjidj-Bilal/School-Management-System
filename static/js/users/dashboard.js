document.addEventListener('DOMContentLoaded', () => {
    
    // Récupération sécurisée du Token CSRF depuis le champ caché
    const csrfTokenInput = document.getElementById('csrf-token');
    const CSRF_TOKEN = csrfTokenInput ? csrfTokenInput.value : '';

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