// --- VARIABLES GLOBALES (Initialisation) ---
// Ces variables sont définies dans le bloc <script> du template HTML
// const CSRF_TOKEN = ...
// const API_URL = ...
let exceptionDays = [];
let exceptionTimes = [];
let currentExceptionType = null;
let currentAction = 'create';
let reloadRequired = false;
let itemToDelete = null;

// --- UTILITIES ---

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

/** Ouvre le modal de confirmation de suppression */
function openDeleteModal(id, type) {
    itemToDelete = { id: id, type: type };
    
    // Mise à jour du texte (optionnel, pour le détail)
    const textElement = document.getElementById('delete-confirmation-text');
    const label = type === 'day' ? "ce jour d'exception" : "cet horaire d'exception";
    if(textElement) textElement.textContent = `Êtes-vous sûr de vouloir supprimer ${label} ? Cette action est irréversible.`;

    // Affichage du modal
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('hidden');
    // Animation simple
    setTimeout(() => {
        const content = modal.querySelector('div'); 
        if(content) content.classList.remove('scale-95', 'opacity-0');
    }, 10);
}

/** Ferme le modal de suppression */
function closeDeleteModal() {
    const modal = document.getElementById('delete-modal');
    modal.classList.add('hidden');
    itemToDelete = null; 
}


// --- RENDERING FUNCTIONS ---

/** Crée un bouton d'action */
function createActionButton(text, className, onClick, iconHtml = '') {
    return `<button onclick="${onClick}" 
                    class="text-sm font-medium py-1 px-2 rounded-lg transition 
                           ${className}">
                ${iconHtml} ${text}
            </button>`;
}

/** Met à jour l'affichage de la liste des jours d'exception */
function renderDayExceptions() {
    const listContainer = document.getElementById('day-list');
    listContainer.innerHTML = '';
    const noDataMsg = document.getElementById('no-day-exceptions');

    if (exceptionDays.length === 0) {
        noDataMsg.classList.remove('hidden');
        return;
    }
    noDataMsg.classList.add('hidden');

    exceptionDays.forEach(day => {
        const editButton = createActionButton('Modifier', 'text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200', `openCrudModal('day', ${day.id})`, '<i class="fas fa-edit"></i>');
        const deleteButton = createActionButton('Supprimer', 'text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200', `openDeleteModal('${day.id}', 'day')`, '<i class="fas fa-trash-alt"></i>');        const element = document.createElement('div');
        element.className = 'flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition';
        element.innerHTML = `
            <div class="mb-2 sm:mb-0">
                <p class="font-semibold text-gray-800">${day.type}</p>
                <p class="text-sm text-gray-600">Du ${formatDate(day.start_date)} au ${formatDate(day.end_date)}</p>
            </div>
            <div class="space-x-2 flex">
                ${editButton}
                ${deleteButton}
            </div>
        `;
        listContainer.appendChild(element);
    });
}

/** Met à jour l'affichage de la liste des horaires d'exception */
function renderTimeExceptions() {
    const listContainer = document.getElementById('time-list');
    listContainer.innerHTML = '';
    const noDataMsg = document.getElementById('no-time-exceptions');

    if (exceptionTimes.length === 0) {
        noDataMsg.classList.remove('hidden');
        return;
    }
    noDataMsg.classList.add('hidden');

    exceptionTimes.forEach(time => {
        const editButton = createActionButton('Modifier', 'text-blue-600 hover:text-blue-800 bg-blue-100 hover:bg-blue-200', `openCrudModal('time', ${time.id})`, '<i class="fas fa-edit"></i>');
        const deleteButton = createActionButton('Supprimer', 'text-red-600 hover:text-red-800 bg-red-100 hover:bg-red-200', `openDeleteModal('${time.id}', 'time')`, '<i class="fas fa-trash-alt"></i>');
        const element = document.createElement('div');
        element.className = 'flex items-center justify-between p-4 bg-gray-50 rounded-lg shadow-sm hover:bg-gray-100 transition';
        element.innerHTML = `
            <div>
                <p class="font-semibold text-gray-800">Pause de l'année</p>
                <p class="text-sm text-gray-600">De ${formatTime(time.start_time)} à ${formatTime(time.end_time)}</p>
            </div>
            <div class="space-x-2 flex">
                ${editButton}
                ${deleteButton}
            </div>
        `;
        listContainer.appendChild(element);
    });
}

/** Fonction principale de rendu */
function renderAll() {
    renderDayExceptions();
    renderTimeExceptions();
}


// --- MODAL CRUD HANDLERS ---
    
/** Ouvre la modale CRUD et initialise les champs */
function openCrudModal(type, id = null) {
    const modal = document.getElementById('crud-modal');
    const form = document.getElementById('exception-form');
    form.reset(); 
    
    currentExceptionType = type;
    currentAction = id ? 'update' : 'create';

    document.getElementById('exception-type').value = type;
    document.getElementById('exception-id').value = id || '';
    document.getElementById('crud-modal-title').textContent = id ? `Modifier l'Exception ${type === 'day' ? 'Journalière' : 'Horaire'}` : `Ajouter une Exception ${type === 'day' ? 'Journalière' : 'Horaire'}`;
    document.getElementById('submit-text').textContent = id ? 'Sauvegarder les modifications' : 'Créer';

    const dayFields = document.getElementById('day-fields');
    const timeFields = document.getElementById('time-fields');
    
    // Affichage/Masquage des champs
    dayFields.classList.toggle('hidden', type !== 'day');
    timeFields.classList.toggle('hidden', type !== 'time');

    // Chargement des données si c'est une modification
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

    modal.classList.remove('hidden');
    modal.classList.add('opacity-100'); // Fait apparaître la modal
}

/** Ferme la modale CRUD */
function closeCrudModal() {
    const modal = document.getElementById('crud-modal');
    modal.classList.add('hidden');
    modal.classList.remove('opacity-100'); 
    document.getElementById('exception-form').reset();
}


// --- MODAL DE FEEDBACK HANDLERS ---

/** Ouvre le modal de feedback avec un message donné */
function showFeedbackModal(message, isSuccess = true) {
    const modal = document.getElementById('feedback-modal');
    const iconContainer = document.getElementById('feedback-icon');
    const title = document.getElementById('feedback-title');
    const messageP = document.getElementById('feedback-message');
    const content = document.getElementById('feedback-content');
    
    let iconHtml;
    let colorClass;

    if (isSuccess) {
        title.textContent = "Opération Réussie !";
        colorClass = "bg-green-100 text-green-600";
        iconHtml = '<svg class="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
    } else {
        title.textContent = "Erreur !";
        colorClass = "bg-red-100 text-red-600";
        iconHtml = '<svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.332 16c-.77 1.333.192 3 1.732 3z"></path></svg>';
    }
    
    iconContainer.className = `flex items-center justify-center h-12 w-12 rounded-full ${colorClass}`;
    iconContainer.innerHTML = iconHtml;
    messageP.textContent = message;
    
    // Affichage avec animation
    modal.classList.remove('hidden');
    modal.classList.add('opacity-100');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}

/** Ferme le modal de feedback et recharge si nécessaire */
function closeFeedbackModal() {
    const modal = document.getElementById('feedback-modal');
    const content = document.getElementById('feedback-content');
    
    // Animation de fermeture
    modal.classList.remove('opacity-100');
    content.classList.remove('scale-100');
    content.classList.add('scale-95');

    setTimeout(() => {
        modal.classList.add('hidden');
        if (reloadRequired) {
            window.location.reload();
        }
    }, 300); // Temps correspondant à la transition CSS
}


// --- API INTERACTION ---

/** Fonction générique pour l'appel API (CRUD) */
async function handleApiCall(data) {
    const submitButton = document.getElementById('crud-submit-button');
    const submitText = document.getElementById('submit-text');
    const spinner = document.getElementById('loading-spinner');

    submitText.textContent = 'Chargement...';
    spinner.classList.remove('hidden');
    submitButton.disabled = true;

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Utilisation de la variable globale CSRF_TOKEN
                'X-CSRFToken': CSRF_TOKEN, 
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok && result.success) {
            closeCrudModal(); 
            reloadRequired = true; // Déclenchera le rechargement après le feedback
            showFeedbackModal(result.message, true);
        } else {
            // Afficher l'erreur du serveur dans la modal de feedback
            showFeedbackModal(result.message || "Erreur inconnue lors de l'opération.", false);
        }

    } catch (error) {
        console.error('Erreur API:', error);
        showFeedbackModal('Erreur de connexion au serveur. Vérifiez l\'URL et la console.', false);
    } finally {
        spinner.classList.add('hidden');
        // Rétablit le texte du bouton CRUD (l'action courante est stockée dans currentAction)
        submitText.textContent = currentAction === 'create' ? 'Créer' : 'Sauvegarder';
        submitButton.disabled = false;
    }
}

/** Gestionnaire de suppression (DELETE) */
function handleDelete(id, type) {
    // --- SUPPRIME LE BLOC IF(CONFIRM) ---
    // On passe directement à la suppression car le modal a déjà validé l'action.

    const deleteData = {
        action: 'delete',
        exception_type: type,
        exception_id: id,
    };

    handleApiCall(deleteData);
}

/** Gestionnaire de soumission du formulaire */
function handleFormSubmit(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const data = {};
    
    formData.forEach((value, key) => {
        data[key] = value;
    });

    data.action = data['exception_id'] ? 'update' : 'create';

    handleApiCall(data);
}

// --- INITIALISATION ---

window.addEventListener('load', function() {
    // 1. Récupération des données initiales depuis les json_script tags
    try {
        const daysScript = document.getElementById('exception_days_data');
        const timesScript = document.getElementById('exception_times_data');
        
        if (daysScript) {
            exceptionDays = JSON.parse(daysScript.textContent);
        }
        if (timesScript) {
            exceptionTimes = JSON.parse(timesScript.textContent);
        }

        // 2. Initialisation du rendu
        renderAll();

        // 3. Listener pour le bouton de confirmation de suppression (AJOUT)
        const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.addEventListener('click', function() {
                if (itemToDelete) {
                    handleDelete(itemToDelete.id, itemToDelete.type);
                    closeDeleteModal();
                }
            });
        }
        
        // 4. Attachement du listener de soumission de formulaire
        document.getElementById('exception-form').addEventListener('submit', handleFormSubmit);

    } catch (e) {
        console.error("Erreur lors de l'initialisation des données :", e);
        // Utiliser la modal de feedback en cas d'erreur critique
        showFeedbackModal("Erreur critique lors du chargement des données initiales. Consultez la console.", false);
    }
});
