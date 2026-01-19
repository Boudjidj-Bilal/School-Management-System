/**
 * Logique JavaScript pour la gestion des matières (CRUD via AJAX)
 * VERSION SÉCURISÉE (CSP Compliant)
 * * Ce script ne dépend PLUS de variables globales.
 * Il récupère les URLs depuis les attributs data-* du DOM 
 * et le CSRF Token depuis le formulaire.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Éléments du DOM ---
    const subjectForm = document.getElementById('subject-form');
    // Récupération du conteneur principal qui porte les URLs
    const subjectsContainer = document.getElementById('subjects-container'); 
    
    // Récupération sécurisée des variables depuis le DOM
    const saveSubjectUrl = subjectsContainer.getAttribute('data-save-url');
    const toggleStatusUrl = subjectsContainer.getAttribute('data-toggle-url');
    // Récupération du token CSRF directement depuis l'input généré par Django
    const csrfTokenInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const csrfToken = csrfTokenInput ? csrfTokenInput.value : '';

    const subjectNameInput = document.getElementById('subject-name');
    const subjectColorInput = document.getElementById('subject-color');
    const formTitle = document.getElementById('form-title');
    const submitBtn = document.getElementById('submit-btn');
    const cancelBtn = document.getElementById('cancel-btn');
    const createBtn = document.getElementById('create-btn');
    const subjectList = document.getElementById('subject-list');
    const formMessage = document.getElementById('form-message');
    const colorPreview = document.getElementById('color-preview');

    // Modal
    const modal = document.getElementById('confirmation-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMessage = document.getElementById('modal-message');
    const modalConfirmBtn = document.getElementById('modal-confirm-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    
    // --- Fonctions Utilitaires ---

    /**
     * Affiche un message de succès ou d'erreur au-dessus du formulaire.
     * @param {string} message - Le message à afficher.
     * @param {boolean} isSuccess - True pour succès, False pour erreur.
     */
    function displayMessage(message, isSuccess) {
        formMessage.innerHTML = message;
        formMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
        
        if (isSuccess) {
            formMessage.classList.add('bg-green-100', 'text-green-700');
        } else {
            formMessage.classList.add('bg-red-100', 'text-red-700');
        }
        
        // Cacher après 5 secondes
        setTimeout(() => {
            formMessage.classList.add('hidden');
        }, 5000);
    }
    
    /**
     * Réinitialise le formulaire en mode "Création".
     */
    function resetForm() {
        formTitle.textContent = 'Créer une nouvelle matière';
        subjectForm.reset();
        subjectForm.removeAttribute('data-subject-id'); 
        submitBtn.innerHTML = '<i class="fas fa-save mr-2"></i> Sauvegarder';
        colorPreview.textContent = '';
        subjectNameInput.focus();
    }
    
    // --- Événements du Formulaire et de la Liste ---

    // 1. Boutons Annuler / Créer
    cancelBtn.addEventListener('click', resetForm);
    createBtn.addEventListener('click', resetForm);

    // 2. Aperçu de la couleur et mise à jour du bouton
    subjectColorInput.addEventListener('change', () => {
        const selectedOption = subjectColorInput.options[subjectColorInput.selectedIndex];
        const colorValue = selectedOption.value.toLowerCase();
        // Vérification de sécurité si selectedOption existe
        const colorLabel = selectedOption ? selectedOption.textContent.split('(')[0].trim() : ''; 
        
        // Supprimer toutes les classes de couleur existantes avant d'ajouter la nouvelle
        colorPreview.className = 'text-sm mt-2 font-medium';
        
        if (colorValue) {
            colorPreview.innerHTML = `Couleur sélectionnée : <span class="px-2 py-0.5 rounded-full text-white font-medium bg-${colorValue}-500 text-xs">${colorLabel}</span>`;
        } else {
            colorPreview.textContent = '';
        }
    });


    // 3. Soumission du Formulaire (Création / Modification)
    subjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Sauvegarde...';

        const subjectId = subjectForm.getAttribute('data-subject-id');
        const name = subjectNameInput.value.trim();
        const color = subjectColorInput.value;

        const payload = {
            subject_id: subjectId || null,
            name: name,
            color: color,
        };

        try {
            // Utilisation de la variable locale saveSubjectUrl
            const response = await fetch(saveSubjectUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken, // Utilisation du token récupéré
                },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();

            if (result.success) {
                displayMessage(result.message, true);
                setTimeout(() => window.location.reload(), 1000); 
            } else {
                displayMessage(result.message, false);
            }
        } catch (error) {
            console.error('Erreur AJAX:', error);
            displayMessage(`Erreur de connexion : Impossible de contacter le serveur.`, false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    // 4. Logique d'Édition (Pré-remplissage du formulaire)
    subjectList.addEventListener('click', (e) => {
        const item = e.target.closest('.subject-link');
        
        if (item) {
            // Empêche l'édition si on clique sur le bouton toggle
            if (e.target.closest('.toggle-status-btn')) {
                return;
            }

            const subjectId = item.dataset.subjectId;
            const name = item.dataset.name;
            const color = item.dataset.color;

            // 1. Mise à jour du formulaire
            formTitle.textContent = `Modifier la matière : ${name}`;
            subjectNameInput.value = name;
            subjectColorInput.value = color;
            subjectForm.setAttribute('data-subject-id', subjectId);
            submitBtn.innerHTML = '<i class="fas fa-edit mr-2"></i> Modifier';

            // Déclenchez l'événement 'change' pour mettre à jour l'aperçu couleur
            const changeEvent = new Event('change');
            subjectColorInput.dispatchEvent(changeEvent);

            // 2. Scroll vers le formulaire
            subjectForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            subjectNameInput.focus();
        }
    });
    
    // 5. Logique d'activation / désactivation via Modal
    subjectList.addEventListener('click', (e) => {
        const toggleButton = e.target.closest('.toggle-status-btn');

        if (toggleButton) {
            const subjectId = toggleButton.dataset.subjectId;
            const isCurrentlyActive = toggleButton.dataset.action === 'deactivate'; 
            const subjectName = toggleButton.closest('li').querySelector('.subject-name').textContent;
            
            const action = isCurrentlyActive ? 'désactiver' : 'activer';

            // Préparation de la modal
            modalTitle.textContent = `Confirmer la ${action}ation`;
            modalMessage.innerHTML = `Voulez-vous vraiment <strong>${action}</strong> la matière <strong>"${subjectName}"</strong> ?`;
            
            modalConfirmBtn.textContent = action.charAt(0).toUpperCase() + action.slice(1);
            
            modalConfirmBtn.classList.toggle('bg-red-600', isCurrentlyActive);
            modalConfirmBtn.classList.toggle('hover:bg-red-700', isCurrentlyActive);
            modalConfirmBtn.classList.toggle('bg-indigo-600', !isCurrentlyActive);
            modalConfirmBtn.classList.toggle('hover:bg-indigo-700', !isCurrentlyActive);
            
            modal.classList.remove('hidden');

            // Clonage pour reset des event listeners
            modalConfirmBtn.replaceWith(modalConfirmBtn.cloneNode(true));
            modalCancelBtn.replaceWith(modalCancelBtn.cloneNode(true));
            
            const newModalConfirmBtn = document.getElementById('modal-confirm-btn');
            const newModalCancelBtn = document.getElementById('modal-cancel-btn');


            // Nouvelle fonction de confirmation
            const confirmHandler = async () => {
                modal.classList.add('hidden');
                toggleButton.disabled = true;
                
                const payload = {
                    subject_id: subjectId,
                };
                
                try {
                    // Utilisation de la variable locale toggleStatusUrl
                    const response = await fetch(toggleStatusUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken, // Utilisation du token récupéré
                        },
                        body: JSON.stringify(payload)
                    });

                    const result = await response.json();
                    
                    if (result.success) {
                        displayMessage(result.message, true);
                        setTimeout(() => window.location.reload(), 1000);
                    } else {
                        displayMessage(result.message, false);
                    }
                } catch (error) {
                    console.error('Erreur AJAX:', error);
                    displayMessage(`Erreur de connexion : Impossible d'effectuer la ${action}ation.`, false);
                } finally {
                    toggleButton.disabled = false;
                }
            };

            newModalConfirmBtn.addEventListener('click', confirmHandler);
            newModalCancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }
    });

});