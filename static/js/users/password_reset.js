document.addEventListener('DOMContentLoaded', () => {
    const resetForm = document.getElementById('resetForm');
    const usernameInput = document.getElementById('username');
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
                // Does this cookie string begin with the name we want?
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }

    resetForm.addEventListener('submit', async function(event) {
        event.preventDefault();
        
        // Afficher l'indicateur de chargement et désactiver le bouton
        loadingIndicator.classList.remove('hidden');
        messageBox.textContent = '';
        messageBox.className = 'text-sm font-medium';
        submitBtn.disabled = true;

        const username = usernameInput.value;
        const csrfToken = getCookie('csrftoken');
        
        try {
            const response = await fetch('', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
                },
                body: JSON.stringify({ username })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                messageBox.textContent = data.message;
                messageBox.classList.remove('text-red-600');
                messageBox.classList.add('text-green-600');
            } else {
                messageBox.textContent = data.message || 'Erreur lors de l\'envoi du lien.';
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
