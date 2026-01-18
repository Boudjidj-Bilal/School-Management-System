/**
 * manage_attendance.js
 * Logique de gestion des justifications d'absence (CPE/Admin)
 * Mode Production Safe
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------------------------
    // 1. CONFIGURATION & RÉFÉRENCES (Extraction DOM)
    // ----------------------------------------------------------------------

    // Conteneur principal
    const container = document.getElementById('manage-attendance-container');
    if (!container) {
        console.error("Erreur critique : Le conteneur #manage-attendance-container est introuvable.");
        return;
    }

    // Récupération de l'URL API
    const API_JUSTIFY_URL = container.dataset.apiJustifyUrl;

    // Récupération du CSRF Token
    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    if (!API_JUSTIFY_URL || !CSRF_TOKEN) {
        console.error("Configuration manquante (API URL ou CSRF).");
    }

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


    // ----------------------------------------------------------------------
    // 2. UTILITAIRES
    // ----------------------------------------------------------------------

    function showNotification(message, type) {
        const colorMap = {
            success: 'bg-green-100 text-green-800 border-green-400',
            error: 'bg-red-100 text-red-800 border-red-400',
        };
        const icon = type === 'success' ? 'fa-check-circle' : 'fa-times-circle';

        const div = document.createElement('div');
        div.className = `p-4 rounded-xl border shadow-md ${colorMap[type]} flex items-center transition-all duration-300 opacity-0 transform translate-y-2`;
        div.innerHTML = `<i class="fas ${icon} mr-3 text-lg"></i><p class="font-semibold">${message}</p>`;

        if (notificationArea) {
            notificationArea.appendChild(div);
            
            requestAnimationFrame(() => div.classList.remove('opacity-0', 'translate-y-2'));
            setTimeout(() => {
                div.classList.add('opacity-0', 'translate-y-2');
                div.addEventListener('transitionend', () => div.remove());
            }, 4000);
        } else {
            alert(message);
        }
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
            
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const json = await response.json();
                if (!response.ok) {
                    showNotification(json.message || `Erreur serveur (${response.status})`, 'error');
                    return { success: false, ...json };
                }
                return json;
            } else {
                showNotification(`Erreur critique serveur (${response.status})`, 'error');
                return { success: false };
            }

        } catch (error) {
            console.error("Erreur API:", error);
            showNotification("Erreur de connexion.", 'error');
            return { success: false };
        }
    }


    // ----------------------------------------------------------------------
    // 3. GESTION DE LA MODALE
    // ----------------------------------------------------------------------

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
        requestAnimationFrame(() => {
            modal.classList.remove('opacity-0');
            const modalPanel = modal.querySelector('div[class*="transform"]');
            if(modalPanel) {
                modalPanel.classList.remove('scale-95');
                modalPanel.classList.add('scale-100');
            }
        });
        
        reasonInput.focus();
    }

    function closeModal() {
        modal.classList.add('opacity-0');
        const modalPanel = modal.querySelector('div[class*="transform"]');
        if(modalPanel) {
            modalPanel.classList.remove('scale-100');
            modalPanel.classList.add('scale-95');
        }
        
        setTimeout(() => {
            modal.classList.add('hidden');
            form.reset();
            resetUnjustifyButton(); 
        }, 300);
    }

    function resetUnjustifyButton() {
        unjustifyConfirmState = false;
        btnUnjustify.innerHTML = '<i class="fas fa-trash-alt mr-1"></i> Retirer la justification';
        btnUnjustify.classList.remove('bg-red-50', 'border', 'border-red-200', 'rounded', 'px-2', 'py-1', 'text-red-700', 'font-bold');
        btnUnjustify.classList.add('text-red-600');
    }

    // Écouteurs d'ouverture (Délégation sur le tableau)
    const list = document.getElementById('attendance-list');
    if (list) {
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-justify');
            if (btn) {
                openModal(btn);
            }
        });
    }

    // Écouteurs de fermeture
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }


    // ----------------------------------------------------------------------
    // 4. ACTIONS API (JUSTIFIER / DÉ-JUSTIFIER)
    // ----------------------------------------------------------------------

    // A. Soumission du formulaire (JUSTIFIER)
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const attendanceId = attendanceIdInput.value;
            const reason = reasonInput.value;

            if (!reason.trim()) {
                showNotification("Veuillez entrer un motif.", "error");
                return;
            }

            const result = await apiFetch(API_JUSTIFY_URL, {
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
    }

    // B. Clic sur "Retirer la justification"
    if (btnUnjustify) {
        btnUnjustify.addEventListener('click', async () => {
            
            if (!unjustifyConfirmState) {
                // Étape 1 : Demande de confirmation
                unjustifyConfirmState = true;
                btnUnjustify.innerHTML = '<i class="fas fa-exclamation-triangle mr-1"></i> Confirmer le retrait ?';
                
                btnUnjustify.classList.remove('text-red-600');
                btnUnjustify.classList.add('bg-red-50', 'border', 'border-red-200', 'rounded', 'px-2', 'py-1', 'text-red-700', 'font-bold');
                
                return; // On arrête ici
            }

            // Étape 2 : Confirmation
            const attendanceId = attendanceIdInput.value;

            const result = await apiFetch(API_JUSTIFY_URL, {
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
    }


    // ----------------------------------------------------------------------
    // 5. MISE À JOUR DU DOM (SANS RECHARGEMENT)
    // ----------------------------------------------------------------------

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