/**
 * Gestion de la page de profil utilisateur.
 * - Changement de mot de passe via API
 * - Afficher/Masquer le mot de passe
 * - [NOUVEAU] Gestion de la photo de profil (Upload/Delete)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Récupération de la configuration injectée
    const CONFIG = window.PROFILE_CONFIG;
    
    if (!CONFIG) {
        console.error("Erreur: Configuration du profil manquante.");
        return;
    }

    // --- Éléments du Formulaire Mot de Passe ---
    const form = document.getElementById('change-password-form');
    const messageArea = document.getElementById('message-area');
    const submitBtn = document.getElementById('btn-save-password');

    // --- Éléments de la Photo de Profil ---
    const profileInput = document.getElementById('profile-image-input');
    const profileImgDisplay = document.getElementById('profile-image-display');
    const profileInitialsDisplay = document.getElementById('profile-initials-display');
    const btnDeletePhoto = document.getElementById('btn-delete-photo');

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
            
            if (newPassword.length < 4) { // J'ai remis 4 comme dans ton HTML, avant c'était 8
                showMessage("Le mot de passe doit faire au moins 4 caractères.", "error");
                resetButton(originalBtnText);
                return;
            }

            // --- D. Envoi API ---
            try {
                const response = await fetch(CONFIG.apiChangePasswordUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CONFIG.csrfToken
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
    // 3. GESTION DE LA PHOTO DE PROFIL (NOUVEAU)
    // =================================================================

    // --- A. Upload d'une nouvelle image ---
    if (profileInput) {
        profileInput.addEventListener('change', async function(e) {
            const file = e.target.files[0];
            if (!file) return;

            // Préparation des données (FormData pour envoyer des fichiers)
            const formData = new FormData();
            formData.append('profile_picture', file);

            try {
                // Petit effet visuel d'attente sur l'image (opacité)
                if(profileImgDisplay) profileImgDisplay.style.opacity = '0.5';

                const response = await fetch(CONFIG.apiProfilePictureUrl, {
                    method: 'POST',
                    headers: {
                        // NE PAS METTRE 'Content-Type': 'multipart/form-data'
                        // Le navigateur le fait automatiquement avec le bon boundary pour les fichiers
                        'X-CSRFToken': CONFIG.csrfToken
                    },
                    body: formData
                });

                const result = await response.json();

                if (result.success) {
                    // 1. Mettre à jour la source de l'image (ajout d'un timestamp pour forcer le rafraîchissement cache)
                    profileImgDisplay.src = result.new_image_url; // + '?t=' + new Date().getTime(); 
                    
                    // 2. Afficher l'image et cacher les initiales
                    profileImgDisplay.classList.remove('hidden');
                    profileInitialsDisplay.classList.add('hidden');
                    
                    // 3. Afficher le bouton supprimer
                    btnDeletePhoto.classList.remove('hidden');

                } else {
                    alert("Erreur : " + result.message);
                }

            } catch (error) {
                console.error("Erreur API Photo:", error);
                alert("Impossible de mettre à jour la photo.");
            } finally {
                // Rétablir l'opacité
                if(profileImgDisplay) profileImgDisplay.style.opacity = '1';
                // Reset de l'input pour pouvoir ré-uploader la même image si besoin
                profileInput.value = ''; 
            }
        });
    }

    // --- B. Suppression de l'image (AVEC MODAL) ---
    const deleteModal = document.getElementById('delete-photo-modal');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    // 1. Ouvrir la modale au clic sur la poubelle
    if (btnDeletePhoto) {
        btnDeletePhoto.addEventListener('click', function(e) {
            e.preventDefault();
            deleteModal.classList.remove('hidden');
        });
    }

    // 2. Action réelle de suppression au clic sur "Confirmer" dans la modale
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', async function() {
            
            // On ferme la modale tout de suite pour l'UX
            deleteModal.classList.add('hidden');

            try {
                const response = await fetch(CONFIG.apiProfilePictureUrl, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': CONFIG.csrfToken
                    }
                });

                const result = await response.json();

                if (result.success) {
                    // --- Mise à jour UI ---
                    // 1. Cacher l'image et nettoyer la source
                    profileImgDisplay.classList.add('hidden');
                    profileImgDisplay.src = '#';
                    
                    // 2. Afficher les initiales
                    profileInitialsDisplay.classList.remove('hidden');
                    
                    // 3. Cacher le bouton poubelle
                    btnDeletePhoto.classList.add('hidden');

                    // Optionnel : Petit message de succès discret
                    // alert("Photo supprimée"); ou utiliser ton showMessage() existant

                } else {
                    alert("Erreur : " + result.message);
                }

            } catch (error) {
                console.error("Erreur API Suppression:", error);
                alert("Impossible de supprimer la photo.");
            }
        });
    }


    // --- Fonctions Utilitaires (Pour le mot de passe) ---

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