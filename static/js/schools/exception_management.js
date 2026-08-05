/**
 * Gestion des exceptions scolaires (Jours et Horaires).
 * VERSION SÉCURISÉE (CSP Compliant) ET MULTILINGUE.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURATION & DONNÉES INITIALES ---
    const container = document.getElementById('exception-manager-container');
    const csrfInput = document.getElementById('csrf-token');
    
    // Récupération sécurisée
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';
    const API_URL = container ? container.getAttribute('data-api-url') : '';

    // Traductions dynamiques depuis le HTML
    const msgEdit = container ? container.getAttribute('data-msg-edit') : 'Modifier';
    const msgDelete = container ? container.getAttribute('data-msg-delete') : 'Supprimer';
    const msgBreak = container ? container.getAttribute('data-msg-break') : "Pause de l'année";
    const msgFromToDate = container ? container.getAttribute('data-msg-from-to-date') : 'Du {start} au {end}';
    const msgFromToTime = container ? container.getAttribute('data-msg-from-to-time') : 'De {start} à {end}';
    const msgEditDay = container ? container.getAttribute('data-msg-edit-day') : 'Modifier l\'Exception Journalière';
    const msgAddDay = container ? container.getAttribute('data-msg-add-day') : 'Ajouter une Exception Journalière';
    const msgEditTime = container ? container.getAttribute('data-msg-edit-time') : 'Modifier l\'Exception Horaire';
    const msgAddTime = container ? container.getAttribute('data-msg-add-time') : 'Ajouter une Exception Horaire';
    const msgSave = container ? container.getAttribute('data-msg-save') : 'Sauvegarder les modifications';
    const msgCreate = container ? container.getAttribute('data-msg-create') : 'Créer';
    const msgConfirmDeleteDay = container ? container.getAttribute('data-msg-confirm-delete-day') : "Êtes-vous sûr de vouloir supprimer ce jour d'exception ?";
    const msgConfirmDeleteTime = container ? container.getAttribute('data-msg-confirm-delete-time') : "Êtes-vous sûr de vouloir supprimer cet horaire d'exception ?";
    const msgProcessing = container ? container.getAttribute('data-msg-processing') : 'Traitement...';
    const msgSuccess = container ? container.getAttribute('data-msg-success') : 'Succès';
    const msgError = container ? container.getAttribute('data-msg-error') : 'Erreur';
    const msgNetworkError = container ? container.getAttribute('data-msg-network-error') : 'Erreur de connexion au serveur.';

    let exceptionDays = [];
    let exceptionTimes = [];
    let currentExceptionType = null;
    let currentAction = 'create';
    let itemToDelete = null;

    // Lecture des données JSON injectées (CSP Safe)
    try {
        const daysEl = document.getElementById('exception_days_data');
        if (daysEl) exceptionDays = JSON.parse(daysEl.textContent);
    } catch (e) { console.error("Erreur parsing jours", e); }

    try {
        const timesEl = document.getElementById('exception_times_data');
        if (timesEl) exceptionTimes = JSON.parse(timesEl.textContent);
    } catch (e) { console.error("Erreur parsing horaires", e); }


    // --- 2. ÉLÉMENTS DU DOM ---
    const dayListContainer = document.getElementById('day-list');
    const timeListContainer = document.getElementById('time-list');
    const noDayMsg = document.getElementById('no-day-exceptions');
    const noTimeMsg = document.getElementById('no-time-exceptions');

    // Modale CRUD
    const crudModal = document.getElementById('crud-modal');
    const form = document.getElementById('exception-form');
    const crudSubmitBtn = document.getElementById('crud-submit-button');
    const submitText = document.getElementById('submit-text');
    const loadingSpinner = document.getElementById('loading-spinner');

    // Modale Delete
    const deleteModal = document.getElementById('delete-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('btn-cancel-delete');

    // Modale Feedback
    const feedbackModal = document.getElementById('feedback-modal');


    // --- 3. UTILITAIRES DE FORMATAGE ---

    function formatDate(isoDate) {
        if (!isoDate) return 'N/A';
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    }

    function formatTime(isoTime) {
        if (!isoTime) return 'N/A';
        const parts = isoTime.split(':');
        return `${parts[0]}:${parts[1]}`;
    }


    // --- 4. FONCTIONS DE RENDU ---

    /** 
     * Crée le HTML d'un bouton d'action.
     * MODIFICATION : Utilisation de "flex items-center gap-2" pour des icônes parfaitement gérées en LTR/RTL 
     */
    function createActionButtonHtml(text, className, action, id, type, iconHtml = '') {
        return `<button class="action-btn text-sm font-medium py-1 px-2 rounded-lg transition flex items-center gap-2 ${className}"
                        data-action="${action}" 
                        data-id="${id}" 
                        data-type="${type}">
                    ${iconHtml} <span>${text}</span>
                </button>`;
    }

    function renderDayExceptions() {
        dayListContainer.innerHTML = '';

        if (exceptionDays.length === 0) {
            noDayMsg.classList.remove('hidden');
            return;
        }
        noDayMsg.classList.add('hidden');

        exceptionDays.forEach(day => {
            const editBtnHtml = createActionButtonHtml(msgEdit, 'text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200', 'edit', day.id, 'day', '<i class="fas fa-edit"></i>');
            const deleteBtnHtml = createActionButtonHtml(msgDelete, 'text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200', 'delete', day.id, 'day', '<i class="fas fa-trash-alt"></i>');
            
            // Formatage de la phrase "Du ... au ..."
            const dateStr = msgFromToDate.replace('{start}', formatDate(day.start_date)).replace('{end}', formatDate(day.end_date));

            const element = document.createElement('div');
            element.className = 'flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition mb-2';
            
            // MODIFICATION : "flex gap-2" remplace "space-x-2 flex"
            element.innerHTML = `
                <div class="mb-2 sm:mb-0">
                    <p class="font-semibold text-gray-800">${day.type}</p>
                    <p class="text-sm text-gray-600" dir="auto">${dateStr}</p>
                </div>
                <div class="flex gap-2">
                    ${editBtnHtml}
                    ${deleteBtnHtml}
                </div>
            `;
            dayListContainer.appendChild(element);
        });
    }

    function renderTimeExceptions() {
        timeListContainer.innerHTML = '';

        if (exceptionTimes.length === 0) {
            noTimeMsg.classList.remove('hidden');
            return;
        }
        noTimeMsg.classList.add('hidden');

        exceptionTimes.forEach(time => {
            const editBtnHtml = createActionButtonHtml(msgEdit, 'text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200', 'edit', time.id, 'time', '<i class="fas fa-edit"></i>');
            const deleteBtnHtml = createActionButtonHtml(msgDelete, 'text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200', 'delete', time.id, 'time', '<i class="fas fa-trash-alt"></i>');
            
            // Formatage de la phrase "De ... à ..."
            const timeStr = msgFromToTime.replace('{start}', formatTime(time.start_time)).replace('{end}', formatTime(time.end_time));

            const element = document.createElement('div');
            element.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition mb-2';
            
            // MODIFICATION : "flex gap-2" remplace "space-x-2 flex"
            element.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-800">${msgBreak}</p>
                    <p class="text-sm text-gray-600" dir="auto">${timeStr}</p>
                </div>
                <div class="flex gap-2">
                    ${editBtnHtml}
                    ${deleteBtnHtml}
                </div>
            `;
            timeListContainer.appendChild(element);
        });
    }

    function renderAll() {
        renderDayExceptions();
        renderTimeExceptions();
    }


    // --- 5. GESTION DES CLICS ---

    function handleListClick(e) {
        const btn = e.target.closest('.action-btn');
        if (!btn) return;

        const action = btn.dataset.action;
        const id = parseInt(btn.dataset.id);
        const type = btn.dataset.type;

        if (action === 'edit') {
            openCrudModal(type, id);
        } else if (action === 'delete') {
            openDeleteModal(id, type);
        }
    }

    dayListContainer.addEventListener('click', handleListClick);
    timeListContainer.addEventListener('click', handleListClick);


    // --- 6. MODAL CRUD ---

    function openCrudModal(type, id = null) {
        form.reset(); 
        
        currentExceptionType = type;
        currentAction = id ? 'update' : 'create';

        document.getElementById('exception-type').value = type;
        document.getElementById('exception-id').value = id || '';
        
        if (type === 'day') {
            document.getElementById('crud-modal-title').textContent = id ? msgEditDay : msgAddDay;
        } else {
            document.getElementById('crud-modal-title').textContent = id ? msgEditTime : msgAddTime;
        }
        
        submitText.textContent = id ? msgSave : msgCreate;

        const dayFields = document.getElementById('day-fields');
        const timeFields = document.getElementById('time-fields');
        
        if (type === 'day') {
            dayFields.classList.remove('hidden');
            timeFields.classList.add('hidden');
        } else {
            dayFields.classList.add('hidden');
            timeFields.classList.remove('hidden');
        }

        if (id) {
            const data = type === 'day' 
                ? exceptionDays.find(d => d.id == id) 
                : exceptionTimes.find(t => t.id == id);

            if (data) {
                if (type === 'day') {
                    document.getElementById('day-type').value = data.type;
                    document.getElementById('start-date').value = data.start_date;
                    document.getElementById('end-date').value = data.end_date;
                } else {
                    document.getElementById('start-time').value = formatTime(data.start_time); 
                    document.getElementById('end-time').value = formatTime(data.end_time);
                }
            }
        }

        crudModal.classList.remove('hidden');
    }

    function closeCrudModal() {
        crudModal.classList.add('hidden');
        form.reset();
    }

    const btnAddDay = document.getElementById('btn-add-day');
    const btnAddTime = document.getElementById('btn-add-time');
    const btnCloseCrud = document.getElementById('btn-close-crud');

    if(btnAddDay) btnAddDay.addEventListener('click', () => openCrudModal('day'));
    if(btnAddTime) btnAddTime.addEventListener('click', () => openCrudModal('time'));
    if(btnCloseCrud) btnCloseCrud.addEventListener('click', closeCrudModal);


    // --- 7. MODAL DELETE ---

    function openDeleteModal(id, type) {
        itemToDelete = { id: id, type: type };
        
        const textElement = document.getElementById('delete-confirmation-text');
        if(textElement) {
            textElement.textContent = type === 'day' ? msgConfirmDeleteDay : msgConfirmDeleteTime;
        }

        deleteModal.classList.remove('hidden');
    }

    function closeDeleteModal() {
        deleteModal.classList.add('hidden');
        itemToDelete = null; 
    }

    if(cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    
    if(confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', () => {
            if (itemToDelete) {
                handleApiCall({
                    action: 'delete',
                    exception_type: itemToDelete.type,
                    exception_id: itemToDelete.id 
                }, 'delete');
            }
        });
    }


    // --- 8. API & FEEDBACK ---

    async function handleApiCall(dataPayload, actionType = 'crud') {
        if (actionType === 'crud') {
            crudSubmitBtn.disabled = true;
            loadingSpinner.classList.remove('hidden');
            submitText.textContent = msgProcessing;
        }

        try {
            if (!API_URL) throw new Error("URL API manquante");

            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN,
                },
                body: JSON.stringify(dataPayload)
            });

            const result = await response.json();

            if (result.success) {
                if (dataPayload.action === 'delete') {
                    if (dataPayload.exception_type === 'day') {
                        exceptionDays = exceptionDays.filter(d => d.id != dataPayload.exception_id);
                    } else {
                        exceptionTimes = exceptionTimes.filter(t => t.id != dataPayload.exception_id);
                    }
                    closeDeleteModal();
                } else {
                    if (result.data) {
                        if (dataPayload.action === 'update') {
                            const updateId = dataPayload.exception_id;
                            if (dataPayload.exception_type === 'day') {
                                const idx = exceptionDays.findIndex(d => d.id == updateId);
                                if(idx !== -1) exceptionDays[idx] = result.data;
                            } else {
                                const idx = exceptionTimes.findIndex(t => t.id == updateId);
                                if(idx !== -1) exceptionTimes[idx] = result.data;
                            }
                        } else {
                            if (dataPayload.exception_type === 'day') exceptionDays.push(result.data);
                            else exceptionTimes.push(result.data);
                        }
                        closeCrudModal();
                    } else {
                        window.location.reload();
                        return;
                    }
                }

                showFeedbackModal(result.message, true);
                renderAll();

            } else {
                showFeedbackModal(result.message || msgError, false);
            }

        } catch (error) {
            console.error("Erreur API:", error);
            showFeedbackModal(msgNetworkError, false);
        } finally {
            if (actionType === 'crud') {
                crudSubmitBtn.disabled = false;
                loadingSpinner.classList.add('hidden');
                submitText.textContent = currentAction === 'create' ? msgCreate : msgEdit;
            }
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => data[key] = value);
        
        const payload = {
            action: currentAction,
            exception_type: currentExceptionType,
            exception_id: document.getElementById('exception-id').value || null 
        };

        if (currentExceptionType === 'day') {
            payload.type = data.type; 
            payload.start_date = data.start_date;
            payload.end_date = data.end_date;
        } else {
            payload.start_time = data.start_time;
            payload.end_time = data.end_time;
        }

        handleApiCall(payload, 'crud');
    });


    // --- 9. FEEDBACK MODAL ---

    function showFeedbackModal(message, isSuccess = true) {
        const title = document.getElementById('feedback-title');
        const messageP = document.getElementById('feedback-message');
        const iconContainer = document.getElementById('feedback-icon');
        const content = document.getElementById('feedback-content');

        if (isSuccess) {
            title.textContent = msgSuccess;
            iconContainer.innerHTML = '<i class="fas fa-check-circle text-green-500 text-2xl"></i>';
        } else {
            title.textContent = msgError;
            iconContainer.innerHTML = '<i class="fas fa-times-circle text-red-500 text-2xl"></i>';
        }
        messageP.textContent = message;

        feedbackModal.classList.remove('hidden');
        feedbackModal.classList.add('opacity-100');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }

    const feedbackCloseBtn = document.getElementById('feedback-close-btn');
    if (feedbackCloseBtn) {
        feedbackCloseBtn.addEventListener('click', () => {
            feedbackModal.classList.add('hidden');
            feedbackModal.classList.remove('opacity-100');
        });
    }

    // --- INITIALISATION ---
    renderAll();
});