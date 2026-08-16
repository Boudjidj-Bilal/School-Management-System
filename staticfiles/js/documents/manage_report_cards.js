/**
 * Gestion de l'interface des bulletins (Modales, Confirmation).
 * VERSION SÉCURISÉE (CSP Compliant) & MULTILINGUE.
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Récupération des traductions dynamiques ---
    // (Tu pourras ajouter ces attributs data-msg-* dans la balise body ou le conteneur principal si besoin, 
    // ou laisser ces valeurs par défaut en dur dans le JS)
    const container = document.getElementById('message-processing');
    const msgProcessing = container ? container.getAttribute('data-msg-processing') : 'Traitement...';

    // --- Éléments du DOM ---
    const modal = document.getElementById('confirm-modal');
    const form = document.getElementById('generate-form');
    const confirmBtn = document.getElementById('confirm-btn');
    const openBtn = document.getElementById('btn-open-generate-modal');
    const cancelBtn = document.getElementById('btn-cancel-modal');
    const overlay = document.getElementById('modal-overlay');
    const backBtn = document.getElementById('btn-back');

    // --- Fonctions ---

    function openModal() {
        if (modal) modal.classList.remove('hidden');
    }

    function closeModal() {
        if (modal) modal.classList.add('hidden');
    }

    // --- Écouteurs d'événements ---

    // 1. Bouton "Générer" (Ouvrir modale)
    if (openBtn) {
        openBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    }

    // 2. Boutons de fermeture (Annuler / Overlay)
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
    }
    if (overlay) {
        overlay.addEventListener('click', closeModal);
    }

    // 3. Fermeture via la touche Echap
    document.addEventListener('keydown', (event) => {
        if (event.key === "Escape") {
            closeModal();
        }
    });

    // 4. Action de Confirmation (Soumission)
    if (confirmBtn && form) {
        confirmBtn.addEventListener('click', function() {
            // Feedback visuel (avec flex et gap-2)
            this.innerHTML = `<div class="inline-flex items-center gap-2"><i class="fas fa-spinner fa-spin"></i><span>${msgProcessing}</span></div>`;
            this.disabled = true;
            this.classList.add('opacity-50', 'cursor-not-allowed');
            
            // Soumission
            form.submit();
        });
    }

    // 5. Bouton Retour
    if (backBtn) {
        backBtn.addEventListener('click', (e) => {
            e.preventDefault();
            history.back();
        });
    }

});