// --- 1. Références DOM et Variables Globales ---

// Les variables API_URL, CSRF_TOKEN et IS_CREATION_STAPE sont définies globalement dans le block extra_js du template HTML.
const classForm = document.getElementById('classForm');
const classesList = document.getElementById('classes-list');
const submitButton = document.getElementById('submit-button');
const cancelButton = document.getElementById('cancel-button');
const formContainer = document.getElementById('form-container');

// NOUVEL ÉLÉMENT DE MESSAGE
const formMessage = document.getElementById('form-message'); 

// Éléments du formulaire
const formTitle = document.getElementById('form-title');
const actionInput = document.getElementById('action');
const classIdInput = document.getElementById('class_id');
const classNameInput = document.getElementById('class_name');
const levelIdSelect = document.getElementById('level_id');

// Nouveaux éléments de la modale de confirmation
const confirmModal = document.getElementById('confirm-modal');
const confirmClassNameSpan = document.getElementById('confirm-class-name');
const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

// Variables pour stocker temporairement l'ID et le nom de la classe à supprimer
let classToDeleteId = null;
let classToDeleteName = null;


// --- 2. Fonctions de l'Interface Utilisateur ---

/**
 * Affiche un message de succès ou d'erreur au-dessus du formulaire (#form-message).
 * @param {string} message - Le message à afficher.
 * @param {boolean} isSuccess - True pour succès (vert), False pour erreur (rouge).
 */
function displayMessage(message, isSuccess) {
    if (!formMessage) return; // Sécurité

    // 1. Définir le contenu
    formMessage.innerHTML = message;
    
    // 2. Réinitialiser toutes les classes de couleur et cacher
    formMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
    
    // 3. Appliquer les classes de style spécifiques
    if (isSuccess) {
        formMessage.classList.add('bg-green-100', 'text-green-700');
    } else {
        formMessage.classList.add('bg-red-100', 'text-red-700');
    }

    // S'assurer qu'il est visible
    formMessage.classList.remove('hidden');
    
    // 4. Cacher après 5 secondes
    setTimeout(() => {
        formMessage.classList.add('hidden');
    }, 5000);
}


/**
 * Affiche la modale de confirmation et configure les données.
 * @param {number} classId - L'ID de la classe à supprimer.
 * @param {string} className - Le nom de la classe.
 */
function openConfirmModal(classId, className) {
    if (IS_CREATION_STAPE) return;
    
    // Stocker les données temporairement
    classToDeleteId = classId;
    classToDeleteName = className;

    // Mettre à jour le contenu de la modale
    confirmClassNameSpan.textContent = className;
    
    // Afficher la modale
    confirmModal.classList.remove('hidden');
    confirmModal.classList.add('flex');
}

/**
 * Masque la modale de confirmation et réinitialise les données temporaires.
 */
function closeConfirmModal() {
    confirmModal.classList.add('hidden');
    confirmModal.classList.remove('flex');
    classToDeleteId = null;
    classToDeleteName = null;
}

/**
 * Réinitialise le formulaire à l'état de "Création".
 */
function resetForm() {
    formTitle.textContent = 'Créer une Nouvelle Classe';
    actionInput.value = 'create';
    classIdInput.value = '';
    classNameInput.value = '';
    levelIdSelect.value = ''; 
    submitButton.textContent = 'Créer la Classe';
    cancelButton.classList.add('hidden');
    // Cacher le message lors de la réinitialisation
    formMessage.classList.add('hidden'); 
}

/**
 * Remplit le formulaire pour l'édition d'une classe existante.
 * @param {number} id - L'ID de la classe.
 * @param {string} name - Le nom de la classe.
 * @param {string} levelId - L'ID du niveau associé.
 */
function populateEditForm(id, name, levelId) {
    if (IS_CREATION_STAPE) return; // Sécurité supplémentaire

    formTitle.textContent = `Modifier la Classe: ${name}`;
    actionInput.value = 'update';
    classIdInput.value = id;
    classNameInput.value = name;
    levelIdSelect.value = levelId;
    submitButton.textContent = 'Sauvegarder les Modifications';
    cancelButton.classList.remove('hidden');
    // Cacher le message lors du passage en mode édition
    formMessage.classList.add('hidden');

    classNameInput.focus();
    // Scroll vers le formulaire sur mobile/tablette
    formContainer.scrollIntoView({ behavior: 'smooth' }); 
}

// --- 3. Logique CRUD (API) ---

/**
 * Exécute l'action CRUD via l'API.
 * @param {string} action - 'create', 'update', ou 'delete'.
 * @param {Object} payload - Les données à envoyer.
 */
async function performAction(action, payload) {
    if (IS_CREATION_STAPE) return; // Bloque l'action si désactivée

    // Désactive le bouton, sauf si c'est une suppression
    if (action !== 'delete') {
        submitButton.disabled = true;
    }
    
    // Cache l'ancien message au début d'une nouvelle tentative
    formMessage.classList.add('hidden');

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': CSRF_TOKEN
            },
            body: JSON.stringify(payload)
        });

        // Tenter de lire le JSON pour obtenir le message du serveur (même en cas d'erreur HTTP)
        const data = await response.json();

        if (response.ok) {
            // Statut HTTP 2xx (Succès)
            // *** UTILISATION DE displayMessage POUR LE SUCCÈS ***
            displayMessage(data.message, true);
            
            // Rechargement simple et fiable après un court délai pour laisser le temps de lire le message
            setTimeout(() => {
                location.reload(); 
            }, 1500);
            
        } else {
            // Statut HTTP 4xx ou 5xx (Erreur)
            // *** UTILISATION DE displayMessage POUR L'ERREUR ***
            // Affiche le message d'erreur du backend (data.message) ou un message générique
            displayMessage(data.message || `Erreur: ${response.status} - ${response.statusText}`, false);
            return; // Arrête le processus en cas d'erreur
        }
    } catch (error) {
        // Erreur réseau ou JSON non valide
        // *** UTILISATION DE displayMessage POUR L'ERREUR RÉSEAU ***
        displayMessage(`Erreur réseau ou format de réponse invalide: ${error.message}`, false);
        console.error("Erreur dans performAction:", error);
    } finally {
        // Réactive le bouton (si non bloqué par IS_CREATION_STAPE)
        submitButton.disabled = IS_CREATION_STAPE; 
    }
}

/**
 * Gère la soumission du formulaire pour Création ou Modification.
 */
async function handleFormSubmit(event) {
    event.preventDefault();
    if (IS_CREATION_STAPE) return;

    const action = actionInput.value;
    const classId = classIdInput.value;
    const className = classNameInput.value.trim();
    const levelId = levelIdSelect.value;

    if (!className || !levelId) {
        // *** UTILISATION DE displayMessage POUR LA VALIDATION LOCALE ***
        displayMessage("Veuillez sélectionner un niveau et donner un nom à la classe.", false);
        return;
    }

    const payload = {
        action: action,
        class_id: classId || undefined,
        class_name: className,
        level_id: levelId
    };
    
    await performAction(action, payload);
}

/**
 * Déclenche la suppression si la confirmation est donnée.
 * Cette fonction est appelée par le bouton de confirmation de la modale.
 */
async function confirmDeletion() {
    if (IS_CREATION_STAPE || classToDeleteId === null) return;
    
    const payload = {
        action: 'delete',
        class_id: classToDeleteId
    };

    closeConfirmModal(); // Ferme la modale avant d'effectuer l'action
    await performAction('delete', payload);
}


// --- 4. Gestion des Événements (Délégation) ---

document.addEventListener('DOMContentLoaded', () => {
    // 1. Soumission du formulaire (Création/Modification)
    classForm.addEventListener('submit', handleFormSubmit);

    // 2. Bouton Annuler (dans le formulaire d'édition)
    cancelButton.addEventListener('click', resetForm);

    // 3. Gestion des boutons Modifier/Supprimer dans le tableau
    classesList.addEventListener('click', (event) => {
        const target = event.target.closest('button');
        if (!target) return;

        const action = target.getAttribute('data-action');
        const classId = target.getAttribute('data-id');
        const className = target.getAttribute('data-name');
        const levelId = target.getAttribute('data-level-id');

        if (IS_CREATION_STAPE || !classId) return;

        if (action === 'edit') {
            populateEditForm(classId, className, levelId);
        } else if (action === 'delete') {
            // Ouvre la modale au lieu d'utiliser window.confirm()
            openConfirmModal(classId, className);
        }
    });

    // 4. Gestion des boutons de la modale de confirmation
    
    // Bouton Confirmer (Supprimer Définitivement)
    confirmDeleteBtn.addEventListener('click', confirmDeletion);
    
    // Bouton Annuler
    cancelDeleteBtn.addEventListener('click', closeConfirmModal);

    // Fermeture de la modale en cliquant sur l'arrière-plan (optionnel, mais bon UX)
    confirmModal.addEventListener('click', (event) => {
        // Si on clique directement sur la modale (l'arrière-plan)
        if (event.target === confirmModal) {
            closeConfirmModal();
        }
    });
});
