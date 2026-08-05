/**
 * manage_attendance.js
 * Logique de gestion des justifications d'absence (CPE/Admin)
 * Mode Production Safe, Multilingue & RTL
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------------------------
    // 1. CONFIGURATION & RÉFÉRENCES (Extraction DOM)
    // ----------------------------------------------------------------------

    const container = document.getElementById('manage-attendance-container');
    if (!container) {
        console.error("Erreur critique : Le conteneur #manage-attendance-container est introuvable.");
        return;
    }

    // Récupération de l'URL API
    const API_JUSTIFY_URL = container.dataset.apiJustifyUrl;

    // Récupération des traductions dynamiques (data-attributes)
    const msgModalTitleEdit = container.getAttribute('data-msg-modal-title-edit') || "Modifier la justification";
    const msgModalTitleAdd = container.getAttribute('data-msg-modal-title-add') || "Justifier l'absence";
    const msgUnjustifyConfirm = container.getAttribute('data-msg-unjustify-confirm') || "Confirmer le retrait ?";
    const msgUnjustifyDefault = container.getAttribute('data-msg-unjustify-default') || "Retirer la justification";
    const msgBtnEdit = container.getAttribute('data-msg-btn-edit') || "Modifier";
    const msgBtnAdd = container.getAttribute('data-msg-btn-add') || "Justifier";
    const msgStatusJustified = container.getAttribute('data-msg-status-justified') || "Justifié";
    const msgStatusUnjustified = container.getAttribute('data-msg-status-unjustified') || "Non justifié";
    const msgErrorReason = container.getAttribute('data-msg-error-reason') || "Veuillez entrer un motif.";
    const msgErrorConn = container.getAttribute('data-msg-error-conn') || "Erreur de connexion.";

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
        // Séparation icône + texte avec gap-3
        div.className = `p-4 rounded-xl border shadow-md ${colorMap[type]} flex items-center gap-3 transition-all duration-300 opacity-0 transform translate-y-2`;
        div.innerHTML = `<i class="fas ${icon} text-lg flex-shrink-0"></i><p class="font-semibold flex-1" dir="auto">${escapeHtml(message)}</p>`;

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
            showNotification(msgErrorConn, 'error');
            return { success: false };
        }
    }


    // ----------------------------------------------------------------------
    // 3. GESTION DE LA MODALE
    // ----------------------------------------------------------------------

    function openModal(button) {
        const id = button.dataset.id;
        const student = button.dataset.student;
        const date = button.dataset.date;
        const type = button.dataset.type;
        const justified = button.dataset.justified === 'true';
        const reason = button.dataset.reason;

        attendanceIdInput.value = id;
        modalStudentName.textContent = student;
        modalDate.textContent = date;
        modalType.textContent = type;
        reasonInput.value = reason;

        resetUnjustifyButton();

        if (justified) {
            modalTitle.textContent = msgModalTitleEdit;
            btnUnjustify.classList.remove('hidden');
            btnUnjustify.classList.add('inline-flex');
        } else {
            modalTitle.textContent = msgModalTitleAdd;
            btnUnjustify.classList.add('hidden');
            btnUnjustify.classList.remove('inline-flex');
        }

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
        btnUnjustify.innerHTML = `<i class="fas fa-trash-alt"></i><span>${msgUnjustifyDefault}</span>`;
        btnUnjustify.classList.remove('bg-red-50', 'border', 'border-red-200', 'rounded', 'px-2', 'py-1', 'text-red-700', 'font-bold');
        btnUnjustify.classList.add('text-red-600');
    }

    const list = document.getElementById('attendance-list');
    if (list) {
        list.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-justify');
            if (btn) {
                openModal(btn);
            }
        });
    }

    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }


    // ----------------------------------------------------------------------
    // 4. ACTIONS API (JUSTIFIER / DÉ-JUSTIFIER)
    // ----------------------------------------------------------------------

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const attendanceId = attendanceIdInput.value;
            const reason = reasonInput.value;

            if (!reason.trim()) {
                showNotification(msgErrorReason, "error");
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

    if (btnUnjustify) {
        btnUnjustify.addEventListener('click', async () => {
            
            if (!unjustifyConfirmState) {
                unjustifyConfirmState = true;
                btnUnjustify.innerHTML = `<i class="fas fa-exclamation-triangle"></i><span>${msgUnjustifyConfirm}</span>`;
                
                btnUnjustify.classList.remove('text-red-600');
                btnUnjustify.classList.add('bg-red-50', 'border', 'border-red-200', 'rounded', 'px-2', 'py-1', 'text-red-700', 'font-bold');
                
                return;
            }

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

        const statusCell = row.querySelector('.status-cell');
        if (isJustified) {
            statusCell.innerHTML = `
                <div class="text-green-600 font-medium inline-flex items-center gap-2">
                    <i class="fas fa-check-circle"></i> 
                    <span>${msgStatusJustified}</span>
                </div>
            `;
        } else {
            statusCell.innerHTML = `
                <div class="text-red-500 font-medium inline-flex items-center gap-2">
                    <i class="fas fa-times-circle"></i> 
                    <span>${msgStatusUnjustified}</span>
                </div>
            `;
        }

        const btn = row.querySelector('.btn-justify');
        if (btn) {
            btn.dataset.justified = isJustified;
            btn.dataset.reason = reason;
            btn.textContent = isJustified ? msgBtnEdit : msgBtnAdd;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

});