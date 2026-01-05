// --- 1. Variables Globales et Initialisation ---

// Correction du bug JSON : On lit le contenu généré par |json_script et on le parse.
const levelChoicesData = JSON.parse(document.getElementById('level-choices-data').textContent);
const termChoicesData = JSON.parse(document.getElementById('term-choices-data').textContent);

// Éléments du DOM
const levelModal = document.getElementById('level-modal');
const levelForm = document.getElementById('level-form');
const modalTitle = document.getElementById('modal-title');
const submitButton = document.getElementById('submit-button');
const levelsTableBody = document.getElementById('levels-table-body');
const levelCountDisplay = document.getElementById('level-count-display');
const noLevelRow = document.getElementById('no-level-row');

// Éléments du formulaire
const levelIdInput = document.getElementById('level-id');
const actionTypeInput = document.getElementById('action-type');
const levelCodeSelect = document.getElementById('level-code');
const termTypeSelect = document.getElementById('term-type');

// Modals de message et de confirmation
const messageModal = document.getElementById('message-modal');
const modalContentMsg = document.getElementById('modal-content-msg');
const modalTitleMsg = document.getElementById('modal-title-msg');
const modalMessage = document.getElementById('modal-message');
const modalIconContainer = document.getElementById('modal-icon-container');
const modalCloseBtn = document.getElementById('modal-close-btn');

const confirmModal = document.getElementById('confirm-modal');
const confirmLevelName = document.getElementById('confirm-level-name');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

let levelToDeleteId = null; // ID du niveau en attente de suppression

// --- 2. Fonctions Utilitaires ---

/**
 * Convertit un code (ex: '6E') en nom d'affichage (ex: '6e').
 * @param {string} code - Le code du niveau ou du terme.
 * @param {Array<Array<string>>} choices - Le tableau de choix (Level.LEVEL_CHOICES ou Level.TERM_TYPE_CHOICES).
 * @returns {string} Le nom d'affichage ou le code si non trouvé.
 */
function getDisplayFromCode(code, choices) {
    const choice = choices.find(c => c[0] === code);
    return choice ? choice[1] : code;
}

/**
 * Affiche une modal de message (succès/erreur).
 * @param {boolean} success - True pour succès, False pour erreur.
 * @param {string} message - Message à afficher.
 */
function showMessageModal(success, message) {
    const isSuccess = success;
    
    // Changements de couleur pour le thème Émeraude/Rouge
    const successColor = 'text-emerald-600';
    const errorColor = 'text-red-600';
    // Mise à jour de la bordure du message pour correspondre au statut
    const borderClass = isSuccess ? 'border-emerald-500' : 'border-red-500';

    const icon = isSuccess 
        ? `<i class="fas fa-check-circle text-2xl ${successColor}"></i>` 
        : `<i class="fas fa-exclamation-triangle text-2xl ${errorColor}"></i>`;

    modalIconContainer.innerHTML = icon;
    modalTitleMsg.textContent = isSuccess ? 'Succès' : 'Erreur';
    modalMessage.textContent = message;
    
    // Mettre à jour la bordure de la modal
    modalContentMsg.classList.remove('border-emerald-500', 'border-red-500');
    modalContentMsg.classList.add(borderClass);

    // Afficher la modal avec transition
    messageModal.classList.remove('hidden', 'opacity-0');
    messageModal.classList.add('flex');
    setTimeout(() => {
        messageModal.classList.remove('opacity-0');
        modalContentMsg.classList.remove('scale-95');
    }, 10);
}

/**
 * Cache la modal de message.
 */
function closeMessageModal() {
    modalContentMsg.classList.add('scale-95');
    messageModal.classList.add('opacity-0');
    setTimeout(() => {
        messageModal.classList.add('hidden');
    }, 300);
}

// --- 3. Gestion des Modals (CRUD) ---

/**
 * Ouvre la modal en mode Création.
 */
document.getElementById('open-modal-create').addEventListener('click', () => {
    levelForm.reset(); // Réinitialiser le formulaire
    levelIdInput.value = '';
    actionTypeInput.value = 'create';
    modalTitle.textContent = 'Ajouter un Nouveau Niveau';
    
    // Harmonie des couleurs : bouton en Emeraude
    submitButton.textContent = 'Enregistrer';
    submitButton.classList.remove('bg-red-600', 'hover:bg-red-700');
    submitButton.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

    // FIX: Vérification de Nullité pour éviter l'erreur "Cannot set properties of null"
    const submitIcon = submitButton.querySelector('i');
    if (submitIcon) {
        submitIcon.className = 'fas fa-save mr-2';
    }


    levelModal.classList.remove('hidden');
    levelModal.classList.add('flex');
});

/**
 * Ouvre la modal en mode Modification.
 * @param {string} id - ID du niveau à modifier.
 */
function openModalById(id) {
    const row = document.getElementById(`level-row-${id}`);
    if (!row) return;

    // Remplir les champs avec les données de la ligne
    levelIdInput.value = id;
    actionTypeInput.value = 'update';
    levelCodeSelect.value = row.dataset.levelCode;
    termTypeSelect.value = row.dataset.termType;

    // Mettre à jour le titre et le bouton
    modalTitle.textContent = `Modifier le Niveau: ${row.dataset.levelDisplay}`;
    submitButton.textContent = 'Mettre à Jour';
    
    // Harmonie des couleurs : bouton en Emeraude
    submitButton.classList.remove('bg-red-600', 'hover:bg-red-700');
    submitButton.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

    // FIX: Vérification de Nullité pour éviter l'erreur "Cannot set properties of null"
    const submitIcon = submitButton.querySelector('i');
    if (submitIcon) {
        submitIcon.className = 'fas fa-edit mr-2';
    }


    levelModal.classList.remove('hidden');
    levelModal.classList.add('flex');
}

/**
 * Ferme la modal de création/modification.
 */
function closeModal() {
    levelModal.classList.remove('flex');
    levelModal.classList.add('hidden');
}

/**
 * Ferme la modal de confirmation.
 */
function closeConfirmModal() {
    confirmModal.classList.remove('flex');
    confirmModal.classList.add('hidden');
    levelToDeleteId = null;
}

// Gestionnaire pour la confirmation de suppression
confirmDeleteBtn.addEventListener('click', () => {
    if (levelToDeleteId) {
        // Exécuter l'action de suppression
        performAction(levelToDeleteId, 'delete', {});
        closeConfirmModal();
    }
});

// Gestionnaire pour l'ouverture de la modal de confirmation (Suppression)
function handleDeleteLevel(id, levelName) {
    levelToDeleteId = id;
    confirmLevelName.textContent = levelName;

    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
}


// --- 4. Logique AJAX et CRUD ---

/**
 * Exécute l'action CRUD via l'API.
 * @param {string} levelId - ID du niveau (pour update/delete).
 * @param {string} action - 'create', 'update', ou 'delete'.
 * @param {Object} data - Données du niveau pour create/update.
 */
async function performAction(levelId, action, data) {
    const payload = {
        action: action,
        level_id: levelId,
        level_code: data.level_code,
        term_type: data.term_type,
    };
    
    // Débloquer le bouton de soumission
    const restoreButton = () => {
        if (action !== 'delete') {
             submitButton.disabled = false;
             submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
        }
    };
    
    // Bloquer le bouton de soumission pendant l'appel
    if (action !== 'delete') {
        submitButton.disabled = true;
        submitButton.classList.add('opacity-50', 'cursor-not-allowed');
    }

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();

        if (response.ok) {
            showMessageModal(true, result.message);
            const finalId = result.level_id || levelId;
            updateTable(action, finalId, payload); // Mettre à jour l'interface utilisateur
            closeModal();
        } else {
            // Afficher l'erreur retournée par la vue (ex: permission, unicité, validation)
            showMessageModal(false, result.message || `Erreur ${response.status}: Impossible d'effectuer l'opération.`);
        }
    } catch (error) {
        showMessageModal(false, 'Une erreur réseau est survenue. Vérifiez la connexion.');
        console.error('Erreur API:', error);
    } finally {
        restoreButton();
    }
}

/**
 * Met à jour le tableau HTML après une opération CRUD réussie.
 * @param {string} action - L'action effectuée ('create', 'update', 'delete').
 * @param {string} levelId - L'ID du niveau concerné.
 * @param {Object} data - Les données utilisées (pour create/update).
 */
function updateTable(action, levelId, data) {
    const levelDisplay = getDisplayFromCode(data.level_code, levelChoicesData);
    const termDisplay = getDisplayFromCode(data.term_type, termChoicesData);
    
    let count = parseInt(levelCountDisplay.textContent);

    if (action === 'create') {
        
        // CORRECTION: Utiliser text-emerald-600 pour l'icône de modification
        const newRow = `
            <tr id="level-row-${levelId}" 
                data-id="${levelId}" 
                data-level-code="${data.level_code}" 
                data-level-display="${levelDisplay}"
                data-term-type="${data.term_type}"
                class="hover:bg-emerald-50/50 transition duration-100">
                
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${levelDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap hidden sm:table-cell text-sm text-gray-500">${termDisplay}</td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onclick="openModalById('${levelId}')" 
                            class="text-emerald-600 hover:text-emerald-800 p-2 rounded-full hover:bg-gray-100 transition duration-150"
                            title="Modifier">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button onclick="handleDeleteLevel('${levelId}', '${levelDisplay}')" 
                            class="text-red-600 hover:text-red-800 ml-3 p-2 rounded-full hover:bg-gray-100 transition duration-150"
                            title="Supprimer">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `;
        levelsTableBody.insertAdjacentHTML('beforeend', newRow);
        
        // Retirer la ligne "Aucun niveau" si elle existe
        const noRow = document.getElementById('no-level-row');
        if (noRow) noRow.remove();

        levelCountDisplay.textContent = count + 1;

    } else if (action === 'update') {
        const row = document.getElementById(`level-row-${levelId}`);
        if (row) {
            // Mettre à jour les attributs data-*
            row.dataset.levelCode = data.level_code;
            row.dataset.levelDisplay = levelDisplay;
            row.dataset.termType = data.term_type;
            
            // Mettre à jour les cellules visibles
            row.children[0].textContent = levelDisplay;
            row.children[1].textContent = termDisplay;

            // Mettre à jour le nom dans la fonction de suppression
            // Note: row.querySelector('[onclick*="handleDeleteLevel"]') pourrait être null si la ligne a été créée sans le bouton.
            const deleteButton = row.querySelector('[onclick*="handleDeleteLevel"]');
            if (deleteButton) {
                deleteButton.setAttribute('onclick', `handleDeleteLevel('${levelId}', '${levelDisplay}')`);
            }
        }

    } else if (action === 'delete') {
        const row = document.getElementById(`level-row-${levelId}`);
        if (row) {
            row.remove();
            levelCountDisplay.textContent = count - 1;
        }

        // Si le compteur est à zéro, ajouter la ligne "Aucun niveau"
        if (parseInt(levelCountDisplay.textContent) === 0) {
            const emptyRow = `
                <tr id="no-level-row">
                    <td colspan="3" class="px-6 py-4 text-center text-gray-500">Aucun niveau scolaire trouvé pour cette école.</td>
                </tr>
            `;
            levelsTableBody.innerHTML = emptyRow;
        }
    }
}


// --- 5. Événements ---

// Soumission du formulaire
levelForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    const levelId = levelIdInput.value;
    const action = actionTypeInput.value;
    
    const data = {
        level_code: levelCodeSelect.value,
        term_type: termTypeSelect.value
    };

    performAction(levelId, action, data);
});

// Fermeture de la modal de message
modalCloseBtn.addEventListener('click', closeMessageModal);

// Fermeture des modals en cliquant à l'extérieur ou via la touche Échap
[levelModal, messageModal, confirmModal].forEach(modal => {
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            if (modal === levelModal) closeModal();
            if (modal === messageModal) closeMessageModal();
            if (modal === confirmModal) closeConfirmModal();
        }
    });
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        if (levelModal.classList.contains('flex')) closeModal();
        if (messageModal.classList.contains('flex')) closeMessageModal();
        if (confirmModal.classList.contains('flex')) closeConfirmModal();
    }
});
