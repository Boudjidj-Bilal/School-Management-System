/**
 * create_session.js
 * Logique de saisie d'appel (Mode Production Safe, Multilingue & RTL)
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ----------------------------------------------------------------------
    // 1. CONFIGURATION & RÉFÉRENCES (Extraction depuis le DOM)
    // ----------------------------------------------------------------------

    const container = document.getElementById('attendance-container');
    if (!container) {
        console.error("Erreur critique : Le conteneur #attendance-container est introuvable.");
        return;
    }

    const CLASS_ID = container.dataset.classId;
    const API_URLS = {
        SAVE_SESSION: container.dataset.apiSaveUrl,
        GET_DETAILS: container.dataset.apiDetailsUrl
    };

    // Récupération des traductions dynamiques (data-attributes)
    const msgSaving = container.getAttribute('data-msg-saving') || "Enregistrement...";
    const msgSaveSuccess = container.getAttribute('data-msg-save-success') || "Appel enregistré avec succès !";
    const msgTermClosed = container.getAttribute('data-msg-term-closed') || "Ce trimestre est clos, modification impossible.";
    const msgEditBtn = container.getAttribute('data-msg-btn-edit') || "Modifier l'appel";
    const msgSessionLoaded = container.getAttribute('data-msg-session-loaded') || "Session chargée pour modification.";
    const msgCreateMode = container.getAttribute('data-msg-create-mode') || "Mode création activé.";
    const msgJustifiedBadge = container.getAttribute('data-msg-justified-badge') || "Absence justifiée (CPE)";
    const msgConnError = container.getAttribute('data-msg-conn-error') || "Erreur de connexion.";
    const msgSaveBtnDefault = container.getAttribute('data-msg-btn-save') || "Enregistrer l'appel";

    const csrfInput = document.querySelector('[name=csrfmiddlewaretoken]');
    const CSRF_TOKEN = csrfInput ? csrfInput.value : '';

    if (!CLASS_ID || !API_URLS.SAVE_SESSION || !CSRF_TOKEN) {
        console.error("Configuration manquante (ID classe, API URLs ou CSRF).");
    }

    // --- ÉLÉMENTS DOM ---
    const form = document.getElementById('attendance-form');
    const sessionIdInput = document.getElementById('session-id');
    const dateInput = document.getElementById('date');
    const startTimeInput = document.getElementById('start_time');
    const endTimeInput = document.getElementById('end_time');
    const submitBtn = document.getElementById('submit-btn');
    const newSessionBtn = document.getElementById('btn-new-session');
    const notificationArea = document.getElementById('notification-area');
    const historyItems = document.querySelectorAll('.history-item');


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
            showNotification(msgConnError, 'error');
            return { success: false };
        }
    }


    // ----------------------------------------------------------------------
    // 3. GESTION DU FORMULAIRE (ENREGISTREMENT)
    // ----------------------------------------------------------------------

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const originalText = submitBtn.innerHTML;
            submitBtn.disabled = true;
            // Séparation icône + texte avec gap-2
            submitBtn.innerHTML = `<div class="inline-flex items-center gap-2 justify-center w-full"><i class="fas fa-spinner fa-spin"></i><span>${msgSaving}</span></div>`;

            const payload = {
                session_id: sessionIdInput.value || null,
                class_id: CLASS_ID, 
                date: dateInput.value,
                start_time: startTimeInput.value,
                end_time: endTimeInput.value,
                attendances: []
            };

            document.querySelectorAll('.student-row').forEach(row => {
                const studentId = row.dataset.studentId;
                const checkedRadio = row.querySelector(`input[name="status_${studentId}"]:checked`);
                
                if (checkedRadio && !checkedRadio.disabled) {
                    payload.attendances.push({
                        student_id: studentId,
                        status: checkedRadio.value
                    });
                }
            });

            const result = await apiFetch(API_URLS.SAVE_SESSION, payload);

            if (result.success) {
                showNotification(msgSaveSuccess, 'success');
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            }
        });
    }


    // ----------------------------------------------------------------------
    // 4. CHARGEMENT D'UNE SESSION (HISTORIQUE)
    // ----------------------------------------------------------------------

    if (historyItems) {
        historyItems.forEach(item => {
            item.addEventListener('click', async () => {
                if (item.querySelector('.fa-lock')) {
                    showNotification(msgTermClosed, "error");
                    return;
                }

                const sessionId = item.dataset.sessionId;
                loadSession(sessionId);
            });
        });
    }

    async function loadSession(sessionId) {
        historyItems.forEach(i => i.classList.remove('bg-indigo-50', 'border-indigo-200', 'ring-2', 'ring-indigo-300'));
        const activeItem = document.querySelector(`.history-item[data-session-id="${sessionId}"]`);
        if (activeItem) activeItem.classList.add('bg-indigo-50', 'border-indigo-200', 'ring-2', 'ring-indigo-300');

        const result = await apiFetch(API_URLS.GET_DETAILS, { session_id: sessionId });

        if (result.success) {
            const data = result.data;

            sessionIdInput.value = data.id;
            dateInput.value = data.date;
            startTimeInput.value = data.start_time;
            endTimeInput.value = data.end_time;

            submitBtn.classList.remove('bg-green-600', 'hover:bg-green-700');
            submitBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
            // Séparation icône + texte avec gap-2
            submitBtn.innerHTML = `<div class="inline-flex items-center gap-2 justify-center w-full"><i class="fas fa-edit"></i><span>${msgEditBtn}</span></div>`;

            const attendancesMap = data.attendances || {};

            document.querySelectorAll('.student-row').forEach(row => {
                const studentId = row.dataset.studentId;
                const studentData = attendancesMap[studentId];
                
                resetStudentRow(row);

                if (studentData) {
                    const radioToCheck = row.querySelector(`input[name="status_${studentId}"][value="${studentData.status}"]`);
                    if (radioToCheck) radioToCheck.checked = true;

                    if (studentData.justified) {
                        lockStudentRow(row, msgJustifiedBadge);
                    }
                } else {
                    const radioPresent = row.querySelector(`input[name="status_${studentId}"][value=""]`);
                    if (radioPresent) radioPresent.checked = true;
                }
            });

            showNotification(msgSessionLoaded, "success");
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }


    // ----------------------------------------------------------------------
    // 5. GESTION DU NOUVEL APPEL (RESET)
    // ----------------------------------------------------------------------

    if (newSessionBtn) {
        newSessionBtn.addEventListener('click', () => {
            sessionIdInput.value = "";
            
            submitBtn.classList.add('bg-green-600', 'hover:bg-green-700');
            submitBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            // Séparation icône + texte avec gap-2
            submitBtn.innerHTML = `<div class="inline-flex items-center gap-2 justify-center w-full"><i class="fas fa-save"></i><span>${msgSaveBtnDefault}</span></div>`;

            historyItems.forEach(i => i.classList.remove('bg-indigo-50', 'border-indigo-200', 'ring-2', 'ring-indigo-300'));

            document.querySelectorAll('.student-row').forEach(row => {
                resetStudentRow(row);
                const radioPresent = row.querySelector(`input[value=""]`);
                if (radioPresent) radioPresent.checked = true;
            });

            showNotification(msgCreateMode, "success");
        });
    }


    // ----------------------------------------------------------------------
    // 6. HELPERS UI
    // ----------------------------------------------------------------------

    function resetStudentRow(row) {
        row.querySelectorAll('input[type="radio"]').forEach(input => {
            input.disabled = false;
            input.parentElement.classList.remove('opacity-50', 'cursor-not-allowed');
        });

        const badge = row.querySelector('.justification-badge');
        if (badge) {
            badge.classList.add('hidden');
            badge.textContent = '';
        }
        
        row.classList.remove('bg-gray-100');
    }

    function lockStudentRow(row, message) {
        row.querySelectorAll('input[type="radio"]').forEach(input => {
            input.disabled = true;
            input.parentElement.classList.add('opacity-50', 'cursor-not-allowed');
        });

        const badge = row.querySelector('.justification-badge');
        if (badge) {
            badge.textContent = message;
            badge.classList.remove('hidden');
            badge.classList.add('bg-green-100', 'text-green-800', 'border-green-200');
        }

        row.classList.add('bg-gray-50');
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

});