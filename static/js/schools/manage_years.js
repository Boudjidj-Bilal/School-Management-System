document.addEventListener('DOMContentLoaded', () => {
    
    // Éléments du DOM
    const yearForm = document.getElementById('year-form');
    const container = document.getElementById('year-management-container'); // Le conteneur principal (à ajouter dans le HTML)

    // Récupération des traductions depuis les data-attributes du conteneur
    const msgCreation = container.getAttribute('data-msg-creation');
    const msgRegistration = container.getAttribute('data-msg-registration');
    const msgRunning = container.getAttribute('data-msg-running');
    const msgEndYear = container.getAttribute('data-msg-end-year');
    const msgFinished = container.getAttribute('data-msg-finished');
    const msgSuccess = container.getAttribute('data-msg-success');
    const msgError = container.getAttribute('data-msg-error');
    const msgCreateNew = container.getAttribute('data-msg-create-new');
    const msgCreateBtn = container.getAttribute('data-msg-create-btn');
    const msgEditYear = container.getAttribute('data-msg-edit-year');
    const msgSaveEdits = container.getAttribute('data-msg-save-edits');
    const msgNoYearSelected = container.getAttribute('data-msg-no-year-selected');
    const msgNetworkError = container.getAttribute('data-msg-network-error');
    
    const msgModalTitleForward = container.getAttribute('data-msg-modal-title-forward');
    const msgModalBodyForward = container.getAttribute('data-msg-modal-body-forward');
    const msgModalBtnForward = container.getAttribute('data-msg-modal-btn-forward');
    
    const msgModalTitleBackward = container.getAttribute('data-msg-modal-title-backward');
    const msgModalBodyBackward = container.getAttribute('data-msg-modal-body-backward');
    const msgModalBtnBackward = container.getAttribute('data-msg-modal-btn-backward');

    // Définition de l'ordre des étapes de l'année scolaire (avec labels traduits)
    const STATUS_ORDER = [
        { key: 'creation', label: msgCreation },
        { key: 'registration', label: msgRegistration },
        { key: 'running', label: msgRunning },
        { key: 'end_year', label: msgEndYear },
        { key: 'finished', label: msgFinished }
    ];

    const createBtn = document.getElementById('create-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    
    // Contrôles de statut
    const statusControls = document.getElementById('statusControls');
    const prevStatusBtn = document.getElementById('prevStatusBtn');
    const nextStatusBtn = document.getElementById('nextStatusBtn');
    
    // Champs du formulaire
    const yearIdInput = document.getElementById('year-id');
    const nameInput = document.getElementById('name');
    const startDateInput = document.getElementById('start_date');
    const endDateInput = document.getElementById('end_date');
    const minTimeInput = document.getElementById('min_time');
    const maxTimeInput = document.getElementById('max_time');

    // Affichage du statut
    const statusDisplay = document.getElementById('status-display');
    const currentStatusText = document.getElementById('current-status');
    const currentYearFlag = document.getElementById('current-year-flag');

    // Modal de message
    const messageModal = document.getElementById('message-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalCloseBtn = document.getElementById('modal-close-btn');

    // Modal de Cycle de Vie
    const lifecycleModal = document.getElementById('lifecycle-modal');
    const lifecycleTitle = document.getElementById('lifecycle-modal-title');
    const lifecycleMessage = document.getElementById('lifecycle-modal-message');
    const lifecycleConfirmBtn = document.getElementById('lifecycle-confirm-btn');
    const lifecycleCancelBtn = document.getElementById('lifecycle-cancel-btn');
    
    let pendingDirection = 0; 

    const apiUrl = '/schools/api/years/'; 
    const schoolId = yearForm.getAttribute('data-school-id');
    const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

    function showModal(message, isSuccess) {
        modalTitle.textContent = isSuccess ? msgSuccess : msgError;
        modalMessage.innerHTML = message;

        const titleClasses = isSuccess ? 'text-green-600' : 'text-red-600';
        const buttonClasses = isSuccess ? 'bg-blue-600 hover:bg-blue-700' : 'bg-red-600 hover:bg-red-700';

        modalTitle.classList.remove('text-green-600', 'text-red-600');
        modalCloseBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700', 'bg-red-600', 'hover:bg-red-700');
        
        modalTitle.classList.add(...titleClasses.split(' ')); 
        modalCloseBtn.classList.add(...buttonClasses.split(' '));

        messageModal.classList.remove('hidden');

        if (isSuccess) {
            setTimeout(() => window.location.reload(), 1500);
        }
    }

    modalCloseBtn.addEventListener('click', () => {
        messageModal.classList.add('hidden');
    });

    function resetForm() {
        yearForm.reset();
        yearIdInput.value = '';
        formTitle.textContent = msgCreateNew;
        submitBtn.textContent = msgCreateBtn;
        submitBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
        submitBtn.classList.add('bg-blue-600', 'hover:bg-blue-700');
        cancelBtn.style.display = 'none';
        
        statusControls.classList.add('hidden'); 
        statusDisplay.classList.add('hidden');
        currentYearFlag.classList.add('hidden');
        
        // MODIFICATION RTL: border-l-4 devient border-s-4
        document.querySelectorAll('.year-link').forEach(l => l.classList.remove('bg-gray-200', 'border-indigo-400', 'border-s-4'));
    }

    function getCurrentStatus(dataset) {
        let currentStatusKey = 'creation'; 
        
        for (const status of STATUS_ORDER) {
            if (dataset[status.key] === 'true') {
                currentStatusKey = status.key;
                break;
            }
        }
        
        const currentStatusIndex = STATUS_ORDER.findIndex(s => s.key === currentStatusKey);
        
        return {
            status: STATUS_ORDER[currentStatusIndex],
            index: currentStatusIndex
        };
    }

    function loadYearForEdit(link) {
        const yearId = link.dataset.yearId;
        const yearName = link.dataset.name;
        const startDate = link.dataset.startDate;
        const endDate = link.dataset.endDate;
        const minTime = link.dataset.minTime;
        const maxTime = link.dataset.maxTime;
        const isCurrent = link.dataset.current === 'true';

        const { status: currentStatus, index: currentStatusIndex } = getCurrentStatus(link.dataset);

        yearIdInput.value = yearId;
        nameInput.value = yearName;
        startDateInput.value = startDate;
        endDateInput.value = endDate;
        minTimeInput.value = minTime;
        maxTimeInput.value = maxTime;

        formTitle.textContent = `${msgEditYear} : ${yearName}`;
        submitBtn.textContent = msgSaveEdits;
        submitBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700');
        submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');
        cancelBtn.style.display = 'block';

        statusDisplay.classList.remove('hidden');
        currentStatusText.textContent = currentStatus.label;
        if (isCurrent) {
            currentYearFlag.classList.remove('hidden');
        } else {
            currentYearFlag.classList.add('hidden');
        }

        if (isCurrent) {
            statusControls.classList.remove('hidden');
            prevStatusBtn.disabled = currentStatusIndex <= 0; 
            nextStatusBtn.disabled = currentStatusIndex >= STATUS_ORDER.length - 1; 
        } else {
            statusControls.classList.add('hidden');
        }
    }

    async function changeYearStatus(yearId, newStatusKey) {
        prevStatusBtn.disabled = true;
        nextStatusBtn.disabled = true;

        const url = `${apiUrl}${yearId}/change_status/`; 
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify({ new_status: newStatusKey })
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showModal(result.message, true); // Message backend géré par Django
            } else {
                prevStatusBtn.disabled = false;
                nextStatusBtn.disabled = false;
                showModal(result.message || msgError, false);
            }

        } catch (error) {
            prevStatusBtn.disabled = false;
            nextStatusBtn.disabled = false;
            showModal(msgNetworkError, false);
            console.error('Erreur API changement de statut:', error);
        }
    }

    function handleStatusChange(direction) {
        const yearId = yearIdInput.value;
        const activeLink = document.querySelector('.year-link.bg-gray-200');

        if (!yearId || !activeLink) {
            showModal(msgNoYearSelected, false);
            return;
        }

        const { index: currentStatusIndex } = getCurrentStatus(activeLink.dataset);
        const newStatusIndex = currentStatusIndex + direction;

        if (newStatusIndex >= 0 && newStatusIndex < STATUS_ORDER.length) {
            const newStatusKey = STATUS_ORDER[newStatusIndex].key;
            changeYearStatus(yearId, newStatusKey);
        }
    }

    function openLifecycleModal(direction) {
        pendingDirection = direction;
        lifecycleModal.classList.remove('hidden');

        if (direction === 1) {
            lifecycleTitle.textContent = msgModalTitleForward;
            lifecycleTitle.className = "text-lg font-bold leading-6 text-indigo-900";
            // msgModalBodyForward doit contenir la structure HTML traduite (avec ps-5 au lieu de pl-5)
            lifecycleMessage.innerHTML = msgModalBodyForward;
            
            // MODIFICATION : Utilisation de Flex et gap-2 pour le bouton au lieu de text et icone en vrac
            lifecycleConfirmBtn.className = "inline-flex items-center gap-2 w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:w-auto transition-colors";
            lifecycleConfirmBtn.innerHTML = `<span>${msgModalBtnForward}</span> <i class="fas fa-arrow-right"></i>`;
        
        } else {
            lifecycleTitle.textContent = msgModalTitleBackward;
            lifecycleTitle.className = "text-lg font-bold leading-6 text-orange-800";
            lifecycleMessage.innerHTML = msgModalBodyBackward;

            // MODIFICATION : Utilisation de Flex et gap-2 pour le bouton au lieu de text et icone en vrac
            lifecycleConfirmBtn.className = "inline-flex items-center gap-2 w-full justify-center rounded-md bg-orange-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-500 sm:w-auto transition-colors";
            lifecycleConfirmBtn.innerHTML = `<i class="fas fa-undo"></i> <span>${msgModalBtnBackward}</span>`;
        }
    }

    function closeLifecycleModal() {
        lifecycleModal.classList.add('hidden');
        pendingDirection = 0;
    }

    lifecycleCancelBtn.addEventListener('click', closeLifecycleModal);
    
    lifecycleConfirmBtn.addEventListener('click', () => {
        handleStatusChange(pendingDirection);
        closeLifecycleModal();
    });

    prevStatusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openLifecycleModal(-1);
    });

    nextStatusBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openLifecycleModal(1);
    });

    document.querySelectorAll('.year-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            // MODIFICATION RTL: border-l-4 devient border-s-4
            document.querySelectorAll('.year-link').forEach(l => l.classList.remove('bg-gray-200', 'border-indigo-400', 'border-s-4'));

            link.classList.add('bg-gray-200', 'border-indigo-400', 'border-s-4');

            loadYearForEdit(link);
        });
    });

    createBtn.addEventListener('click', resetForm);

    cancelBtn.addEventListener('click', resetForm);

    yearForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const data = {
            year_id: yearIdInput.value || null,
            name: nameInput.value,
            start_date: startDateInput.value,
            end_date: endDateInput.value,
            min_time: minTimeInput.value,
            max_time: maxTimeInput.value,
            school_id: schoolId
        };

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();

            if (response.ok && result.success) {
                showModal(result.message, true); // Géré par django
            } else {
                showModal(result.message || msgError, false);
            }

        } catch (error) {
            showModal(msgNetworkError, false);
            console.error('Erreur lors de la soumission du formulaire:', error);
        }
    });

    const currentYearLink = document.querySelector('#year-list-current .year-link');
    if (currentYearLink) {
        // MODIFICATION RTL: border-l-4 devient border-s-4
        currentYearLink.classList.add('bg-gray-200', 'border-indigo-400', 'border-s-4'); 
        loadYearForEdit(currentYearLink);
        cancelBtn.style.display = 'none'; 
    } else {
        resetForm(); 
    }
});