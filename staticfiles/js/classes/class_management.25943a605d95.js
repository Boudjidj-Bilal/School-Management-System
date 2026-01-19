/**
 * class_management.js
 * Gestion des classes (Création, Modification, Suppression)
 * Mode Production Safe
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Récupération de la Configuration (DOM) ---
    
    // On récupère le conteneur principal qui porte les données
    const container = document.getElementById('management-container');
    
    if (!container) {
        console.error("Erreur critique : Le conteneur #management-container est introuvable.");
        return;
    }

    // Récupération sécurisée des configurations
    const API_URL = container.dataset.apiUrl;
    // Conversion propre de la chaîne "true"/"false" en booléen JS
    const IS_CREATION_STAPE = container.dataset.isCreationStep === 'true';

    // Récupération du CSRF Token
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    if (!API_URL || !CSRF_TOKEN) {
        console.error("Configuration manquante : API_URL ou CSRF_TOKEN introuvable.");
    }


    // --- 2. Références DOM ---

    const classForm = document.getElementById('classForm');
    const classesList = document.getElementById('classes-list');
    const submitButton = document.getElementById('submit-button');
    const cancelButton = document.getElementById('cancel-button');
    const formContainer = document.getElementById('form-container');
    const formMessage = document.getElementById('form-message'); 

    // Éléments du formulaire
    const formTitle = document.getElementById('form-title');
    const actionInput = document.getElementById('action');
    const classIdInput = document.getElementById('class_id');
    const classNameInput = document.getElementById('class_name');
    const levelIdSelect = document.getElementById('level_id');

    // Éléments de la modale de confirmation
    const confirmModal = document.getElementById('confirm-modal');
    const confirmClassNameSpan = document.getElementById('confirm-class-name');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');

    // Variables d'état temporaires
    let classToDeleteId = null;
    let classToDeleteName = null;


    // --- 3. Fonctions de l'Interface Utilisateur ---

    function displayMessage(message, isSuccess) {
        if (!formMessage) return;

        formMessage.innerHTML = message;
        formMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
        
        if (isSuccess) {
            formMessage.classList.add('bg-green-100', 'text-green-700');
        } else {
            formMessage.classList.add('bg-red-100', 'text-red-700');
        }

        formMessage.classList.remove('hidden');
        
        setTimeout(() => {
            formMessage.classList.add('hidden');
        }, 5000);
    }

    function openConfirmModal(classId, className) {
        if (IS_CREATION_STAPE) return;
        
        classToDeleteId = classId;
        classToDeleteName = className;

        if (confirmClassNameSpan) confirmClassNameSpan.textContent = className;
        
        if (confirmModal) {
            confirmModal.classList.remove('hidden');
            confirmModal.classList.add('flex');
        }
    }

    function closeConfirmModal() {
        if (confirmModal) {
            confirmModal.classList.add('hidden');
            confirmModal.classList.remove('flex');
        }
        classToDeleteId = null;
        classToDeleteName = null;
    }

    function resetForm() {
        if(formTitle) formTitle.textContent = 'Créer une Nouvelle Classe';
        if(actionInput) actionInput.value = 'create';
        if(classIdInput) classIdInput.value = '';
        if(classNameInput) classNameInput.value = '';
        if(levelIdSelect) levelIdSelect.value = ''; 
        if(submitButton) submitButton.textContent = 'Créer la Classe';
        if(cancelButton) cancelButton.classList.add('hidden');
        if(formMessage) formMessage.classList.add('hidden'); 
    }

    function populateEditForm(id, name, levelId) {
        if (IS_CREATION_STAPE) return;

        if(formTitle) formTitle.textContent = `Modifier la Classe: ${name}`;
        if(actionInput) actionInput.value = 'update';
        if(classIdInput) classIdInput.value = id;
        if(classNameInput) classNameInput.value = name;
        if(levelIdSelect) levelIdSelect.value = levelId;
        if(submitButton) submitButton.textContent = 'Sauvegarder les Modifications';
        if(cancelButton) cancelButton.classList.remove('hidden');
        if(formMessage) formMessage.classList.add('hidden');

        if(classNameInput) classNameInput.focus();
        if(formContainer) formContainer.scrollIntoView({ behavior: 'smooth' }); 
    }


    // --- 4. Logique CRUD (API) ---

    async function performAction(action, payload) {
        if (IS_CREATION_STAPE && action !== 'create') return; // Sécurité: en création étape, seul create est permis normalement, ou bloqué totalement selon la logique métier

        if (action !== 'delete' && submitButton) {
            submitButton.disabled = true;
        }
        
        if(formMessage) formMessage.classList.add('hidden');

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (response.ok) {
                displayMessage(data.message, true);
                setTimeout(() => {
                    location.reload(); 
                }, 1500);
            } else {
                displayMessage(data.message || `Erreur: ${response.status}`, false);
            }
        } catch (error) {
            displayMessage(`Erreur réseau: ${error.message}`, false);
            console.error("Erreur action:", error);
        } finally {
            if (submitButton) {
                // Reste désactivé si on est en "Creation Step" global, sinon réactivé
                submitButton.disabled = IS_CREATION_STAPE; 
            }
        }
    }

    async function handleFormSubmit(event) {
        event.preventDefault();
        // Si IS_CREATION_STAPE est true, cela signifie généralement "Verrouillé" selon ton code HTML précédent (overlay + disabled).
        // Donc on bloque tout sauf si la logique métier a changé. Je garde la logique "disabled" de ton template.
        if (IS_CREATION_STAPE) return;

        const action = actionInput.value;
        const classId = classIdInput.value;
        const className = classNameInput.value.trim();
        const levelId = levelIdSelect.value;

        if (!className || !levelId) {
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

    async function confirmDeletion() {
        if (IS_CREATION_STAPE || classToDeleteId === null) return;
        
        const payload = {
            action: 'delete',
            class_id: classToDeleteId
        };

        closeConfirmModal();
        await performAction('delete', payload);
    }


    // --- 5. Gestionnaires d'Événements ---

    if (classForm) classForm.addEventListener('submit', handleFormSubmit);
    if (cancelButton) cancelButton.addEventListener('click', resetForm);

    if (classesList) {
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
                openConfirmModal(classId, className);
            }
        });
    }

    if (confirmDeleteBtn) confirmDeleteBtn.addEventListener('click', confirmDeletion);
    if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeConfirmModal);
    
    if (confirmModal) {
        confirmModal.addEventListener('click', (event) => {
            if (event.target === confirmModal) {
                closeConfirmModal();
            }
        });
    }
});