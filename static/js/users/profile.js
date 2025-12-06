/**
 * Gestion de la page de profil utilisateur.
 * - Changement de mot de passe via API
 * - Afficher/Masquer le mot de passe (Toggle visibility)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // Récupération de la configuration injectée
    const CONFIG = window.PROFILE_CONFIG;
    
    if (!CONFIG) {
        console.error("Erreur: Configuration du profil manquante.");
        return;
    }

    const form = document.getElementById('change-password-form');
    const messageArea = document.getElementById('message-area');
    const submitBtn = document.getElementById('btn-save-password');
    
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
    // 2. SOUMISSION DU FORMULAIRE (AJAX)
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
            
            if (newPassword.length < 8) {
                showMessage("Le mot de passe doit faire au moins 8 caractères.", "error");
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
                    // Succès
                    showMessage(result.message, "success");
                    form.reset(); // Vider le formulaire
                } else {
                    // Erreur métier (ex: mauvais mot de passe actuel)
                    showMessage(result.message, "error");
                }

            } catch (error) {
                console.error("Erreur API:", error);
                showMessage("Une erreur technique est survenue.", "error");
            } finally {
                resetButton(originalBtnText);
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