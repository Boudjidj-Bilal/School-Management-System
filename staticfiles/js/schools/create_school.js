document.addEventListener('DOMContentLoaded', () => {
    const createSchoolForm = document.getElementById('createSchoolForm');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // 💡 NOUVEAU : Récupération du jeton CSRF directement à partir du DOM (la méthode la plus fiable)
    const CSRF_TOKEN = document.querySelector('[name=csrfmiddlewaretoken]').value; 
    // La fonction getCookie n'est plus nécessaire et a été supprimée.

    createSchoolForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        // Afficher l'indicateur de chargement et désactiver le bouton
        loadingIndicator.classList.remove('hidden');
        messageBox.textContent = '';
        messageBox.className = 'text-sm font-medium text-center';
        submitBtn.disabled = true;

        // Collecte des données du formulaire (aucun changement ici)
        const schoolName = document.getElementById('schoolName').value;
        const schoolAddress = document.getElementById('schoolAddress').value;
        const schoolType = document.getElementById('schoolType').value;
        const schoolEmail = document.getElementById('schoolEmail').value;
        const schoolPhone = document.getElementById('schoolPhone').value;
        
        const principalFirstName = document.getElementById('principalFirstName').value;
        const principalLastName = document.getElementById('principalLastName').value;
        const principalEmail = document.getElementById('principalEmail').value;
        const principalGender = document.getElementById('principalGender').value;
        const principalBirthDate = document.getElementById('principalBirthDate').value;
        const principalAddress = document.getElementById('principalAddress').value;

        // Préparation des données pour la requête (aucun changement ici)
        const data = {
            school_data: {
                name: schoolName,
                address: schoolAddress,
                type: schoolType,
                email: schoolEmail,
                phone_number: schoolPhone
            },
            principal_data: {
                first_name: principalFirstName,
                last_name: principalLastName,
                email: principalEmail,
                gender: principalGender,
                birth_date: principalBirthDate,
                address: principalAddress
            }
        };

        try {
            const response = await fetch('/schools/create/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Utilisation du jeton directement récupéré (CSRF_TOKEN)
                    'X-CSRFToken': CSRF_TOKEN, 
                },
                body: JSON.stringify(data)
            });

            // 💡 AMÉLIORATION : Gestion des statuts HTTP (403, 500, etc.)
            if (!response.ok) {
                // Tente de lire le JSON pour obtenir un message d'erreur du serveur
                let errorMessage;
                try {
                    const errorJson = await response.json();
                    errorMessage = errorJson.message || `Erreur serveur (Status: ${response.status}).`;
                } catch (e) {
                    // Si ce n'est pas du JSON (par exemple, un HTML de 403/Redirection)
                    errorMessage = response.status === 403 
                        ? "Accès refusé. Vérifiez vos droits (SuperAdmin)."
                        : `Erreur inattendue (Status: ${response.status}).`;
                }

                messageBox.textContent = errorMessage;
                messageBox.classList.remove('text-green-600');
                messageBox.classList.add('text-red-600');
                // Lance une erreur pour passer au bloc catch si vous voulez loguer
                throw new Error(`HTTP Error Status: ${response.status}`);
            }

            // Si response.ok est vrai (Status 200), on traite la réponse JSON
            const result = await response.json();

            if (result.success) {
                messageBox.textContent = result.message;
                messageBox.classList.remove('text-red-600');
                messageBox.classList.add('text-green-600');
                createSchoolForm.reset();
            } else {
                messageBox.textContent = result.message || 'Erreur lors de la création.';
                messageBox.classList.remove('text-green-600');
                messageBox.classList.add('text-red-600');
            }
        } catch (error) {
            // Le bloc catch ne sera exécuté que si une erreur réseau survient ou si on 'throw' une erreur dans le try
            if (!messageBox.textContent) { // Pour ne pas écraser les messages d'erreur du serveur
                 messageBox.textContent = 'Une erreur réseau ou interne est survenue. Veuillez réessayer.';
                 messageBox.classList.remove('text-green-600');
                 messageBox.classList.add('text-red-600');
            }
            console.error('Erreur:', error);
        } finally {
            // Masquer l'indicateur de chargement et réactiver le bouton
            loadingIndicator.classList.add('hidden');
            submitBtn.disabled = false;
        }
    });
});