/**
 * Gestion de la page de profil utilisateur.
 * - Changement de mot de passe via API
 * - Afficher/Masquer le mot de passe
 * - Gestion de la photo de profil (Upload/Delete)
 * * VERSION SÉCURISÉE (CSP Compliant) :
 * - Plus de dépendance à window.PROFILE_CONFIG
 * - Récupération des URLs via data-attributes
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
    const triggerUploadBtn = document.getElementById('trigger-upload-btn'); // Bouton caméra

    // URLs API (récupérées depuis les data-attributes)
    const apiChangePasswordUrl = form ? form.getAttribute('data-api-url') : null;
    const apiProfilePictureUrl = profileInput ? profileInput.getAttribute('data-api-url') : null;

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
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> Traitement...';
            
            // --- B. Récupération des données ---
            const currentPassword = document.getElementById('current_password').value;
            const newPassword = document.getElementById('new_password').value;
            const confirmPassword = document.getElementById('confirm_password').value;

            // --- C. Validation Client basique ---
            if (newPassword !== confirmPassword) {
                showMessage("Les nouveaux mots de passe ne correspondent pas.", "error");
                resetButton(originalBtnText);
                return;
            }
            
            if (newPassword.length < 4) {
                showMessage("Le mot de passe doit faire au moins 4 caractères.", "error");
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
                    showMessage(result.message, "success");
                    form.reset(); 
                } else {
                    showMessage(result.message, "error");
                }

            } catch (error) {
                console.error("Erreur API MDP:", error);
                showMessage("Une erreur technique est survenue.", "error");
            } finally {
                resetButton(originalBtnText);
            }
        });
    }

    // =================================================================
    // 3. GESTION DE LA PHOTO DE PROFIL
    // =================================================================

    // --- A. Trigger Upload (Clic sur l'icône caméra) ---
    // Remplace le onclick="..." qui a été supprimé du HTML
    if (triggerUploadBtn && profileInput) {
        triggerUploadBtn.addEventListener('click', () => {
            profileInput.click();
        });
    }

    // --- B. Upload d'une nouvelle image ---
    if (profileInput) {
        profileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Préparation des données
            const formData = new FormData();
            formData.append('profile_picture', file);

            try {
                if (!apiProfilePictureUrl) throw new Error("URL API Photo manquante");

                // Petit effet visuel d'attente
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
                    // 1. Mettre à jour la source
                    profileImgDisplay.src = result.new_image_url; 
                    
                    // 2. Afficher l'image et cacher les initiales
                    profileImgDisplay.classList.remove('hidden');
                    if (profileInitialsDisplay) profileInitialsDisplay.classList.add('hidden');
                    
                    // 3. Afficher le bouton supprimer
                    if (btnDeletePhoto) btnDeletePhoto.classList.remove('hidden');

                } else {
                    alert("Erreur : " + result.message);
                }

            } catch (error) {
                console.error("Erreur API Photo:", error);
                alert("Impossible de mettre à jour la photo.");
            } finally {
                if(profileImgDisplay) profileImgDisplay.style.opacity = '1';
                profileInput.value = ''; 
            }
        });
    }

    // --- C. Suppression de l'image (AVEC MODAL) ---
    const deleteModal = document.getElementById('delete-photo-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
    const modalCancelBtn = document.getElementById('modal-cancel-btn');

    // 1. Ouvrir la modale
    if (btnDeletePhoto) {
        btnDeletePhoto.addEventListener('click', function(e) {
            e.preventDefault();
            if (deleteModal) deleteModal.classList.remove('hidden');
        });
    }

    // 2. Fermer la modale (Nouveau gestionnaire pour le bouton Annuler)
    if (modalCancelBtn && deleteModal) {
        modalCancelBtn.addEventListener('click', () => {
            deleteModal.classList.add('hidden');
        });
    }

    // 3. Action réelle de suppression
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
                    // Mise à jour UI
                    if (profileImgDisplay) {
                        profileImgDisplay.classList.add('hidden');
                        profileImgDisplay.src = '#';
                    }
                    
                    if (profileInitialsDisplay) profileInitialsDisplay.classList.remove('hidden');
                    
                    if (btnDeletePhoto) btnDeletePhoto.classList.add('hidden');

                } else {
                    alert("Erreur : " + result.message);
                }

            } catch (error) {
                console.error("Erreur API Suppression:", error);
                alert("Impossible de supprimer la photo.");
            }
        });
    }


    // --- Fonctions Utilitaires ---

    function showMessage(message, type) {
        messageArea.classList.remove('hidden', 'bg-green-100', 'text-green-800', 'border-green-200', 'bg-red-100', 'text-red-800', 'border-red-200');
        messageArea.classList.add('border', 'border-l-4');
        
        if (type === 'success') {
            messageArea.classList.add('bg-green-50', 'text-green-800', 'border-green-500');
            messageArea.innerHTML = `<i class="fas fa-check-circle mr-2"></i> ${message}`;
        } else {
            messageArea.classList.add('bg-red-50', 'text-red-800', 'border-red-500');
            messageArea.innerHTML = `<i class="fas fa-exclamation-circle mr-2"></i> ${message}`;
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