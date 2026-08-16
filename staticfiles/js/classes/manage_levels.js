/**
 * manage_levels.js
 * Gestion des Niveaux Scolaires (Mode Production Safe, Multilingue & RTL)
 */

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------------------
    // 1. INITIALISATION & CONFIGURATION (Sécurisée)
    // ----------------------------------------------------------------------

    const container = document.getElementById('level-container');
    if (!container) return;

    const API_URL = container.dataset.apiUrl;
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    // Récupération des traductions dynamiques (data-attributes)
    const msgSuccessTitle = container.getAttribute('data-msg-success-title') || "Succès";
    const msgErrorTitle = container.getAttribute('data-msg-error-title') || "Erreur";
    const msgCreateTitle = container.getAttribute('data-msg-create-title') || "Ajouter un Nouveau Niveau";
    const msgUpdateTitleFormat = container.getAttribute('data-msg-update-title') || "Modifier le Niveau: {name}";
    const msgBtnSave = container.getAttribute('data-msg-btn-save') || "Enregistrer";
    const msgBtnUpdate = container.getAttribute('data-msg-btn-update') || "Mettre à Jour";
    const msgNetworkError = container.getAttribute('data-msg-network-error') || "Erreur réseau.";
    const msgEmptyRow = container.getAttribute('data-msg-empty-row') || "Aucun niveau scolaire trouvé pour cette école.";
    const msgEditTitle = container.getAttribute('data-msg-edit-title') || "Modifier";
    const msgDeleteTitle = container.getAttribute('data-msg-delete-title') || "Supprimer";

    // Lecture sécurisée des JSON scripts (données statiques)
    let levelChoicesData = [];
    let termChoicesData = [];
    try {
        const levelDataEl = document.getElementById('level-choices-data');
        const termDataEl = document.getElementById('term-choices-data');
        if (levelDataEl) levelChoicesData = JSON.parse(levelDataEl.textContent);
        if (termDataEl) termChoicesData = JSON.parse(termDataEl.textContent);
    } catch (e) {
        console.error("Erreur parsing JSON choices:", e);
    }

    // Références DOM
    const levelModal = document.getElementById('level-modal');
    const levelForm = document.getElementById('level-form');
    const modalTitle = document.getElementById('modal-title');
    const submitButton = document.getElementById('submit-button');
    const levelsTableBody = document.getElementById('levels-table-body');
    const levelCountDisplay = document.getElementById('level-count-display');

    // Champs Formulaire
    const levelIdInput = document.getElementById('level-id');
    const actionTypeInput = document.getElementById('action-type');
    const levelCodeSelect = document.getElementById('level-code');
    const termTypeSelect = document.getElementById('term-type');

    // Modals
    const messageModal = document.getElementById('message-modal');
    const modalContentMsg = document.getElementById('modal-content-msg');
    const modalTitleMsg = document.getElementById('modal-title-msg');
    const modalMessage = document.getElementById('modal-message');
    const modalIconContainer = document.getElementById('modal-icon-container');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    const confirmModal = document.getElementById('confirm-modal');
    const confirmLevelName = document.getElementById('confirm-level-name');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    // État
    let levelToDeleteId = null;


    // ----------------------------------------------------------------------
    // 2. FONCTIONS UTILITAIRES
    // ----------------------------------------------------------------------

    function getDisplayFromCode(code, choices) {
        const choice = choices.find(c => c[0] === code);
        return choice ? choice[1] : code;
    }

    function showMessageModal(success, message) {
        const isSuccess = success;
        const successColor = 'text-emerald-600';
        const errorColor = 'text-red-600';
        const borderClass = isSuccess ? 'border-emerald-500' : 'border-red-500';

        const icon = isSuccess 
            ? `<i class="fas fa-check-circle text-2xl ${successColor}"></i>` 
            : `<i class="fas fa-exclamation-triangle text-2xl ${errorColor}"></i>`;

        modalIconContainer.innerHTML = icon;
        modalTitleMsg.textContent = isSuccess ? msgSuccessTitle : msgErrorTitle;
        modalMessage.textContent = message;
        
        modalContentMsg.classList.remove('border-emerald-500', 'border-red-500');
        modalContentMsg.classList.add(borderClass);

        messageModal.classList.remove('hidden', 'opacity-0');
        messageModal.classList.add('flex');
        setTimeout(() => {
            messageModal.classList.remove('opacity-0');
            modalContentMsg.classList.remove('scale-95');
        }, 10);
    }

    function closeMessageModal() {
        modalContentMsg.classList.add('scale-95');
        messageModal.classList.add('opacity-0');
        setTimeout(() => {
            messageModal.classList.add('hidden');
        }, 300);
    }


    // ----------------------------------------------------------------------
    // 3. GESTION DES MODALES (UI)
    // ----------------------------------------------------------------------

    function openCreateModal() {
        levelForm.reset();
        levelIdInput.value = '';
        actionTypeInput.value = 'create';
        modalTitle.textContent = msgCreateTitle;
        
        submitButton.textContent = msgBtnSave;
        submitButton.classList.remove('bg-red-600', 'hover:bg-red-700');
        submitButton.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

        const submitIcon = submitButton.querySelector('i');
        if (submitIcon) submitIcon.className = 'fas fa-save';

        levelModal.classList.remove('hidden');
        levelModal.classList.add('flex');
    }

    function openEditModal(rowElement) {
        const id = rowElement.dataset.id;
        
        levelIdInput.value = id;
        actionTypeInput.value = 'update';
        levelCodeSelect.value = rowElement.dataset.levelCode;
        termTypeSelect.value = rowElement.dataset.termType;

        modalTitle.textContent = msgUpdateTitleFormat.replace('{name}', rowElement.dataset.levelDisplay);
        submitButton.textContent = msgBtnUpdate;
        
        submitButton.classList.remove('bg-red-600', 'hover:bg-red-700');
        submitButton.classList.add('bg-emerald-600', 'hover:bg-emerald-700');

        const submitIcon = submitButton.querySelector('i');
        if (submitIcon) submitIcon.className = 'fas fa-edit';

        levelModal.classList.remove('hidden');
        levelModal.classList.add('flex');
    }

    function closeModal() {
        levelModal.classList.remove('flex');
        levelModal.classList.add('hidden');
    }

    function closeConfirmModal() {
        confirmModal.classList.remove('flex');
        confirmModal.classList.add('hidden');
        levelToDeleteId = null;
    }

    function openDeleteConfirm(id, levelName) {
        levelToDeleteId = id;
        confirmLevelName.textContent = levelName;

        confirmModal.classList.remove('hidden');
        confirmModal.classList.add('flex');
    }


    // ----------------------------------------------------------------------
    // 4. LOGIQUE AJAX (CRUD)
    // ----------------------------------------------------------------------

    async function performAction(levelId, action, data) {
        const payload = {
            action: action,
            level_id: levelId,
            level_code: data.level_code,
            term_type: data.term_type,
        };
        
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
                updateTable(action, finalId, payload); 
                closeModal();
            } else {
                showMessageModal(false, result.message || `Erreur ${response.status}`);
            }
        } catch (error) {
            showMessageModal(false, msgNetworkError);
            console.error('Erreur API:', error);
        } finally {
            if (action !== 'delete') {
                 submitButton.disabled = false;
                 submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    function updateTable(action, levelId, data) {
        const levelDisplay = getDisplayFromCode(data.level_code, levelChoicesData);
        const termDisplay = getDisplayFromCode(data.term_type, termChoicesData);
        
        let count = parseInt(levelCountDisplay.textContent);

        if (action === 'create') {
            const newRow = document.createElement('tr');
            newRow.id = `level-row-${levelId}`;
            newRow.dataset.id = levelId;
            newRow.dataset.levelCode = data.level_code;
            newRow.dataset.levelDisplay = levelDisplay;
            newRow.dataset.termType = data.term_type;
            newRow.className = "hover:bg-emerald-50/50 transition duration-100";
            
            // Séparation icône + texte avec gap-2 (et ms-3 pour l'espacement logique à la place de ml-3)
            newRow.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" dir="auto">${escapeHtml(levelDisplay)}</td>
                <td class="px-6 py-4 whitespace-nowrap hidden sm:table-cell text-sm text-gray-500" dir="auto">${escapeHtml(termDisplay)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                    <div class="inline-flex items-center gap-2">
                        <button type="button" class="js-edit-btn text-emerald-600 hover:text-emerald-800 p-2 rounded-full hover:bg-gray-100 transition duration-150 inline-flex items-center justify-center" title="${msgEditTitle}">
                            <i class="fas fa-edit pointer-events-none"></i>
                        </button>
                        <button type="button" class="js-delete-btn text-red-600 hover:text-red-800 p-2 rounded-full hover:bg-gray-100 transition duration-150 inline-flex items-center justify-center" title="${msgDeleteTitle}">
                            <i class="fas fa-trash-alt pointer-events-none"></i>
                        </button>
                    </div>
                </td>
            `;
            
            levelsTableBody.appendChild(newRow);
            
            const noRow = document.getElementById('no-level-row');
            if (noRow) noRow.remove();

            levelCountDisplay.textContent = count + 1;

        } else if (action === 'update') {
            const row = document.getElementById(`level-row-${levelId}`);
            if (row) {
                row.dataset.levelCode = data.level_code;
                row.dataset.levelDisplay = levelDisplay;
                row.dataset.termType = data.term_type;
                
                row.children[0].textContent = levelDisplay;
                row.children[1].textContent = termDisplay;
            }

        } else if (action === 'delete') {
            const row = document.getElementById(`level-row-${levelId}`);
            if (row) {
                row.remove();
                levelCountDisplay.textContent = count - 1;
            }

            if (parseInt(levelCountDisplay.textContent) === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.id = "no-level-row";
                emptyRow.innerHTML = `<td colspan="3" class="px-6 py-4 text-center text-gray-500" dir="auto">${escapeHtml(msgEmptyRow)}</td>`;
                levelsTableBody.appendChild(emptyRow);
            }
        }
    }


    // ----------------------------------------------------------------------
    // 5. ÉCOUTEURS D'ÉVÉNEMENTS (Délégation)
    // ----------------------------------------------------------------------

    document.getElementById('open-create-modal-btn')?.addEventListener('click', openCreateModal);

    if(confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (levelToDeleteId) {
                performAction(levelToDeleteId, 'delete', {});
                closeConfirmModal();
            }
        });
    }

    if(levelForm) {
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
    }

    if(levelsTableBody) {
        levelsTableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.js-edit-btn');
            const deleteBtn = e.target.closest('.js-delete-btn');
            const row = e.target.closest('tr');
            
            if (!row) return;

            if (editBtn) {
                openEditModal(row);
            } else if (deleteBtn) {
                const levelName = row.dataset.levelDisplay;
                const levelId = row.dataset.id;
                openDeleteConfirm(levelId, levelName);
            }
        });
    }

    const closeBtns = document.querySelectorAll('.js-close-modal, .js-close-confirm-modal, .js-close-msg-modal');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            if (e.target.closest('#level-modal')) closeModal();
            if (e.target.closest('#confirm-modal')) closeConfirmModal();
            if (e.target.closest('#message-modal')) closeMessageModal();
        });
    });

    [levelModal, messageModal, confirmModal].forEach(modal => {
        if(!modal) return;
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
            if (levelModal && !levelModal.classList.contains('hidden')) closeModal();
            if (messageModal && !messageModal.classList.contains('hidden')) closeMessageModal();
            if (confirmModal && !confirmModal.classList.contains('hidden')) closeConfirmModal();
        }
    });

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

});