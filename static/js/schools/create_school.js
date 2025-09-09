document.addEventListener('DOMContentLoaded', () => {
    const createSchoolForm = document.getElementById('createSchoolForm');
    const submitBtn = document.getElementById('submitBtn');
    const messageBox = document.getElementById('messageBox');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // Fonction pour obtenir le jeton CSRF
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    createSchoolForm.addEventListener('submit', async function(event) {
        event.preventDefault();

        // Afficher l'indicateur de chargement et désactiver le bouton
        loadingIndicator.classList.remove('hidden');
        messageBox.textContent = '';
        messageBox.className = 'text-sm font-medium text-center';
        submitBtn.disabled = true;

        // Collecte des données du formulaire
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

        // Préparation des données pour la requête
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
                    'X-CSRFToken': getCookie('csrftoken'),
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                messageBox.textContent = result.message;
                messageBox.classList.remove('text-red-600');
                messageBox.classList.add('text-green-600');
                // Vous pouvez réinitialiser le formulaire ici si vous le souhaitez
                createSchoolForm.reset();
            } else {
                messageBox.textContent = result.message || 'Erreur lors de la création.';
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
