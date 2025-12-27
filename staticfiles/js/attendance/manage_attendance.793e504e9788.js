// ====================================================================
// LOGIQUE JAVASCRIPT POUR LA GESTION DES ABSENCES (CPE)
// ====================================================================

document.addEventListener('DOMContentLoaded', () => {
    
    // --- ÉLÉMENTS DOM ---
    const modal = document.getElementById('justification-modal');
    const form = document.getElementById('justification-form');
    const modalTitle = document.getElementById('modal-title');
    const modalStudentName = document.getElementById('modal-student-name');
    const modalDate = document.getElementById('modal-date');
    const modalType = document.getElementById('modal-type');
    const attendanceIdInput = document.getElementById('modal-attendance-id');
    const reasonInput = document.getElementById('justification-reason');
    
    const btnCancel = document.getElementById('btn-cancel-modal');
    const btnUnjustify = document.getElementById('btn-unjustify');
    
    const notificationArea = document.getElementById('notification-area');

    // Variable pour gérer l'état de confirmation du bouton "Retirer"
    let unjustifyConfirmState = false;

    // --- 1. UTILITAIRES ---

    function showNotification(message, type) {
        const colorMap = {
            success: 'bg-green-100 text-green-800 border-green-400',
            error: 'bg-red-100 text-red-800 border-red-400',
        };
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-times-circle';

        const div = document.createElement('div');
        div.className = `p-4 rounded-xl border shadow-md ${colorMap[type]} flex items-center transition-all duration-300 opacity-0 transform translate-y-2`;
        div.innerHTML = `<i class="fas ${icon} mr-3 text-lg"></i><p class="font-semibold">${message}</p>`;

        notificationArea.appendChild(div);
        
        requestAnimationFrame(() => div.classList.remove('opacity-0', 'translate-y-2'));
        setTimeout(() => {
            div.classList.add('opacity-0', 'translate-y-2');
            div.addEventListener('transitionend', () => div.remove());
        }, 4000);
    }

    async function apiFetch(url, data) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': CSRF_TOKEN,
                },
                body: JSON.stringify(data),
            });
            const json = await response.json();
            if (!response.ok) {
                showNotification(json.message || `Erreur serveur (${response.status})`, 'error');
                return { success: false, ...json };
            }
            return json;
        } catch (error) {
            console.error("Erreur API:", error);
            showNotification("Erreur de connexion.", 'error');
            return { success: false };
        }
    }

    // --- 2. GESTION DE LA MODALE ---

    function openModal(button) {
        // Récupération des données depuis le bouton
        const id = button.dataset.id;
        const student = button.dataset.student;
        const date = button.dataset.date;
        const type = button.dataset.type;
        const justified = button.dataset.justified === 'true';
        const reason = button.dataset.reason;

        // Remplissage UI
        attendanceIdInput.value = id;
        modalStudentName.textContent = student;
        modalDate.textContent = date;
        modalType.textContent = type;
        reasonInput.value = reason;

        // Réinitialiser l'état du bouton "Retirer"
        resetUnjustifyButton();

        // Gestion état Bouton Dé-justifier
        if (justified) {
            modalTitle.textContent = "Modifier la justification";
            btnUnjustify.classList.remove('hidden');
        } else {
            modalTitle.textContent = "Justifier l'absence";
            btnUnjustify.classList.add('hidden');
        }

        // Affichage (Transition)
        modal.classList.remove('hidden');
        // Petit délai pour permettre à la classe hidden de s'enlever avant l'opacité
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div[class*="transform"]').classList.remove('scale-95');
            modal.querySelector('div[class*="transform"]').classList.add('scale-100');
        });
        
        reasonInput.focus();
    }

    function closeModal() {
        modal.classList.add('opacity-0');
        modal.querySelector('div[class*="transform"]').classList.remove('scale-100');
        modal.querySelector('div[class*="transform"]').classList.add('scale-95');
        
        setTimeout(() => {
            modal.classList.add('hidden');
            form.reset();
            resetUnjustifyButton(); // Reset du bouton en cas de fermeture sans action
        }, 300); // Correspond à la durée de transition CSS
    }

    // Fonction pour remettre le bouton "Retirer" à son état initial
    function resetUnjustifyButton() {
        unjustifyConfirmState = false;
        btnUnjustify.innerHTML = '<i class="fas fa-trash-alt mr-1"></i> Retirer la justification';
        btnUnjustify.classList.remove('bg-red-50', 'border', 'border-red-200', 'rounded', 'px-2', 'py-1');
        btnUnjustify.classList.add('text-red-600');
    }

    // Écouteurs d'ouverture (Délégation sur le tableau)
    document.getElementById('attendance-list').addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-justify');
        if (btn) {
            openModal(btn);
        }
    });

    // Écouteurs de fermeture
    btnCancel.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });


    // --- 3. ACTIONS API (JUSTIFIER / DÉ-JUSTIFIER) ---

    // A. Soumission du formulaire (JUSTIFIER)
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const attendanceId = attendanceIdInput.value;
        const reason = reasonInput.value;

        if (!reason.trim()) {
            showNotification("Veuillez entrer un motif.", "error");
            return;
        }

        const result = await apiFetch(API_URLS.JUSTIFY, {
            attendance_id: attendanceId,
            justified: true,
            reason: reason
        });

        if (result.success) {
            updateRowUI(attendanceId, true, reason, result.justification_date);
            showNotification(result.message, 'success');
            closeModal();
        }
    });

    // B. Clic sur "Retirer la justification"
    // [MODIFIÉ] Gestion de la confirmation en 2 étapes sur le bouton lui-même
    btnUnjustify.addEventListener('click', async () => {
        
        if (!unjustifyConfirmState) {
            // Étape 1 : Demande de confirmation
            unjustifyConfirmState = true;
            btnUnjustify.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i> Confirmer le retrait ?';
            
            // Changement visuel pour attirer l'attention
            btnUnjustify.classList.remove('text-red-600');
            btnUnjustify.classList.add('bg-red-50', 'border', 'border-red-200', 'rounded', 'px-2', 'py-1', 'text-red-700', 'font-bold');
            
            return; // On arrête ici, on attend le deuxième clic
        }

        // Étape 2 : L'utilisateur a cliqué une deuxième fois (Confirmation)
        const attendanceId = attendanceIdInput.value;

        const result = await apiFetch(API_URLS.JUSTIFY, {
            attendance_id: attendanceId,
            justified: false,
            reason: ""
        });

        if (result.success) {
            updateRowUI(attendanceId, false, "", null);
            showNotification(result.message, 'success');
            closeModal();
        }
    });


    // --- 4. MISE À JOUR DU DOM (SANS RECHARGEMENT) ---

    function updateRowUI(attendanceId, isJustified, reason, dateStr) {
        const row = document.querySelector(`.record-row[data-id="${attendanceId}"]`);
        if (!row) return;

        // 1. Mise à jour de la colonne Statut
        const statusCell = row.querySelector('.status-cell');
        if (isJustified) {
            statusCell.innerHTML = `
                <div class="text-green-600 font-medium flex items-center">
                    <i class="fas fa-check-circle mr-2"></i> Justifié
                </div>
            `;
        } else {
            statusCell.innerHTML = `
                <div class="text-red-500 font-medium flex items-center">
                    <i class="fas fa-times-circle mr-2"></i> Non justifié
                </div>
            `;
        }

        // 2. Mise à jour du bouton d'action
        const btn = row.querySelector('.btn-justify');
        if (btn) {
            // Met à jour les data-attributes pour la prochaine ouverture
            btn.dataset.justified = isJustified;
            btn.dataset.reason = reason;
            
            // Change le texte du bouton
            btn.textContent = isJustified ? "Modifier" : "Justifier";
        }
    }

});