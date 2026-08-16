/**
 * Logique JavaScript pour la gestion des matières (CRUD via AJAX)
 * VERSION SÉCURISÉE (CSP Compliant) et MULTILINGUE
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- Éléments du DOM ---
    const subjectForm = document.getElementById('subject-form');
    const subjectsContainer = document.getElementById('subjects-container'); 
    
    // Récupération sécurisée des variables et URLS
    const saveSubjectUrl = subjectsContainer.getAttribute('data-save-url');
    const toggleStatusUrl = subjectsContainer.getAttribute('data-toggle-url');
    const csrfTokenInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const csrfToken = csrfTokenInput ? csrfTokenInput.value : '';

    // Traductions dynamiques depuis le HTML
    const msgCreate = subjectsContainer.getAttribute('data-msg-create');
    const msgEdit = subjectsContainer.getAttribute('data-msg-edit');
    const msgSaving = subjectsContainer.getAttribute('data-msg-saving');
    const msgSave = subjectsContainer.getAttribute('data-msg-save');
    const msgUpdate = subjectsContainer.getAttribute('data-msg-update');
    const msgColorSelected = subjectsContainer.getAttribute('data-msg-color-selected');
    const msgErrorNetwork = subjectsContainer.getAttribute('data-msg-error-network');
    const msgConfirmActivation = subjectsContainer.getAttribute('data-msg-confirm-activation');
    const msgConfirmDeactivation = subjectsContainer.getAttribute('data-msg-confirm-deactivation');
    const msgAskActivate = subjectsContainer.getAttribute('data-msg-ask-activate');
    const msgAskDeactivate = subjectsContainer.getAttribute('data-msg-ask-deactivate');
    const msgBtnActivate = subjectsContainer.getAttribute('data-msg-btn-activate');
    const msgBtnDeactivate = subjectsContainer.getAttribute('data-msg-btn-deactivate');
    const msgErrorAction = subjectsContainer.getAttribute('data-msg-error-action');

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

    function displayMessage(message, isSuccess) {
        formMessage.innerHTML = message;
        formMessage.classList.remove('hidden', 'bg-red-100', 'text-red-700', 'bg-green-100', 'text-green-700');
        
        if (isSuccess) {
            formMessage.classList.add('bg-green-100', 'text-green-700');
        } else {
            formMessage.classList.add('bg-red-100', 'text-red-700');
        }
        
        setTimeout(() => {
            formMessage.classList.add('hidden');
        }, 5000);
    }
    
    function resetForm() {
        formTitle.textContent = msgCreate;
        subjectForm.reset();
        subjectForm.removeAttribute('data-subject-id'); 
        submitBtn.innerHTML = `<i class="fas fa-save"></i> <span>${msgSave}</span>`;
        colorPreview.textContent = '';
        subjectNameInput.focus();
    }
    
    // --- Événements du Formulaire et de la Liste ---

    cancelBtn.addEventListener('click', resetForm);
    createBtn.addEventListener('click', resetForm);

    subjectColorInput.addEventListener('change', () => {
        const selectedOption = subjectColorInput.options[subjectColorInput.selectedIndex];
        const colorValue = selectedOption.value.toLowerCase();
        const colorLabel = selectedOption ? selectedOption.textContent.split('(')[0].trim() : ''; 
        
        colorPreview.className = 'text-sm mt-2 font-medium flex items-center gap-2';
        
        if (colorValue) {
            colorPreview.innerHTML = `${msgColorSelected} <span class="px-2 py-0.5 rounded-full text-white font-medium bg-${colorValue}-500 text-xs">${colorLabel}</span>`;
        } else {
            colorPreview.textContent = '';
        }
    });

    subjectForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        submitBtn.disabled = true;
        const originalText = submitBtn.innerHTML;
        // On remplace par l'icône de chargement, toujours avec le système de gap de Flexbox
        submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> <span>${msgSaving}</span>`;

        const subjectId = subjectForm.getAttribute('data-subject-id');
        const name = subjectNameInput.value.trim();
        const color = subjectColorInput.value;

        const payload = {
            subject_id: subjectId || null,
            name: name,
            color: color,
        };

        try {
            const response = await fetch(saveSubjectUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken,
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
            displayMessage(msgErrorNetwork, false);
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        }
    });

    subjectList.addEventListener('click', (e) => {
        const item = e.target.closest('.subject-link');
        
        if (item) {
            if (e.target.closest('.toggle-status-btn')) {
                return;
            }

            const subjectId = item.dataset.subjectId;
            const name = item.dataset.name;
            const color = item.dataset.color;

            formTitle.textContent = `${msgEdit} ${name}`;
            subjectNameInput.value = name;
            subjectColorInput.value = color;
            subjectForm.setAttribute('data-subject-id', subjectId);
            submitBtn.innerHTML = `<i class="fas fa-edit"></i> <span>${msgUpdate}</span>`;

            const changeEvent = new Event('change');
            subjectColorInput.dispatchEvent(changeEvent);

            subjectForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            subjectNameInput.focus();
        }
    });
    
    subjectList.addEventListener('click', (e) => {
        const toggleButton = e.target.closest('.toggle-status-btn');

        if (toggleButton) {
            const subjectId = toggleButton.dataset.subjectId;
            const isCurrentlyActive = toggleButton.dataset.action === 'deactivate'; 
            const subjectName = toggleButton.closest('li').querySelector('.subject-name').textContent;
            
            modalTitle.textContent = isCurrentlyActive ? msgConfirmDeactivation : msgConfirmActivation;
            modalMessage.innerHTML = `${isCurrentlyActive ? msgAskDeactivate : msgAskActivate} <strong>"${subjectName}"</strong> ?`;
            
            modalConfirmBtn.textContent = isCurrentlyActive ? msgBtnDeactivate : msgBtnActivate;
            
            modalConfirmBtn.classList.toggle('bg-red-600', isCurrentlyActive);
            modalConfirmBtn.classList.toggle('hover:bg-red-700', isCurrentlyActive);
            modalConfirmBtn.classList.toggle('bg-indigo-600', !isCurrentlyActive);
            modalConfirmBtn.classList.toggle('hover:bg-indigo-700', !isCurrentlyActive);
            
            modal.classList.remove('hidden');

            modalConfirmBtn.replaceWith(modalConfirmBtn.cloneNode(true));
            modalCancelBtn.replaceWith(modalCancelBtn.cloneNode(true));
            
            const newModalConfirmBtn = document.getElementById('modal-confirm-btn');
            const newModalCancelBtn = document.getElementById('modal-cancel-btn');


            const confirmHandler = async () => {
                modal.classList.add('hidden');
                toggleButton.disabled = true;
                
                const payload = {
                    subject_id: subjectId,
                };
                
                try {
                    const response = await fetch(toggleStatusUrl, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken,
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
                    displayMessage(msgErrorAction, false);
                } finally {
                    toggleButton.disabled = false;
                }
            };

            newModalConfirmBtn.addEventListener('click', confirmHandler);
            newModalCancelBtn.addEventListener('click', () => modal.classList.add('hidden'));
        }
    });

});