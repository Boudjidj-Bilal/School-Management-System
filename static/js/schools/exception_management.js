/**
 * Gestion des exceptions scolaires (Jours et Horaires).
 * VERSION SÉCURISÉE (CSP Compliant).
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIGURATION & DONNÉES INITIALES ---
    const container = document.getElementById('exception-manager-container');
    const csrfInput = document.getElementById('csrf-token');
    
    // Récupération sécurisée
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';
    const API_URL = container ? container.getAttribute('data-api-url') : '';

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

    /** Formatte une date ISO (YYYY-MM-DD) en DD/MM/YYYY */
    function formatDate(isoDate) {
        if (!isoDate) return 'N/A';
        const [year, month, day] = isoDate.split('-');
        return `${day}/${month}/${year}`;
    }

    /** Formatte une heure ISO (HH:MM:SS) en HH:MM */
    function formatTime(isoTime) {
        if (!isoTime) return 'N/A';
        const parts = isoTime.split(':');
        return `${parts[0]}:${parts[1]}`;
    }


    // --- 4. FONCTIONS DE RENDU ---

    /** Crée le HTML d'un bouton d'action avec des attributs data-* pour le JS */
    function createActionButtonHtml(text, className, action, id, type, iconHtml = '') {
        return `<button class="action-btn text-sm font-medium py-1 px-2 rounded-lg transition ${className}"
                        data-action="${action}" 
                        data-id="${id}" 
                        data-type="${type}">
                    ${iconHtml} ${text}
                </button>`;
    }

    /** Met à jour l'affichage de la liste des jours d'exception */
    function renderDayExceptions() {
        dayListContainer.innerHTML = '';

        if (exceptionDays.length === 0) {
            noDayMsg.classList.remove('hidden');
            return;
        }
        noDayMsg.classList.add('hidden');

        exceptionDays.forEach(day => {
            const editBtnHtml = createActionButtonHtml('Modifier', 'text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200', 'edit', day.id, 'day', '<i class="fas fa-edit"></i>');
            const deleteBtnHtml = createActionButtonHtml('Supprimer', 'text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200', 'delete', day.id, 'day', '<i class="fas fa-trash-alt"></i>');
            
            const element = document.createElement('div');
            element.className = 'flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition mb-2';
            element.innerHTML = `
                <div class="mb-2 sm:mb-0">
                    <p class="font-semibold text-gray-800">${day.type}</p>
                    <p class="text-sm text-gray-600">Du ${formatDate(day.start_date)} au ${formatDate(day.end_date)}</p>
                </div>
                <div class="space-x-2 flex">
                    ${editBtnHtml}
                    ${deleteBtnHtml}
                </div>
            `;
            dayListContainer.appendChild(element);
        });
    }

    /** Met à jour l'affichage de la liste des horaires d'exception */
    function renderTimeExceptions() {
        timeListContainer.innerHTML = '';

        if (exceptionTimes.length === 0) {
            noTimeMsg.classList.remove('hidden');
            return;
        }
        noTimeMsg.classList.add('hidden');

        exceptionTimes.forEach(time => {
            const editBtnHtml = createActionButtonHtml('Modifier', 'text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200', 'edit', time.id, 'time', '<i class="fas fa-edit"></i>');
            const deleteBtnHtml = createActionButtonHtml('Supprimer', 'text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200', 'delete', time.id, 'time', '<i class="fas fa-trash-alt"></i>');
            
            const element = document.createElement('div');
            element.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition mb-2';
            element.innerHTML = `
                <div>
                    <p class="font-semibold text-gray-800">Pause de l'année</p>
                    <p class="text-sm text-gray-600">De ${formatTime(time.start_time)} à ${formatTime(time.end_time)}</p>
                </div>
                <div class="space-x-2 flex">
                    ${editBtnHtml}
                    ${deleteBtnHtml}
                </div>
            `;
            timeListContainer.appendChild(element);
        });
    }

    /** Fonction principale de rendu */
    function renderAll() {
        renderDayExceptions();
        renderTimeExceptions();
    }


    // --- 5. GESTION DES CLICS (Délégation) ---

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
        document.getElementById('crud-modal-title').textContent = id ? `Modifier l'Exception ${type === 'day' ? 'Journalière' : 'Horaire'}` : `Ajouter une Exception ${type === 'day' ? 'Journalière' : 'Horaire'}`;
        submitText.textContent = id ? 'Sauvegarder les modifications' : 'Créer';

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
        const label = type === 'day' ? "ce jour d'exception" : "cet horaire d'exception";
        if(textElement) textElement.textContent = `Êtes-vous sûr de vouloir supprimer ${label} ? Cette action est irréversible.`;

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
                    // Utilisation correcte de exception_id pour le backend
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
            submitText.textContent = 'Traitement...';
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
                // Mise à jour locale des données
                if (dataPayload.action === 'delete') {
                    // Pour le delete, on utilise exception_id
                    if (dataPayload.exception_type === 'day') {
                        exceptionDays = exceptionDays.filter(d => d.id != dataPayload.exception_id);
                    } else {
                        exceptionTimes = exceptionTimes.filter(t => t.id != dataPayload.exception_id);
                    }
                    closeDeleteModal();
                } else {
                    // Pour update/create
                    if (result.data) {
                        if (dataPayload.action === 'update') {
                            // Pour l'update, on utilise exception_id du payload
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
                showFeedbackModal(result.message || "Erreur lors de l'opération", false);
            }

        } catch (error) {
            console.error("Erreur API:", error);
            showFeedbackModal('Erreur de connexion au serveur.', false);
        } finally {
            if (actionType === 'crud') {
                crudSubmitBtn.disabled = false;
                loadingSpinner.classList.add('hidden');
                submitText.textContent = currentAction === 'create' ? 'Créer' : 'Modifier';
            }
        }
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => data[key] = value);
        
        // Préparation Payload
        // CORRECTION MAJEURE ICI : Utilisation de 'exception_id' au lieu de 'id'
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
            title.textContent = "Succès";
            iconContainer.innerHTML = '<i class="fas fa-check-circle text-green-500 text-2xl"></i>';
        } else {
            title.textContent = "Erreur";
            iconContainer.innerHTML = '<i class="fas fa-times-circle text-red-500 text-2xl"></i>';
        }
        messageP.textContent = message;

        feedbackModal.classList.remove('hidden');
        feedbackModal.classList.add('opacity-100');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }

    document.getElementById('feedback-close-btn').addEventListener('click', () => {
        feedbackModal.classList.add('hidden');
        feedbackModal.classList.remove('opacity-100');
    });

    // --- INITIALISATION ---
    renderAll();
});