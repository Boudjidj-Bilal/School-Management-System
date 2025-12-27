// Récupérer les éléments DOM
const statusContainer = document.getElementById('status-message-container');
const loadingSpinner = document.getElementById('loading-spinner');
const modal = document.getElementById('confirmation-modal');
const modalTitle = document.getElementById('modal-title');
const modalMessage = document.getElementById('modal-message');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');

// Récupérer les variables globales définies dans le template HTML
const termManageUrl = window.termManageUrl;
const csrftoken = window.csrftoken;

/**
 * Affiche un message de statut (Succès ou Erreur) dans la zone dédiée.
 * @param {string} message - Le contenu du message.
 * @param {boolean} isSuccess - Vrai pour Succès (vert), Faux pour Erreur (rouge).
 */
function displayMessage(message, isSuccess) {
    const colorClass = isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
    statusContainer.innerHTML = `
        <div class="p-3 rounded-lg ${colorClass}" role="alert">
            <span class="font-semibold">${isSuccess ? 'Succès' : 'Erreur'} :</span> ${message}
        </div>
    `;
    setTimeout(() => {
        statusContainer.innerHTML = '';
    }, 6000); // Masque le message après 6 secondes
}

/** Masque la modal de confirmation. */
function hideConfirmModal() {
    // Animation de sortie
    modal.querySelector('.transform').classList.remove('scale-100', 'opacity-100');
    modal.querySelector('.transform').classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        modalConfirmBtn.onclick = null; // Nettoyer l'écouteur après fermeture
    }, 300);
}
// Rendre la fonction globale pour qu'elle puisse être appelée depuis l'attribut onclick du bouton Annuler dans la modal
window.hideConfirmModal = hideConfirmModal;


/**
 * Affiche la modal de confirmation.
 * @param {number} levelId - ID du niveau concerné.
 * @param {string} action - 'advance' ou 'finish'.
 * @param {string} levelName - Nom convivial du niveau.
 * @param {number} currentCounter - Numéro du terme actuel ou suivant.
 */
function showConfirmModal(levelId, action, levelName, currentCounter) {
    let title, message;
    
    if (action === 'advance') {
        title = `Passer au Terme ${currentCounter}`;
        message = `Êtes-vous sûr de vouloir AVANCER le niveau ${levelName} au ${currentCounter}e terme/semestre ? Cette action est IRRÉVERSIBLE.`;
        modalConfirmBtn.className = 'py-2 px-4 rounded-lg text-white bg-green-600 hover:bg-green-700 transition duration-150 ease-in-out';
    } else if (action === 'finish') {
        title = `Terminer le Cycle`;
        message = `Êtes-vous sûr de vouloir TERMINER le cycle pour le niveau ${levelName} au terme ${currentCounter} ? Le niveau sera marqué comme COMPLÉTÉ pour l'année.`;
        modalConfirmBtn.className = 'py-2 px-4 rounded-lg text-white bg-red-600 hover:bg-red-700 transition duration-150 ease-in-out';
    } else {
        return;
    }

    modalTitle.textContent = title;
    modalMessage.innerHTML = message;
    
    // Attache l'événement de confirmation au bouton interne de la modal
    modalConfirmBtn.onclick = () => {
        hideConfirmModal();
        handleTermAction(levelId, action);
    };

    // Affichage de la modal avec animation
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.querySelector('.transform').classList.add('scale-100', 'opacity-100');
        modal.querySelector('.transform').classList.remove('scale-95', 'opacity-0');
    }, 10);
}


/**
 * Gère l'action d'avancement ou de finalisation d'un terme via AJAX.
 * @param {number} levelId - ID du niveau concerné.
 * @param {string} action - 'advance' ou 'finish'.
 */
async function handleTermAction(levelId, action) {
    loadingSpinner.classList.remove('hidden');

    const payload = {
        level_id: levelId,
        action: action,
    };

    try {
        const response = await fetch(termManageUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': csrftoken 
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        
        loadingSpinner.classList.add('hidden');

        if (response.ok && data.success) {
            displayMessage(data.message, true);
            // Recharger la page après succès pour mettre à jour le tableau
            setTimeout(() => window.location.reload(), 1500); 
        } else {
            const message = data.message || `Erreur inconnue (Statut: ${response.status}).`;
            displayMessage(message, false);
        }

    } catch (error) {
        loadingSpinner.classList.add('hidden');
        console.error('Erreur réseau ou JSON:', error);
        displayMessage('Erreur de connexion au serveur. Vérifiez votre réseau.', false);
    }
}


// --- Logique d'initialisation et d'écoute d'événements ---
document.addEventListener('DOMContentLoaded', () => {
    // Écouteur d'événement qui cible tous les boutons avec la classe 'term-action-btn'
    document.querySelectorAll('.term-action-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.currentTarget;
            
            // Extraction des données des attributs de données du bouton cliqué
            const levelId = parseInt(btn.dataset.levelId);
            const action = btn.dataset.action;
            const levelName = btn.dataset.levelName;
            // Utilise l'opérateur parseInt pour s'assurer que c'est un nombre
            const currentCounter = parseInt(btn.dataset.currentCounter); 

            // Vérifie que les données essentielles sont présentes avant d'ouvrir la modal
            if (levelId && action && levelName && !isNaN(currentCounter)) {
                showConfirmModal(levelId, action, levelName, currentCounter);
            }
        });
    });
});
