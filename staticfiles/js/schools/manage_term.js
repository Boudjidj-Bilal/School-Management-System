/**
 * Gestion de l'avancement des périodes (Trimestres/Semestres).
 * VERSION SÉCURISÉE (CSP Compliant) & MULTILINGUE.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURATION & DONNÉES ---
    const container = document.getElementById('manage-term-container');
    const csrfInput = document.getElementById('csrf-token');
    
    const API_URL = container ? container.getAttribute('data-api-url') : '';
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    // Messages traduits
    const msgSuccess = container ? container.getAttribute('data-msg-success') : 'Succès';
    const msgError = container ? container.getAttribute('data-msg-error') : 'Erreur';
    const msgAdvanceTitle = container ? container.getAttribute('data-msg-advance-title') : '';
    const msgAdvanceBody = container ? container.getAttribute('data-msg-advance-body') : '';
    const msgFinishTitle = container ? container.getAttribute('data-msg-finish-title') : '';
    const msgFinishBody = container ? container.getAttribute('data-msg-finish-body') : '';
    const msgUnknownError = container ? container.getAttribute('data-msg-unknown-error') : '';
    const msgNetworkError = container ? container.getAttribute('data-msg-network-error') : '';

    // --- 2. ÉLÉMENTS DU DOM ---
    const statusContainer = document.getElementById('status-message-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    
    // Modal
    const modal = document.getElementById('confirmation-modal');
    const modalContent = document.getElementById('confirmation-modal-content');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const btnCancelConfirm = document.getElementById('btn-cancel-confirm'); 

    // --- 3. FONCTIONS D'AFFICHAGE ---

    function displayMessage(message, isSuccess) {
        const colorClass = isSuccess ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const label = isSuccess ? msgSuccess : msgError;
        statusContainer.innerHTML = `
            <div class="p-3 rounded-lg ${colorClass}" role="alert">
                <span class="font-semibold">${label} :</span> ${message}
            </div>
        `;
        statusContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        setTimeout(() => {
            statusContainer.innerHTML = '';
        }, 6000);
    }

    function hideConfirmModal() {
        if (!modalContent) return; 

        modalContent.classList.remove('scale-100', 'opacity-100');
        modalContent.classList.add('scale-95', 'opacity-0');
        
        setTimeout(() => {
            modal.classList.add('hidden');
            modalConfirmBtn.onclick = null; 
        }, 300);
    }

    function showConfirmModal(levelId, action, levelName, currentCounter) {
        let title, message;
        
        if (action === 'advance') {
            title = `${msgAdvanceTitle} ${currentCounter}`;
            message = msgAdvanceBody.replace('{level}', levelName).replace('{counter}', currentCounter);
            modalConfirmBtn.className = 'py-2 px-4 rounded-lg text-white bg-green-600 hover:bg-green-700 transition duration-150 ease-in-out';
        } else if (action === 'finish') {
            title = msgFinishTitle;
            message = msgFinishBody.replace('{level}', levelName).replace('{counter}', currentCounter);
            modalConfirmBtn.className = 'py-2 px-4 rounded-lg text-white bg-red-600 hover:bg-red-700 transition duration-150 ease-in-out';
        } else {
            return;
        }

        modalTitle.textContent = title;
        modalMessage.innerHTML = message;
        
        modalConfirmBtn.onclick = () => {
            hideConfirmModal();
            handleTermAction(levelId, action);
        };

        modal.classList.remove('hidden');
        setTimeout(() => {
            if (modalContent) {
                modalContent.classList.add('scale-100', 'opacity-100');
                modalContent.classList.remove('scale-95', 'opacity-0');
            }
        }, 10);
    }

    // --- 4. GESTION API ---

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
                // message provient du backend, et il est logiquement déjà traduit
                displayMessage(data.message, true);
                setTimeout(() => window.location.reload(), 1500); 
            } else {
                const message = data.message || msgUnknownError.replace('{status}', response.status);
                displayMessage(message, false);
            }

        } catch (error) {
            loadingSpinner.classList.add('hidden');
            console.error('Erreur réseau ou JSON:', error);
            displayMessage(msgNetworkError, false);
        }
    }

    // --- 5. INITIALISATION & ÉCOUTEURS ---

    if (btnCancelConfirm) {
        btnCancelConfirm.addEventListener('click', hideConfirmModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideConfirmModal();
            }
        });
    }

    document.querySelectorAll('.term-action-btn').forEach(button => {
        button.addEventListener('click', (event) => {
            const btn = event.currentTarget;
            
            const levelId = parseInt(btn.dataset.levelId);
            const action = btn.dataset.action;
            const levelName = btn.dataset.levelName;
            const currentCounter = parseInt(btn.dataset.currentCounter); 

            if (levelId && action && levelName && !isNaN(currentCounter)) {
                showConfirmModal(levelId, action, levelName, currentCounter);
            }
        });
    });

});