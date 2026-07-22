/**
 * Gestion de l'avancement des périodes (Trimestres/Semestres).
 * VERSION SÉCURISÉE (CSP Compliant).
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURATION & DONNÉES ---
    const container = document.getElementById('manage-term-container');
    const csrfInput = document.getElementById('csrf-token');
    
    // Récupération sécurisée depuis le DOM
    const API_URL = container ? container.getAttribute('data-api-url') : '';
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    // --- 2. ÉLÉMENTS DU DOM ---
    const statusContainer = document.getElementById('status-message-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Modal
    const modal = document.getElementById('confirmation-modal');
    const modalContent = document.getElementById('confirmation-modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm'); // Nouveau ID du HTML


    // --- 3. FONCTIONS D'AFFICHAGE ---

    /**
     * Affiche un message de statut (Succès ou Erreur) dans la zone dédiée.
     */
    function displayMessage(message, isSuccess) {
        const colorClass = isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        statusContainer.innerHTML = `
            <div class="p-3 rounded-lg ${colorClass}" role="alert">
                <span class="font-semibold">${isSuccess ? 'Succès' : 'Erreur'} :</span> ${message}
            </div>
        `;
        // Scroll vers le message
        statusContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
            statusContainer.innerHTML = '';
        }, 6000);
    }

    /**
     * Masque la modal de confirmation avec animation.
     */
    function hideConfirmModal() {
        if (!modalContent) return; // Sécurité si l'élément n'existe pas

        // Animation de sortie
        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            modal.classList.add('hidden');
            // Important : On nettoie l'événement onclick pour éviter les appels multiples ou incorrects
            // lors de la prochaine ouverture si on utilise la propriété .onclick
            modalConfirmBtn.onclick = null; 
        }, 300);
    }

    /**
     * Affiche la modal de confirmation et configure l'action.
     */
    function showConfirmModal(levelId, action, levelName, currentCounter) {
        let title, message;
        
        if (action === 'advance') {
            title = `Passer au Terme ${currentCounter}`;
            message = `Êtes-vous sûr de vouloir AVANCER le niveau ${levelName} au ${currentCounter}e terme ? Cette action est IRRÉVERSIBLE.`;
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
        
        // Configuration de l'action unique pour ce clic
        // On utilise la propriété .onclick ici pour écraser tout handler précédent (méthode simple et efficace pour ce cas)
        modalConfirmBtn.onclick = () => {
            hideConfirmModal();
            handleTermAction(levelId, action);
        };

        // Affichage de la modal avec animation
        modal.classList.remove('hidden');
        // Petit délai pour permettre au navigateur de rendre la classe hidden enlevée avant de lancer l'anim CSS
        setTimeout(() => {
            if (modalContent) {
                modalContent.classList.add('scale-100', 'opacity-100');
                modalContent.classList.remove('scale-95', 'opacity-0');
            }
        }, 10);
    }


    // --- 4. GESTION API ---

    /**
     * Gère l'action d'avancement ou de finalisation d'un terme via AJAX.
     */
    async function handleTermAction(levelId, action) {
        loadingSpinner.classList.remove('hidden');

        const payload = {
            level_id: levelId,
            action: action,
        };

        try {
            if (!API_URL) throw new Error("URL API manquante dans la configuration.");

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN 
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


    // --- 5. INITIALISATION & ÉCOUTEURS ---

    // Écouteur pour le bouton "Annuler" de la modale
    if (btnCancelConfirm) {
        btnCancelConfirm.addEventListener('click', hideConfirmModal);
    }

    // Écouteur pour fermer la modale si on clique en dehors (sur le fond gris)
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideConfirmModal();
            }
        });
    }

    // Écouteurs pour les boutons d'action (Avancer / Terminer)
    document.querySelectorAll('.term-action-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.currentTarget;
            
            // Extraction des données
            const levelId = parseInt(btn.dataset.levelId);
            const action = btn.dataset.action;
            const levelName = btn.dataset.levelName;
            const currentCounter = parseInt(btn.dataset.currentCounter); 

            // Vérification
            if (levelId && action && levelName && !isNaN(currentCounter)) {
                showConfirmModal(levelId, action, levelName, currentCounter);
            }
        });
    });

});