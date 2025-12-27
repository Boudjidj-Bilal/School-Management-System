/**
 * Fichier de gestion des salles de classe (manage_classrooms.js)
 * Contient toute la logique JavaScript pour la manipulation de l'interface 
 * utilisateur (modales, notifications) et les appels API réels pour le CRUD.
 * * DÉPENDANCES CRUCIALES (Doivent être définies dans le template HTML) :
 * 1. const API_URL = "{% url 'votre_url_de_gestion_classrooms' %}"; 
 * 2. const CSRF_TOKEN = "{{ csrf_token }}";
 */

// ----------------------------------------------------------------------
// LOGIQUE DE LA MODALE DE NOTIFICATION UNIFORME (VISUELLE SEULEMENT)
// ----------------------------------------------------------------------

/**
 * Affiche la modale de notification avec le style approprié.
 * @param {('success'|'error')} type - Le type de message.
 * @param {string} message - Le corps du message.
 */
function showNotification(type, message) {
    const modal = document.getElementById('message-modal');
    const titleElement = document.getElementById('modal-title-msg');
    const messageElement = document.getElementById('modal-message');
    const iconContainer = document.getElementById('modal-icon-container');
    const content = document.getElementById('modal-content-msg');
    const closeBtn = document.getElementById('modal-close-btn');

    if (!modal || !titleElement || !messageElement || !iconContainer || !content || !closeBtn) {
        console.error("Erreur: Éléments du modal de notification manquants.");
        console.log("Tentative de notification non affichée:", message);
        return; 
    }
    
    let titleText, iconSvg, titleColorClass, buttonColorClass, iconColorClass;

    // 1. Définir le contenu et le style en fonction du type
    if (type === 'success') {
        titleText = 'Opération Réussie';
        titleColorClass = 'text-green-700';
        buttonColorClass = 'bg-green-600 hover:bg-green-700 focus:ring-green-500';
        iconColorClass = 'text-green-500';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 ${iconColorClass}"><path d="M22 11.08V12a10 10 0 1 1-5.6-8.98"/><path d="M9 11l3 3L22 4"/></svg>`;

    } else { // 'error' ou autre
        titleText = 'Erreur';
        titleColorClass = 'text-red-700';
        buttonColorClass = 'bg-red-600 hover:bg-red-700 focus:ring-red-500';
        iconColorClass = 'text-red-500';
        iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-6 h-6 ${iconColorClass}"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>`;
    }

    // 2. Mettre à jour le contenu
    titleElement.textContent = titleText;
    messageElement.textContent = message;
    iconContainer.innerHTML = iconSvg;
    
    // 3. Appliquer les styles dynamiques
    titleElement.className = `text-lg font-bold mb-1 ${titleColorClass}`;
    closeBtn.className = `px-5 py-2 text-white rounded-lg text-sm font-semibold transition duration-300 focus:outline-none focus:ring-2 focus:ring-opacity-50 ${buttonColorClass}`;

    // 4. Afficher le modal avec transitions
    modal.classList.remove('hidden');
    void modal.offsetWidth; // Force reflow
    modal.classList.remove('opacity-0');
    content.classList.remove('scale-95');
    content.classList.add('scale-100');
}

/** Masque la modale de notification. */
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
// GESTION DES MODALES CRUD ET DES ACTIONS (APPELS API RÉELS)
// ----------------------------------------------------------------------

/** Réinitialise le formulaire de création/modification. */
function resetForm() {
    document.getElementById('classroom-form').reset();
    document.getElementById('classroom-id').value = '';
    document.getElementById('action-type').value = 'create';
    document.getElementById('modal-title').textContent = 'Ajouter une Nouvelle Salle';
    document.getElementById('submit-button').innerHTML = '<i class="fas fa-save mr-2"></i> Enregistrer';
    document.getElementById('active-status-field').classList.add('hidden');
}

/** Ferme le modal de création/modification. */
function closeModal() {
    const modal = document.getElementById('classroom-modal');
    if (modal) {
        // CORRIGÉ : On retire 'flex' avant d'ajouter 'hidden'
        modal.classList.remove('flex');
        modal.classList.add('hidden');
    }
    resetForm();
}

/**
 * Ouvre le modal en mode "Modification" pour une salle existante.
 * @param {string} classroomId - L'ID de la salle à modifier.
 */
function openModalById(classroomId) {
    const row = document.getElementById(`classroom-row-${classroomId}`);
    if (!row) return console.error(`Ligne de salle ID ${classroomId} non trouvée.`);

    const name = row.getAttribute('data-name');
    const isActive = row.getAttribute('data-is-active') === 'true';

    document.getElementById('classroom-id').value = classroomId;
    document.getElementById('action-type').value = 'update';
    document.getElementById('modal-title').textContent = `Modifier la Salle: ${name}`;
    document.getElementById('submit-button').innerHTML = '<i class="fas fa-pencil-alt mr-2"></i> Mettre à jour';
    
    document.getElementById('name').value = name;
    document.getElementById('is-active').checked = isActive;
    document.getElementById('active-status-field').classList.remove('hidden');

    // CORRIGÉ : On ajoute 'flex' pour centrer le modal
    const modal = document.getElementById('classroom-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

/**
 * Envoie une requête d'action (Toggle Status) à l'API Django.
 * @param {string} classroomId - L'ID de la salle.
 */
async function handleToggleStatusById(classroomId) {
    const row = document.getElementById(`classroom-row-${classroomId}`);
    if (!row) return;

    // Récupérer le statut actuel pour envoyer le statut cible (opposé)
    const currentStatus = row.getAttribute('data-is-active') === 'true';
    const newStatus = !currentStatus;
    
    const dataToSend = {
        action: 'toggle_active',
        classroom_id: classroomId,
        is_active: newStatus // Le statut cible
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
            // Le compteur ne change pas lors du changement de statut
            updateClassroomCount(); 
            showNotification('success', result.message);
        } else {
            const errorMessage = result.message || `Erreur lors du changement de statut: HTTP ${response.status}`;
            showNotification('error', errorMessage);
        }
    } catch (error) {
        console.error("Erreur lors de l'appel API (Toggle Status):", error);
        showNotification('error', "Impossible de communiquer avec le serveur pour changer le statut.");
    }
}

/** * Gère la soumission du formulaire (Création ou Modification) via l'API.
 */
async function handleFormSubmit(e) {
    e.preventDefault();
    
    const actionType = document.getElementById('action-type').value;
    const classroomId = document.getElementById('classroom-id').value;
    const name = document.getElementById('name').value.trim();
    const isActive = document.getElementById('is-active').checked; 

    if (!name) return showNotification('error', "Le nom de la salle est obligatoire.");

    const dataToSend = {
        action: actionType, // 'create' ou 'update'
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
            
            // Mise à jour du compteur après la manipulation des lignes du tableau
            updateClassroomCount(); 
            showNotification('success', result.message);

        } else {
            const errorMessage = result.message || `Erreur lors de la soumission: HTTP ${response.status}`;
            showNotification('error', errorMessage);
        }
    } catch (error) {
        console.error("Erreur lors de la soumission du formulaire:", error);
        showNotification('error', "Impossible de communiquer avec le serveur.");
    }
}

// ----------------------------------------------------------------------
// MANIPULATION DE L'INTERFACE UTILISATEUR (UI)
// ----------------------------------------------------------------------

/**
 * Met à jour le compteur affiché sur la page en comptant les lignes réelles.
 */
function updateClassroomCount() {
    const countElement = document.getElementById('classroom-count-display');
    const tableBody = document.getElementById('classrooms-table-body');
    
    if (!countElement || !tableBody) {
        console.warn("L'élément de compteur ID 'classroom-count-display' ou le corps du tableau est manquant.");
        return;
    }

    // Compte toutes les lignes enfants
    let rowCount = tableBody.querySelectorAll('tr').length;
    
    // Si la ligne "Aucune salle de classe trouvée" est présente, le vrai compte est 0
    if (document.getElementById('no-classroom-row')) {
        rowCount = 0;
    }
    
    countElement.textContent = rowCount;
    
    console.log(`Compteur de salles mis à jour: ${rowCount}`);
}


/** * Met à jour l'affichage d'une ligne de salle existante.
 * @param {string} id - L'ID DOM de la ligne.
 * @param {Object} data - Les propriétés à mettre à jour (name, is_active).
 */
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
            badge.textContent = data.is_active ? 'Active' : 'Inactive';
            badge.classList.toggle('bg-green-100', data.is_active);
            badge.classList.toggle('text-green-800', data.is_active);
            badge.classList.toggle('bg-red-100', !data.is_active);
            badge.classList.toggle('text-red-800', !data.is_active);
        }

        if (toggleBtn) {
            toggleBtn.classList.toggle('text-red-600', data.is_active);
            toggleBtn.classList.toggle('hover:text-red-900', data.is_active);
            toggleBtn.classList.toggle('text-green-600', !data.is_active);
            toggleBtn.classList.toggle('hover:text-green-900', !data.is_active);
            const icon = toggleBtn.querySelector('i');
            if(icon) {
                 icon.classList.toggle('fa-toggle-on', data.is_active);
                 icon.classList.toggle('fa-toggle-off', !data.is_active);
            }
        }
        
        row.setAttribute('data-is-active', isActiveStr);
    }
}

/** * Ajoute une nouvelle ligne de salle au tableau.
 * @param {string} id - ID de la nouvelle salle (reçu du backend).
 * @param {string} name - Nom de la salle.
 * @param {boolean} isActive - Statut initial.
 */
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
    newRow.innerHTML = `
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${name}</td>
        <td class="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
            <span id="status-badge-${id}" 
                  class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${badgeClass}">
                ${isActive ? 'Active' : 'Inactive'}
            </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
            <button onclick="openModalById('${id}')" 
                    class="text-indigo-600 hover:text-indigo-900 p-2 rounded-full hover:bg-gray-100 transition duration-150"
                    title="Modifier">
                <i class="fas fa-edit"></i>
            </button>
            <button onclick="handleToggleStatusById('${id}')" 
                    id="toggle-btn-${id}"
                    class="${toggleBtnClass} ml-3 p-2 rounded-full hover:bg-gray-100 transition duration-150"
                    title="Changer le statut">
                <i class="fas ${toggleIconClass}"></i>
            </button>
        </td>
    `;
    tableBody.appendChild(newRow);
}


// ----------------------------------------------------------------------
// INITIALISATION DE LA PAGE
// ----------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
    // Exposer les fonctions au scope global pour les appels "onclick" dans le HTML
    window.openModalById = openModalById;
    window.closeModal = closeModal;
    window.handleToggleStatusById = handleToggleStatusById;
    window.showNotification = showNotification;
    window.hideNotification = hideNotification;
    window.updateClassroomCount = updateClassroomCount; // Exposer la fonction de compteur

    // Mettre à jour le compteur au chargement initial pour s'assurer qu'il est synchronisé
    updateClassroomCount();

    // 1. Événements de fermeture du modal de notification
    const messageModal = document.getElementById('message-modal');
    if (messageModal) {
        document.getElementById('modal-close-btn')?.addEventListener('click', hideNotification);
        messageModal.addEventListener('click', (e) => {
            if (e.target === messageModal) {
                hideNotification();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && messageModal && !messageModal.classList.contains('hidden')) {
            hideNotification();
        }
    });

    // 2. Événement pour ouvrir le modal de création
    document.getElementById('open-modal-create')?.addEventListener('click', () => {
        resetForm();
        const modal = document.getElementById('classroom-modal');
        if (modal) {
            // CORRIGÉ : On ajoute 'flex' pour centrer
            modal.classList.remove('hidden');
            modal.classList.add('flex');
        }
    });

    // 3. Gestion de l'envoi du formulaire (Création/Modification)
    document.getElementById('classroom-form')?.addEventListener('submit', handleFormSubmit);

    // 4. Traitement des messages Django au chargement de la page (lecture du JSON)
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
            console.error("Erreur lors du parsing des messages Django:", error);
        }
    }
});
