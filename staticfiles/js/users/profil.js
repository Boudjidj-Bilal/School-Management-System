/**
 * Gestion de la page de profil utilisateur.
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 0. Récupération de la configuration depuis le DOM ---
    const csrfInput = document.getElementById('csrf-token');
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    // --- Éléments du Formulaire Mot de Passe ---
    const form = document.getElementById('change-password-form');
    const messageArea = document.getElementById('message-area');
    const submitBtn = document.getElementById('btn-save-password');

    // --- Éléments de la Photo de Profil ---
    const profileInput = document.getElementById('profile-image-input');
    const profileImgDisplay = document.getElementById('profile-image-display');
    const profileInitialsDisplay = document.getElementById('profile-initials-display');
    const btnDeletePhoto = document.getElementById('btn-delete-photo');
    const triggerUploadBtn = document.getElementById('trigger-upload-btn'); 

    // URLs API
    const apiChangePasswordUrl = form ? form.getAttribute('data-api-url') : null;
    const apiProfilePictureUrl = profileInput ? profileInput.getAttribute('data-api-url') : null;

    // Récupération des Textes Traduits
    const msgMismatch = form ? form.dataset.msgMismatch : "Les nouveaux mots de passe ne correspondent pas.";
    const msgShort = form ? form.dataset.msgShort : "Le mot de passe doit faire au moins 4 caractères.";
    const msgTechError = form ? form.dataset.msgTechError : "Une erreur technique est survenue.";
    const msgProcessing = form ? form.dataset.msgProcessing : "Traitement...";
    
    const msgErrorUpdate = profileInput ? profileInput.dataset.msgErrorUpdate : "Impossible de mettre à jour la photo.";
    const msgErrorPrefix = profileInput ? profileInput.dataset.msgErrorPrefix : "Erreur :";
    
    const modalFooter = document.querySelector('.sm\\:flex-row-reverse');
    const msgErrorDelete = modalFooter ? modalFooter.dataset.msgErrorDelete : "Impossible de supprimer la photo.";


    // =================================================================
    // 1. TOGGLE PASSWORD VISIBILITY (Afficher/Masquer)
    // =================================================================
    
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const targetId = this.dataset.target;
            const input = document.getElementById(targetId);
            const icon = this.querySelector('i');
            
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });


    // =================================================================
    // 2. SOUMISSION DU FORMULAIRE MOT DE PASSE (AJAX)
    // =================================================================

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            // --- A. Nettoyage UI ---
            hideMessage();
            const originalBtnText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            // Utilisation du message traduit et de me-2 au lieu de mr-2 pour l'icône de chargement
            submitBtn.innerHTML = `<i class="fas fa-spinner fa-spin me-2"></i> ${msgProcessing}`;
            
            // --- B. Récupération des données ---
            const currentPassword = document.getElementById('current_password').value;
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = document.getElementById('confirm_password').value;

            // --- C. Validation Client basique ---
            if (newPassword !== confirmPassword) {
                showMessage(msgMismatch, "error");
                resetButton(originalBtnText);
                return;
            }
            
            if (newPassword.length < 4) {
                showMessage(msgShort, "error");
                resetButton(originalBtnText);
                return;
            }

            // --- D. Envoi API ---
            try {
                if (!apiChangePasswordUrl) throw new Error("URL API manquante");

                const response = await fetch(apiChangePasswordUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CSRF_TOKEN
                    },
                    body: JSON.stringify({
                        current_password: currentPassword,
                        new_password: newPassword,
                        confirm_password: confirmPassword
                    })
                });

                const result = await response.json();

                if (result.success) {
                    showMessage(result.message, "success"); // result.message est déjà traduit par le backend Python
                    form.reset(); 
                } else {
                    showMessage(result.message, "error");
                }

            } catch (error) {
                console.error("Erreur API MDP:", error);
                showMessage(msgTechError, "error");
            } finally {
                resetButton(originalBtnText);
            }
        });
    }

    // =================================================================
    // 3. GESTION DE LA PHOTO DE PROFIL
    // =================================================================

    if (triggerUploadBtn && profileInput) {
        triggerUploadBtn.addEventListener('click', () => {
            profileInput.click();
        });
    }

    if (profileInput) {
        profileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('profile_picture', file);

            try {
                if (!apiProfilePictureUrl) throw new Error("URL API Photo manquante");

                if(profileImgDisplay) profileImgDisplay.style.opacity = '0.5';

                const response = await fetch(apiProfilePictureUrl, {
                    method: 'POST',
                    headers: {
                        'X-CSRFToken': CSRF_TOKEN
                    },
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    profileImgDisplay.src = result.new_image_url; 
                    profileImgDisplay.classList.remove('hidden');
                    if (profileInitialsDisplay) profileInitialsDisplay.classList.add('hidden');
                    if (btnDeletePhoto) btnDeletePhoto.classList.remove('hidden');
                } else {
                    alert(`${msgErrorPrefix} ${result.message}`);
                }

            } catch (error) {
                console.error("Erreur API Photo:", error);
                alert(msgErrorUpdate);
            } finally {
                if(profileImgDisplay) profileImgDisplay.style.opacity = '1';
                profileInput.value = ''; 
            }
        });
    }

    const deleteModal = document.getElementById('delete-photo-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    if (btnDeletePhoto) {
        btnDeletePhoto.addEventListener('click', function(e) {
            e.preventDefault();
            if (deleteModal) deleteModal.classList.remove('hidden');
        });
    }

    if (modalCancelBtn && deleteModal) {
        modalCancelBtn.addEventListener('click', () => {
            deleteModal.classList.add('hidden');
        });
    }

    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async function() {
            
            if (deleteModal) deleteModal.classList.add('hidden');

            try {
                if (!apiProfilePictureUrl) throw new Error("URL API Photo manquante");

                const response = await fetch(apiProfilePictureUrl, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CSRF_TOKEN
                    }
                });

                const result = await response.json();

                if (result.success) {
                    if (profileImgDisplay) {
                        profileImgDisplay.classList.add('hidden');
                        profileImgDisplay.src = '#';
                    }
                    if (profileInitialsDisplay) profileInitialsDisplay.classList.remove('hidden');
                    if (btnDeletePhoto) btnDeletePhoto.classList.add('hidden');
                } else {
                    alert(`${msgErrorPrefix} ${result.message}`);
                }

            } catch (error) {
                console.error("Erreur API Suppression:", error);
                alert(msgErrorDelete);
            }
        });
    }


    // --- Fonctions Utilitaires ---

    function showMessage(message, type) {
        messageArea.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'border-green-200', 'bg-red-100', 'text-red-800', 'border-red-200');
        // MODIFICATION RTL : border-l-4 devient border-s-4
        messageArea.classList.add('border', 'border-s-4');
        
        if (type === 'success') {
            messageArea.classList.add('bg-green-50', 'text-green-800', 'border-green-500');
            // MODIFICATION RTL : mr-2 devient me-2
            messageArea.innerHTML = `<i class="fas fa-check-circle me-2"></i> ${message}`;
        } else {
            messageArea.classList.add('bg-red-50', 'text-red-800', 'border-red-500');
            // MODIFICATION RTL : mr-2 devient me-2
            messageArea.innerHTML = `<i class="fas fa-exclamation-circle me-2"></i> ${message}`;
        }
    }

    function hideMessage() {
        messageArea.classList.add('hidden');
        messageArea.textContent = '';
    }

    function resetButton(originalText) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }

});