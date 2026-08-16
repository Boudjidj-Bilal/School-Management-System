/**
 * Fichier de gestion des salles de classe (manage_classrooms.js)
 * ADAPTÉ POUR PRODUCTION (CSP SAFE, MULTILINGUE & RTL)
 */

document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------------------
    // 0. CONFIGURATION & RÉFÉRENCES (Récupération sécurisée depuis le DOM)
    // ----------------------------------------------------------------------
    
    const container = document.getElementById('classroom-container');
    if (!container) return;

    const API_URL = container.dataset.apiUrl;
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    // Récupération des traductions dynamiques (data-attributes)
    const msgSuccessTitle = container.getAttribute('data-msg-success-title') || "Opération Réussie";
    const msgErrorTitle = container.getAttribute('data-msg-error-title') || "Erreur";
    const msgCreateTitle = container.getAttribute('data-msg-create-title') || "Ajouter une Nouvelle Salle";
    const msgUpdateTitleFormat = container.getAttribute('data-msg-update-title') || "Modifier la Salle: {name}";
    const msgBtnSave = container.getAttribute('data-msg-btn-save') || "Enregistrer";
    const msgBtnUpdate = container.getAttribute('data-msg-btn-update') || "Mettre à jour";
    const msgActiveStatus = container.getAttribute('data-msg-active') || "Active";
    const msgInactiveStatus = container.getAttribute('data-msg-inactive') || "Inactive";
    const msgEditTitle = container.getAttribute('data-msg-edit-title') || "Modifier";
    const msgToggleTitle = container.getAttribute('data-msg-toggle-title') || "Changer le statut";
    const msgNameRequired = container.getAttribute('data-msg-name-required') || "Le nom de la salle est obligatoire.";
    const msgServerCommError = container.getAttribute('data-msg-server-error') || "Impossible de communiquer avec le serveur.";

    // ----------------------------------------------------------------------
    // 1. LOGIQUE DE LA MODALE DE NOTIFICATION
    // ----------------------------------------------------------------------

    function showNotification(type, message) {
        const modal = document.getElementById('message-modal');
        const titleElement = document.getElementById('modal-title-msg');
        const messageElement = document.getElementById('modal-message');
        const iconContainer = document.getElementById('modal-icon-container');
        const content = document.getElementById('modal-content-msg');
        const closeBtn = document.getElementById('modal-close-btn');

        if (!modal || !titleElement || !messageElement || !iconContainer || !content || !closeBtn) {
            console.error("Erreur: Éléments du modal de notification manquants.");
            return; 
        }
        
        let titleText, iconSvg, titleColorClass, buttonColorClass, iconColorClass;

        if (type === 'success') {
            titleText = msgSuccessTitle;
            titleColorClass = 'text-green-700';
            buttonColorClass = 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
            iconColorClass = 'text-green-500';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 ${iconColorClass}"><path d="M22 11.08V12a10 10 0 1 1-5.6-8.98"/><path d="M9 11l3 3L22 4"/></svg>`;
        } else { 
            titleText = msgErrorTitle;
            titleColorClass = 'text-red-700';
            buttonColorClass = 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
            iconColorClass = 'text-red-500';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 ${iconColorClass}"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
        }

        titleElement.textContent = titleText;
        messageElement.textContent = message;
        iconContainer.innerHTML = iconSvg;
        
        titleElement.className = `text-lg font-bold mb-1 ${titleColorClass}`;
        closeBtn.className = `px-5 py-2 text-white rounded-lg text-sm font-semibold transition duration-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${buttonColorClass}`;

        modal.classList.remove('hidden');
        void modal.offsetWidth;
        modal.classList.remove('opacity-0');
        content.classList.remove('scale-95');
        content.classList.add('scale-100');
    }

    function hideNotification() {
        const modal = document.getElementById('message-modal');
        const content = document.getElementById('modal-content-msg');

        if (!modal || !content) return;

        modal.classList.add('opacity-0');
        content.classList.remove('scale-100');
        content.classList.add('scale-95');
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); 
    }

    // ----------------------------------------------------------------------
    // 2. GESTION DES MODALES CRUD & LOGIQUE MÉTIER
    // ----------------------------------------------------------------------

    function resetForm() {
        document.getElementById('classroom-form').reset();
        document.getElementById('classroom-id').value = '';
        document.getElementById('action-type').value = 'create';
        document.getElementById('modal-title').textContent = msgCreateTitle;
        
        const submitBtn = document.getElementById('submit-button');
        submitBtn.innerHTML = `<i class="fas fa-save"></i> <span>${msgBtnSave}</span>`;
        
        document.getElementById('active-status-field').classList.add('hidden');
    }

    function closeModal() {
        const modal = document.getElementById('classroom-modal');
        if (modal) {
            modal.classList.remove('flex');
            modal.classList.add('hidden');
        }
        resetForm();
    }

    function prepareEditModal(rowElement) {
        const classroomId = rowElement.dataset.id;
        const name = rowElement.dataset.name;
        const isActive = rowElement.dataset.isActive === 'true';

        if (!classroomId) return console.error("ID manquant sur la ligne");

        document.getElementById('classroom-id').value = classroomId;
        document.getElementById('action-type').value = 'update';
        document.getElementById('modal-title').textContent = msgUpdateTitleFormat.replace('{name}', name);
        
        const submitBtn = document.getElementById('submit-button');
        submitBtn.innerHTML = `<i class="fas fa-pencil-alt"></i> <span>${msgBtnUpdate}</span>`;
        
        document.getElementById('name').value = name;
        document.getElementById('is-active').checked = isActive;
        document.getElementById('active-status-field').classList.remove('hidden');

        const modal = document.getElementById('classroom-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    }

    async function handleToggleStatus(rowElement) {
        const classroomId = rowElement.dataset.id;
        const currentStatus = rowElement.dataset.isActive === 'true';
        const newStatus = !currentStatus;
        
        const dataToSend = {
            action: 'toggle_active',
            classroom_id: classroomId,
            is_active: newStatus
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN
                },
                body: JSON.stringify(dataToSend)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                const classroom = result.classroom; 
                updateClassroomUI(classroom.id, { is_active: classroom.is_active }); 
                updateClassroomCount(); 
                showNotification('success', result.message);
            } else {
                const errorMessage = result.message || `Erreur: HTTP ${response.status}`;
                showNotification('error', errorMessage);
            }
        } catch (error) {
            console.error("Erreur API (Toggle):", error);
            showNotification('error', msgServerCommError);
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        
        const actionType = document.getElementById('action-type').value;
        const classroomId = document.getElementById('classroom-id').value;
        const name = document.getElementById('name').value.trim();
        const isActive = document.getElementById('is-active').checked; 

        if (!name) return showNotification('error', msgNameRequired);

        const dataToSend = {
            action: actionType,
            classroom_id: actionType === 'update' ? classroomId : undefined,
            name: name,
            is_active: actionType === 'update' ? isActive : undefined 
        };

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN 
                },
                body: JSON.stringify(dataToSend)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                closeModal();
                const classroom = result.classroom; 

                if (actionType === 'create') {
                    addNewClassroomUI(classroom.id, classroom.name, classroom.is_active);
                } else {
                    updateClassroomUI(classroom.id, { name: classroom.name, is_active: classroom.is_active });
                }
                
                updateClassroomCount(); 
                showNotification('success', result.message);

            } else {
                const errorMessage = result.message || `Erreur: HTTP ${response.status}`;
                showNotification('error', errorMessage);
            }
        } catch (error) {
            console.error("Erreur Formulaire:", error);
            showNotification('error', msgServerCommError);
        }
    }

    // ----------------------------------------------------------------------
    // 3. MANIPULATION UI (Mises à jour DOM)
    // ----------------------------------------------------------------------

    function updateClassroomCount() {
        const countElement = document.getElementById('classroom-count-display');
        const tableBody = document.getElementById('classrooms-table-body');
        
        if (!countElement || !tableBody) return;

        let rowCount = tableBody.querySelectorAll('tr').length;
        if (document.getElementById('no-classroom-row')) {
            rowCount = 0;
        }
        countElement.textContent = rowCount;
    }

    function updateClassroomUI(id, data) {
        const row = document.getElementById(`classroom-row-${id}`);
        if (!row) return;

        if (data.name !== undefined) {
            row.querySelector('td:first-child').textContent = data.name;
            row.setAttribute('data-name', data.name);
        }
        if (data.is_active !== undefined) {
            const badge = document.getElementById(`status-badge-${id}`);
            const toggleBtn = document.getElementById(`toggle-btn-${id}`);
            const isActiveStr = data.is_active ? 'true' : 'false';

            if (badge) {
                badge.textContent = data.is_active ? msgActiveStatus : msgInactiveStatus;
                badge.className = `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${data.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`;
            }

            if (toggleBtn) {
                toggleBtn.className = `js-toggle-btn p-2 rounded-full hover:bg-gray-100 transition duration-150 inline-flex items-center justify-center ${data.is_active ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900'}`;
                const icon = toggleBtn.querySelector('i');
                if(icon) {
                     icon.className = `pointer-events-none fas ${data.is_active ? 'fa-toggle-on' : 'fa-toggle-off'}`;
                }
            }
            
            row.setAttribute('data-is-active', isActiveStr);
        }
    }

    function addNewClassroomUI(id, name, isActive) {
        const tableBody = document.getElementById('classrooms-table-body');
        const noRow = document.getElementById('no-classroom-row');
        if (noRow) noRow.remove();
        if (!tableBody) return;

        const isActiveStr = isActive ? 'true' : 'false';
        const badgeClass = isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        const toggleBtnClass = isActive ? 'text-red-600 hover:text-red-900' : 'text-green-600 hover:text-green-900';
        const toggleIconClass = isActive ? 'fa-toggle-on' : 'fa-toggle-off';

        const newRow = document.createElement('tr');
        newRow.id = `classroom-row-${id}`;
        newRow.setAttribute('data-id', id);
        newRow.setAttribute('data-name', name);
        newRow.setAttribute('data-is-active', isActiveStr);
        newRow.className = "hover:bg-gray-50/50 transition duration-100";
        
        // Séparation stricte icône + texte avec gap-2, et utilisation de text-end
        newRow.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" dir="auto">${escapeHtml(name)}</td>
            <td class="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                <span id="status-badge-${id}" 
                      class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}" dir="auto">
                    ${isActive ? msgActiveStatus : msgInactiveStatus}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-end text-sm font-medium">
                <div class="inline-flex items-center gap-2">
                    <button type="button" 
                            class="js-edit-btn text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-gray-100 transition duration-150 inline-flex items-center justify-center"
                            title="${msgEditTitle}">
                        <i class="fas fa-edit pointer-events-none"></i>
                    </button>
                    <button type="button"
                            id="toggle-btn-${id}"
                            class="js-toggle-btn ${toggleBtnClass} p-2 rounded-full hover:bg-gray-100 transition duration-150 inline-flex items-center justify-center"
                            title="${msgToggleTitle}">
                        <i class="fas ${toggleIconClass} pointer-events-none"></i>
                    </button>
                </div>
            </td>
        `;
        tableBody.appendChild(newRow);
    }

    // ----------------------------------------------------------------------
    // 4. ÉCOUTEURS D'ÉVÉNEMENTS (Délégation & Initialisation)
    // ----------------------------------------------------------------------

    updateClassroomCount();

    const messageModal = document.getElementById('message-modal');
    if (messageModal) {
        document.getElementById('modal-close-btn')?.addEventListener('click', hideNotification);
        const closeMsgX = messageModal.querySelector('.js-close-msg-modal');
        if(closeMsgX) closeMsgX.addEventListener('click', hideNotification);

        messageModal.addEventListener('click', (e) => {
            if (e.target === messageModal) hideNotification();
        });
    }

    document.getElementById('open-create-modal-btn')?.addEventListener('click', () => {
        resetForm();
        const modal = document.getElementById('classroom-modal');
        if (modal) {
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    });

    const closeCreateModalBtn = document.querySelector('.js-close-modal');
    if(closeCreateModalBtn) {
        closeCreateModalBtn.addEventListener('click', closeModal);
    }

    document.getElementById('classroom-form')?.addEventListener('submit', handleFormSubmit);

    const tableBody = document.getElementById('classrooms-table-body');
    if(tableBody) {
        tableBody.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.js-edit-btn');
            const toggleBtn = e.target.closest('.js-toggle-btn');
            const row = e.target.closest('tr');
            if(!row) return;

            if (editBtn) {
                prepareEditModal(row);
            } else if (toggleBtn) {
                handleToggleStatus(row);
            }
        });
    }

    const messageScriptTag = document.getElementById('django-messages-data');
    if (messageScriptTag) {
        try {
            const djangoMessages = JSON.parse(messageScriptTag.textContent);
            djangoMessages.forEach((msg, index) => {
                const tags = msg.tags; 
                let type = 'success';
                if (tags.includes('error') || tags.includes('warning')) {
                    type = 'error'; 
                }
                setTimeout(() => {
                    showNotification(type, msg.text);
                }, 100 + (index * 400)); 
            });
        } catch (error) {
            console.error("Erreur parsing messages:", error);
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
});